/** A single day cell in the month grid. */
export interface CalendarDay {
	year: number;
	/** Zero-based month index (0 = January). */
	month: number;
	day: number;
	/** ISO date, `YYYY-MM-DD`, in local time. */
	iso: string;
	/** True when the day belongs to the grid's own month (not a spillover cell). */
	inMonth: boolean;
}

function pad(value: number): string {
	return value < 10 ? `0${value}` : String(value);
}

/** ISO `YYYY-MM-DD` for the given local calendar date. */
export function isoOf(year: number, month0: number, day: number): string {
	return `${year}-${pad(month0 + 1)}-${pad(day)}`;
}

/**
 * Build a 6×7 month grid for the given month. Leading and trailing cells come
 * from the adjacent months (with `inMonth = false`) so every week is complete.
 *
 * `weekStartsOn` is 0 (Sunday) or 1 (Monday). Uses local dates only, so there
 * are no timezone surprises.
 */
export function buildMonthGrid(
	year: number,
	month0: number,
	weekStartsOn: 0 | 1 = 1,
): CalendarDay[][] {
	const firstWeekday = new Date(year, month0, 1).getDay(); // 0=Sun … 6=Sat
	const lead = (firstWeekday - weekStartsOn + 7) % 7;
	const cursor = new Date(year, month0, 1 - lead);

	const weeks: CalendarDay[][] = [];
	for (let w = 0; w < 6; w++) {
		const week: CalendarDay[] = [];
		for (let d = 0; d < 7; d++) {
			const y = cursor.getFullYear();
			const m = cursor.getMonth();
			const day = cursor.getDate();
			week.push({
				year: y,
				month: m,
				day,
				iso: isoOf(y, m, day),
				inMonth: m === month0,
			});
			cursor.setDate(cursor.getDate() + 1);
		}
		weeks.push(week);
	}
	return weeks;
}

/** Advance a (year, month0) pair by `delta` months, normalising the year. */
export function addMonths(
	year: number,
	month0: number,
	delta: number,
): { year: number; month0: number } {
	const total = year * 12 + month0 + delta;
	return { year: Math.floor(total / 12), month0: ((total % 12) + 12) % 12 };
}
