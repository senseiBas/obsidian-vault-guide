import { ItemView, moment, setIcon } from 'obsidian';
import type { HoverPopover, WorkspaceLeaf } from 'obsidian';
import {
	CALENDAR_VIEW_ICON,
	CALENDAR_VIEW_NAME,
	CALENDAR_VIEW_TYPE,
} from '../constants';
import { addMonths, buildMonthGrid, isoOf } from '../calendar/month';
import {
	dailyNoteForDate,
	getDailyNoteConfig,
	type DailyNoteConfig,
} from '../calendar/daily-notes';
import type VaultGuidePlugin from '../main';

const WEEK_STARTS_ON = 1; // Monday

/**
 * A month calendar in its own pane. Days that have a daily note show a dot;
 * clicking such a day opens the note and hovering it shows Obsidian's page
 * preview. The daily-note folder and format are detected from the core Daily
 * Notes plugin (or Periodic Notes as a fallback).
 */
export class CalendarView extends ItemView {
	/** HoverParent: the core Page Preview plugin manages this popover. */
	hoverPopover: HoverPopover | null = null;

	private readonly plugin: VaultGuidePlugin;
	private year: number;
	private month0: number;

	constructor(leaf: WorkspaceLeaf, plugin: VaultGuidePlugin) {
		super(leaf);
		this.plugin = plugin;
		const now = new Date();
		this.year = now.getFullYear();
		this.month0 = now.getMonth();
	}

	getViewType(): string {
		return CALENDAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return CALENDAR_VIEW_NAME;
	}

	getIcon(): string {
		return CALENDAR_VIEW_ICON;
	}

	protected async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('vault-guide-calendar');
		this.registerVaultEvents();
		this.render();
	}

	protected async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private registerVaultEvents(): void {
		const onChange = () => this.render();
		this.registerEvent(this.app.vault.on('create', onChange));
		this.registerEvent(this.app.vault.on('delete', onChange));
		this.registerEvent(this.app.vault.on('rename', onChange));
	}

	private goToMonth(delta: number): void {
		const next = addMonths(this.year, this.month0, delta);
		this.year = next.year;
		this.month0 = next.month0;
		this.render();
	}

	private goToToday(): void {
		const now = new Date();
		this.year = now.getFullYear();
		this.month0 = now.getMonth();
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		const config = getDailyNoteConfig(this.app);
		const todayIso = isoOf(
			new Date().getFullYear(),
			new Date().getMonth(),
			new Date().getDate(),
		);

		this.renderHeader();
		this.renderWeekdayRow();

		const gridEl = this.contentEl.createDiv('vault-guide-cal-grid');
		const weeks = buildMonthGrid(this.year, this.month0, WEEK_STARTS_ON);
		for (const week of weeks) {
			const firstIso = week[0]?.iso;
			gridEl.createSpan({
				cls: 'vault-guide-cal-weeknum',
				text: firstIso
					? String(moment(firstIso, 'YYYY-MM-DD').isoWeek())
					: '',
			});
			for (const day of week) {
				this.renderDay(gridEl, day, config, todayIso);
			}
		}
	}

	private renderHeader(): void {
		const headerEl = this.contentEl.createDiv('vault-guide-cal-header');

		const prev = headerEl.createEl('button', {
			cls: 'vault-guide-toolbar-btn',
			attr: { 'aria-label': 'Previous month' },
		});
		setIcon(prev, 'chevron-left');
		prev.addEventListener('click', () => this.goToMonth(-1));

		headerEl.createSpan({
			cls: 'vault-guide-cal-title',
			text: moment([this.year, this.month0, 1]).format('MMMM YYYY'),
		});

		const next = headerEl.createEl('button', {
			cls: 'vault-guide-toolbar-btn',
			attr: { 'aria-label': 'Next month' },
		});
		setIcon(next, 'chevron-right');
		next.addEventListener('click', () => this.goToMonth(1));

		const today = headerEl.createEl('button', {
			cls: 'vault-guide-toolbar-btn vault-guide-cal-today-btn',
			attr: { 'aria-label': 'Go to today' },
		});
		setIcon(today, 'calendar-check');
		today.addEventListener('click', () => this.goToToday());
	}

	private renderWeekdayRow(): void {
		const rowEl = this.contentEl.createDiv('vault-guide-cal-weekdays');
		rowEl.createSpan('vault-guide-cal-weeknum');
		const labels = moment.weekdaysMin();
		for (let i = 0; i < 7; i++) {
			const index = (i + WEEK_STARTS_ON) % 7;
			rowEl.createSpan({
				cls: 'vault-guide-cal-weekday',
				text: labels[index] ?? '',
			});
		}
	}

	private renderDay(
		gridEl: HTMLElement,
		day: { iso: string; day: number; inMonth: boolean },
		config: DailyNoteConfig,
		todayIso: string,
	): void {
		const cellEl = gridEl.createDiv('vault-guide-cal-day');
		if (!day.inMonth) cellEl.addClass('is-outside');
		if (day.iso === todayIso) cellEl.addClass('is-today');

		cellEl.createSpan({
			cls: 'vault-guide-cal-daynum',
			text: String(day.day),
		});

		const file = dailyNoteForDate(this.app, config, day.iso);
		if (!file) return;

		cellEl.addClass('has-note');
		cellEl.createDiv('vault-guide-cal-dot');

		cellEl.addEventListener('click', () => {
			void this.app.workspace.openLinkText(file.path, '', false);
		});
		cellEl.addEventListener('mouseover', (event) => {
			this.app.workspace.trigger('hover-link', {
				event,
				source: CALENDAR_VIEW_TYPE,
				hoverParent: this,
				targetEl: cellEl,
				linktext: file.path,
				sourcePath: file.path,
			});
		});
	}
}
