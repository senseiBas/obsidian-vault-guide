# Vault Guide

A minimal vault navigator for [Obsidian](https://obsidian.md): a lightweight alternative to heavier file-explorer replacements. Its display state (order, icons, collapse, hide patterns) lives entirely in the plugin's own data and never rearranges your files on disk.

## Features

- **Folder tree** in its own side pane, with files shown inside each folder. Folders expand/collapse (per folder and collapse-all / expand-all) and the state is remembered between sessions.
- **Open notes** — click a file to open it in the main editor pane.
- **New folder** — a toolbar button creates a folder in the vault root.
- **Manual folder ordering** — drag a folder onto the top or bottom edge of a sibling to reorder it. The order is stored in the plugin's own data, so it is purely a display order; reordering never moves or renames folders on disk.
- **Move by drag** — drop a file or folder onto the middle of a folder to move it inside, or onto the empty area of the tree to move it to the vault root. This performs a real file-system move (via Obsidian's link-aware rename).
- **Emoji folder icons** — right-click a folder and choose from the full Unicode emoji set (rendered in your operating system's own style). Icons are display-only overlays and are never written into folder names.
- **Hide folders by regex** — set regex patterns (one per line) in the plugin settings to hide matching folders; toggle the eye button in the navigator to reveal them, greyed out.
- **Native context menu** — right-clicking a folder or file shows Obsidian's usual actions (and those added by other plugins).
- **Calendar pane** — a separate month view that shows a dot on every day that has a daily note. Click a day to open its note, hover to see Obsidian's page preview, and use the arrows / today button to navigate months. The daily-note folder and format are detected from the core Daily Notes plugin (or Periodic Notes as a fallback).

The overlay state (order, icons, collapse, hide patterns) never mutates the vault. Explicit actions you take — creating a folder, opening a note, or using the native context menu — do exactly what they say.

## Usage

1. Enable the plugin in **Settings → Community plugins**.
2. Open the navigator via the ribbon compass icon or the command **Open Vault Guide**.
3. Drag folders to reorder them; right-click a folder to set or remove its emoji icon; click a file to open it.

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
