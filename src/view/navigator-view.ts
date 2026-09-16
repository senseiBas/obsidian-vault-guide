import { ItemView, Menu, Notice, TFile, TFolder, setIcon } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { VIEW_ICON, VIEW_NAME, VIEW_TYPE } from '../constants';
import {
	migrateSettingsPaths,
	orderFolderPaths,
	reorderSiblings,
} from '../tree/order';
import { compileHidePatterns, isHiddenName } from '../tree/hidden';
import { requestEmoji } from './emoji-picker';
import { requestText } from './prompt-modal';
import type VaultGuidePlugin from '../main';

const DRAG_MIME = 'application/x-vault-guide-folder';

/**
 * The Vault Guide navigator: a side-pane view that renders the vault's folder
 * tree with a manual, drag-sortable order and per-folder emoji icons. All state
 * is display-only and stored in the plugin's settings; the view never mutates
 * the vault (no renames, moves, or writes).
 */
export class NavigatorView extends ItemView {
	private readonly plugin: VaultGuidePlugin;
	private treeEl!: HTMLElement;
	/** The item currently being dragged, if any. */
	private dragged: { path: string; isFolder: boolean } | null = null;
	/** Compiled hide patterns for the current render pass. */
	private hidePatterns: RegExp[] = [];
	/** The eye toggle button, so its icon can follow the showHidden state. */
	private hiddenToggleEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: VaultGuidePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return VIEW_NAME;
	}

	getIcon(): string {
		return VIEW_ICON;
	}

	protected async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('vault-guide');
		this.buildToolbar();
		this.treeEl = this.contentEl.createDiv('vault-guide-tree');
		this.setupRootDrop();
		this.registerVaultEvents();
		this.render();
	}

	protected async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private buildToolbar(): void {
		const toolbarEl = this.contentEl.createDiv('vault-guide-toolbar');

		const newFolderBtn = toolbarEl.createEl('button', {
			cls: 'vault-guide-toolbar-btn',
			attr: { 'aria-label': 'New folder' },
		});
		setIcon(newFolderBtn, 'folder-plus');
		newFolderBtn.addEventListener('click', () => void this.createNewFolder());

		const collapseBtn = toolbarEl.createEl('button', {
			cls: 'vault-guide-toolbar-btn',
			attr: { 'aria-label': 'Collapse all' },
		});
		setIcon(collapseBtn, 'chevrons-down-up');
		collapseBtn.addEventListener('click', () => this.collapseAll());

		const expandBtn = toolbarEl.createEl('button', {
			cls: 'vault-guide-toolbar-btn',
			attr: { 'aria-label': 'Expand all' },
		});
		setIcon(expandBtn, 'chevrons-up-down');
		expandBtn.addEventListener('click', () => this.expandAll());

		const hiddenBtn = toolbarEl.createEl('button', {
			cls: 'vault-guide-toolbar-btn',
		});
		this.hiddenToggleEl = hiddenBtn;
		this.updateHiddenToggle();
		hiddenBtn.addEventListener('click', () => this.toggleHidden());
	}

	private toggleHidden(): void {
		this.plugin.settings.showHidden = !this.plugin.settings.showHidden;
		void this.plugin.saveSettings();
		this.updateHiddenToggle();
		this.render();
	}

	private updateHiddenToggle(): void {
		if (!this.hiddenToggleEl) return;
		const showing = this.plugin.settings.showHidden;
		this.hiddenToggleEl.toggleClass('is-active', showing);
		this.hiddenToggleEl.setAttribute(
			'aria-label',
			showing ? 'Hide hidden folders' : 'Show hidden folders',
		);
		setIcon(this.hiddenToggleEl, showing ? 'eye' : 'eye-off');
	}

	private collapseAll(): void {
		this.plugin.settings.collapsed = this.allCollapsibleFolderPaths();
		void this.plugin.saveSettings();
		this.render();
	}

	private expandAll(): void {
		this.plugin.settings.collapsed = [];
		void this.plugin.saveSettings();
		this.render();
	}

	/** Every folder path that has children (so is collapsible). */
	private allCollapsibleFolderPaths(): string[] {
		const paths: string[] = [];
		const walk = (folder: TFolder): void => {
			for (const child of folder.children) {
				if (!(child instanceof TFolder)) continue;
				if (child.children.length > 0) paths.push(child.path);
				walk(child);
			}
		};
		walk(this.app.vault.getRoot());
		return paths;
	}

	private async createNewFolder(): Promise<void> {
		const name = await requestText(
			this.app,
			'New folder',
			'Folder name',
		);
		if (!name) return;
		try {
			await this.app.vault.createFolder(name);
		} catch (error) {
			new Notice(
				`Could not create folder: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/** React to folder changes: keep display state in sync and re-render. */
	private registerVaultEvents(): void {
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFolder) {
					this.plugin.settings = migrateSettingsPaths(
						this.plugin.settings,
						oldPath,
						file.path,
					);
					void this.plugin.saveSettings();
				}
				this.render();
			}),
		);
		this.registerEvent(
			this.app.vault.on('create', () => this.render()),
		);
		this.registerEvent(this.app.vault.on('delete', () => this.render()));
	}

	/** Public re-render hook, used after settings changes. */
	refresh(): void {
		this.updateHiddenToggle();
		this.render();
	}

	private render(): void {
		if (!this.treeEl) return;
		this.hidePatterns = compileHidePatterns(
			this.plugin.settings.hiddenFolderPatterns,
		);
		this.treeEl.empty();
		this.renderChildren(this.treeEl, this.app.vault.getRoot());
	}

	private renderChildren(containerEl: HTMLElement, parent: TFolder): void {
		const subfolders = parent.children.filter(
			(child): child is TFolder => child instanceof TFolder,
		);

		const byPath = new Map(subfolders.map((folder) => [folder.path, folder]));
		const ordered = orderFolderPaths(
			subfolders.map((folder) => folder.path),
			this.plugin.settings.folderOrder[parent.path],
		);

		const showHidden = this.plugin.settings.showHidden;
		for (const path of ordered) {
			const folder = byPath.get(path);
			if (!folder) continue;
			const hidden = isHiddenName(folder.name, this.hidePatterns);
			if (hidden && !showHidden) continue;
			this.renderFolder(containerEl, folder, hidden);
		}

		// Files come after folders, in natural alphabetical order.
		const files = parent.children
			.filter((child): child is TFile => child instanceof TFile)
			.sort((a, b) =>
				a.basename.localeCompare(b.basename, undefined, {
					sensitivity: 'base',
				}),
			);
		for (const file of files) this.renderFile(containerEl, file);
	}

	private renderFolder(
		containerEl: HTMLElement,
		folder: TFolder,
		hidden: boolean,
	): void {
		const hasChildren = folder.children.length > 0;
		const collapsed = this.plugin.settings.collapsed.includes(folder.path);

		const rowEl = containerEl.createDiv('vault-guide-row');
		rowEl.dataset.path = folder.path;
		rowEl.setAttribute('draggable', 'true');
		if (hidden) rowEl.addClass('is-hidden-folder');

		const chevron = rowEl.createSpan('vault-guide-chevron');
		if (hasChildren) {
			setIcon(chevron, collapsed ? 'chevron-right' : 'chevron-down');
			chevron.addEventListener('click', (event) => {
				event.stopPropagation();
				this.toggleCollapse(folder.path);
			});
		} else {
			chevron.addClass('is-empty');
		}

		const iconEl = rowEl.createSpan('vault-guide-icon');
		const emoji = this.plugin.settings.folderIcons[folder.path];
		if (emoji) iconEl.setText(emoji);
		else setIcon(iconEl, 'folder');

		rowEl.createSpan({ cls: 'vault-guide-name', text: folder.name });

		rowEl.addEventListener('click', () => {
			if (hasChildren) this.toggleCollapse(folder.path);
		});
		rowEl.addEventListener('contextmenu', (event) =>
			this.showContextMenu(event, folder),
		);

		this.setupFolderDrag(rowEl, folder);

		if (hasChildren && !collapsed) {
			const childrenEl = containerEl.createDiv('vault-guide-children');
			this.renderChildren(childrenEl, folder);
		}
	}

	private renderFile(containerEl: HTMLElement, file: TFile): void {
		const rowEl = containerEl.createDiv('vault-guide-row vault-guide-file');
		rowEl.dataset.path = file.path;
		rowEl.setAttribute('draggable', 'true');

		rowEl.createSpan('vault-guide-chevron').addClass('is-empty');

		const iconEl = rowEl.createSpan('vault-guide-icon');
		setIcon(iconEl, file.extension === 'md' ? 'file-text' : 'file');

		const label = file.extension === 'md' ? file.basename : file.name;
		rowEl.createSpan({ cls: 'vault-guide-name', text: label });

		rowEl.addEventListener('click', () => {
			void this.app.workspace.openLinkText(file.path, '', false);
		});
		rowEl.addEventListener('contextmenu', (event) => {
			event.preventDefault();
			const menu = new Menu();
			this.app.workspace.trigger('file-menu', menu, file, 'vault-guide');
			menu.showAtMouseEvent(event);
		});

		this.makeDraggable(rowEl, file.path, false);
		// Files are not drop targets themselves; swallow the event so it does not
		// bubble up to the root drop handler while hovering another file.
		rowEl.addEventListener('dragover', (event) => event.stopPropagation());
	}

	/** Wire the shared drag-start / drag-end behaviour for a row. */
	private makeDraggable(
		rowEl: HTMLElement,
		path: string,
		isFolder: boolean,
	): void {
		rowEl.addEventListener('dragstart', (event) => {
			event.stopPropagation();
			this.dragged = { path, isFolder };
			if (event.dataTransfer) {
				event.dataTransfer.setData(DRAG_MIME, path);
				event.dataTransfer.effectAllowed = 'move';
			}
			rowEl.addClass('is-dragging');
		});
		rowEl.addEventListener('dragend', () => {
			this.dragged = null;
			rowEl.removeClass('is-dragging');
			this.clearDropIndicator(rowEl);
		});
	}

	private setupFolderDrag(rowEl: HTMLElement, folder: TFolder): void {
		this.makeDraggable(rowEl, folder.path, true);

		rowEl.addEventListener('dragover', (event) => {
			const zone = this.dropZone(event, rowEl, folder);
			if (zone === 'none') return;
			event.preventDefault();
			event.stopPropagation();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
			rowEl.toggleClass('is-drop-before', zone === 'before');
			rowEl.toggleClass('is-drop-after', zone === 'after');
			rowEl.toggleClass('is-drop-into', zone === 'into');
		});
		rowEl.addEventListener('dragleave', () =>
			this.clearDropIndicator(rowEl),
		);
		rowEl.addEventListener('drop', (event) => {
			const dragged = this.dragged;
			const zone = this.dropZone(event, rowEl, folder);
			this.clearDropIndicator(rowEl);
			if (!dragged || zone === 'none') return;
			event.preventDefault();
			event.stopPropagation();
			if (zone === 'before' || zone === 'after') {
				this.reorderWithin(
					folder.parent,
					dragged.path,
					folder.path,
					zone === 'before',
				);
			} else {
				void this.moveInto(dragged.path, folder.path);
			}
			this.dragged = null;
		});
	}

	/**
	 * Decide what a drop on this folder row means:
	 * - `before` / `after`: reorder among siblings (folder dragged onto a sibling,
	 *   near its top/bottom edge). View-only.
	 * - `into`: move the dragged item inside this folder (real file-system move).
	 * - `none`: not a valid drop here.
	 */
	private dropZone(
		event: DragEvent,
		rowEl: HTMLElement,
		folder: TFolder,
	): 'before' | 'after' | 'into' | 'none' {
		const dragged = this.dragged;
		if (!dragged || dragged.path === folder.path) return 'none';

		const reorderable =
			dragged.isFolder && this.sameParent(dragged.path, folder.path);
		if (reorderable) {
			const rect = rowEl.getBoundingClientRect();
			const offset = event.clientY - rect.top;
			const edge = rect.height * 0.3;
			if (offset < edge) return 'before';
			if (offset > rect.height - edge) return 'after';
			return this.canMoveInto(dragged, folder.path) ? 'into' : 'none';
		}
		return this.canMoveInto(dragged, folder.path) ? 'into' : 'none';
	}

	/** True when moving `dragged` into `destFolderPath` would be a valid move. */
	private canMoveInto(
		dragged: { path: string; isFolder: boolean },
		destFolderPath: string,
	): boolean {
		const item = this.app.vault.getAbstractFileByPath(dragged.path);
		if (!item) return false;
		const rootPath = this.app.vault.getRoot().path;
		if ((item.parent?.path ?? rootPath) === destFolderPath) return false;
		if (dragged.isFolder) {
			if (destFolderPath === dragged.path) return false;
			if (destFolderPath.startsWith(`${dragged.path}/`)) return false;
		}
		return true;
	}

	private async moveInto(
		sourcePath: string,
		destFolderPath: string,
	): Promise<void> {
		const item = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!item) return;
		if (!this.canMoveInto({ path: sourcePath, isFolder: item instanceof TFolder }, destFolderPath)) {
			if (
				item instanceof TFolder &&
				(destFolderPath === item.path ||
					destFolderPath.startsWith(`${item.path}/`))
			) {
				new Notice('Cannot move a folder into itself.');
			}
			return;
		}
		const rootPath = this.app.vault.getRoot().path;
		const destDir = destFolderPath === rootPath ? '' : destFolderPath;
		const newPath = destDir ? `${destDir}/${item.name}` : item.name;
		try {
			await this.app.fileManager.renameFile(item, newPath);
		} catch (error) {
			new Notice(
				`Could not move: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	/** True when two paths currently live in the same parent folder. */
	private sameParent(a: string, b: string): boolean {
		const fa = this.app.vault.getAbstractFileByPath(a);
		const fb = this.app.vault.getAbstractFileByPath(b);
		return !!fa && !!fb && fa.parent?.path === fb.parent?.path;
	}

	/** Dropping on the empty area of the tree moves the item to the vault root. */
	private setupRootDrop(): void {
		const rootPath = this.app.vault.getRoot().path;
		this.treeEl.addEventListener('dragover', (event) => {
			if (!this.dragged || !this.canMoveInto(this.dragged, rootPath)) {
				return;
			}
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
			this.treeEl.addClass('is-drop-root');
		});
		this.treeEl.addEventListener('dragleave', (event) => {
			if (event.target === this.treeEl) {
				this.treeEl.removeClass('is-drop-root');
			}
		});
		this.treeEl.addEventListener('drop', (event) => {
			this.treeEl.removeClass('is-drop-root');
			const dragged = this.dragged;
			if (!dragged) return;
			event.preventDefault();
			void this.moveInto(dragged.path, rootPath);
			this.dragged = null;
		});
	}

	private reorderWithin(
		parent: TFolder | null,
		dragged: string,
		target: string,
		before: boolean,
	): void {
		if (!parent) return;
		const childPaths = parent.children
			.filter((child): child is TFolder => child instanceof TFolder)
			.map((child) => child.path);
		const current = orderFolderPaths(
			childPaths,
			this.plugin.settings.folderOrder[parent.path],
		);
		const next = reorderSiblings(current, dragged, target, before);
		this.plugin.settings.folderOrder[parent.path] = next;
		void this.plugin.saveSettings();
		this.render();
	}

	private clearDropIndicator(rowEl: HTMLElement): void {
		rowEl.removeClass('is-drop-before');
		rowEl.removeClass('is-drop-after');
		rowEl.removeClass('is-drop-into');
	}

	private toggleCollapse(path: string): void {
		const collapsed = this.plugin.settings.collapsed;
		const index = collapsed.indexOf(path);
		if (index >= 0) collapsed.splice(index, 1);
		else collapsed.push(path);
		void this.plugin.saveSettings();
		this.render();
	}

	private showContextMenu(event: MouseEvent, folder: TFolder): void {
		event.preventDefault();
		const menu = new Menu();
		// Let Obsidian core and other plugins add all their usual folder actions
		// (New note, New folder, Move folder to…, Rename, Delete, and third-party
		// items like Doom scroll folder or Reveal in Notebook Navigator).
		this.app.workspace.trigger('file-menu', menu, folder, 'vault-guide');

		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle('Set icon…')
				.setIcon('smile')
				.onClick(() => void this.pickIcon(folder)),
		);
		if (this.plugin.settings.folderIcons[folder.path]) {
			menu.addItem((item) =>
				item
					.setTitle('Remove icon')
					.setIcon('trash-2')
					.onClick(() => this.setIconValue(folder.path, null)),
			);
		}

		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle('Delete folder')
				.setIcon('trash')
				.onClick(() => {
					void this.app.fileManager.promptForDeletion(folder);
				}),
		);
		menu.showAtMouseEvent(event);
	}

	private async pickIcon(folder: TFolder): Promise<void> {
		const current = this.plugin.settings.folderIcons[folder.path] ?? '';
		const result = await requestEmoji(this.app, folder.name, current);
		if (result === undefined) return;
		this.setIconValue(folder.path, result === '' ? null : result);
	}

	private setIconValue(path: string, icon: string | null): void {
		if (icon) this.plugin.settings.folderIcons[path] = icon;
		else delete this.plugin.settings.folderIcons[path];
		void this.plugin.saveSettings();
		this.render();
	}
}
