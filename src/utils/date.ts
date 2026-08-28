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
