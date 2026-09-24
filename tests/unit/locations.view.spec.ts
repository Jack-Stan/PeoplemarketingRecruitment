import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';

/**
 * Leaflet can't run in jsdom and the view calls a wide surface of it, so it
 * is replaced by a stub where every property is a chainable no-op. The tests
 * here are about the view's Firestore listeners, not the map.
 */
vi.mock('leaflet', () => {
  const stub: unknown = new Proxy(function () {}, {
    get: (_t, prop) => (prop === 'then' ? undefined : stub),
    apply: () => stub,
    construct: () => stub as object,
  });
  return { default: stub };
});
vi.mock('leaflet-draw', () => ({}));

type Emit = (list: unknown[]) => void;
const emitters: Record<string, Emit> = {};
const visitUnsubs: { officeId: string; locationId: string; unsub: ReturnType<typeof vi.fn> }[] = [];

vi.mock('@/services/locations.service', () => ({
  locationsService: {
    subscribe: vi.fn((officeId: string, onChange: Emit) => {
      emitters[officeId] = onChange;
      return () => {};
    }),
    subscribeVisits: vi.fn((officeId: string, locationId: string) => {
      const unsub = vi.fn();
      visitUnsubs.push({ officeId, locationId, unsub });
      return unsub;
    }),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    logVisit: vi.fn(),
  },
}));

vi.mock('@/services/auditLog.service', () => ({
  auditLogService: { log: vi.fn().mockResolvedValue(undefined), subscribe: vi.fn(() => () => {}) },
}));

import LocationsView from '@/views/LocationsView.vue';
import { useAuthStore } from '@/stores/auth';
import { useOfficeContextStore } from '@/stores/officeContext';
import type { User } from 'firebase/auth';

// jsdom has no matchMedia; selectLocation uses it to scroll the panel into
// view on phones. Report a desktop width so the scroll path is skipped.
window.matchMedia ??= ((query: string) => ({
  matches: true,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

const PARK = {
  locationId: 'loc-1',
  officeId: 'o1',
  name: 'Citadelpark',
  neighbourhood: null,
  boundary: null,
  shape: null,
  address: null,
  lat: 51.04,
  lng: 3.72,
  status: 'planned',
  notes: null,
  timesVisited: 0,
  lastVisitedAt: null,
  createdAt: 0,
};

async function mountWithParkOpen() {
  const auth = useAuthStore();
  auth.user = { uid: 'admin' } as User;
  auth.role = 'Administrator';
  auth.officeId = 'o1';
  useOfficeContextStore().setActiveOffice('o1');

  const w = mount(LocationsView);
  await flushPromises();
  emitters.o1([PARK]);
  await flushPromises();
  await w.find('tbody tr').trigger('click');
  await flushPromises();

  const open = visitUnsubs.filter((v) => v.locationId === 'loc-1');
  expect(open, 'opening a location starts its visits listener').toHaveLength(1);
  return { w, listener: open[0] };
}

describe('LocationsView visits listener', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    visitUnsubs.length = 0;
    for (const k of Object.keys(emitters)) delete emitters[k];
  });

  it('stops when an admin switches office with a location open', async () => {
    const { w, listener } = await mountWithParkOpen();
    useOfficeContextStore().setActiveOffice('o2');
    await flushPromises();
    expect(listener.unsub).toHaveBeenCalled();
    expect(visitUnsubs.filter((v) => !v.unsub.mock.calls.length)).toHaveLength(0);
    w.unmount();
  });

  it('stops when the open location is deleted by someone else', async () => {
    const { w, listener } = await mountWithParkOpen();
    emitters.o1([]);
    await flushPromises();
    expect(listener.unsub).toHaveBeenCalled();
    expect(visitUnsubs.filter((v) => !v.unsub.mock.calls.length)).toHaveLength(0);
    w.unmount();
  });

  it('stops when leaving the page', async () => {
    const { w, listener } = await mountWithParkOpen();
    w.unmount();
    expect(listener.unsub).toHaveBeenCalled();
  });
});
