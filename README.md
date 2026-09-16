# Vault Guide

A minimal, **view-only** vault navigator for [Obsidian](https://obsidian.md). A lightweight alternative to heavier file-explorer replacements: it does just two things, and it never touches your file system.

## Features (iteration 1)

- **Folder tree** in its own side pane, with collapse/expand that is remembered between sessions.
- **Manual folder ordering** — drag a folder to reorder it among its siblings. The order is stored in the plugin's own data, so it is purely a display order; your files and folders on disk are never moved or renamed.
- **Emoji folder icons** — right-click a folder to give it an emoji icon (or remove it). Icons are display-only overlays and are never written into folder names.

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
