import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/services/shifts.service', () => ({
  shiftsService: {
    subscribe: vi.fn(() => () => {}),
    create: vi.fn(),
    update: vi.fn(),
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
  type: 'D2D',
  startTime: '11:00',
  endTime: '19:00',
  status: 'draft',
  rejectionReason: null,
};

const SHIFT_B: Shift = {
  ...SHIFT_A,
  shiftId: 's2',
  date: '2026-08-25',
  startTime: '09:30',
  type: 'Straat',
  status: 'pending',
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

  it('submitForApproval moves a draft to pending via the service', async () => {
    vi.mocked(shiftsService.update).mockResolvedValueOnce(undefined);

    const store = useShiftsStore();
    const ok = await store.submitForApproval('gent', 's1');

    expect(ok).toBe(true);
    expect(shiftsService.update).toHaveBeenCalledWith('gent', 's1', { status: 'pending' });
  });

  it('approve clears any prior rejection reason', async () => {
    vi.mocked(shiftsService.update).mockResolvedValueOnce(undefined);

    const store = useShiftsStore();
    await store.approve('gent', 's2');

    expect(shiftsService.update).toHaveBeenCalledWith('gent', 's2', {
      status: 'approved',
      rejectionReason: null,
    });
  });

  it('reject stores the reason', async () => {
    vi.mocked(shiftsService.update).mockResolvedValueOnce(undefined);

    const store = useShiftsStore();
    await store.reject('gent', 's2', 'Understaffed on Team Leaders that day');

    expect(shiftsService.update).toHaveBeenCalledWith('gent', 's2', {
      status: 'rejected',
      rejectionReason: 'Understaffed on Team Leaders that day',
    });
  });

  it('surfaces a friendly error when a transition fails', async () => {
    vi.mocked(shiftsService.update).mockRejectedValueOnce(
      Object.assign(new Error('nope'), { code: 'permission-denied' }),
    );

    const store = useShiftsStore();
    const ok = await store.approve('gent', 's2');

    expect(ok).toBe(false);
    expect(store.error).toMatch(/permission/i);
  });
});
