import { Modal } from 'obsidian';
import type { App } from 'obsidian';
import rawGroups from 'unicode-emoji-json/data-by-group.json';

interface EmojiEntry {
	emoji: string;
	name: string;
	slug: string;
}

interface EmojiGroup {
	name: string;
	emojis: EmojiEntry[];
}

const EMOJI_GROUPS = rawGroups as unknown as EmojiGroup[];

/**
 * Ask the user to pick an emoji icon for a folder from the full Unicode emoji
 * set (the operating system renders them in its own style). Resolves to the
 * chosen emoji, an empty string to clear the icon, or `undefined` when the
 * dialog is cancelled.
 */
export function requestEmoji(
	app: App,
	folderName: string,
	current: string,
): Promise<string | undefined> {
	return new Promise((resolve) => {
		new EmojiPickerModal(app, folderName, current, resolve).open();
	});
}

class EmojiPickerModal extends Modal {
	private resolved = false;
	private readonly folderName: string;
	private readonly current: string;
	private readonly resolveWith: (value: string | undefined) => void;
	private gridEl!: HTMLElement;
	private searchHandle = 0;

	constructor(
		app: App,
		folderName: string,
		current: string,
		resolve: (value: string | undefined) => void,
	) {
		super(app);
		this.folderName = folderName;
		this.current = current;
		this.resolveWith = resolve;
	}

	onOpen(): void {
		this.modalEl.addClass('vault-guide-emoji-modal');
		this.titleEl.setText(`Icon for "${this.folderName}"`);
		const { contentEl } = this;

		const search = contentEl.createEl('input', {
			cls: 'vault-guide-emoji-search',
			attr: { type: 'text', placeholder: 'Search emoji…' },
		});
		search.addEventListener('input', () => {
			window.clearTimeout(this.searchHandle);
			this.searchHandle = window.setTimeout(() => {
				this.renderGrid(search.value.trim().toLowerCase());
			}, 120);
		});
		search.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') this.close();
		});

		this.gridEl = contentEl.createDiv('vault-guide-emoji-grid');
		// One delegated listener instead of thousands of per-cell handlers.
		this.gridEl.addEventListener('click', (event) => {
			const cell =
				event.target instanceof HTMLElement
					? event.target.closest<HTMLElement>('[data-emoji]')
					: null;
			if (cell?.dataset.emoji) this.finish(cell.dataset.emoji);
		});

		const footer = contentEl.createDiv('vault-guide-emoji-footer');
		const removeBtn = footer.createEl('button', {
			text: this.current ? 'Remove icon' : 'No icon',
		});
		removeBtn.addEventListener('click', () => this.finish(''));
		const cancelBtn = footer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		this.renderGrid('');
		window.setTimeout(() => search.focus(), 0);
	}

	private renderGrid(query: string): void {
		this.gridEl.empty();

		if (query) {
			const matches: EmojiEntry[] = [];
			for (const group of EMOJI_GROUPS) {
				for (const entry of group.emojis) {
					if (
						entry.name.includes(query) ||
						entry.slug.includes(query)
					) {
						matches.push(entry);
					}
				}
			}
			if (matches.length === 0) {
				this.gridEl.createDiv({
					cls: 'vault-guide-emoji-empty',
					text: 'No matching emoji.',
				});
				return;
			}
			this.renderCells(this.gridEl.createDiv('vault-guide-emoji-row'), matches);
			return;
		}

		for (const group of EMOJI_GROUPS) {
			this.gridEl.createDiv({
				cls: 'vault-guide-emoji-cat',
				text: group.name,
			});
			this.renderCells(
				this.gridEl.createDiv('vault-guide-emoji-row'),
				group.emojis,
			);
		}
	}

	private renderCells(containerEl: HTMLElement, emojis: EmojiEntry[]): void {
		for (const entry of emojis) {
			const cell = containerEl.createSpan({
				cls: 'vault-guide-emoji-cell',
				text: entry.emoji,
			});
			cell.dataset.emoji = entry.emoji;
			cell.setAttribute('role', 'button');
			cell.setAttribute('aria-label', entry.name);
		}
	}

	private finish(value: string): void {
		this.resolved = true;
		this.resolveWith(value);
		this.close();
	}

	onClose(): void {
		window.clearTimeout(this.searchHandle);
		this.contentEl.empty();
		if (!this.resolved) this.resolveWith(undefined);
	}
}
