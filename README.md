# Vault Guide

A minimal, **view-only** vault navigator for [Obsidian](https://obsidian.md). A lightweight alternative to heavier file-explorer replacements: it does just two things, and it never touches your file system.

## Features (iteration 1)

- **Folder tree** in its own side pane, with collapse/expand (per folder and collapse-all / expand-all) that is remembered between sessions.
- **Manual folder ordering** — drag a folder to reorder it among its siblings. The order is stored in the plugin's own data, so it is purely a display order; your files and folders on disk are never moved or renamed.
- **Emoji folder icons** — right-click a folder and choose from the full Unicode emoji set (rendered in your operating system's own style). Icons are display-only overlays and are never written into folder names.
- **Native context menu** — right-clicking a folder still shows Obsidian's usual folder actions (and those added by other plugins), with the icon options added below.

Everything Vault Guide stores lives in the plugin's `data.json`. It performs **no** vault mutations: no renames, no moves, no writes to your notes.

## Usage

1. Enable the plugin in **Settings → Community plugins**.
2. Open the navigator via the ribbon compass icon or the command **Open Vault Guide**.
3. Drag folders to reorder them; right-click a folder to set or remove its emoji icon.

## Development

```bash
npm install
npm run dev      # watch build
npm run build    # production build (type-check + bundle)
npm test         # unit tests
npm run lint
```

## License

MIT
