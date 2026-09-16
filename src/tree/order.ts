import type { VaultGuideSettings } from '../settings';

/** The last path segment (folder or file name) of a vault path. */
export function baseName(path: string): string {
	const index = path.lastIndexOf('/');
	return index >= 0 ? path.slice(index + 1) : path;
}

/**
 * Order a parent's child folders for display: the paths listed in `order` come
 * first, in that order, followed by any remaining children sorted alphabetically
 * (case-insensitive). Stale entries in `order` (folders that no longer exist)
 * are ignored, and children missing from `order` are appended, so the result
 * always covers exactly `childPaths` with no duplicates.
 */
export function orderFolderPaths(
	childPaths: string[],
	order: string[] | undefined,
): string[] {
	const present = new Set(childPaths);
	const seen = new Set<string>();
	const ranked: string[] = [];
	for (const path of order ?? []) {
		if (present.has(path) && !seen.has(path)) {
			seen.add(path);
			ranked.push(path);
		}
	}
	const rest = childPaths
		.filter((path) => !seen.has(path))
		.sort((a, b) =>
			baseName(a).localeCompare(baseName(b), undefined, {
				sensitivity: 'base',
			}),
		);
	return [...ranked, ...rest];
}

/**
 * The new sibling order after moving `dragged` to just before or after
 * `target`. Both must already be members of `siblings`; otherwise the list is
 * returned unchanged.
 */
export function reorderSiblings(
	siblings: string[],
	dragged: string,
	target: string,
	before: boolean,
): string[] {
	if (dragged === target) return siblings;
	if (!siblings.includes(dragged) || !siblings.includes(target)) {
		return siblings;
	}
	const next = siblings.filter((path) => path !== dragged);
	const index = next.indexOf(target);
	next.splice(before ? index : index + 1, 0, dragged);
	return next;
}

/** Rewrite a path when it, or one of its ancestors, is renamed or moved. */
export function rewritePath(
	path: string,
	oldPath: string,
	newPath: string,
): string {
	if (path === oldPath) return newPath;
	if (path.startsWith(`${oldPath}/`)) {
		return `${newPath}${path.slice(oldPath.length)}`;
	}
	return path;
}

/**
 * Return a copy of the settings with every stored path updated after a folder
 * move/rename from `oldPath` to `newPath`. Covers icon keys, order keys, the
 * paths inside each order list, and the collapsed set, so display state follows
 * a folder when the user renames or moves it. Purely in-memory — it never
 * touches the vault.
 */
export function migrateSettingsPaths(
	settings: VaultGuideSettings,
	oldPath: string,
	newPath: string,
): VaultGuideSettings {
	const rewrite = (path: string): string =>
		rewritePath(path, oldPath, newPath);

	const folderIcons: Record<string, string> = {};
	for (const [path, icon] of Object.entries(settings.folderIcons)) {
		folderIcons[rewrite(path)] = icon;
	}

	const folderOrder: Record<string, string[]> = {};
	for (const [parent, children] of Object.entries(settings.folderOrder)) {
		folderOrder[rewrite(parent)] = children.map(rewrite);
	}

	const collapsed = settings.collapsed.map(rewrite);

	return { ...settings, folderIcons, folderOrder, collapsed };
}
