import { TFile, moment, normalizePath } from 'obsidian';
import type { App } from 'obsidian';

/** The folder + moment filename format used for daily notes. */
export interface DailyNoteConfig {
	folder: string;
	format: string;
}

interface InternalDailyNotes {
	instance?: { options?: { folder?: string; format?: string } };
}

interface PeriodicNotesPlugin {
	settings?: { daily?: { folder?: string; format?: string; enabled?: boolean } };
}

/**
 * Resolve the daily-note folder and filename format. Reads the core Daily Notes
 * plugin first, then falls back to the community Periodic Notes plugin, then to
 * a sensible default. Empty format defaults to `YYYY-MM-DD`, matching Obsidian.
 */
export function getDailyNoteConfig(app: App): DailyNoteConfig {
	const core = (
		app as unknown as {
			internalPlugins?: {
				getPluginById?: (id: string) => InternalDailyNotes | null;
			};
		}
	).internalPlugins?.getPluginById?.('daily-notes');
	const coreOptions = core?.instance?.options;
	if (coreOptions && (coreOptions.folder || coreOptions.format)) {
		return normalizeConfig(coreOptions.folder, coreOptions.format);
	}

	const periodic = (
		app as unknown as {
			plugins?: { getPlugin?: (id: string) => PeriodicNotesPlugin | null };
		}
	).plugins?.getPlugin?.('periodic-notes')?.settings?.daily;
	if (periodic?.enabled) {
		return normalizeConfig(periodic.folder, periodic.format);
	}

	return normalizeConfig(coreOptions?.folder, coreOptions?.format);
}

function normalizeConfig(
	folder: string | undefined,
	format: string | undefined,
): DailyNoteConfig {
	return {
		folder: (folder ?? '').trim(),
		format: (format ?? '').trim() || 'YYYY-MM-DD',
	};
}

/** The vault path a daily note for `iso` (YYYY-MM-DD) would live at. */
export function dailyNotePath(config: DailyNoteConfig, iso: string): string {
	const filename = moment(iso, 'YYYY-MM-DD').format(config.format);
	const raw = config.folder ? `${config.folder}/${filename}.md` : `${filename}.md`;
	return normalizePath(raw);
}

/** The existing daily-note file for `iso`, or null when there is none. */
export function dailyNoteForDate(
	app: App,
	config: DailyNoteConfig,
	iso: string,
): TFile | null {
	const file = app.vault.getAbstractFileByPath(dailyNotePath(config, iso));
	return file instanceof TFile ? file : null;
}
