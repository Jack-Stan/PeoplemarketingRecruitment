import type { Shift } from '@/types/shift';
import { parseLocalISODate } from '@/utils/date';

/** Minutes between two HH:mm times; an end before the start runs past midnight. */
function shiftMinutes(startTime: string, endTime: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const diff = toMin(endTime) - toMin(startTime);
  return diff < 0 ? diff + 24 * 60 : diff;
}

/** 30 → "30u", 37.5 → "37,5u" (nl-BE decimal comma). */
function formatHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 100) / 100;
  return `${String(hours).replace('.', ',')}u`;
}

/**
 * The weekly planning as the WhatsApp group message the office already posts
 * by hand: one block per employee, "Naam (Xu)" with X = that week's planned
 * hours, then one "weekdag: werven" line per day they work. Only APPROVED
 * shifts count — drafts/pending aren't the planning yet. Every shift type
 * prints as "werven" (Stan, 2026-09-24); two shifts on one day stay one line.
 * Employees are sorted by name so the message is stable between shares.
 */
export function formatWeekMessage(shifts: Shift[]): string {
  const byEmployee = new Map<string, { name: string; minutes: number; dates: Set<string> }>();
  for (const s of shifts) {
    if (s.status !== 'approved') continue;
    const entry = byEmployee.get(s.assignedEmployeeId) ?? {
      name: s.employeeName.trim() || 'Onbekend',
      minutes: 0,
      dates: new Set<string>(),
    };
    entry.minutes += shiftMinutes(s.startTime, s.endTime);
    entry.dates.add(s.date);
    byEmployee.set(s.assignedEmployeeId, entry);
  }

  return [...byEmployee.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'nl-BE'))
    .map(({ name, minutes, dates }) => {
      const days = [...dates]
        .sort()
        .map(
          (d) =>
            `${parseLocalISODate(d).toLocaleDateString('nl-BE', { weekday: 'long' })}: werven`,
        );
      return [`${name} (${formatHours(minutes)})`, ...days].join('\n');
    })
    .join('\n\n');
}
