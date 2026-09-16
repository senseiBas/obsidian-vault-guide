import { Plugin } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import {
	CALENDAR_VIEW_ICON,
	CALENDAR_VIEW_NAME,
	CALENDAR_VIEW_TYPE,
	VIEW_ICON,
	VIEW_NAME,
	VIEW_TYPE,
} from './constants';
import { NavigatorView } from './view/navigator-view';
import { CalendarView } from './view/calendar-view';
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
		this.registerView(
			CALENDAR_VIEW_TYPE,
			(leaf) => new CalendarView(leaf, this),
		);

		// Let the core Page Preview plugin show note previews when hovering a day.
		this.registerHoverLinkSource(CALENDAR_VIEW_TYPE, {
			display: CALENDAR_VIEW_NAME,
			defaultMod: false,
		});

		this.addSettingTab(new VaultGuideSettingTab(this.app, this));

		this.addRibbonIcon(VIEW_ICON, `Open ${VIEW_NAME}`, () => {
			void this.activateView(VIEW_TYPE, 'left');
		});
		this.addRibbonIcon(CALENDAR_VIEW_ICON, `Open ${CALENDAR_VIEW_NAME}`, () => {
			void this.activateView(CALENDAR_VIEW_TYPE, 'right');
		});

		this.addCommand({
			id: 'open-vault-guide',
			name: `Open ${VIEW_NAME}`,
			callback: () => void this.activateView(VIEW_TYPE, 'left'),
		});
		this.addCommand({
			id: 'open-vault-guide-calendar',
			name: `Open ${CALENDAR_VIEW_NAME}`,
			callback: () => void this.activateView(CALENDAR_VIEW_TYPE, 'right'),
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

	/** Reveal a view, reusing an existing leaf or opening one on the given side. */
	private async activateView(
		type: string,
		side: 'left' | 'right',
	): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(type);
		if (existing.length > 0 && existing[0]) {
			await workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf: WorkspaceLeaf | null =
			side === 'left'
				? workspace.getLeftLeaf(false)
				: workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type, active: true });
		await workspace.revealLeaf(leaf);
	}
}
