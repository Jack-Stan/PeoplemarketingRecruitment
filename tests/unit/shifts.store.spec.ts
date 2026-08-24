import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/services/shifts.service', () => ({
  shiftsService: {
    subscribe: vi.fn(() => () => {}),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    submitWeek: vi.fn(),
  },
}));

import { shiftsService } from '@/services/shifts.service';
import { useShiftsStore } from '@/stores/shifts';
import type { Shift } from '@/types/shift';

const SHIFT_A: Shift = {
  shiftId: 's1',
  officeId: 'gent',
  assignedEmployeeId: 'e1',
  date: '2026-08-25',
  weekStart: '2026-08-24',
  type: 'D2D',
  startTime: '11:00',
  endTime: '19:00',
  status: 'draft',
  rejectionReason: null,
  employeeName: 'Mia Member',
  employeeIsTeamLeader: false,
  eventTitle: null,
  location: null,
  notes: null,
  createdBy: 'e1',
  submittedAt: null,
  decidedAt: null,
  decidedBy: null,
  calendarEventId: null,
};

const SHIFT_B: Shift = {
  ...SHIFT_A,
  shiftId: 's2',
  date: '2026-08-25',
  startTime: '09:30',
  type: 'Straat',
  status: 'pending',
  employeeIsTeamLeader: true,
};

const SHIFT_C: Shift = { ...SHIFT_A, shiftId: 's3', date: '2026-08-26', status: 'pending' };

describe('shifts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('groups shifts by date, sorted by start time within a day', () => {
    vi.mocked(shiftsService.subscribe).mockImplementationOnce((_officeId, onChange) => {
      onChange([SHIFT_A, SHIFT_B, SHIFT_C]);
      return () => {};
    });

    const store = useShiftsStore();
    store.subscribe('gent');

    const day1 = store.byDate.get('2026-08-25');
    expect(day1?.map((s) => s.shiftId)).toEqual(['s2', 's1']); // 09:30 before 11:00
    expect(store.byDate.get('2026-08-26')?.map((s) => s.shiftId)).toEqual(['s3']);
  });

  it('pending computes only status === pending shifts', () => {
    vi.mocked(shiftsService.subscribe).mockImplementationOnce((_officeId, onChange) => {
      onChange([SHIFT_A, SHIFT_B, SHIFT_C]);
      return () => {};
    });

    const store = useShiftsStore();
    store.subscribe('gent');

    expect(store.pending.map((s) => s.shiftId).sort()).toEqual(['s2', 's3']);
  });

  it('staffingTotals counts distinct TL vs non-TL employees off the denormalised flag', () => {
    vi.mocked(shiftsService.subscribe).mockImplementationOnce((_officeId, onChange) => {
      onChange([SHIFT_A, SHIFT_B, SHIFT_C]);
      return () => {};
    });

    const store = useShiftsStore();
    store.subscribe('gent');

    expect(store.staffingTotals).toEqual({ shifts: 3, teamLeaders: 1, nonTeamLeaders: 1 });
  });

  it('submitForApproval moves a draft to pending via the service', async () => {
    vi.mocked(shiftsService.update).mockResolvedValueOnce(undefined);

    const store = useShiftsStore();
    const ok = await store.submitForApproval('gent', 's1');

    expect(ok).toBe(true);
    expect(shiftsService.update).toHaveBeenCalledWith('gent', 's1', { status: 'pending' });
  });

  it('submitWeek batches every current draft via the service', async () => {
    const SHIFT_D_DRAFT: Shift = { ...SHIFT_A, shiftId: 's4', date: '2026-08-26' };
    vi.mocked(shiftsService.subscribe).mockImplementationOnce((_officeId, onChange) => {
      onChange([SHIFT_A, SHIFT_D_DRAFT]); // both draft
      return () => {};
    });
    vi.mocked(shiftsService.submitWeek).mockResolvedValueOnce(undefined);

    const store = useShiftsStore();
    store.subscribe('gent');
    const ok = await store.submitWeek('gent', 1_724_500_000_000);

    expect(ok).toBe(true);
    expect(shiftsService.submitWeek).toHaveBeenCalledWith('gent', ['s1', 's4'], 1_724_500_000_000);
  });

  it('hasOverlap catches two overlapping shifts for the same employee/day and ignores rejected ones', () => {
    vi.mocked(shiftsService.subscribe).mockImplementationOnce((_officeId, onChange) => {
      onChange([SHIFT_A, { ...SHIFT_A, shiftId: 's5', status: 'rejected', startTime: '10:00', endTime: '20:00' }]);
      return () => {};
    });

    const store = useShiftsStore();
    store.subscribe('gent');

    // SHIFT_A is e1, 2026-08-25, 11:00-19:00
    expect(store.hasOverlap('e1', '2026-08-25', '12:00', '13:00')).toBe(true); // fully inside
    expect(store.hasOverlap('e1', '2026-08-25', '18:00', '20:00')).toBe(true); // partial overlap
    expect(store.hasOverlap('e1', '2026-08-25', '19:00', '20:00')).toBe(false); // back-to-back, no overlap
    expect(store.hasOverlap('e2', '2026-08-25', '11:00', '19:00')).toBe(false); // different employee
    expect(store.hasOverlap('e1', '2026-08-26', '11:00', '19:00')).toBe(false); // different day
    expect(store.hasOverlap('e1', '2026-08-25', '11:00', '19:00', 's1')).toBe(false); // excludes itself
  });

  it('remove delegates to the service', async () => {
    vi.mocked(shiftsService.remove).mockResolvedValueOnce(undefined);

    const store = useShiftsStore();
    const ok = await store.remove('gent', 's1');

    expect(ok).toBe(true);
    expect(shiftsService.remove).toHaveBeenCalledWith('gent', 's1');
  });

  it('approve clears any prior rejection reason and stamps the decider', async () => {
    vi.mocked(shiftsService.update).mockResolvedValueOnce(undefined);

    const store = useShiftsStore();
    await store.approve('gent', 's2', 'admin-1', 1_724_500_000_000);

    expect(shiftsService.update).toHaveBeenCalledWith('gent', 's2', {
      status: 'approved',
      rejectionReason: null,
      decidedBy: 'admin-1',
      decidedAt: 1_724_500_000_000,
    });
  });

  it('reject stores the reason and stamps the decider', async () => {
    vi.mocked(shiftsService.update).mockResolvedValueOnce(undefined);

    const store = useShiftsStore();
    await store.reject('gent', 's2', 'Understaffed on Team Leaders that day', 'admin-1', 1_724_500_000_000);

    expect(shiftsService.update).toHaveBeenCalledWith('gent', 's2', {
      status: 'rejected',
      rejectionReason: 'Understaffed on Team Leaders that day',
      decidedBy: 'admin-1',
      decidedAt: 1_724_500_000_000,
    });
  });

  it('surfaces a friendly error when a transition fails', async () => {
    vi.mocked(shiftsService.update).mockRejectedValueOnce(
      Object.assign(new Error('nope'), { code: 'permission-denied' }),
    );

    const store = useShiftsStore();
    const ok = await store.approve('gent', 's2', 'admin-1', 1_724_500_000_000);

    expect(ok).toBe(false);
    expect(store.error).toMatch(/permission/i);
  });
});
