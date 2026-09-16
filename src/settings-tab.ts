import { PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type VaultGuidePlugin from './main';

export class VaultGuideSettingTab extends PluginSettingTab {
	private readonly plugin: VaultGuidePlugin;

	constructor(app: App, plugin: VaultGuidePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Hidden folder patterns')
			.setDesc(
				'One regular expression per line, tested against each folder name. ' +
					'Matching folders are hidden from the tree; toggle the eye button ' +
					'in the navigator to reveal them (greyed). Examples: "^_" hides ' +
					'folders starting with an underscore, "^\\." hides dot-folders.',
			)
			.addTextArea((text) => {
				text.setPlaceholder('^_\n^\\.')
					.setValue(
						this.plugin.settings.hiddenFolderPatterns.join('\n'),
					)
					.onChange(async (value) => {
						this.plugin.settings.hiddenFolderPatterns = value
							.split('\n')
							.map((line) => line.trim())
							.filter((line) => line.length > 0);
						await this.plugin.saveSettings();
						this.plugin.refreshViews();
					});
				text.inputEl.rows = 5;
				text.inputEl.addClass('vault-guide-pattern-input');
			});
	}
}
