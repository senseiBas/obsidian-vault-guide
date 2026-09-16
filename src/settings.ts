/**
 * All persisted state for Vault Guide. Every field is purely presentational and
 * lives in the plugin's own `data.json`; none of it is ever written back to the
 * vault (no renames, moves, or note edits).
 */
export interface VaultGuideSettings {
	/**
	 * Manual child-folder order, keyed by the parent folder's path. Each value
	 * is a list of child folder paths in the order they should appear. Folders
	 * not listed fall back to alphabetical order after the listed ones.
	 */
	folderOrder: Record<string, string[]>;
	/** Emoji icon per folder path. Display-only overlay on the folder name. */
	folderIcons: Record<string, string>;
	/** Collapsed folder paths, so the tree remembers its expand state. */
	collapsed: string[];
	/**
	 * Regular expressions (as strings), each tested against a folder's name.
	 * Matching folders are hidden from the tree unless `showHidden` is on.
	 */
	hiddenFolderPatterns: string[];
	/** When true, hidden folders are still shown, greyed out. */
	showHidden: boolean;
}

export const DEFAULT_SETTINGS: VaultGuideSettings = {
	folderOrder: {},
	folderIcons: {},
	collapsed: [],
	hiddenFolderPatterns: [],
	showHidden: false,
};

function isStringRecord(value: unknown): value is Record<string, string> {
	if (typeof value !== 'object' || value === null) return false;
	return Object.values(value).every((item) => typeof item === 'string');
}

function isStringArrayRecord(
	value: unknown,
): value is Record<string, string[]> {
	if (typeof value !== 'object' || value === null) return false;
	return Object.values(value).every(
		(item) =>
			Array.isArray(item) &&
			item.every((entry) => typeof entry === 'string'),
	);
}

/**
 * Coerce unknown persisted data into a valid settings object, dropping anything
 * that does not match the expected shape. Keeps the plugin resilient to hand
 * edits and older data files.
 */
export function normalizeSettings(raw: unknown): VaultGuideSettings {
	const data = (raw ?? {}) as Partial<VaultGuideSettings>;
	return {
		folderOrder: isStringArrayRecord(data.folderOrder)
			? data.folderOrder
			: {},
		folderIcons: isStringRecord(data.folderIcons) ? data.folderIcons : {},
		collapsed: Array.isArray(data.collapsed)
			? data.collapsed.filter(
					(path): path is string => typeof path === 'string',
				)
			: [],
		hiddenFolderPatterns: Array.isArray(data.hiddenFolderPatterns)
			? data.hiddenFolderPatterns.filter(
					(pattern): pattern is string => typeof pattern === 'string',
				)
			: [],
		showHidden: typeof data.showHidden === 'boolean' ? data.showHidden : false,
	};
}
