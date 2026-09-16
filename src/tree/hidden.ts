/**
 * Compile hide patterns into regular expressions, silently dropping any that are
 * empty or not valid regex. A pattern may be written either as a bare regex
 * source (`^_`) or in `/source/flags` literal form (`/^_/i`).
 */
export function compileHidePatterns(patterns: string[]): RegExp[] {
	const compiled: RegExp[] = [];
	for (const raw of patterns) {
		const regex = toRegExp(raw);
		if (regex) compiled.push(regex);
	}
	return compiled;
}

/** True when the folder name matches at least one of the hide patterns. */
export function isHiddenName(name: string, patterns: RegExp[]): boolean {
	return patterns.some((regex) => regex.test(name));
}

function toRegExp(raw: string): RegExp | null {
	const source = raw.trim();
	if (!source) return null;
	const literal = /^\/(.+)\/([a-z]*)$/i.exec(source);
	try {
		return literal
			? new RegExp(literal[1] ?? '', literal[2])
			: new RegExp(source);
	} catch {
		// Invalid regex — ignore it rather than breaking the whole tree.
		return null;
	}
}
