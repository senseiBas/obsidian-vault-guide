import { Plugin } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { VIEW_ICON, VIEW_NAME, VIEW_TYPE } from './constants';
import { NavigatorView } from './view/navigator-view';
import { VaultGuideSettingTab } from './settings-tab';
import {
	DEFAULT_SETTINGS,
	normalizeSettings,
	type VaultGuideSettings,
} from './settings';

export default class VaultGuidePlugin extends Plugin {
	settings: VaultGuideSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());

		this.registerView(
			VIEW_TYPE,
			(leaf) => new NavigatorView(leaf, this),
		);

		this.addSettingTab(new VaultGuideSettingTab(this.app, this));

		this.addRibbonIcon(VIEW_ICON, `Open ${VIEW_NAME}`, () => {
			void this.activateView();
		});

		this.addCommand({
			id: 'open-vault-guide',
			name: `Open ${VIEW_NAME}`,
			callback: () => void this.activateView(),
		});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/** Re-render every open navigator, e.g. after settings change. */
	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof NavigatorView) view.refresh();
		}
	}

	/** Reveal the navigator, reusing an existing leaf or opening one on the left. */
	private async activateView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE);
		if (existing.length > 0 && existing[0]) {
			await workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf: WorkspaceLeaf | null = workspace.getLeftLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE, active: true });
		await workspace.revealLeaf(leaf);
	}
}
