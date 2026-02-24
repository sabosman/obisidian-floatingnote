import {
  App,
  moment,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
} from "obsidian";

// Extend the Obsidian App type to include popout window API
declare module "obsidian" {
  interface Workspace {
    openPopoutLeaf(options?: { size?: { width: number; height: number } }): WorkspaceLeaf;
  }
}

interface FloatingNoteSettings {
  noteFolder: string;
  noteTitleFormat: string;
  windowWidth: number;
  windowHeight: number;
  defaultNoteContent: string;
  alwaysOnTop: boolean;
  opacity: number;
}

const LEGACY_DEFAULT_SETTINGS = {
  noteFolder: "Call Notes",
  noteTitleFormat: "Call - YYYY-MM-DD HH[h]mm",
  defaultNoteContent: "# 📞 Call Notes\n\n**Date:** {{date}}\n\n---\n\n",
};

const DEFAULT_SETTINGS: FloatingNoteSettings = {
  noteFolder: "Quick Notes",
  noteTitleFormat: "[Quick] - YYYY-MM-DD HH[h]mm",
  windowWidth: 480,
  windowHeight: 600,
  defaultNoteContent: "# 📌 Quick Notes\n\n**Date:** {{date}}\n\n---\n\n",
  alwaysOnTop: true,
  opacity: 100,
};

export default class FloatingNotePlugin extends Plugin {
  settings: FloatingNoteSettings;

  async onload() {
    await this.loadSettings();

    // Command: Open a fresh floating quick note (new file each time)
    this.addCommand({
      id: "open-floating-quick-note",
      name: "Open new floating quick note",
      callback: () => this.openFloatingNote(true),
    });

    // Command: Open today's quick note in a floating window (reuse same file)
    this.addCommand({
      id: "open-todays-floating-quick-note",
      name: "Open today's quick note (floating)",
      callback: () => this.openFloatingNote(false),
    });

    // Ribbon icon for quick access
    this.addRibbonIcon("pin", "Open new floating quick note", () => {
      this.openFloatingNote(true);
    });

    // Settings tab
    this.addSettingTab(new FloatingNoteSettingTab(this.app, this));
  }

  async openFloatingNote(createNew: boolean) {
    const file = createNew
      ? await this.createNewQuickNote()
      : await this.getOrCreateTodaysQuickNote();

    if (!file) {
      new Notice("❌ Failed to create/find quick note.");
      return;
    }

    // Open a new popout (detached) window
    const leaf = this.app.workspace.openPopoutLeaf({
      size: {
        width: this.settings.windowWidth,
        height: this.settings.windowHeight,
      },
    });

    await leaf.openFile(file, { active: true });

    // Give Electron a moment to create and focus the new window
    setTimeout(() => {
      this.lightenPopoutHeaderBar(leaf);
      this.applyWindowSettings();
    }, 200);
  }

  private lightenPopoutHeaderBar(leaf: WorkspaceLeaf) {
    const popoutDoc = leaf.view?.containerEl?.ownerDocument;
    if (!popoutDoc) return;

    const root = popoutDoc.documentElement;
    root.style.setProperty("--titlebar-background", "var(--background-secondary-alt)");
    root.style.setProperty(
      "--titlebar-background-focused",
      "var(--background-secondary-alt)"
    );
  }

  private applyWindowSettings() {
    try {
      // Access Electron's remote API (available in Obsidian's Electron context)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { remote } = require("electron") as typeof import("electron") & {
        remote: {
          BrowserWindow: {
            getFocusedWindow(): {
              setAlwaysOnTop(flag: boolean, level?: string): void;
              setVisibleOnAllWorkspaces(flag: boolean): void;
              setOpacity(opacity: number): void;
              setTitle(title: string): void;
            } | null;
          };
        };
      };

      const win = remote?.BrowserWindow?.getFocusedWindow();

      if (win) {
        if (this.settings.alwaysOnTop) {
          // 'floating' level keeps it above most windows but below system UI
          win.setAlwaysOnTop(true, "floating");
          // Makes it visible across all macOS Spaces / virtual desktops
          win.setVisibleOnAllWorkspaces(true);
        }

        if (this.settings.opacity < 100) {
          win.setOpacity(this.settings.opacity / 100);
        }

        win.setTitle("📌 Quick Notes");
      } else {
        // Fallback: try @electron/remote (Obsidian 1.x+)
        this.tryElectronRemote();
      }
    } catch (e) {
      // Try the newer @electron/remote approach
      this.tryElectronRemote();
    }
  }

  private tryElectronRemote() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { BrowserWindow } = require("@electron/remote") as {
        BrowserWindow: {
          getFocusedWindow(): {
            setAlwaysOnTop(flag: boolean, level?: string): void;
            setVisibleOnAllWorkspaces(flag: boolean): void;
            setOpacity(opacity: number): void;
          } | null;
        };
      };

      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        if (this.settings.alwaysOnTop) {
          win.setAlwaysOnTop(true, "floating");
          win.setVisibleOnAllWorkspaces(true);
        }
        if (this.settings.opacity < 100) {
          win.setOpacity(this.settings.opacity / 100);
        }
      }
    } catch (err) {
      new Notice(
        "⚠️ Could not set always-on-top. Your Obsidian version may not support this.",
        5000
      );
      console.error("FloatingNote: Electron remote error", err);
    }
  }

  private async createNewQuickNote(): Promise<TFile | null> {
    const folder = this.settings.noteFolder;
    const title = moment().format(this.settings.noteTitleFormat);
    const path = folder ? `${folder}/${title}.md` : `${title}.md`;
    const content = this.settings.defaultNoteContent.replace(
      "{{date}}",
      moment().format("YYYY-MM-DD HH:mm")
    );

    await this.ensureFolderExists(folder);

    // Try the base path first, then (2), (3), … until a free slot is found.
    const MAX_ATTEMPTS = 100;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const suffix = attempt === 1 ? "" : ` (${attempt})`;
      const candidate = folder
        ? `${folder}/${title}${suffix}.md`
        : `${title}${suffix}.md`;
      try {
        return await this.app.vault.create(candidate, content);
      } catch {
        // File already exists – try the next suffix.
      }
    }
    new Notice("❌ Could not create a unique note file after many attempts.");
    return null;
  }

  private async getOrCreateTodaysQuickNote(): Promise<TFile | null> {
    const folder = this.settings.noteFolder;
    const title = moment().format("YYYY-MM-DD") + " Quick Notes";
    const path = folder ? `${folder}/${title}.md` : `${title}.md`;

    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      return existing;
    }

    const content = this.settings.defaultNoteContent.replace(
      "{{date}}",
      moment().format("YYYY-MM-DD")
    );

    await this.ensureFolderExists(folder);
    return await this.app.vault.create(path, content);
  }

  private async ensureFolderExists(folder: string) {
    if (!folder) return;
    const existing = this.app.vault.getAbstractFileByPath(folder);
    if (!existing) {
      await this.app.vault.createFolder(folder);
    }
  }

  async loadSettings() {
    const savedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);

    let migrated = false;
    if (this.settings.noteFolder === LEGACY_DEFAULT_SETTINGS.noteFolder) {
      this.settings.noteFolder = DEFAULT_SETTINGS.noteFolder;
      migrated = true;
    }
    if (this.settings.noteTitleFormat === LEGACY_DEFAULT_SETTINGS.noteTitleFormat) {
      this.settings.noteTitleFormat = DEFAULT_SETTINGS.noteTitleFormat;
      migrated = true;
    }
    // Earlier quick-note default used an unescaped literal and produced odd filenames.
    if (this.settings.noteTitleFormat === "Quick - YYYY-MM-DD HH[h]mm") {
      this.settings.noteTitleFormat = DEFAULT_SETTINGS.noteTitleFormat;
      migrated = true;
    }
    // Common plain-text format that Moment mutates (e.g., "Note" -> "ADot2").
    if (this.settings.noteTitleFormat === "Note") {
      this.settings.noteTitleFormat = "[Note]";
      migrated = true;
    }
    if (this.settings.defaultNoteContent === LEGACY_DEFAULT_SETTINGS.defaultNoteContent) {
      this.settings.defaultNoteContent = DEFAULT_SETTINGS.defaultNoteContent;
      migrated = true;
    }

    if (migrated) {
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class FloatingNoteSettingTab extends PluginSettingTab {
  plugin: FloatingNotePlugin;

  constructor(app: App, plugin: FloatingNotePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Floating Quick Note Settings" });

    // ── Note settings ──────────────────────────────────────────────────────

    new Setting(containerEl)
      .setName("Notes folder")
      .setDesc("Folder where quick notes are saved. Leave blank for vault root.")
      .addText((text) =>
        text
          .setPlaceholder("Quick Notes")
          .setValue(this.plugin.settings.noteFolder)
          .onChange(async (value) => {
            this.plugin.settings.noteFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("New note title format")
      .setDesc(
        "Moment.js date format for new notes opened via 'Open new floating quick note'. Wrap plain text in [] (e.g. [Note])."
      )
      .addText((text) =>
        text
          .setPlaceholder("[Quick] - YYYY-MM-DD HH[h]mm")
          .setValue(this.plugin.settings.noteTitleFormat)
          .onChange(async (value) => {
            this.plugin.settings.noteTitleFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default note content")
      .setDesc("Template for new notes. Use {{date}} for the current date/time.")
      .addTextArea((text) =>
        text
          .setValue(this.plugin.settings.defaultNoteContent)
          .onChange(async (value) => {
            this.plugin.settings.defaultNoteContent = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Window settings ─────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Window" });

    new Setting(containerEl)
      .setName("Always on top")
      .setDesc("Keep the floating note window above all other windows.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.alwaysOnTop)
          .onChange(async (value) => {
            this.plugin.settings.alwaysOnTop = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Window width (px)")
      .addSlider((slider) =>
        slider
          .setLimits(300, 1200, 20)
          .setValue(this.plugin.settings.windowWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.windowWidth = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Window height (px)")
      .addSlider((slider) =>
        slider
          .setLimits(200, 1000, 20)
          .setValue(this.plugin.settings.windowHeight)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.windowHeight = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Window opacity (%)")
      .setDesc("Make the window slightly transparent (100 = fully opaque).")
      .addSlider((slider) =>
        slider
          .setLimits(30, 100, 5)
          .setValue(this.plugin.settings.opacity)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.opacity = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
