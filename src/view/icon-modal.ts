import { Modal, Setting } from 'obsidian';
import type { App, TextComponent } from 'obsidian';

/** A small set of handy folder emojis offered as one-click choices. */
const QUICK_EMOJIS = [
	'📁',
	'⭐',
	'📌',
	'📥',
	'📓',
	'🗂️',
	'🧠',
	'💼',
	'🔧',
	'🎯',
	'📅',
	'🏠',
	'🚀',
	'💡',
	'🔒',
	'🗒️',
];

/**
 * Ask the user for an emoji icon for a folder. Resolves to the chosen emoji, an
 * empty string to clear the icon, or `undefined` when the dialog is cancelled.
 */
export function requestFolderIcon(
	app: App,
	folderName: string,
	current: string,
): Promise<string | undefined> {
	return new Promise((resolve) => {
		new IconModal(app, folderName, current, resolve).open();
	});
}

class IconModal extends Modal {
	private value: string;
	private resolved = false;
	private readonly folderName: string;
	private readonly resolveWith: (value: string | undefined) => void;

	constructor(
		app: App,
		folderName: string,
		current: string,
		resolve: (value: string | undefined) => void,
	) {
		super(app);
		this.folderName = folderName;
		this.value = current;
		this.resolveWith = resolve;
	}

	onOpen(): void {
		this.titleEl.setText(`Icon for "${this.folderName}"`);
		const { contentEl } = this;

		let textComponent: TextComponent | undefined;
		new Setting(contentEl)
			.setName('Emoji')
			.setDesc('Paste or type an emoji. Leave empty to remove the icon.')
			.addText((text) => {
				textComponent = text;
				text.setValue(this.value).onChange((value) => {
					this.value = value;
				});
				text.inputEl.addEventListener('keydown', (event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						this.submit();
					}
				});
				window.setTimeout(() => text.inputEl.focus(), 0);
			});

		const quickEl = contentEl.createDiv('vault-guide-emoji-quick');
		for (const emoji of QUICK_EMOJIS) {
			const button = quickEl.createEl('button', {
				text: emoji,
				cls: 'vault-guide-emoji-btn',
			});
			button.addEventListener('click', () => {
				this.value = emoji;
				textComponent?.setValue(emoji);
			});
		}

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Save')
					.setCta()
					.onClick(() => this.submit()),
			)
			.addButton((button) =>
				button
					.setButtonText('Remove')
					.setWarning()
					.onClick(() => {
						this.value = '';
						this.submit();
					}),
			)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close()),
			);
	}

	private submit(): void {
		this.resolved = true;
		this.resolveWith(this.value.trim());
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) this.resolveWith(undefined);
	}
}
