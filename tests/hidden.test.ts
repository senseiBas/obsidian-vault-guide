import { describe, expect, it } from 'vitest';
import { compileHidePatterns, isHiddenName } from '../src/tree/hidden';

describe('compileHidePatterns', () => {
	it('compiles bare regex sources', () => {
		const patterns = compileHidePatterns(['^_', '\\.old$']);
		expect(patterns).toHaveLength(2);
	});

	it('supports /source/flags literal form with flags', () => {
		const [regex] = compileHidePatterns(['/^inbox$/i']);
		expect(regex?.test('INBOX')).toBe(true);
	});

	it('drops empty and whitespace-only patterns', () => {
		expect(compileHidePatterns(['', '   ', '^_'])).toHaveLength(1);
	});

	it('drops invalid regex without throwing', () => {
		const patterns = compileHidePatterns(['(', '^_']);
		expect(patterns).toHaveLength(1);
		expect(patterns[0]?.test('_drafts')).toBe(true);
	});
});

describe('isHiddenName', () => {
	const patterns = compileHidePatterns(['^_', '^\\.']);

	it('matches folders starting with an underscore', () => {
		expect(isHiddenName('_reference', patterns)).toBe(true);
	});

	it('matches dot-folders', () => {
		expect(isHiddenName('.trash', patterns)).toBe(true);
	});

	it('leaves ordinary folders visible', () => {
		expect(isHiddenName('journal', patterns)).toBe(false);
	});

	it('never hides anything when there are no patterns', () => {
		expect(isHiddenName('_reference', [])).toBe(false);
	});
});
