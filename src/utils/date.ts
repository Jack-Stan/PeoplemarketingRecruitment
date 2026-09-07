/**
 * Local-timezone yyyy-MM-dd formatting. `Date#toISOString()` converts to UTC
 * first, which silently rolls local midnight back to the previous day for
 * any positive UTC offset (Belgium is always UTC+1/+2) — every call site
 * that built a date string via `.toISOString().slice(0, 10)` was one day
 * off. Use this instead whenever a `Date` needs to become a plain date string.
 */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayLocalISO(): string {
  return toLocalISODate(new Date());
}

/**
 * Parse a plain `yyyy-MM-dd` string as LOCAL midnight. The mirror image of
 * `toLocalISODate`: `new Date('2026-09-07')` is parsed by spec as UTC
 * midnight, which is 02:00 local in Belgian summer time — harmless for
 * `date.slice()` style work, but it renders the PREVIOUS weekday for anyone
 * west of UTC and shifts any `setDate()` arithmetic built on top of it.
 * Appending an explicit time forces the local-time parse branch instead.
 * Always use this rather than `new Date(isoDateString)`.
 */
export function parseLocalISODate(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

/**
 * Monday of the ISO week containing `date` (yyyy-MM-dd in, yyyy-MM-dd out).
 * Lives here rather than in `types/shift.ts` — it's date logic, not a type,
 * and the types file importing from utils was the dependency arrow pointing
 * the wrong way. Uses parseLocalISODate/toLocalISODate, NOT `new Date(iso)` +
 * `toISOString()`: both of those go through UTC, which for any positive UTC
 * offset (Belgium is always UTC+1/+2) rolls the day back and makes every
 * computed week start land on Sunday instead of Monday.
 */
export function weekStartFor(date: string): string {
  const d = parseLocalISODate(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalISODate(d);
}

/** `date` shifted by `days`, as a yyyy-MM-dd string. Local-time safe. */
export function addDaysISO(date: string, days: number): string {
  const d = parseLocalISODate(date);
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}

/** First day of the month `months` before/after `date`'s month, as yyyy-MM-dd. */
export function addMonthsISO(date: string, months: number): string {
  const d = parseLocalISODate(date);
  d.setMonth(d.getMonth() + months);
  return toLocalISODate(d);
}
