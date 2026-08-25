<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Leaflet's default marker icon references image files by relative URL,
// which breaks under Vite's bundling — point them at the bundled assets
// explicitly instead (well-known workaround, not project-specific).
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import { useAuth } from '@/composables/useAuth';
import { useActiveOffice } from '@/composables/useActiveOffice';
import { useLocationsStore } from '@/stores/locations';
import { useUiStore } from '@/stores/ui';
import { LOCATION_STATUS_LABELS, type Location, type LocationCreatePayload, type LocationStatus } from '@/types/location';

L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

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
let map: L.Map | null = null;
let markersLayer: L.LayerGroup | null = null;

function renderMarkers(): void {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();
  for (const l of filtered.value) {
    const marker = L.circleMarker([l.lat, l.lng], {
      radius: 9,
      color: '#ffffff',
      weight: 2,
      fillColor: STATUS_COLORS[l.status],
      fillOpacity: 0.9,
    });
    marker.bindPopup(
      `<strong>${l.name}</strong><br/>${l.neighbourhood ?? ''}<br/>${LOCATION_STATUS_LABELS[l.status]} · ${l.timesVisited}x bezocht`,
    );
    marker.addTo(markersLayer);
  }
  if (filtered.value.length) {
    const bounds = L.latLngBounds(filtered.value.map((l) => [l.lat, l.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }
}

onMounted(async () => {
  await nextTick();
  if (!mapEl.value) return;
  map = L.map(mapEl.value).setView([51.0538, 3.7250], 12); // Gent default
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  renderMarkers();
});
onBeforeUnmount(() => {
  map?.remove();
  map = null;
});
watch(filtered, () => renderMarkers());

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
  form.value = { name: l.name, address: l.address, neighbourhood: l.neighbourhood, lat: l.lat, lng: l.lng, status: l.status };
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
      <button v-if="isStaff" class="bg-primary-pink px-4 py-2.5 text-sm font-bold text-white" @click="openCreate">
        + Locatie toevoegen
      </button>
    </section>

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

    <div ref="mapEl" class="h-[420px] w-full border border-black/5 bg-[#eee]"></div>

    <section class="overflow-x-auto border border-black/5 bg-white">
      <table class="w-full min-w-[760px] text-left text-sm">
        <thead class="border-b border-black/5 bg-[#faf9f7] text-[10px] uppercase tracking-[0.16em] text-neutral-mute">
          <tr>
            <th class="px-5 py-4">Locatie</th>
            <th class="px-5 py-4">Status</th>
            <th class="px-5 py-4">Keer bezocht</th>
            <th class="px-5 py-4">Laatst bezocht</th>
            <th class="px-5 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/5">
          <tr v-for="l in filtered" :key="l.locationId" class="hover:bg-[#faf9f7]">
            <td class="px-5 py-4">
              <p class="font-bold">{{ l.name }}</p>
              <p class="text-xs text-neutral-mute">{{ l.neighbourhood ?? l.address ?? '—' }}</p>
            </td>
            <td class="px-5 py-4">
              <span class="inline-flex items-center gap-2 text-xs font-semibold">
                <i class="h-2 w-2 rounded-full" :style="{ backgroundColor: STATUS_COLORS[l.status] }"></i>
                {{ LOCATION_STATUS_LABELS[l.status] }}
              </span>
            </td>
            <td class="px-5 py-4 text-xs text-neutral-mute">{{ l.timesVisited }}x</td>
            <td class="px-5 py-4 text-xs text-neutral-mute">{{ formatDate(l.lastVisitedAt) }}</td>
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
        <form class="mt-4 space-y-3" @submit.prevent="submitForm">
          <input v-model="form.name" placeholder="Naam" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <input v-model="form.neighbourhood" placeholder="Wijk (optioneel)" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <input v-model="form.address" placeholder="Adres (optioneel)" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <div class="grid grid-cols-2 gap-3">
            <input v-model.number="form.lat" type="number" step="any" placeholder="Latitude" class="border-black/10 bg-[#faf9f7] text-sm" />
            <input v-model.number="form.lng" type="number" step="any" placeholder="Longitude" class="border-black/10 bg-[#faf9f7] text-sm" />
          </div>
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
