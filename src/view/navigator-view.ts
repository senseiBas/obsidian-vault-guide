import { ItemView, Menu, TFolder, setIcon } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { VIEW_ICON, VIEW_NAME, VIEW_TYPE } from '../constants';
import {
	migrateSettingsPaths,
	orderFolderPaths,
	reorderSiblings,
} from '../tree/order';
import { requestFolderIcon } from './icon-modal';
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
	/** Path of the folder currently being dragged, if any. */
	private dragPath: string | null = null;

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
		this.treeEl = this.contentEl.createDiv('vault-guide-tree');
		this.registerVaultEvents();
		this.render();
	}

	protected async onClose(): Promise<void> {
		this.contentEl.empty();
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
			this.app.vault.on('create', (file) => {
				if (file instanceof TFolder) this.render();
			}),
		);
		this.registerEvent(this.app.vault.on('delete', () => this.render()));
	}

	private render(): void {
		if (!this.treeEl) return;
		this.treeEl.empty();
		this.renderChildren(this.treeEl, this.app.vault.getRoot());
	}

	private renderChildren(containerEl: HTMLElement, parent: TFolder): void {
		const subfolders = parent.children.filter(
			(child): child is TFolder => child instanceof TFolder,
		);
		if (subfolders.length === 0) return;

		const byPath = new Map(subfolders.map((folder) => [folder.path, folder]));
		const ordered = orderFolderPaths(
			subfolders.map((folder) => folder.path),
			this.plugin.settings.folderOrder[parent.path],
		);

		for (const path of ordered) {
			const folder = byPath.get(path);
			if (folder) this.renderFolder(containerEl, folder);
		}
	}

	private renderFolder(containerEl: HTMLElement, folder: TFolder): void {
		const hasSubfolders = folder.children.some(
			(child) => child instanceof TFolder,
		);
		const collapsed = this.plugin.settings.collapsed.includes(folder.path);

		const rowEl = containerEl.createDiv('vault-guide-row');
		rowEl.dataset.path = folder.path;
		rowEl.setAttribute('draggable', 'true');

		const chevron = rowEl.createSpan('vault-guide-chevron');
		if (hasSubfolders) {
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
			if (hasSubfolders) this.toggleCollapse(folder.path);
		});
		rowEl.addEventListener('contextmenu', (event) =>
			this.showContextMenu(event, folder),
		);

		this.setupDrag(rowEl, folder);

		if (hasSubfolders && !collapsed) {
			const childrenEl = containerEl.createDiv('vault-guide-children');
			this.renderChildren(childrenEl, folder);
		}
	}

	private setupDrag(rowEl: HTMLElement, folder: TFolder): void {
		rowEl.addEventListener('dragstart', (event) => {
			this.dragPath = folder.path;
			if (event.dataTransfer) {
				event.dataTransfer.setData(DRAG_MIME, folder.path);
				event.dataTransfer.effectAllowed = 'move';
			}
			rowEl.addClass('is-dragging');
		});
		rowEl.addEventListener('dragend', () => {
			this.dragPath = null;
			rowEl.removeClass('is-dragging');
			this.clearDropIndicator(rowEl);
		});
		rowEl.addEventListener('dragover', (event) => {
			if (!this.isSiblingDrag(folder)) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
			const before = this.isAbove(event, rowEl);
			rowEl.toggleClass('is-drop-before', before);
			rowEl.toggleClass('is-drop-after', !before);
		});
		rowEl.addEventListener('dragleave', () =>
			this.clearDropIndicator(rowEl),
		);
		rowEl.addEventListener('drop', (event) => {
			this.clearDropIndicator(rowEl);
			if (!this.isSiblingDrag(folder) || !this.dragPath) return;
			event.preventDefault();
			const before = this.isAbove(event, rowEl);
			this.reorderWithin(folder.parent, this.dragPath, folder.path, before);
			this.dragPath = null;
		});
	}

	/** True when the dragged folder shares a parent with `target` (not itself). */
	private isSiblingDrag(target: TFolder): boolean {
		if (!this.dragPath || this.dragPath === target.path) return false;
		const dragged = this.app.vault.getAbstractFileByPath(this.dragPath);
		return (
			dragged instanceof TFolder &&
			dragged.parent?.path === target.parent?.path
		);
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
	}

	private isAbove(event: DragEvent, el: HTMLElement): boolean {
		const rect = el.getBoundingClientRect();
		return event.clientY < rect.top + rect.height / 2;
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
					.setIcon('trash')
					.onClick(() => this.setIconValue(folder.path, null)),
			);
		}
		menu.showAtMouseEvent(event);
	}

	private async pickIcon(folder: TFolder): Promise<void> {
		const current = this.plugin.settings.folderIcons[folder.path] ?? '';
		const result = await requestFolderIcon(this.app, folder.name, current);
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
