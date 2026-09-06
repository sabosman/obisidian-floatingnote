# Floating Quick Note

Floating Quick Note is an Obsidian plugin that lets you open a small, detached note window that stays on top of your other apps. It is great for taking notes during meetings or while you are working in other programs without having to switch back and forth to Obsidian.

## What it does

- Opens a floating window that stays visible even when you use other apps like Meet, Zoom or Teams.
- You can choose between opening a new note every time or reusing a single note for the whole day.
- Comes with a button in the sidebar for quick access.
- You can customize the window size, transparency, and where your notes are saved.

## How to use it

1. Click the pin icon in the sidebar to open a new quick note.
2. Use the command palette (Cmd/Ctrl + P) and search for "Floating Quick Note" to open a new one.
3. You can also set up a keyboard shortcut in the Obsidian settings if you use it often.

## Settings

You can find the settings for this plugin under **Settings -> Floating Quick Note**. Here you can change:

- **Notes folder**: Where your quick notes are stored.
- **Title format**: How the notes are named.
- **Default content**: What text should be in a new note by default.
- **Always on top**: Whether the window should stay above other apps.
- **Window size and opacity**: Adjust how big and how transparent the window is.

## Installation

Requires Obsidian Desktop 1.4.0 or newer.

### From the Obsidian Community Store
1. Open Obsidian and go to **Settings**.
2. Select **Community plugins**.
3. Click **Browse** and search for "Floating Quick Note".
4. Click **Install**, then **Enable**.

### Manual installation (for testing)
1. Create a folder named `floating-quick-note` in your vault's `.obsidian/plugins/` directory.
2. Copy the `main.js` and `manifest.json` files into that folder.
3. Enable the plugin in the Obsidian settings.

## Releasing

Update `package.json`, `manifest.json`, and `versions.json` together, run
`npm ci --ignore-scripts`, `npm run lint`, `npm test -- --runInBand`, and
`npm run build`, then commit the updated source and `main.js`.

Push a tag matching the version exactly (for example, `1.0.1`, without a `v`
prefix). The release workflow builds from that tag, attests `main.js` and
`manifest.json`, and uploads those exact files to a draft GitHub release.
Review and publish the draft before asking the Obsidian reviewer to recheck it.
Do not replace those assets with a local build: the attestation covers their
exact contents. Existing `1.0.0` assets are not changed by this workflow.

Verify a downloaded release asset with:

```sh
gh attestation verify main.js --repo sabosman/obisidian-floatingnote
```
