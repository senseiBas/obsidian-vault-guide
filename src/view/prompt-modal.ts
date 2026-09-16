import { Modal, Setting } from 'obsidian';
import type { App } from 'obsidian';

/**
 * Ask the user for a line of text. Resolves to the trimmed value, or `undefined`
 * when the dialog is cancelled or the value is empty.
 */
export function requestText(
	app: App,
	title: string,
	placeholder: string,
	initial = '',
): Promise<string | undefined> {
	return new Promise((resolve) => {
		new PromptModal(app, title, placeholder, initial, resolve).open();
	});
}

class PromptModal extends Modal {
	private value: string;
	private resolved = false;
	private readonly title: string;
	private readonly placeholder: string;
	private readonly resolveWith: (value: string | undefined) => void;

	constructor(
		app: App,
		title: string,
		placeholder: string,
		initial: string,
		resolve: (value: string | undefined) => void,
	) {
		super(app);
		this.title = title;
		this.placeholder = placeholder;
		this.value = initial;
		this.resolveWith = resolve;
	}

	onOpen(): void {
		this.titleEl.setText(this.title);
		const { contentEl } = this;

		new Setting(contentEl).addText((text) => {
			text.setPlaceholder(this.placeholder)
				.setValue(this.value)
				.onChange((value) => {
					this.value = value;
				});
			text.inputEl.addClass('vault-guide-prompt-input');
			text.inputEl.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					this.submit();
				}
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText('Create')
					.setCta()
					.onClick(() => this.submit()),
			)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => this.close()),
			);
	}

	private submit(): void {
		const trimmed = this.value.trim();
		if (!trimmed) return;
		this.resolved = true;
		this.resolveWith(trimmed);
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) this.resolveWith(undefined);
	}
}
