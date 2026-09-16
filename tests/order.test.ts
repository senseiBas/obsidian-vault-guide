import { describe, expect, it } from 'vitest';
import {
	baseName,
	migrateSettingsPaths,
	orderFolderPaths,
	reorderSiblings,
	rewritePath,
} from '../src/tree/order';
import type { VaultGuideSettings } from '../src/settings';

describe('baseName', () => {
	it('returns the last path segment', () => {
		expect(baseName('journal/2026/notes')).toBe('notes');
	});

	it('returns the whole string for a top-level path', () => {
		expect(baseName('inbox')).toBe('inbox');
	});
});

describe('orderFolderPaths', () => {
	it('sorts alphabetically (case-insensitive) when no manual order', () => {
		const children = ['a/Zebra', 'a/apple', 'a/Banana'];
		expect(orderFolderPaths(children, undefined)).toEqual([
			'a/apple',
			'a/Banana',
			'a/Zebra',
		]);
	});

	it('puts manually ordered folders first, in order', () => {
		const children = ['a/one', 'a/two', 'a/three'];
		const order = ['a/three', 'a/one'];
		expect(orderFolderPaths(children, order)).toEqual([
			'a/three',
			'a/one',
			'a/two',
		]);
	});

	it('ignores stale entries and appends unlisted children alphabetically', () => {
		const children = ['a/keep', 'a/new', 'a/also'];
		const order = ['a/gone', 'a/keep'];
		expect(orderFolderPaths(children, order)).toEqual([
			'a/keep',
			'a/also',
			'a/new',
		]);
	});

	it('never produces duplicates', () => {
		const children = ['a/x', 'a/y'];
		const order = ['a/x', 'a/x', 'a/y'];
		expect(orderFolderPaths(children, order)).toEqual(['a/x', 'a/y']);
	});
});

describe('reorderSiblings', () => {
	const siblings = ['a', 'b', 'c', 'd'];

	it('moves a folder before the target', () => {
		expect(reorderSiblings(siblings, 'd', 'b', true)).toEqual([
			'a',
			'd',
			'b',
			'c',
		]);
	});

	it('moves a folder after the target', () => {
		expect(reorderSiblings(siblings, 'a', 'c', false)).toEqual([
			'b',
			'c',
			'a',
			'd',
		]);
	});

	it('returns the list unchanged when dragged equals target', () => {
		expect(reorderSiblings(siblings, 'b', 'b', true)).toBe(siblings);
	});

	it('returns the list unchanged when a member is missing', () => {
		expect(reorderSiblings(siblings, 'z', 'b', true)).toBe(siblings);
	});
});

describe('rewritePath', () => {
	it('rewrites an exact match', () => {
		expect(rewritePath('old', 'old', 'new')).toBe('new');
	});

	it('rewrites a descendant path', () => {
		expect(rewritePath('old/child/deep', 'old', 'new')).toBe(
			'new/child/deep',
		);
	});

	it('leaves unrelated paths untouched', () => {
		expect(rewritePath('older', 'old', 'new')).toBe('older');
		expect(rewritePath('other/old', 'old', 'new')).toBe('other/old');
	});
});

describe('migrateSettingsPaths', () => {
	it('rewrites icon keys, order keys, order values and collapsed paths', () => {
		const settings: VaultGuideSettings = {
			folderIcons: {
				projects: '📁',
				'projects/alpha': '⭐',
				other: '📌',
			},
			folderOrder: {
				'/': ['projects', 'other'],
				projects: ['projects/alpha', 'projects/beta'],
			},
			collapsed: ['projects', 'projects/alpha', 'other'],
			hiddenFolderPatterns: ['^_'],
			showHidden: false,
		};

		const migrated = migrateSettingsPaths(settings, 'projects', 'work');

		expect(migrated.folderIcons).toEqual({
			work: '📁',
			'work/alpha': '⭐',
			other: '📌',
		});
		expect(migrated.folderOrder).toEqual({
			'/': ['work', 'other'],
			work: ['work/alpha', 'work/beta'],
		});
		expect(migrated.collapsed).toEqual(['work', 'work/alpha', 'other']);
		expect(migrated.hiddenFolderPatterns).toEqual(['^_']);
		expect(migrated.showHidden).toBe(false);
	});

	it('does not mutate the original settings', () => {
		const settings: VaultGuideSettings = {
			folderIcons: { old: '📁' },
			folderOrder: { '/': ['old'] },
			collapsed: ['old'],
			hiddenFolderPatterns: [],
			showHidden: true,
		};
		migrateSettingsPaths(settings, 'old', 'new');
		expect(settings.folderIcons).toEqual({ old: '📁' });
		expect(settings.folderOrder).toEqual({ '/': ['old'] });
		expect(settings.collapsed).toEqual(['old']);
	});
});
