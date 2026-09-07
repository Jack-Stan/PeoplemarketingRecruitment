import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/services/locations.service', () => ({
  locationsService: {
    subscribe: vi.fn(() => () => {}),
    subscribeVisits: vi.fn(() => () => {}),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    logVisit: vi.fn(),
  },
}));

import { locationsService } from '@/services/locations.service';
import { useLocationsStore } from '@/stores/locations';
import { friendlyError } from '@/utils/errors';
import type { Location, LocationVisit } from '@/types/location';

/** Derived rather than hardcoded — these strings are being translated in parallel. */
const PERMISSION_DENIED_MSG = friendlyError({ code: 'permission-denied' });

const LOC: Location = {
  locationId: 'loc-1',
  officeId: 'office-main',
  name: 'Korenmarkt',
  address: 'Korenmarkt 1, Gent',
  neighbourhood: 'Binnenstad',
  lat: 51.0543,
  lng: 3.7226,
  boundary: null,
  notes: null,
  status: 'planned',
  timesVisited: 0,
  lastVisitedAt: null,
};
const LOC_VISITED: Location = { ...LOC, locationId: 'loc-2', name: 'Vrijdagmarkt', status: 'visited', timesVisited: 4, lastVisitedAt: 1_700_000_000_000 };

const VISIT: LocationVisit = {
  visitId: 'v1',
  locationId: 'loc-1',
  employeeId: 'member-1',
  employeeName: 'Team Lid',
  visitedAt: 1_700_000_000_000,
  notes: null,
};

function withLocations(list: Location[]) {
  vi.mocked(locationsService.subscribe).mockImplementationOnce((_officeId, onChange) => {
    onChange(list);
    return () => {};
  });
  const store = useLocationsStore();
  store.subscribe('office-main');
  return store;
}

describe('locations store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('subscribe', () => {
    it('starts empty', () => {
      const store = useLocationsStore();
      expect(store.locations).toEqual([]);
      expect(store.visits).toEqual([]);
      expect(store.error).toBeNull();
    });

    it('populates locations from the live callback', () => {
      const store = withLocations([LOC, LOC_VISITED]);
      expect(store.locations).toHaveLength(2);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('surfaces a friendly error through onError', () => {
      vi.mocked(locationsService.subscribe).mockImplementationOnce((_officeId, _onChange, onError) => {
        onError(Object.assign(new Error('nope'), { code: 'permission-denied' }));
        return () => {};
      });
      const store = useLocationsStore();
      store.subscribe('office-main');

      expect(store.error).toBe(PERMISSION_DENIED_MSG);
      expect(store.isLoading).toBe(false);
    });

    it('unsubscribe calls the stored teardown', () => {
      const unsubFn = vi.fn();
      vi.mocked(locationsService.subscribe).mockReturnValueOnce(unsubFn);
      const store = useLocationsStore();
      store.subscribe('office-main');
      store.unsubscribe();

      expect(unsubFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('visits subscription', () => {
    it('populates visits for one location', () => {
      vi.mocked(locationsService.subscribeVisits).mockImplementationOnce((_o, _l, onChange) => {
        onChange([VISIT]);
        return () => {};
      });
      const store = useLocationsStore();
      store.subscribeVisits('office-main', 'loc-1');

      expect(locationsService.subscribeVisits).toHaveBeenCalledWith(
        'office-main',
        'loc-1',
        expect.any(Function),
        expect.any(Function),
      );
      expect(store.visits).toEqual([VISIT]);
    });

    it('unsubscribeVisits clears the list so a stale location’s visits never leak into the next one', () => {
      const unsubFn = vi.fn();
      vi.mocked(locationsService.subscribeVisits).mockImplementationOnce((_o, _l, onChange) => {
        onChange([VISIT]);
        return unsubFn;
      });
      const store = useLocationsStore();
      store.subscribeVisits('office-main', 'loc-1');
      expect(store.visits).toHaveLength(1);

      store.unsubscribeVisits();

      expect(unsubFn).toHaveBeenCalledTimes(1);
      expect(store.visits).toEqual([]);
    });

    it('switching location tears the previous visits subscription down', () => {
      const first = vi.fn();
      vi.mocked(locationsService.subscribeVisits).mockReturnValueOnce(first).mockReturnValueOnce(vi.fn());
      const store = useLocationsStore();
      store.subscribeVisits('office-main', 'loc-1');
      store.subscribeVisits('office-main', 'loc-2');

      expect(first).toHaveBeenCalledTimes(1);
    });

    it('a visits error surfaces without clobbering the locations list', () => {
      vi.mocked(locationsService.subscribeVisits).mockImplementationOnce((_o, _l, _onChange, onError) => {
        onError(Object.assign(new Error('nope'), { code: 'permission-denied' }));
        return () => {};
      });
      const store = withLocations([LOC]);
      store.subscribeVisits('office-main', 'loc-1');

      expect(store.error).toBe(PERMISSION_DENIED_MSG);
      expect(store.locations).toHaveLength(1);
    });
  });

  describe('create / update / remove', () => {
    const payload = {
      name: 'Sint-Pietersplein',
      address: null,
      neighbourhood: null,
      lat: 51.03,
      lng: 3.72,
      boundary: null,
      notes: null,
      status: 'planned' as const,
    };

    it('create delegates and returns true', async () => {
      vi.mocked(locationsService.create).mockResolvedValue(undefined);
      const store = useLocationsStore();

      expect(await store.create('office-main', payload)).toBe(true);
      expect(locationsService.create).toHaveBeenCalledWith('office-main', payload);
    });

    it('update delegates the patch and returns true', async () => {
      vi.mocked(locationsService.update).mockResolvedValue(undefined);
      const store = useLocationsStore();

      expect(await store.update('office-main', 'loc-1', { status: 'reserved' })).toBe(true);
      expect(locationsService.update).toHaveBeenCalledWith('office-main', 'loc-1', { status: 'reserved' });
    });

    it('remove delegates and returns true', async () => {
      vi.mocked(locationsService.remove).mockResolvedValue(undefined);
      const store = useLocationsStore();

      expect(await store.remove('office-main', 'loc-1')).toBe(true);
      expect(locationsService.remove).toHaveBeenCalledWith('office-main', 'loc-1');
    });

    it.each([
      ['create', () => useLocationsStore().create('office-main', payload), locationsService.create],
      ['update', () => useLocationsStore().update('office-main', 'loc-1', { name: 'x' }), locationsService.update],
      ['remove', () => useLocationsStore().remove('office-main', 'loc-1'), locationsService.remove],
    ])('%s returns false and records a friendly error on failure', async (_label, call, svc) => {
      vi.mocked(svc as never as ReturnType<typeof vi.fn>).mockRejectedValue(
        Object.assign(new Error('nope'), { code: 'permission-denied' }),
      );
      const store = useLocationsStore();

      expect(await call()).toBe(false);
      expect(store.error).toBe(PERMISSION_DENIED_MSG);
    });
  });

  describe('logVisit', () => {
    const payload = {
      employeeId: 'member-1',
      employeeName: 'Team Lid',
      visitedAt: 1_700_000_000_000,
      notes: 'Drie leads',
    };

    it('delegates the whole payload to the batched service call', async () => {
      vi.mocked(locationsService.logVisit).mockResolvedValue(undefined);
      const store = useLocationsStore();

      expect(await store.logVisit('office-main', 'loc-1', payload)).toBe(true);
      // The visit doc AND the parent's timesVisited/lastVisitedAt counter bump
      // are one batch inside the service — the store must not split them.
      expect(locationsService.logVisit).toHaveBeenCalledTimes(1);
      expect(locationsService.logVisit).toHaveBeenCalledWith('office-main', 'loc-1', payload);
    });

    it('passes visitedAt through unchanged — it is also the parent’s lastVisitedAt', async () => {
      vi.mocked(locationsService.logVisit).mockResolvedValue(undefined);
      const store = useLocationsStore();
      await store.logVisit('office-main', 'loc-1', payload);

      expect(vi.mocked(locationsService.logVisit).mock.calls[0][2].visitedAt).toBe(1_700_000_000_000);
    });

    it('returns false and records a friendly error when the batch fails', async () => {
      vi.mocked(locationsService.logVisit).mockRejectedValue(
        Object.assign(new Error('nope'), { code: 'permission-denied' }),
      );
      const store = useLocationsStore();

      expect(await store.logVisit('office-main', 'loc-1', payload)).toBe(false);
      expect(store.error).toBe(PERMISSION_DENIED_MSG);
    });

    it('does not locally bump timesVisited — the counter comes back via the subscription', async () => {
      vi.mocked(locationsService.logVisit).mockResolvedValue(undefined);
      const store = withLocations([LOC]);
      await store.logVisit('office-main', 'loc-1', payload);

      expect(store.locations[0].timesVisited).toBe(0);
      expect(store.locations[0].lastVisitedAt).toBeNull();
    });

    it('clears a previous error on a subsequent success', async () => {
      vi.mocked(locationsService.logVisit)
        .mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'permission-denied' }))
        .mockResolvedValueOnce(undefined);
      const store = useLocationsStore();

      await store.logVisit('office-main', 'loc-1', payload);
      expect(store.error).toBe(PERMISSION_DENIED_MSG);

      await store.logVisit('office-main', 'loc-1', payload);
      expect(store.error).toBeNull();
    });
  });
});
