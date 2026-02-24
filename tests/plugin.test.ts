/**
 * Tests for FloatingNotePlugin (main.ts)
 *
 * Obsidian, Electron, and @electron/remote are fully mocked so these tests
 * run in plain Node without any browser or Obsidian runtime.
 */

import { App, Plugin, TFile, Notice } from "obsidian";
import { remote, mockWin } from "../__mocks__/electron";
import { BrowserWindow as remoteBrowserWindow, mockRemoteWin } from "../__mocks__/electronRemote";

// We import the plugin class *after* jest module mocks are in place.
// ts-jest will pick up jest.config.js moduleNameMapper automatically.
import FloatingNotePlugin from "../main";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Construct a TFile with a path without fighting obsidian's zero-arg type declaration. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mkTFile = (path: string): TFile => new (TFile as any)(path);

/** Create a plugin instance wired to a fresh mocked App */
function makePlugin(): FloatingNotePlugin {
    const app = new App() as unknown as import("obsidian").App;
    // The Plugin constructor in obsidian's real API takes (app, manifest).
    // Our mock extends EventEmitter so we can call new directly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugin = new (FloatingNotePlugin as any)(app, { id: "test", name: "test" });
    return plugin as FloatingNotePlugin;
}

// ── loadSettings ───────────────────────────────────────────────────────────

describe("loadSettings", () => {
    it("applies DEFAULT_SETTINGS when no saved data exists", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();

        expect(plugin.settings.noteFolder).toBe("Quick Notes");
        expect(plugin.settings.noteTitleFormat).toBe("[Quick] - YYYY-MM-DD HH[h]mm");
        expect(plugin.settings.windowWidth).toBe(480);
        expect(plugin.settings.windowHeight).toBe(600);
        expect(plugin.settings.alwaysOnTop).toBe(true);
        expect(plugin.settings.opacity).toBe(100);
    });

    it("migrates legacy noteFolder from 'Call Notes' → 'Quick Notes'", async () => {
        const plugin = makePlugin();
        (plugin as unknown as { _setSavedData: (d: object) => void })._setSavedData({
            noteFolder: "Call Notes",
        });
        await plugin.loadSettings();
        expect(plugin.settings.noteFolder).toBe("Quick Notes");
    });

    it("migrates legacy noteTitleFormat from call format → quick format", async () => {
        const plugin = makePlugin();
        (plugin as unknown as { _setSavedData: (d: object) => void })._setSavedData({
            noteTitleFormat: "Call - YYYY-MM-DD HH[h]mm",
        });
        await plugin.loadSettings();
        expect(plugin.settings.noteTitleFormat).toBe("[Quick] - YYYY-MM-DD HH[h]mm");
    });

    it("migrates old 'Quick - ...' title format (no square brackets)", async () => {
        const plugin = makePlugin();
        (plugin as unknown as { _setSavedData: (d: object) => void })._setSavedData({
            noteTitleFormat: "Quick - YYYY-MM-DD HH[h]mm",
        });
        await plugin.loadSettings();
        expect(plugin.settings.noteTitleFormat).toBe("[Quick] - YYYY-MM-DD HH[h]mm");
    });

    it("wraps bare 'Note' title format in square brackets", async () => {
        const plugin = makePlugin();
        (plugin as unknown as { _setSavedData: (d: object) => void })._setSavedData({
            noteTitleFormat: "Note",
        });
        await plugin.loadSettings();
        expect(plugin.settings.noteTitleFormat).toBe("[Note]");
    });

    it("migrates legacy defaultNoteContent from call template → quick template", async () => {
        const plugin = makePlugin();
        (plugin as unknown as { _setSavedData: (d: object) => void })._setSavedData({
            defaultNoteContent: "# 📞 Call Notes\n\n**Date:** {{date}}\n\n---\n\n",
        });
        await plugin.loadSettings();
        expect(plugin.settings.defaultNoteContent).toBe(
            "# 📌 Quick Notes\n\n**Date:** {{date}}\n\n---\n\n"
        );
    });

    it("preserves user-customised settings without migrating them", async () => {
        const plugin = makePlugin();
        (plugin as unknown as { _setSavedData: (d: object) => void })._setSavedData({
            noteFolder: "My Custom Folder",
            noteTitleFormat: "[Meeting] YYYY-MM-DD",
            windowWidth: 800,
            opacity: 80,
            alwaysOnTop: false,
        });
        await plugin.loadSettings();
        expect(plugin.settings.noteFolder).toBe("My Custom Folder");
        expect(plugin.settings.noteTitleFormat).toBe("[Meeting] YYYY-MM-DD");
        expect(plugin.settings.windowWidth).toBe(800);
        expect(plugin.settings.opacity).toBe(80);
        expect(plugin.settings.alwaysOnTop).toBe(false);
    });
});

// ── createNewQuickNote ─────────────────────────────────────────────────────

describe("createNewQuickNote", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("creates a note at <folder>/<formatted-title>.md", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        // Ensure folder path is set
        plugin.settings.noteFolder = "Quick Notes";

        const mockFile = mkTFile("Quick Notes/[Quick] - 2026-02-24 10h00.md");
        (plugin.app.vault.create as jest.Mock).mockResolvedValueOnce(mockFile);
        (plugin.app.vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(null);

        const file = await (plugin as unknown as { createNewQuickNote(): Promise<TFile> }).createNewQuickNote();

        expect(plugin.app.vault.create).toHaveBeenCalledTimes(1);
        const [calledPath, calledContent] = (plugin.app.vault.create as jest.Mock).mock.calls[0];
        expect(calledPath).toMatch(/^Quick Notes\//);
        expect(calledPath).toMatch(/\.md$/);
        expect(calledContent).not.toContain("{{date}}");
        expect(file).toBe(mockFile);
    });

    it("creates note at vault root when noteFolder is empty", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.noteFolder = "";

        const mockFile = mkTFile("Quick - 2026-02-24 10h00.md");
        (plugin.app.vault.create as jest.Mock).mockResolvedValueOnce(mockFile);

        await (plugin as unknown as { createNewQuickNote(): Promise<TFile> }).createNewQuickNote();

        const [calledPath] = (plugin.app.vault.create as jest.Mock).mock.calls[0];
        expect(calledPath).not.toContain("/");
        expect(calledPath).toMatch(/\.md$/);
    });

    it("falls back to '(2)' suffix when the file already exists (same minute)", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.noteFolder = "Quick Notes";

        const mockFile = mkTFile("Quick Notes/note (2).md");
        // First create call rejects (collision); second resolves
        (plugin.app.vault.create as jest.Mock)
            .mockRejectedValueOnce(new Error("File already exists"))
            .mockResolvedValueOnce(mockFile);

        const file = await (plugin as unknown as { createNewQuickNote(): Promise<TFile> }).createNewQuickNote();

        expect(plugin.app.vault.create).toHaveBeenCalledTimes(2);
        const [, collisionPath] = (plugin.app.vault.create as jest.Mock).mock.calls.map((c) => c[0]);
        expect(collisionPath).toMatch(/\(2\)\.md$/);
        expect(file).toBe(mockFile);
    });
});

// ── getOrCreateTodaysQuickNote ─────────────────────────────────────────────

describe("getOrCreateTodaysQuickNote", () => {
    beforeEach(() => jest.clearAllMocks());

    it("returns the existing TFile without creating a new one", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.noteFolder = "Quick Notes";

        const existing = mkTFile("Quick Notes/2026-02-24 Quick Notes.md");
        (plugin.app.vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(existing);

        const file = await (
            plugin as unknown as { getOrCreateTodaysQuickNote(): Promise<TFile> }
        ).getOrCreateTodaysQuickNote();

        expect(plugin.app.vault.create).not.toHaveBeenCalled();
        expect(file).toBe(existing);
    });

    it("creates a new file when today's note doesn't exist yet", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.noteFolder = "Quick Notes";

        (plugin.app.vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(null);
        const newFile = mkTFile("Quick Notes/2026-02-24 Quick Notes.md");
        (plugin.app.vault.create as jest.Mock).mockResolvedValueOnce(newFile);

        const file = await (
            plugin as unknown as { getOrCreateTodaysQuickNote(): Promise<TFile> }
        ).getOrCreateTodaysQuickNote();

        expect(plugin.app.vault.create).toHaveBeenCalledTimes(1);
        const createdPath: string = (plugin.app.vault.create as jest.Mock).mock.calls[0][0];
        expect(createdPath).toMatch(/Quick Notes\.md$/);
        expect(file).toBe(newFile);
    });

    it("uses vault root when noteFolder is empty", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.noteFolder = "";

        (plugin.app.vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(null);
        const newFile = mkTFile("2026-02-24 Quick Notes.md");
        (plugin.app.vault.create as jest.Mock).mockResolvedValueOnce(newFile);

        await (
            plugin as unknown as { getOrCreateTodaysQuickNote(): Promise<TFile> }
        ).getOrCreateTodaysQuickNote();

        const createdPath: string = (plugin.app.vault.create as jest.Mock).mock.calls[0][0];
        expect(createdPath).not.toContain("/");
    });
});

// ── ensureFolderExists ────────────────────────────────────────────────────

describe("ensureFolderExists", () => {
    beforeEach(() => jest.clearAllMocks());

    it("does nothing when folder is an empty string", async () => {
        const plugin = makePlugin();
        await (plugin as unknown as { ensureFolderExists(f: string): Promise<void> }).ensureFolderExists("");
        expect(plugin.app.vault.createFolder).not.toHaveBeenCalled();
    });

    it("does NOT create folder when it already exists", async () => {
        const plugin = makePlugin();
        (plugin.app.vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce({ path: "Notes" });
        await (plugin as unknown as { ensureFolderExists(f: string): Promise<void> }).ensureFolderExists("Notes");
        expect(plugin.app.vault.createFolder).not.toHaveBeenCalled();
    });

    it("creates folder when it is absent", async () => {
        const plugin = makePlugin();
        (plugin.app.vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(null);
        await (plugin as unknown as { ensureFolderExists(f: string): Promise<void> }).ensureFolderExists("NewFolder");
        expect(plugin.app.vault.createFolder).toHaveBeenCalledWith("NewFolder");
    });
});

// ── openFloatingNote ──────────────────────────────────────────────────────

describe("openFloatingNote", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers(); // Prevent setTimeout from firing after test teardown
    });
    afterEach(() => jest.useRealTimers());

    it("aborts early (no popout) when file creation returns null", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();

        // Both getAbstractFileByPath and vault.create return null → file is null
        (plugin.app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
        (plugin.app.vault.create as jest.Mock).mockResolvedValue(null);

        await plugin.openFloatingNote(true);

        // Without a file, the method should bail out before opening a popout
        expect(plugin.app.workspace.openPopoutLeaf).not.toHaveBeenCalled();
    });

    it("calls openPopoutLeaf with the configured dimensions", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.windowWidth = 600;
        plugin.settings.windowHeight = 700;
        plugin.settings.noteFolder = "";

        const mockFile = mkTFile("2026-02-24 Quick Notes.md");
        (plugin.app.vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(null);
        (plugin.app.vault.create as jest.Mock).mockResolvedValueOnce(mockFile);

        await plugin.openFloatingNote(false);

        expect(plugin.app.workspace.openPopoutLeaf).toHaveBeenCalledWith({
            size: { width: 600, height: 700 },
        });
    });
});

// ── applyWindowSettings (Electron remote) ─────────────────────────────────

describe("applyWindowSettings (Electron remote)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the electron mock to return the window by default
        remote.BrowserWindow.getFocusedWindow.mockReturnValue(mockWin);
    });

    it("sets always-on-top and workspace visibility when alwaysOnTop=true", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.alwaysOnTop = true;
        plugin.settings.opacity = 100;

        (plugin as unknown as { applyWindowSettings(): void }).applyWindowSettings();

        expect(mockWin.setAlwaysOnTop).toHaveBeenCalledWith(true, "floating");
        expect(mockWin.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true);
    });

    it("does NOT call setAlwaysOnTop when alwaysOnTop=false", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.alwaysOnTop = false;

        (plugin as unknown as { applyWindowSettings(): void }).applyWindowSettings();

        expect(mockWin.setAlwaysOnTop).not.toHaveBeenCalled();
    });

    it("calls setOpacity with normalised value when opacity < 100", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.opacity = 80;
        plugin.settings.alwaysOnTop = false;

        (plugin as unknown as { applyWindowSettings(): void }).applyWindowSettings();

        expect(mockWin.setOpacity).toHaveBeenCalledWith(0.8);
    });

    it("does NOT call setOpacity when opacity is 100", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.opacity = 100;
        plugin.settings.alwaysOnTop = false;

        (plugin as unknown as { applyWindowSettings(): void }).applyWindowSettings();

        expect(mockWin.setOpacity).not.toHaveBeenCalled();
    });

    it("sets the title to '📌 Quick Notes'", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();

        (plugin as unknown as { applyWindowSettings(): void }).applyWindowSettings();

        expect(mockWin.setTitle).toHaveBeenCalledWith("📌 Quick Notes");
    });

    it("falls back to @electron/remote when primary API returns null window", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.alwaysOnTop = true;
        plugin.settings.opacity = 70;

        // Primary electron.remote returns null → fallback path triggered
        remote.BrowserWindow.getFocusedWindow.mockReturnValueOnce(null);
        remoteBrowserWindow.getFocusedWindow.mockReturnValueOnce(mockRemoteWin);

        (plugin as unknown as { applyWindowSettings(): void }).applyWindowSettings();

        // Primary window mock should NOT have been called (it returned null)
        expect(mockWin.setAlwaysOnTop).not.toHaveBeenCalled();
        // Fallback mock should have been called
        expect(mockRemoteWin.setAlwaysOnTop).toHaveBeenCalledWith(true, "floating");
        expect(mockRemoteWin.setOpacity).toHaveBeenCalledWith(0.7);
    });
});

// ── Edge cases ────────────────────────────────────────────────────────────

describe("Edge cases", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => jest.useRealTimers());

    it("opacity boundary: value of exactly 30 is applied (minimum slider value)", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.opacity = 30;
        plugin.settings.alwaysOnTop = false;
        remote.BrowserWindow.getFocusedWindow.mockReturnValue(mockWin);

        (plugin as unknown as { applyWindowSettings(): void }).applyWindowSettings();
        expect(mockWin.setOpacity).toHaveBeenCalledWith(0.3);
    });

    it("window dimensions: min-width 300 and min-height 200 are accepted", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.windowWidth = 300;
        plugin.settings.windowHeight = 200;
        plugin.settings.noteFolder = "";

        (plugin.app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
        const f = mkTFile("note.md");
        (plugin.app.vault.create as jest.Mock).mockResolvedValue(f);

        await plugin.openFloatingNote(false);

        expect(plugin.app.workspace.openPopoutLeaf).toHaveBeenCalledWith({
            size: { width: 300, height: 200 },
        });
    });

    it("{{date}} placeholder in defaultNoteContent is replaced on note creation", async () => {
        const plugin = makePlugin();
        await plugin.loadSettings();
        plugin.settings.noteFolder = "";
        plugin.settings.defaultNoteContent = "Created: {{date}}";

        (plugin.app.vault.create as jest.Mock).mockResolvedValue(mkTFile("note.md"));

        await (plugin as unknown as { createNewQuickNote(): Promise<TFile> }).createNewQuickNote();

        const calledContent: string = (plugin.app.vault.create as jest.Mock).mock.calls[0][1];
        expect(calledContent).not.toContain("{{date}}");
        // Should contain a date-like string YYYY-MM-DD
        expect(calledContent).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
});
