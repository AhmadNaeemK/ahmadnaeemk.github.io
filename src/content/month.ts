/**
 * Month-only dates ("2024-07"). They are handled as plain strings and never
 * become a `Date`, so neither the build machine's timezone nor the visitor's
 * can move one into a neighbouring month.
 */

export const PRESENT = "present";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const RANGE_SEPARATOR = " – ";

export function isMonth(candidate: string): boolean {
  return MONTH_PATTERN.test(candidate);
}

/** Formats "2024-07" as "Jul 2024". Throws on anything that is not a month. */
export function formatMonth(month: string): string {
  if (!isMonth(month)) {
    throw new Error(`Expected a month as "YYYY-MM", got "${month}"`);
  }
  const [year, monthNumber] = month.split("-");
  return `${MONTH_NAMES[Number(monthNumber) - 1]} ${year}`;
}

/** Formats an end date, which is a month or the word "present". */
export function formatEnd(end: string): string {
  return end === PRESENT ? "Present" : formatMonth(end);
}

/** Zero-padded months sort as text, so no date parsing is needed here. */
export function isChronological(start: string, end: string): boolean {
  return end === PRESENT || start <= end;
}

export interface DateLabels {
  startLabel: string;
  endLabel: string;
  /** Both ends together, such as "Jul 2024 – Present". */
  dates: string;
}

export function dateLabels(start: string, end: string): DateLabels {
  const startLabel = formatMonth(start);
  const endLabel = formatEnd(end);
  return {
    startLabel,
    endLabel,
    dates: `${startLabel}${RANGE_SEPARATOR}${endLabel}`,
  };
}
