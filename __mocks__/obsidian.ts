// Mock for the 'obsidian' module
// Provides minimal stubs for all APIs used by main.ts

import { EventEmitter } from "events";

// ── moment stub ────────────────────────────────────────────────────────────
// We use the real moment library via jest's actual resolvers outside this mock,
// but the plugin imports moment from 'obsidian', so we proxy it here.
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const moment = require("moment");

// ── TFile ─────────────────────────────────────────────────────────────────
export class TFile {
    path: string;
    name: string;
    constructor(path: string) {
        this.path = path;
        this.name = path.split("/").pop() ?? path;
    }
}

// ── Notice ────────────────────────────────────────────────────────────────
export class Notice {
    message: string;
    constructor(message: string, _timeout?: number) {
        this.message = message;
    }
}

// ── WorkspaceLeaf stub ────────────────────────────────────────────────────
export class WorkspaceLeaf {
    view = {
        containerEl: {
            ownerDocument: {
                documentElement: {
                    style: { setProperty: jest.fn() },
                },
            },
        },
    };
    openFile = jest.fn().mockResolvedValue(undefined);
}

// ── App stub ──────────────────────────────────────────────────────────────
export class App {
    workspace = {
        openPopoutLeaf: jest.fn().mockReturnValue(new WorkspaceLeaf()),
    };
    vault = {
        getAbstractFileByPath: jest.fn().mockReturnValue(null),
        create: jest.fn(),
        createFolder: jest.fn().mockResolvedValue(undefined),
    };
}

// ── Plugin base class ─────────────────────────────────────────────────────
export class Plugin extends EventEmitter {
    app: App;
    manifest: Record<string, unknown>;

    // Stored data backing loadData / saveData
    private _data: Record<string, unknown> = {};

    constructor(app: App, manifest: Record<string, unknown> = {}) {
        super();
        this.app = app;
        this.manifest = manifest;
    }

    async loadData(): Promise<Record<string, unknown>> {
        return this._data;
    }

    async saveData(data: Record<string, unknown>): Promise<void> {
        this._data = { ...data };
    }

    /** Seed saved data for migration tests */
    _setSavedData(data: Record<string, unknown>) {
        this._data = { ...data };
    }

    addCommand = jest.fn();
    addRibbonIcon = jest.fn();
    addSettingTab = jest.fn();
}

// ── PluginSettingTab stub ─────────────────────────────────────────────────
export class PluginSettingTab {
    app: App;
    plugin: Plugin;
    containerEl = {
        empty: jest.fn(),
        createEl: jest.fn().mockReturnValue({}),
    };
    constructor(app: App, plugin: Plugin) {
        this.app = app;
        this.plugin = plugin;
    }
    display() { }
}

// ── Setting stub ──────────────────────────────────────────────────────────
export class Setting {
    setName = jest.fn().mockReturnThis();
    setDesc = jest.fn().mockReturnThis();
    addText = jest.fn().mockReturnThis();
    addTextArea = jest.fn().mockReturnThis();
    addToggle = jest.fn().mockReturnThis();
    addSlider = jest.fn().mockReturnThis();
    constructor(_containerEl: unknown) { }
}
