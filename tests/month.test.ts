import { describe, expect, it } from 'vitest';
import { addMonths, buildMonthGrid, isoOf } from '../src/calendar/month';

describe('isoOf', () => {
	it('zero-pads month and day', () => {
		expect(isoOf(2026, 8, 3)).toBe('2026-09-03');
	});
});

describe('buildMonthGrid', () => {
	// September 2026: the 1st is a Tuesday.
	const grid = buildMonthGrid(2026, 8, 1);

	it('always returns 6 weeks of 7 days', () => {
		expect(grid).toHaveLength(6);
		for (const week of grid) expect(week).toHaveLength(7);
	});

	it('pads the start with the previous month when weeks start on Monday', () => {
		expect(grid[0]?.[0]).toMatchObject({ iso: '2026-08-31', inMonth: false });
		expect(grid[0]?.[1]).toMatchObject({ iso: '2026-09-01', inMonth: true });
	});

	it('marks in-month days correctly', () => {
		const inMonth = grid.flat().filter((d) => d.inMonth);
		expect(inMonth).toHaveLength(30);
		expect(inMonth[0]?.iso).toBe('2026-09-01');
		expect(inMonth[inMonth.length - 1]?.iso).toBe('2026-09-30');
	});

	it('honours a Sunday week start', () => {
		const sunday = buildMonthGrid(2026, 8, 0);
		expect(sunday[0]?.[0]).toMatchObject({ iso: '2026-08-30', inMonth: false });
		expect(sunday[0]?.[2]).toMatchObject({ iso: '2026-09-01', inMonth: true });
	});
});

describe('addMonths', () => {
	it('moves forward across a year boundary', () => {
		expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month0: 0 });
	});

	it('moves backward across a year boundary', () => {
		expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month0: 11 });
	});

	it('handles multi-year jumps', () => {
		expect(addMonths(2026, 5, 25)).toEqual({ year: 2028, month0: 6 });
	});
});
