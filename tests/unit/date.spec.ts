import { describe, expect, it } from 'vitest';

import {
  addDaysISO,
  addMonthsISO,
  parseLocalISODate,
  toLocalISODate,
  todayLocalISO,
  weekStartFor,
} from '@/utils/date';

/**
 * Regression tests for the UTC date-shift bug fixed in commit 4eafdac.
 *
 * The bug: call sites built date strings with `d.toISOString().slice(0, 10)`.
 * `toISOString()` converts to UTC first, so for any POSITIVE UTC offset
 * (Belgium is always UTC+1 in winter / UTC+2 in summer) a local time near
 * midnight rolls BACK to the previous calendar day. Every affected date was
 * one day early, and `weekStartFor` consequently returned Sunday instead of
 * Monday.
 *
 * These tests are written so they FAIL under the old UTC-based behaviour:
 * each case constructs a Date whose local calendar day and UTC calendar day
 * differ, then asserts the LOCAL day is what comes out. The assertions are
 * expressed against the Date's own local getters rather than hardcoded
 * strings, so they hold in any process timezone (CI may not run Europe/
 * Brussels) while still pinning the local-vs-UTC distinction.
 */

/** What the buggy implementation would have produced. */
function utcISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The local calendar day, computed independently of the code under test. */
function expectedLocal(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

describe('toLocalISODate', () => {
  it('formats a plain midday date as yyyy-MM-dd', () => {
    expect(toLocalISODate(new Date(2026, 7, 25, 12, 0, 0))).toBe('2026-08-25');
  });

  it('zero-pads single-digit months and days', () => {
    expect(toLocalISODate(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
    expect(toLocalISODate(new Date(2026, 8, 9, 12, 0, 0))).toBe('2026-09-09');
  });

  it.each([
    ['just after local midnight', 2026, 7, 25, 0, 0, 1],
    ['just before local midnight', 2026, 7, 25, 23, 59, 59],
    ['exactly local midnight', 2026, 7, 25, 0, 0, 0],
  ])('%s returns the LOCAL day, never the UTC day', (_label, y, m, d, hh, mm, ss) => {
    const date = new Date(y, m, d, hh, mm, ss);
    expect(toLocalISODate(date)).toBe(expectedLocal(date));
    // Sanity: pin the fact that this is a real distinction, not a tautology.
    // Under any non-zero UTC offset at least one of these near-midnight
    // instants disagrees with toISOString(); when the process happens to run
    // in UTC they agree and the check is vacuous, which is correct.
    if (date.getTimezoneOffset() !== 0) {
      const midnight = new Date(y, m, d, 0, 0, 0);
      const lastSecond = new Date(y, m, d, 23, 59, 59);
      expect(utcISODate(midnight) === expectedLocal(midnight) && utcISODate(lastSecond) === expectedLocal(lastSecond)).toBe(false);
    }
  });

  it('does not roll a New Year local midnight back into the previous year', () => {
    const nye = new Date(2027, 0, 1, 0, 30, 0);
    expect(toLocalISODate(nye)).toBe('2027-01-01');
    expect(toLocalISODate(nye).slice(0, 4)).toBe('2027');
  });

  it('handles a month rollover at local midnight', () => {
    expect(toLocalISODate(new Date(2026, 8, 1, 0, 15, 0))).toBe('2026-09-01');
    expect(toLocalISODate(new Date(2026, 7, 31, 23, 45, 0))).toBe('2026-08-31');
  });

  it('handles a leap day', () => {
    expect(toLocalISODate(new Date(2028, 1, 29, 0, 5, 0))).toBe('2028-02-29');
  });

  it.each([
    ['spring forward (EU DST starts last Sunday of March)', 2026, 2, 29],
    ['fall back (EU DST ends last Sunday of October)', 2026, 9, 25],
  ])('%s: the DST day itself formats as that same day', (_label, y, m, d) => {
    for (const hour of [0, 1, 2, 3, 12, 23]) {
      const date = new Date(y, m, d, hour, 30, 0);
      expect(toLocalISODate(date)).toBe(expectedLocal(date));
    }
  });

  it('todayLocalISO agrees with toLocalISODate(new Date())', () => {
    expect(todayLocalISO()).toBe(toLocalISODate(new Date()));
    expect(todayLocalISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('weekStartFor', () => {
  it.each([
    ['Monday', '2026-08-24', '2026-08-24'],
    ['Tuesday', '2026-08-25', '2026-08-24'],
    ['Wednesday', '2026-08-26', '2026-08-24'],
    ['Thursday', '2026-08-27', '2026-08-24'],
    ['Friday', '2026-08-28', '2026-08-24'],
    ['Saturday', '2026-08-29', '2026-08-24'],
    ['Sunday', '2026-08-30', '2026-08-24'],
  ])('%s maps to the Monday of its ISO week', (_label, date, expected) => {
    expect(weekStartFor(date)).toBe(expected);
  });

  it('a Sunday belongs to the week that STARTED six days earlier, not the next one', () => {
    // The classic off-by-one: getDay() === 0 must subtract 6, not add 1.
    expect(weekStartFor('2026-08-30')).toBe('2026-08-24');
    expect(weekStartFor('2026-01-04')).toBe('2025-12-29');
  });

  it('is idempotent — the week start of a week start is itself', () => {
    for (const d of ['2026-08-24', '2026-01-05', '2026-12-28']) {
      expect(weekStartFor(weekStartFor(d))).toBe(weekStartFor(d));
    }
  });

  it('never returns a Sunday for any day of a full year (the exact production symptom)', () => {
    const seen = new Set<string>();
    const cursor = new Date(2026, 0, 1, 12, 0, 0);
    for (let i = 0; i < 365; i++) {
      const iso = toLocalISODate(cursor);
      const start = weekStartFor(iso);
      seen.add(start);
      expect(new Date(`${start}T00:00:00`).getDay()).toBe(1); // 1 = Monday
      cursor.setDate(cursor.getDate() + 1);
    }
    expect(seen.size).toBeGreaterThanOrEqual(52);
  });

  it('rolls back across a month boundary', () => {
    expect(weekStartFor('2026-09-01')).toBe('2026-08-31'); // Tue → Mon in previous month
    expect(weekStartFor('2026-03-01')).toBe('2026-02-23'); // Sunday → previous Monday
  });

  it('rolls back across a year boundary', () => {
    expect(weekStartFor('2026-01-01')).toBe('2025-12-29'); // Thursday → Monday in previous year
    expect(weekStartFor('2027-01-01')).toBe('2026-12-28');
  });

  it('survives the spring-forward DST day without shifting a day', () => {
    // 2026-03-29 is a Sunday and the EU spring-forward day: that local day has
    // only 23 hours. Naive date arithmetic (subtracting 6 * 86400000 ms) lands
    // on the wrong calendar day here; setDate() does not.
    expect(weekStartFor('2026-03-29')).toBe('2026-03-23');
    expect(weekStartFor('2026-03-30')).toBe('2026-03-30');
    expect(weekStartFor('2026-03-28')).toBe('2026-03-23');
  });

  it('survives the fall-back DST day without shifting a day', () => {
    // 2026-10-25 is a Sunday and the EU fall-back day (25 hours long).
    expect(weekStartFor('2026-10-25')).toBe('2026-10-19');
    expect(weekStartFor('2026-10-26')).toBe('2026-10-26');
  });

  it('is built on parseLocalISODate, so it agrees with a locally-constructed Date', () => {
    const monday = parseLocalISODate('2026-08-24');
    expect(monday.getDay()).toBe(1);
    expect(weekStartFor(toLocalISODate(monday))).toBe('2026-08-24');
  });

  it('parses the date string in LOCAL time, not UTC', () => {
    // `new Date('2026-08-30')` (no time part) is parsed as UTC midnight, which
    // in a negative-offset timezone is Saturday the 29th locally — the parsing
    // half of the same bug. weekStartFor appends T00:00:00 to force local
    // parsing, so its answer must match a locally-constructed date.
    const localSunday = new Date(2026, 7, 30, 0, 0, 0);
    expect(localSunday.getDay()).toBe(0);
    expect(weekStartFor(toLocalISODate(localSunday))).toBe('2026-08-24');
  });
});

describe('parseLocalISODate', () => {
  it('returns LOCAL midnight, not UTC midnight', () => {
    const d = parseLocalISODate('2026-09-07');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // September
    expect(d.getDate()).toBe(7);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('disagrees with `new Date(iso)` whenever the process is not on UTC', () => {
    // This is the whole reason the helper exists: `new Date('2026-09-07')` is
    // parsed by spec as UTC midnight, so its LOCAL calendar day is the 6th
    // for anyone west of UTC and its local hour is non-zero east of it.
    const helper = parseLocalISODate('2026-09-07');
    const naive = new Date('2026-09-07');
    if (helper.getTimezoneOffset() !== 0) {
      expect(helper.getTime()).not.toBe(naive.getTime());
    }
    // Either way the helper's local day is always the requested one.
    expect(toLocalISODate(helper)).toBe('2026-09-07');
  });

  it('round-trips with toLocalISODate for a full month, DST day included', () => {
    for (let day = 1; day <= 31; day++) {
      const iso = `2026-03-${String(day).padStart(2, '0')}`;
      expect(toLocalISODate(parseLocalISODate(iso))).toBe(iso);
    }
  });
});

describe('addDaysISO', () => {
  it('adds and subtracts whole days', () => {
    expect(addDaysISO('2026-08-24', 1)).toBe('2026-08-25');
    expect(addDaysISO('2026-08-24', -1)).toBe('2026-08-23');
    expect(addDaysISO('2026-08-24', 0)).toBe('2026-08-24');
    expect(addDaysISO('2026-08-24', 7)).toBe('2026-08-31');
  });

  it('rolls over month and year boundaries', () => {
    expect(addDaysISO('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysISO('2026-02-28', 1)).toBe('2026-03-01'); // 2026 is not a leap year
  });

  it('does not lose or gain a day across either DST boundary', () => {
    // Naive `+ days * 86400000` arithmetic fails exactly here: the 23-hour and
    // 25-hour local days. setDate()-based arithmetic does not.
    expect(addDaysISO('2026-03-28', 1)).toBe('2026-03-29'); // into spring-forward
    expect(addDaysISO('2026-03-29', 1)).toBe('2026-03-30'); // out of it
    expect(addDaysISO('2026-10-24', 1)).toBe('2026-10-25'); // into fall-back
    expect(addDaysISO('2026-10-25', 1)).toBe('2026-10-26'); // out of it
  });

  it('stepping 7 days from a week start lands on the next week start', () => {
    const start = weekStartFor('2026-03-25');
    expect(weekStartFor(addDaysISO(start, 7))).toBe(addDaysISO(start, 7));
  });
});

describe('addMonthsISO', () => {
  it('moves forward and backward by whole months', () => {
    expect(addMonthsISO('2026-08-15', 1)).toBe('2026-09-15');
    expect(addMonthsISO('2026-08-15', -1)).toBe('2026-07-15');
    expect(addMonthsISO('2026-08-15', 0)).toBe('2026-08-15');
  });

  it('rolls over the year boundary', () => {
    expect(addMonthsISO('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonthsISO('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('returns a valid date string for every month of a year', () => {
    for (let m = 0; m < 12; m++) {
      expect(addMonthsISO('2026-01-01', m)).toMatch(/^\d{4}-\d{2}-01$/);
    }
  });
});
