<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

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
let map: L.Map | null = null;
let drawPolygonHandler: L.Draw.Polygon | null = null;
type EditablePolygon = L.Polygon & { editing: { enable(): void; disable(): void } };
let reshapeLayer: EditablePolygon | null = null;
/** none = browsing/selecting; 'point'/'area' = placing a NEW location; 'reshape' = editing an existing zone's boundary. */
const mode = ref<'none' | 'point' | 'area' | 'reshape'>('none');
const markers: L.Marker[] = [];
const zoneLayers: L.Polygon[] = [];

function clearMapLayers(): void {
  markers.forEach((m) => m.remove());
  markers.length = 0;
  zoneLayers.forEach((l) => l.remove());
  zoneLayers.length = 0;
}

function pinIcon(color: string, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 22 : 16;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;border:2px solid #fff;background:${color};box-shadow:0 0 0 ${isSelected ? 3 : 1}px ${isSelected ? '#111' : 'rgba(0,0,0,.2)'};cursor:pointer;"></div>`,
  });
}

function renderLocations(): void {
  if (!map) return;
  clearMapLayers();

  const bounds = L.latLngBounds([]);
  let hasPoints = false;

  for (const l of filtered.value) {
    if (mode.value === 'reshape' && l.locationId === selectedId.value) continue;
    if (l.boundary && l.boundary.length >= 3) {
      hasPoints = true;
      const latlngs = l.boundary.map((p) => [p.lat, p.lng] as [number, number]);
      latlngs.forEach((ll) => bounds.extend(ll));
      const isSelected = l.locationId === selectedId.value;
      const polygon = L.polygon(latlngs, {
        color: isSelected ? '#111111' : STATUS_COLORS[l.status],
        weight: isSelected ? 3 : 2,
        fillColor: STATUS_COLORS[l.status],
        fillOpacity: 0.35,
      }).addTo(map);
      polygon.on('click', () => selectLocation(l));
      polygon.on('mouseover', () => map && (map.getContainer().style.cursor = 'pointer'));
      polygon.on('mouseout', () => map && (map.getContainer().style.cursor = ''));
      zoneLayers.push(polygon);
      continue; // rendered as a polygon, not a pin
    }
    hasPoints = true;
    bounds.extend([l.lat, l.lng]);
    const isSelected = l.locationId === selectedId.value;
    const marker = L.marker([l.lat, l.lng], { icon: pinIcon(STATUS_COLORS[l.status], isSelected) }).addTo(map);
    marker.on('click', () => selectLocation(l));
    markers.push(marker);
  }
  if (hasPoints && bounds.isValid() && mode.value !== 'reshape') map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
}

onMounted(async () => {
  await nextTick();
  if (!mapEl.value) return;
  map = L.map(mapEl.value).setView([51.0538, 3.725], 12); // Ghent
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);
  map.on('click', onMapClick);
  map.on('draw:created', ((e: L.DrawEvents.Created) => onAreaDrawn(e)) as L.LeafletEventHandlerFn);
  renderLocations();
});
onBeforeUnmount(() => {
  map?.remove();
  map = null;
});
watch(filtered, () => renderLocations());
watch(selectedId, () => renderLocations());

function onMapClick(e: L.LeafletMouseEvent): void {
  if (mode.value !== 'point') return;
  openCreate();
  form.value = { ...form.value, lat: e.latlng.lat, lng: e.latlng.lng };
  mode.value = 'none';
}

function toggleDrawArea(): void {
  if (!map) return;
  if (mode.value === 'area') {
    mode.value = 'none';
    drawPolygonHandler?.disable();
    drawPolygonHandler = null;
  } else {
    mode.value = 'area';
    drawPolygonHandler = new L.Draw.Polygon(map as unknown as L.DrawMap, { shapeOptions: { color: '#ec4899' } });
    drawPolygonHandler.enable();
  }
}
function toggleAddPoint(): void {
  mode.value = mode.value === 'point' ? 'none' : 'point';
}

function boundaryCentroid(boundary: LatLng[]): LatLng {
  return boundary.reduce((acc, p) => ({ lat: acc.lat + p.lat / boundary.length, lng: acc.lng + p.lng / boundary.length }), { lat: 0, lng: 0 });
}

function onAreaDrawn(e: L.DrawEvents.Created): void {
  drawPolygonHandler = null;
  const latlngs = (e.layer as L.Polygon).getLatLngs()[0] as L.LatLng[];
  const boundary: LatLng[] = latlngs.map((ll) => ({ lat: ll.lat, lng: ll.lng }));
  openCreate();
  const centroid = boundaryCentroid(boundary);
  form.value = { ...form.value, boundary, ...centroid };
  mode.value = 'none';
}

// --- Reshape an existing zone's boundary --------------------------------
function startReshape(l: Location): void {
  if (!map || !l.boundary) return;
  mode.value = 'reshape';
  closePanel();
  const latlngs = l.boundary.map((p) => [p.lat, p.lng] as [number, number]);
  reshapeLayer = L.polygon(latlngs, { color: '#111111', weight: 3 }).addTo(map) as EditablePolygon;
  reshapeTargetId.value = l.locationId;
  renderLocations();
  reshapeLayer.editing?.enable();
}
const reshapeTargetId = ref<string | null>(null);
async function saveReshape(): Promise<void> {
  if (!reshapeTargetId.value || !reshapeLayer) return;
  const latlngs = reshapeLayer.getLatLngs()[0] as L.LatLng[];
  const boundary: LatLng[] = latlngs.map((ll) => ({ lat: ll.lat, lng: ll.lng }));
  const centroid = boundaryCentroid(boundary);
  const ok = await store.update(officeId.value, reshapeTargetId.value, { boundary, ...centroid });
  ui.push(ok ? 'Zone bijgewerkt.' : (store.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
  cancelReshape();
}
function cancelReshape(): void {
  reshapeLayer?.editing?.disable();
  reshapeLayer?.remove();
  reshapeLayer = null;
  mode.value = 'none';
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
