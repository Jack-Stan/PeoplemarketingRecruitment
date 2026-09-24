import { describe, expect, it } from 'vitest';

import type { Shift } from '@/types/shift';
import { formatWeekMessage } from '@/utils/planningMessage';

// 2026-09-28 is a Monday.
function shift(p: Partial<Shift>): Shift {
  return {
    shiftId: Math.random().toString(36),
    officeId: 'gent',
    assignedEmployeeId: 'e1',
    date: '2026-09-28',
    weekStart: '2026-09-28',
    type: 'D2D',
    startTime: '11:00',
    endTime: '17:00',
    status: 'approved',
    rejectionReason: null,
    employeeName: 'Robin De Wolf',
    employeeIsTeamLeader: false,
    eventTitle: null,
    location: null,
    notes: null,
    createdBy: 'admin',
    submittedAt: null,
    decidedAt: null,
    decidedBy: null,
    calendarEventId: null,
    ...p,
  } as Shift;
}

describe('formatWeekMessage', () => {
  it('matches the hand-written group message format', () => {
    const msg = formatWeekMessage([
      shift({ date: '2026-09-29' }),
      shift({ date: '2026-09-30', type: 'Straat' }),
      shift({ date: '2026-10-03', type: 'Event' }),
    ]);
    expect(msg).toBe(
      'Robin De Wolf (18u)\ndinsdag: werven\nwoensdag: werven\nzaterdag: werven',
    );
  });

  it('only counts approved shifts', () => {
    const msg = formatWeekMessage([
      shift({ date: '2026-09-28' }),
      shift({ date: '2026-09-29', status: 'pending' }),
      shift({ date: '2026-09-30', status: 'draft' }),
      shift({ date: '2026-10-01', status: 'rejected' }),
      shift({ assignedEmployeeId: 'e2', employeeName: 'Maya', status: 'pending' }),
    ]);
    expect(msg).toBe('Robin De Wolf (6u)\nmaandag: werven');
  });

  it('sorts days by date and employees by name, blank line between blocks', () => {
    const msg = formatWeekMessage([
      shift({ date: '2026-09-30' }),
      shift({ date: '2026-09-28' }),
      shift({ assignedEmployeeId: 'e2', employeeName: 'Anil', date: '2026-09-29' }),
    ]);
    expect(msg).toBe(
      'Anil (6u)\ndinsdag: werven\n\nRobin De Wolf (12u)\nmaandag: werven\nwoensdag: werven',
    );
  });

  it('sums real durations, keeps two shifts on one day as one line, uses a decimal comma', () => {
    const msg = formatWeekMessage([
      shift({ startTime: '09:30', endTime: '17:00' }), // 7,5u
      shift({ startTime: '18:00', endTime: '20:00' }), // same day, +2u
    ]);
    expect(msg).toBe('Robin De Wolf (9,5u)\nmaandag: werven');
  });

  it('handles a shift running past midnight', () => {
    expect(formatWeekMessage([shift({ startTime: '20:00', endTime: '02:00' })])).toBe(
      'Robin De Wolf (6u)\nmaandag: werven',
    );
  });

  it('returns an empty string when nothing is approved', () => {
    expect(formatWeekMessage([shift({ status: 'pending' })])).toBe('');
  });
});
