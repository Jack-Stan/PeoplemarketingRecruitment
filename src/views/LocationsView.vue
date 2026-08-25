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

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const STATUS_COLORS: Record<LocationStatus, string> = {
  planned: '#f59e0b',
  reserved: '#3b82f6',
  visited: '#10b981',
};

const auth = useAuth();
const store = useLocationsStore();
const ui = useUiStore();
const { officeId } = useActiveOffice();

/**
 * A "zone manager" — Administrator, TeamManager, OR a plain TeamMember who
 * carries the isTeamLeader flag (EmployeesView's Teamleider/Teamlid split,
 * separate from the Role enum). Mirrors firestore.rules' isCoverageViewer
 * exactly: same tier both draws zones AND sees the coverage numbers, per
 * Stan ("teamleaders & admin can make zones" / "see how many times").
 */
const canManage = computed(() => auth.hasRole('Administrator', 'TeamManager') || auth.isTeamLeader.value);
const canSeeCoverage = canManage;

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
function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('nl-BE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// --- Selection / detail panel -------------------------------------------
const selectedId = ref<string | null>(null);
const selected = computed(() => store.locations.find((l) => l.locationId === selectedId.value) ?? null);

function selectLocation(l: Location): void {
  if (mode.value !== 'none') return; // ignore selection clicks while placing/reshaping
  selectedId.value = l.locationId;
}
function closePanel(): void {
  selectedId.value = null;
}
watch(selectedId, (id) => {
  store.unsubscribeVisits();
  if (id && canSeeCoverage.value) store.subscribeVisits(officeId.value, id);
});

// --- Map ---------------------------------------------------------------
const mapEl = ref<HTMLElement | null>(null);
let map: mapboxgl.Map | null = null;
let draw: MapboxDraw | null = null;
/** none = browsing/selecting; 'point'/'area' = placing a NEW location; 'reshape' = editing an existing zone's boundary. */
const mode = ref<'none' | 'point' | 'area' | 'reshape'>('none');
const markers: mapboxgl.Marker[] = [];
let reshapeDraftBoundary: LatLng[] | null = null;

function clearMapLayers(): void {
  markers.forEach((m) => m.remove());
  markers.length = 0;
  if (map?.getLayer('location-areas-fill')) map.removeLayer('location-areas-fill');
  if (map?.getLayer('location-areas-line')) map.removeLayer('location-areas-line');
  if (map?.getLayer('location-areas-selected')) map.removeLayer('location-areas-selected');
  if (map?.getSource('location-areas')) map.removeSource('location-areas');
}

function renderLocations(): void {
  if (!map) return;
  clearMapLayers();

  const areaLocations = filtered.value.filter(
    (l) => l.boundary && l.boundary.length >= 3 && l.locationId !== (mode.value === 'reshape' ? selectedId.value : null),
  );
  if (areaLocations.length) {
    map.addSource('location-areas', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: areaLocations.map((l) => ({
          type: 'Feature' as const,
          properties: { locationId: l.locationId },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[...l.boundary!.map((p) => [p.lng, p.lat]), [l.boundary![0].lng, l.boundary![0].lat]]],
          },
        })),
      },
    });
    const colorMatch = [
      'match',
      ['get', 'locationId'],
      ...areaLocations.flatMap((l) => [l.locationId, STATUS_COLORS[l.status]]),
      '#999999',
    ] as unknown as mapboxgl.ExpressionSpecification;
    map.addLayer({ id: 'location-areas-fill', type: 'fill', source: 'location-areas', paint: { 'fill-color': colorMatch, 'fill-opacity': 0.35 } });
    map.addLayer({
      id: 'location-areas-selected',
      type: 'line',
      source: 'location-areas',
      paint: { 'line-color': '#111111', 'line-width': 3 },
      filter: ['==', ['get', 'locationId'], selectedId.value ?? ''],
    });
    map.addLayer({ id: 'location-areas-line', type: 'line', source: 'location-areas', paint: { 'line-color': colorMatch, 'line-width': 2 } });
    map.on('click', 'location-areas-fill', (e) => {
      const l = filtered.value.find((x) => x.locationId === e.features?.[0]?.properties?.locationId);
      if (l) selectLocation(l);
    });
    map.on('mouseenter', 'location-areas-fill', () => (map!.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'location-areas-fill', () => (map!.getCanvas().style.cursor = ''));
  }

  const bounds = new mapboxgl.LngLatBounds();
  let hasPoints = false;
  for (const l of filtered.value) {
    hasPoints = true;
    bounds.extend([l.lng, l.lat]);
    if (l.boundary && l.boundary.length >= 3) {
      l.boundary.forEach((p) => bounds.extend([p.lng, p.lat]));
      continue; // rendered via the fill/line layers above, not a pin
    }
    const el = document.createElement('div');
    const isSelected = l.locationId === selectedId.value;
    el.style.cssText = `width:${isSelected ? 22 : 16}px;height:${isSelected ? 22 : 16}px;border-radius:50%;border:2px solid #fff;background:${STATUS_COLORS[l.status]};box-shadow:0 0 0 ${isSelected ? 3 : 1}px ${isSelected ? '#111' : 'rgba(0,0,0,.2)'};cursor:pointer;`;
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      selectLocation(l);
    });
    const marker = new mapboxgl.Marker({ element: el }).setLngLat([l.lng, l.lat]).addTo(map);
    markers.push(marker);
  }
  if (hasPoints && !bounds.isEmpty() && mode.value !== 'reshape') map.fitBounds(bounds, { padding: 48, maxZoom: 15 });
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
  draw = new MapboxDraw({ displayControlsDefault: false });
  map.addControl(draw);
  map.on('draw.create', onAreaDrawn);
  map.on('draw.update', onAreaReshaped);
  map.on('click', onMapClick);
  map.on('load', renderLocations);
});
onBeforeUnmount(() => {
  map?.remove();
  map = null;
});
watch(filtered, () => renderLocations());
watch(selectedId, () => renderLocations());

function onMapClick(e: mapboxgl.MapMouseEvent): void {
  if (mode.value !== 'point') return;
  openCreate();
  form.value = { ...form.value, lat: e.lngLat.lat, lng: e.lngLat.lng };
  mode.value = 'none';
}

function toggleDrawArea(): void {
  if (!draw) return;
  if (mode.value === 'area') {
    mode.value = 'none';
    draw.deleteAll();
  } else {
    mode.value = 'area';
    draw.deleteAll();
    draw.changeMode('draw_polygon');
  }
}
function toggleAddPoint(): void {
  mode.value = mode.value === 'point' ? 'none' : 'point';
}

function boundaryCentroid(boundary: LatLng[]): LatLng {
  return boundary.reduce((acc, p) => ({ lat: acc.lat + p.lat / boundary.length, lng: acc.lng + p.lng / boundary.length }), { lat: 0, lng: 0 });
}

function onAreaDrawn(e: { features: Array<{ geometry: { coordinates: number[][][] } }> }): void {
  if (mode.value === 'reshape') return; // handled by onAreaReshaped instead
  const ring = e.features[0]?.geometry.coordinates[0];
  if (!ring) return;
  const boundary: LatLng[] = ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
  openCreate();
  const centroid = boundaryCentroid(boundary);
  form.value = { ...form.value, boundary, ...centroid };
  draw?.deleteAll();
  mode.value = 'none';
}

// --- Reshape an existing zone's boundary --------------------------------
function startReshape(l: Location): void {
  if (!draw || !l.boundary) return;
  mode.value = 'reshape';
  closePanel();
  draw.deleteAll();
  const feature = draw.add({
    type: 'Polygon',
    coordinates: [[...l.boundary.map((p) => [p.lng, p.lat]), [l.boundary[0].lng, l.boundary[0].lat]]],
  } as GeoJSON.Polygon)[0];
  reshapeDraftBoundary = l.boundary;
  reshapeTargetId.value = l.locationId;
  draw.changeMode('direct_select', { featureId: feature });
  renderLocations();
}
function onAreaReshaped(e: { features: Array<{ geometry: { coordinates: number[][][] } }> }): void {
  const ring = e.features[0]?.geometry.coordinates[0];
  if (!ring) return;
  reshapeDraftBoundary = ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
}
const reshapeTargetId = ref<string | null>(null);
async function saveReshape(): Promise<void> {
  if (!reshapeTargetId.value || !reshapeDraftBoundary) return;
  const centroid = boundaryCentroid(reshapeDraftBoundary);
  const ok = await store.update(officeId.value, reshapeTargetId.value, { boundary: reshapeDraftBoundary, ...centroid });
  ui.push(ok ? 'Zone bijgewerkt.' : (store.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
  cancelReshape();
}
function cancelReshape(): void {
  draw?.deleteAll();
  mode.value = 'none';
  reshapeDraftBoundary = null;
  reshapeTargetId.value = null;
  renderLocations();
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
async function quickSetStatus(l: Location, status: LocationStatus): Promise<void> {
  const ok = await store.update(officeId.value, l.locationId, { status });
  if (!ok) ui.push(store.error ?? 'Er ging iets mis.', 'error');
}
async function removeLocation(l: Location): Promise<void> {
  const ok = await store.remove(officeId.value, l.locationId);
  ui.push(ok ? 'Locatie verwijderd.' : (store.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
  if (ok) closePanel();
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
onBeforeUnmount(() => {
  store.unsubscribe();
  store.unsubscribeVisits();
});
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm text-neutral-mute">Kantoor · {{ store.locations.length }} locaties</p>
        <h2 class="mt-1 text-3xl font-bold tracking-tight">Locaties</h2>
      </div>
      <div v-if="canManage" class="flex flex-wrap gap-2">
        <button
          class="border border-primary-pink px-4 py-2.5 text-sm font-bold text-primary-pink"
          :class="{ 'bg-primary-pink text-white': mode === 'point' }"
          @click="toggleAddPoint"
        >
          {{ mode === 'point' ? 'Klik op de kaart…' : '📍 Punt plaatsen' }}
        </button>
        <button
          class="border border-primary-pink px-4 py-2.5 text-sm font-bold text-primary-pink"
          :class="{ 'bg-primary-pink text-white': mode === 'area' }"
          @click="toggleDrawArea"
        >
          {{ mode === 'area' ? 'Tekenen annuleren' : '⬠ Zone tekenen' }}
        </button>
      </div>
    </section>

    <p v-if="!MAPBOX_TOKEN" class="border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
      Geen Mapbox-token ingesteld (<code>VITE_MAPBOX_TOKEN</code>) — de kaart kan niet laden. Maak een gratis token aan
      op mapbox.com en voeg het toe aan de omgevingsvariabelen.
    </p>
    <p v-if="mode === 'point'" class="border border-primary-pink/30 bg-primary-pink/5 p-3 text-xs font-semibold text-primary-pink">
      Klik ergens op de kaart om daar een nieuwe locatie te plaatsen.
    </p>
    <p v-if="mode === 'area'" class="border border-primary-pink/30 bg-primary-pink/5 p-3 text-xs font-semibold text-primary-pink">
      Klik op de kaart om een zone af te bakenen; dubbelklik om af te ronden.
    </p>
    <div v-if="mode === 'reshape'" class="flex items-center justify-between border border-primary-pink/30 bg-primary-pink/5 p-3 text-xs font-semibold text-primary-pink">
      <span>Sleep de punten om de zone aan te passen.</span>
      <span class="flex gap-2">
        <button class="border border-primary-pink px-3 py-1.5" @click="cancelReshape">Annuleren</button>
        <button class="bg-primary-pink px-3 py-1.5 text-white" @click="saveReshape">Zone opslaan</button>
      </span>
    </div>

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

    <div class="flex flex-col gap-4 lg:flex-row">
      <div ref="mapEl" class="h-[520px] flex-1 border border-black/5 bg-[#eee]"></div>

      <!-- Detail panel: opens on clicking a pin/zone on the map, or a row below. -->
      <aside v-if="selected" class="w-full shrink-0 space-y-4 border border-black/5 bg-white p-5 lg:w-80">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-lg font-bold">{{ selected.name }}</h3>
            <p class="text-xs text-neutral-mute">{{ selected.neighbourhood ?? selected.address ?? '—' }}</p>
          </div>
          <button class="text-neutral-mute hover:text-neutral-ink" @click="closePanel">✕</button>
        </div>

        <div>
          <label class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Status</label>
          <select
            v-if="canManage"
            :value="selected.status"
            class="mt-1 w-full border-black/10 bg-[#faf9f7] text-sm"
            @change="quickSetStatus(selected, ($event.target as HTMLSelectElement).value as LocationStatus)"
          >
            <option v-for="(label, key) in LOCATION_STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
          <p v-else class="mt-1 inline-flex items-center gap-2 text-xs font-semibold">
            <i class="h-2 w-2 rounded-full" :style="{ backgroundColor: STATUS_COLORS[selected.status] }"></i>
            {{ LOCATION_STATUS_LABELS[selected.status] }}
          </p>
        </div>

        <p v-if="selected.notes" class="border-l-2 border-black/10 pl-3 text-xs text-neutral-mute">{{ selected.notes }}</p>

        <div v-if="canSeeCoverage" class="border border-black/5 bg-[#faf9f7] p-3 text-xs">
          <p class="font-bold">{{ selected.timesVisited }}x bezocht · laatst {{ formatDate(selected.lastVisitedAt) }}</p>
          <ul v-if="store.visits.length" class="mt-2 max-h-32 space-y-1 overflow-y-auto">
            <li v-for="v in store.visits" :key="v.visitId" class="text-neutral-mute">
              {{ v.employeeName }} · {{ formatDateTime(v.visitedAt) }}
            </li>
          </ul>
          <p v-else class="mt-2 text-neutral-mute">Nog geen bezoeken gelogd.</p>
        </div>

        <div class="flex flex-col gap-2 pt-2">
          <button class="bg-primary-pink px-4 py-2.5 text-sm font-bold text-white" @click="logVisit(selected)">
            Bezoek loggen
          </button>
          <template v-if="canManage">
            <button v-if="selected.boundary" class="border border-black/10 px-4 py-2 text-sm font-semibold" @click="startReshape(selected)">
              Zone vorm aanpassen
            </button>
            <button class="border border-black/10 px-4 py-2 text-sm font-semibold" @click="openEdit(selected)">Bewerken</button>
            <button class="border border-black/10 px-4 py-2 text-sm font-semibold text-semantic-danger" @click="removeLocation(selected)">
              Verwijderen
            </button>
          </template>
        </div>
      </aside>
    </div>

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
          <tr
            v-for="l in filtered"
            :key="l.locationId"
            class="cursor-pointer hover:bg-[#faf9f7]"
            :class="{ 'bg-primary-pink/5': l.locationId === selectedId }"
            @click="selectLocation(l)"
          >
            <td class="px-5 py-4">
              <p class="font-bold">{{ l.name }} <span v-if="l.boundary" class="text-xs text-neutral-mute">(zone)</span></p>
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
              <button class="text-xs font-semibold text-neutral-ink hover:text-primary-pink" @click.stop="logVisit(l)">
                Bezoek loggen
              </button>
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
        <p v-if="form.boundary" class="mt-1 text-xs text-neutral-mute">Zone getekend ({{ form.boundary.length }} punten).</p>
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
