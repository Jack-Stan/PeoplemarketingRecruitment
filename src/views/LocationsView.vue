<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

import { useAuth } from '@/composables/useAuth';
import { useActiveOffice } from '@/composables/useActiveOffice';
import { useLocationsStore } from '@/stores/locations';
import { useUiStore } from '@/stores/ui';
import {
  LOCATION_STATUS_LABELS,
  type LatLng,
  type Location,
  type LocationCreatePayload,
  type LocationStatus,
} from '@/types/location';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const STATUS_COLORS: Record<LocationStatus, string> = {
  planned: '#f59e0b',
  reserved: '#3b82f6',
  visited: '#10b981',
};

const auth = useAuth();
const store = useLocationsStore();
const ui = useUiStore();
const { officeId } = useActiveOffice();
const isStaff = computed(() => auth.hasRole('Administrator', 'TeamManager'));
// Coverage stats (times visited / last visited) are leadership-only per
// Stan: "teamleaders/admin can see how many times did they do a
// neighbourhood" — a plain team member still sees the pins/areas (they need
// to know where to go) but not the numbers. firestore.rules enforces this
// server-side for the visits log itself; the location doc's own denormalised
// counters aren't field-level-restrictable in Firestore rules, so this is
// belt (server-side visits log) + client-side hiding of the doc's counters,
// same "documented client-side-only" pattern already used for overlap
// validation and the last-admin guard elsewhere in this app.
const canSeeCoverage = computed(() => auth.hasRole('Administrator') || auth.isTeamLeader.value);

const statusFilter = ref<LocationStatus | 'all'>('all');
const search = ref('');
const filtered = computed(() =>
  store.locations.filter(
    (l) =>
      (statusFilter.value === 'all' || l.status === statusFilter.value) &&
      `${l.name} ${l.neighbourhood ?? ''} ${l.address ?? ''}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
);

function formatDate(ms: number | null): string {
  if (!ms) return 'Nooit';
  return new Date(ms).toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// --- Map ---------------------------------------------------------------
const mapEl = ref<HTMLElement | null>(null);
let map: mapboxgl.Map | null = null;
let draw: MapboxDraw | null = null;
const isDrawingArea = ref(false);
const markers: mapboxgl.Marker[] = [];
const popups: mapboxgl.Popup[] = [];

function popupHtml(l: Location): string {
  const coverage = canSeeCoverage.value
    ? `<br/>${l.timesVisited}x bezocht · laatst ${formatDate(l.lastVisitedAt)}`
    : '';
  const notes = l.notes ? `<br/><em>${l.notes}</em>` : '';
  return `<strong>${l.name}</strong><br/>${l.neighbourhood ?? ''}<br/>${LOCATION_STATUS_LABELS[l.status]}${coverage}${notes}`;
}

function clearMapLayers(): void {
  markers.forEach((m) => m.remove());
  markers.length = 0;
  popups.forEach((p) => p.remove());
  popups.length = 0;
  if (map?.getLayer('location-areas-fill')) map.removeLayer('location-areas-fill');
  if (map?.getLayer('location-areas-line')) map.removeLayer('location-areas-line');
  if (map?.getSource('location-areas')) map.removeSource('location-areas');
}

function renderLocations(): void {
  if (!map) return;
  clearMapLayers();

  const areaFeatures = filtered.value
    .filter((l) => l.boundary && l.boundary.length >= 3)
    .map((l) => ({
      type: 'Feature' as const,
      properties: { locationId: l.locationId },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[...l.boundary!.map((p) => [p.lng, p.lat]), [l.boundary![0].lng, l.boundary![0].lat]]],
      },
    }));

  if (areaFeatures.length) {
    map.addSource('location-areas', { type: 'geojson', data: { type: 'FeatureCollection', features: areaFeatures } });
    map.addLayer({
      id: 'location-areas-fill',
      type: 'fill',
      source: 'location-areas',
      paint: {
        'fill-color': [
          'match',
          ['get', 'locationId'],
          ...filtered.value.filter((l) => l.boundary).flatMap((l) => [l.locationId, STATUS_COLORS[l.status]]),
          '#999999',
        ],
        'fill-opacity': 0.35,
      },
    });
    map.addLayer({
      id: 'location-areas-line',
      type: 'line',
      source: 'location-areas',
      paint: {
        'line-color': [
          'match',
          ['get', 'locationId'],
          ...filtered.value.filter((l) => l.boundary).flatMap((l) => [l.locationId, STATUS_COLORS[l.status]]),
          '#999999',
        ],
        'line-width': 2,
      },
    });
    map.on('click', 'location-areas-fill', (e) => {
      const l = filtered.value.find((x) => x.locationId === e.features?.[0]?.properties?.locationId);
      if (l) new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(popupHtml(l)).addTo(map!);
    });
  }

  const bounds = new mapboxgl.LngLatBounds();
  let hasPoints = false;
  for (const l of filtered.value) {
    hasPoints = true;
    bounds.extend([l.lng, l.lat]);
    if (l.boundary && l.boundary.length >= 3) {
      l.boundary.forEach((p) => bounds.extend([p.lng, p.lat]));
      continue; // areas are rendered via the fill/line layers above, not a pin
    }
    const el = document.createElement('div');
    el.style.cssText = `width:16px;height:16px;border-radius:50%;border:2px solid #fff;background:${STATUS_COLORS[l.status]};box-shadow:0 0 0 1px rgba(0,0,0,.2);`;
    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([l.lng, l.lat])
      .setPopup(new mapboxgl.Popup().setHTML(popupHtml(l)))
      .addTo(map);
    markers.push(marker);
  }
  if (hasPoints && !bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 15 });
}

onMounted(async () => {
  await nextTick();
  if (!mapEl.value || !MAPBOX_TOKEN) return;
  mapboxgl.accessToken = MAPBOX_TOKEN;
  map = new mapboxgl.Map({
    container: mapEl.value,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [3.725, 51.0538], // Ghent
    zoom: 12,
  });
  draw = new MapboxDraw({ displayControlsDefault: false, controls: { polygon: true, trash: true } });
  map.addControl(draw);
  map.on('draw.create', onAreaDrawn);
  map.on('load', renderLocations);
});
onBeforeUnmount(() => {
  map?.remove();
  map = null;
});
watch(filtered, () => renderLocations());

function toggleDrawArea(): void {
  if (!draw) return;
  isDrawingArea.value = !isDrawingArea.value;
  if (isDrawingArea.value) {
    draw.changeMode('draw_polygon');
  } else {
    draw.deleteAll();
  }
}

function onAreaDrawn(e: { features: Array<{ geometry: { coordinates: number[][][] } }> }): void {
  const ring = e.features[0]?.geometry.coordinates[0];
  if (!ring) return;
  const boundary: LatLng[] = ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
  const centroid = boundary.reduce((acc, p) => ({ lat: acc.lat + p.lat / boundary.length, lng: acc.lng + p.lng / boundary.length }), {
    lat: 0,
    lng: 0,
  });
  openCreate();
  form.value = { ...form.value, boundary, lat: centroid.lat, lng: centroid.lng };
  draw?.deleteAll();
  isDrawingArea.value = false;
}

// --- Add/edit form -------------------------------------------------------
const isFormOpen = ref(false);
const editingId = ref<string | null>(null);
const formError = ref<string | null>(null);
const emptyForm: LocationCreatePayload = {
  name: '',
  address: null,
  neighbourhood: null,
  lat: 51.0538,
  lng: 3.725,
  boundary: null,
  notes: null,
  status: 'planned',
};
const form = ref<LocationCreatePayload>({ ...emptyForm });

function openCreate(): void {
  editingId.value = null;
  form.value = { ...emptyForm };
  formError.value = null;
  isFormOpen.value = true;
}
function openEdit(l: Location): void {
  editingId.value = l.locationId;
  form.value = {
    name: l.name,
    address: l.address,
    neighbourhood: l.neighbourhood,
    lat: l.lat,
    lng: l.lng,
    boundary: l.boundary,
    notes: l.notes,
    status: l.status,
  };
  formError.value = null;
  isFormOpen.value = true;
}
function closeForm(): void {
  isFormOpen.value = false;
}
async function submitForm(): Promise<void> {
  if (!form.value.name.trim()) {
    formError.value = 'Naam is verplicht.';
    return;
  }
  if (Number.isNaN(form.value.lat) || Number.isNaN(form.value.lng)) {
    formError.value = 'Geef geldige coördinaten op.';
    return;
  }
  const ok = editingId.value
    ? await store.update(officeId.value, editingId.value, form.value)
    : await store.create(officeId.value, form.value);
  if (ok) {
    ui.push(editingId.value ? 'Locatie bijgewerkt.' : 'Locatie toegevoegd.', 'success');
    isFormOpen.value = false;
  } else {
    formError.value = store.error;
  }
}
async function removeLocation(l: Location): Promise<void> {
  const ok = await store.remove(officeId.value, l.locationId);
  ui.push(ok ? 'Locatie verwijderd.' : (store.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
}

// --- Log visit -------------------------------------------------------
async function logVisit(l: Location): Promise<void> {
  if (!auth.user.value) return;
  const ok = await store.logVisit(officeId.value, l.locationId, {
    employeeId: auth.user.value.uid,
    employeeName: auth.user.value.email ?? 'Onbekend',
    visitedAt: Date.now(),
    notes: null,
  });
  ui.push(ok ? `Bezoek aan ${l.name} gelogd.` : (store.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
}

watch(
  officeId,
  (id) => {
    if (id) store.subscribe(id);
  },
  { immediate: true },
);
onBeforeUnmount(() => store.unsubscribe());
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm text-neutral-mute">Kantoor · {{ store.locations.length }} locaties</p>
        <h2 class="mt-1 text-3xl font-bold tracking-tight">Locaties</h2>
      </div>
      <div v-if="isStaff" class="flex gap-2">
        <button
          class="border border-primary-pink px-4 py-2.5 text-sm font-bold text-primary-pink"
          :class="{ 'bg-primary-pink text-white': isDrawingArea }"
          @click="toggleDrawArea"
        >
          {{ isDrawingArea ? 'Tekenen annuleren' : '⬠ Gebied tekenen' }}
        </button>
        <button class="bg-primary-pink px-4 py-2.5 text-sm font-bold text-white" @click="openCreate">
          + Locatie toevoegen
        </button>
      </div>
    </section>

    <p v-if="!MAPBOX_TOKEN" class="border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
      Geen Mapbox-token ingesteld (<code>VITE_MAPBOX_TOKEN</code>) — de kaart kan niet laden. Maak een gratis token aan
      op mapbox.com en voeg het toe aan de omgevingsvariabelen.
    </p>
    <p v-if="isDrawingArea" class="border border-primary-pink/30 bg-primary-pink/5 p-3 text-xs font-semibold text-primary-pink">
      Klik op de kaart om een gebied af te bakenen; dubbelklik om af te ronden.
    </p>

    <div class="flex flex-col gap-3 border border-black/5 bg-white p-4 sm:flex-row sm:items-center">
      <input
        v-model="search"
        class="min-w-0 flex-1 border-black/10 bg-[#faf9f7] text-sm focus:border-primary-pink focus:ring-primary-pink"
        placeholder="Zoek op naam, wijk of adres"
        type="search"
      />
      <select v-model="statusFilter" class="border-black/10 bg-[#faf9f7] text-sm">
        <option value="all">Alle statussen</option>
        <option v-for="(label, key) in LOCATION_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <div ref="mapEl" class="h-[480px] w-full border border-black/5 bg-[#eee]"></div>

    <section class="overflow-x-auto border border-black/5 bg-white">
      <table class="w-full min-w-[760px] text-left text-sm">
        <thead class="border-b border-black/5 bg-[#faf9f7] text-[10px] uppercase tracking-[0.16em] text-neutral-mute">
          <tr>
            <th class="px-5 py-4">Locatie</th>
            <th class="px-5 py-4">Status</th>
            <th v-if="canSeeCoverage" class="px-5 py-4">Keer bezocht</th>
            <th v-if="canSeeCoverage" class="px-5 py-4">Laatst bezocht</th>
            <th class="px-5 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/5">
          <tr v-for="l in filtered" :key="l.locationId" class="hover:bg-[#faf9f7]">
            <td class="px-5 py-4">
              <p class="font-bold">{{ l.name }} <span v-if="l.boundary" class="text-xs text-neutral-mute">(gebied)</span></p>
              <p class="text-xs text-neutral-mute">{{ l.neighbourhood ?? l.address ?? '—' }}</p>
            </td>
            <td class="px-5 py-4">
              <span class="inline-flex items-center gap-2 text-xs font-semibold">
                <i class="h-2 w-2 rounded-full" :style="{ backgroundColor: STATUS_COLORS[l.status] }"></i>
                {{ LOCATION_STATUS_LABELS[l.status] }}
              </span>
            </td>
            <td v-if="canSeeCoverage" class="px-5 py-4 text-xs text-neutral-mute">{{ l.timesVisited }}x</td>
            <td v-if="canSeeCoverage" class="px-5 py-4 text-xs text-neutral-mute">{{ formatDate(l.lastVisitedAt) }}</td>
            <td class="px-5 py-4 text-right">
              <button class="mr-3 text-xs font-semibold text-neutral-ink hover:text-primary-pink" @click="logVisit(l)">
                Bezoek loggen
              </button>
              <template v-if="isStaff">
                <button class="mr-3 text-xs font-semibold text-neutral-ink hover:text-primary-pink" @click="openEdit(l)">
                  Bewerken
                </button>
                <button class="text-xs font-semibold text-neutral-mute hover:text-semantic-danger" @click="removeLocation(l)">
                  Verwijderen
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="store.isLoading" class="p-8 text-center text-sm text-neutral-mute">Laden…</p>
      <p v-else-if="!filtered.length" class="p-8 text-center text-sm text-neutral-mute">Geen locaties gevonden.</p>
    </section>

    <div v-if="isFormOpen" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md border border-black/10 bg-white p-6">
        <h3 class="text-lg font-bold">{{ editingId ? 'Locatie bewerken' : 'Locatie toevoegen' }}</h3>
        <p v-if="form.boundary" class="mt-1 text-xs text-neutral-mute">Gebied getekend ({{ form.boundary.length }} punten).</p>
        <form class="mt-4 space-y-3" @submit.prevent="submitForm">
          <input v-model="form.name" placeholder="Naam" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <input v-model="form.neighbourhood" placeholder="Wijk (optioneel)" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <input v-model="form.address" placeholder="Adres (optioneel)" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <div v-if="!form.boundary" class="grid grid-cols-2 gap-3">
            <input v-model.number="form.lat" type="number" step="any" placeholder="Latitude" class="border-black/10 bg-[#faf9f7] text-sm" />
            <input v-model.number="form.lng" type="number" step="any" placeholder="Longitude" class="border-black/10 bg-[#faf9f7] text-sm" />
          </div>
          <textarea v-model="form.notes" placeholder="Details / notities (optioneel)" rows="2" class="w-full border-black/10 bg-[#faf9f7] text-sm"></textarea>
          <select v-model="form.status" class="w-full border-black/10 bg-[#faf9f7] text-sm">
            <option v-for="(label, key) in LOCATION_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
          <p v-if="formError" class="text-xs font-semibold text-semantic-danger">{{ formError }}</p>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="px-4 py-2 text-sm font-semibold text-neutral-mute" @click="closeForm">Annuleren</button>
            <button type="submit" class="bg-primary-pink px-4 py-2 text-sm font-bold text-white">
              {{ editingId ? 'Opslaan' : 'Toevoegen' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
