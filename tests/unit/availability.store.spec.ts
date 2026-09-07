import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/services/availability.service', () => ({
  availabilityService: {
    subscribe: vi.fn(() => () => {}),
    subscribeForEmployee: vi.fn(() => () => {}),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

import { availabilityService } from '@/services/availability.service';
import { useAvailabilityStore } from '@/stores/availability';
import { friendlyError } from '@/utils/errors';
import type { Availability } from '@/types/availability';

/** Derived rather than hardcoded — these strings are being translated in parallel. */
const PERMISSION_DENIED_MSG = friendlyError({ code: 'permission-denied' });

const row = (over: Partial<Availability> = {}): Availability => ({
  availabilityId: 'member-1_2026-08-25',
  officeId: 'office-main',
  employeeId: 'member-1',
  employeeName: 'Team Lid',
  employeeIsTeamLeader: false,
  date: '2026-08-25',
  weekStart: '2026-08-24',
  ...over,
});

const MON = row({ availabilityId: 'member-1_2026-08-24', date: '2026-08-24' });
const TUE = row();
const TUE_OTHER = row({ availabilityId: 'member-2_2026-08-25', employeeId: 'member-2', employeeName: 'Andere Lid' });

function withRows(rows: Availability[]) {
  vi.mocked(availabilityService.subscribe).mockImplementationOnce((_officeId, onChange) => {
    onChange(rows);
    return () => {};
  });
  const store = useAvailabilityStore();
  store.subscribe('office-main');
  return store;
}

describe('availability store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('subscribe / subscribeMine', () => {
    it('starts empty', () => {
      const store = useAvailabilityStore();
      expect(store.rows).toEqual([]);
      expect(store.byDate.size).toBe(0);
    });

    it('office-wide subscribe populates rows and clears loading', () => {
      const store = withRows([MON, TUE, TUE_OTHER]);
      expect(store.rows).toHaveLength(3);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('subscribeMine scopes to one employee via the service', () => {
      vi.mocked(availabilityService.subscribeForEmployee).mockImplementationOnce(
        (_officeId, _employeeId, onChange) => {
          onChange([MON, TUE]);
          return () => {};
        },
      );
      const store = useAvailabilityStore();
      store.subscribeMine('office-main', 'member-1');

      expect(availabilityService.subscribeForEmployee).toHaveBeenCalledWith(
        'office-main',
        'member-1',
        expect.any(Function),
        expect.any(Function),
      );
      expect(store.rows).toHaveLength(2);
    });

    it('surfaces a friendly error from either subscription', () => {
      vi.mocked(availabilityService.subscribe).mockImplementationOnce((_officeId, _onChange, onError) => {
        onError(Object.assign(new Error('nope'), { code: 'permission-denied' }));
        return () => {};
      });
      const store = useAvailabilityStore();
      store.subscribe('office-main');

      expect(store.error).toBe(PERMISSION_DENIED_MSG);
      expect(store.isLoading).toBe(false);
    });

    it('switching from office-wide to own view tears the first subscription down', () => {
      const unsubFn = vi.fn();
      vi.mocked(availabilityService.subscribe).mockReturnValueOnce(unsubFn);
      const store = useAvailabilityStore();
      store.subscribe('office-main');
      store.subscribeMine('office-main', 'member-1');

      expect(unsubFn).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe calls the stored teardown', () => {
      const unsubFn = vi.fn();
      vi.mocked(availabilityService.subscribe).mockReturnValueOnce(unsubFn);
      const store = useAvailabilityStore();
      store.subscribe('office-main');
      store.unsubscribe();

      expect(unsubFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('byDate', () => {
    it('groups rows by their date string', () => {
      const store = withRows([MON, TUE, TUE_OTHER]);

      expect([...store.byDate.keys()].sort()).toEqual(['2026-08-24', '2026-08-25']);
      expect(store.byDate.get('2026-08-24')).toHaveLength(1);
      expect(store.byDate.get('2026-08-25')).toHaveLength(2);
    });

    it('returns undefined for a day nobody marked', () => {
      const store = withRows([MON]);
      expect(store.byDate.get('2026-08-26')).toBeUndefined();
    });

    it('is empty when there are no rows', () => {
      const store = useAvailabilityStore();
      expect(store.byDate.size).toBe(0);
    });
  });

  describe('isMarked', () => {
    it('finds the row for a given employee AND date', () => {
      const store = withRows([MON, TUE, TUE_OTHER]);
      expect(store.isMarked('member-1', '2026-08-25')?.availabilityId).toBe('member-1_2026-08-25');
      expect(store.isMarked('member-2', '2026-08-25')?.availabilityId).toBe('member-2_2026-08-25');
    });

    it('returns undefined when the employee did not mark that date', () => {
      const store = withRows([MON, TUE]);
      expect(store.isMarked('member-1', '2026-08-26')).toBeUndefined();
      expect(store.isMarked('member-9', '2026-08-25')).toBeUndefined();
    });

    it('does not match on date alone — another employee’s mark is not yours', () => {
      const store = withRows([TUE_OTHER]);
      expect(store.isMarked('member-1', '2026-08-25')).toBeUndefined();
    });
  });

  describe('mark', () => {
    const payload = {
      employeeId: 'member-1',
      employeeName: 'Team Lid',
      employeeIsTeamLeader: false,
      date: '2026-08-26',
    };

    it('delegates to the service and returns true', async () => {
      vi.mocked(availabilityService.create).mockResolvedValue('member-1_2026-08-26');
      const store = useAvailabilityStore();

      expect(await store.mark('office-main', payload)).toBe(true);
      expect(availabilityService.create).toHaveBeenCalledWith('office-main', payload);
      expect(store.error).toBeNull();
    });

    it('returns false and records a friendly error on failure', async () => {
      vi.mocked(availabilityService.create).mockRejectedValue(
        Object.assign(new Error('nope'), { code: 'permission-denied' }),
      );
      const store = useAvailabilityStore();

      expect(await store.mark('office-main', payload)).toBe(false);
      expect(store.error).toBe(PERMISSION_DENIED_MSG);
    });

    it('does not optimistically insert into rows — the subscription owns that', async () => {
      vi.mocked(availabilityService.create).mockResolvedValue('member-1_2026-08-26');
      const store = withRows([MON]);
      await store.mark('office-main', payload);

      expect(store.rows).toHaveLength(1);
    });
  });

  describe('unmark', () => {
    it('delegates the availability id and returns true', async () => {
      vi.mocked(availabilityService.remove).mockResolvedValue(undefined);
      const store = useAvailabilityStore();

      expect(await store.unmark('office-main', 'member-1_2026-08-25')).toBe(true);
      expect(availabilityService.remove).toHaveBeenCalledWith('office-main', 'member-1_2026-08-25');
    });

    it('returns false and records a friendly error on failure', async () => {
      vi.mocked(availabilityService.remove).mockRejectedValue(
        Object.assign(new Error('nope'), { code: 'permission-denied' }),
      );
      const store = useAvailabilityStore();

      expect(await store.unmark('office-main', 'member-1_2026-08-25')).toBe(false);
      expect(store.error).toBe(PERMISSION_DENIED_MSG);
    });
  });

  it('mark then unmark round-trips through the id the store was given', async () => {
    vi.mocked(availabilityService.create).mockResolvedValue('member-1_2026-08-25');
    vi.mocked(availabilityService.remove).mockResolvedValue(undefined);
    const store = withRows([TUE]);

    const existing = store.isMarked('member-1', '2026-08-25');
    expect(existing).toBeDefined();
    await store.unmark('office-main', existing!.availabilityId);

    expect(availabilityService.remove).toHaveBeenCalledWith('office-main', 'member-1_2026-08-25');
  });
});
