<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';

import { useAuth } from '@/composables/useAuth';
import { useActiveOffice } from '@/composables/useActiveOffice';
import { useEmployeesStore } from '@/stores/employees';
import { useShiftsStore } from '@/stores/shifts';
import { useUiStore } from '@/stores/ui';
import { FIXED_SHIFT_HOURS, type Shift, type ShiftCreatePayload, type ShiftType } from '@/types/shift';

const auth = useAuth();
const employeesStore = useEmployeesStore();
const shiftsStore = useShiftsStore();
const ui = useUiStore();

const { officeId } = useActiveOffice();
const isAdmin = computed(() => auth.role.value === 'Administrator');
const canDraft = computed(() => auth.role.value === 'Administrator' || auth.role.value === 'TeamManager');

const isFormOpen = ref(false);
const formError = ref(null as string | null);
const rejectingId = ref(null as string | null);
const rejectReason = ref('');

function makeEmptyForm(): ShiftCreatePayload {
  return {
    assignedEmployeeId: '',
    date: new Date().toISOString().slice(0, 10),
    type: 'D2D',
    startTime: FIXED_SHIFT_HOURS.D2D.start,
    endTime: FIXED_SHIFT_HOURS.D2D.end,
    status: 'draft',
    rejectionReason: null,
    employeeName: '',
    employeeIsTeamLeader: false,
    eventTitle: null,
    location: null,
    notes: null,
    calendarEventId: null,
  };
}
const form = ref<ShiftCreatePayload>(makeEmptyForm());

const isTimeLocked = computed(() => form.value.type !== 'Event');

function onTypeChange(type: ShiftType): void {
  form.value.type = type;
  if (type !== 'Event') {
    form.value.startTime = FIXED_SHIFT_HOURS[type].start;
    form.value.endTime = FIXED_SHIFT_HOURS[type].end;
    form.value.eventTitle = null;
  }
}

function onEmployeePicked(id: string): void {
  form.value.assignedEmployeeId = id;
  const e = employeesStore.employees.find((emp) => emp.employeeId === id);
  form.value.employeeName = e ? `${e.firstName} ${e.lastName}` : '';
  form.value.employeeIsTeamLeader = e?.isTeamLeader ?? false;
}

/** FRD §8 — daily list view (below), optionally scoped to a date picked from the month view. */
const dateFilter = ref<string | null>(null);
const dayGroups = computed(() => {
  const entries = [...shiftsStore.byDate.entries()];
  const filtered = dateFilter.value ? entries.filter(([date]) => date === dateFilter.value) : entries;
  return filtered.sort(([a], [b]) => a.localeCompare(b));
});

const totals = computed(() => shiftsStore.staffingTotals);

/** FRD §8 — monthly view: coverage, weekend highlighting, TL visibility per day. */
const viewMode = ref<'lijst' | 'maand'>('lijst');
const today = new Date().toISOString().slice(0, 10);
const selectedMonth = ref(today.slice(0, 7));

const monthLabel = computed(() => {
  const [year, month] = selectedMonth.value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' });
});

function shiftMonth(delta: number): void {
  const [year, month] = selectedMonth.value.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  selectedMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface MonthCell {
  iso: string;
  dayNumber: number;
  isWeekend: boolean;
  isToday: boolean;
  shiftCount: number;
  pendingCount: number;
  tlCount: number;
}

const monthCells = computed<(MonthCell | null)[]>(() => {
  const [year, month] = selectedMonth.value.split('-').map(Number);
  const firstOfMonth = new Date(year, month - 1, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonthCount = new Date(year, month, 0).getDate();
  const cells: (MonthCell | null)[] = Array.from({ length: startWeekday }, () => null);
  for (let d = 1; d <= daysInMonthCount; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayShifts = shiftsStore.shifts.filter((s) => s.date === iso);
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    cells.push({
      iso,
      dayNumber: d,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isToday: iso === today,
      shiftCount: dayShifts.length,
      pendingCount: dayShifts.filter((s) => s.status === 'pending').length,
      tlCount: new Set(dayShifts.filter((s) => s.employeeIsTeamLeader).map((s) => s.assignedEmployeeId)).size,
    });
  }
  return cells;
});

const weekdayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

function openDayFromMonth(iso: string): void {
  dateFilter.value = iso;
  viewMode.value = 'lijst';
}

function statusClasses(status: Shift['status']): string {
  return {
    draft: 'bg-neutral-200 text-neutral-mute',
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  }[status];
}

const statusLabels: Record<Shift['status'], string> = {
  draft: 'Concept',
  pending: 'In afwachting',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
};

const typeLabels: Record<ShiftType, string> = {
  D2D: 'D2D (deur-tot-deur)',
  Straat: 'Straat',
  Event: 'Event',
};

function openCreate(date?: string): void {
  const firstEmployee = employeesStore.activeEmployees[0];
  form.value = { ...makeEmptyForm() };
  if (date) form.value.date = date;
  if (firstEmployee) onEmployeePicked(firstEmployee.employeeId);
  formError.value = null;
  isFormOpen.value = true;
}

async function submitForm(): Promise<void> {
  if (!form.value.assignedEmployeeId) {
    formError.value = 'Kies een medewerker.';
    return;
  }
  if (form.value.startTime >= form.value.endTime) {
    formError.value = 'Starttijd moet voor eindtijd liggen.';
    return;
  }
  if (shiftsStore.hasOverlap(form.value.assignedEmployeeId, form.value.date, form.value.startTime, form.value.endTime)) {
    formError.value = `${form.value.employeeName} heeft die dag al een overlappende shift.`;
    return;
  }
  if (!auth.user.value) return;
  formError.value = null;
  const ok = await shiftsStore.create(officeId.value, auth.user.value.uid, form.value);
  if (ok) {
    ui.push('Shift aangemaakt.', 'success');
    isFormOpen.value = false;
  } else {
    formError.value = shiftsStore.error;
  }
}

async function submitShift(shift: Shift): Promise<void> {
  const ok = await shiftsStore.submitForApproval(officeId.value, shift.shiftId);
  ui.push(ok ? 'Ingediend ter goedkeuring.' : (shiftsStore.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
}

async function approveShift(shift: Shift): Promise<void> {
  if (!auth.user.value) return;
  const ok = await shiftsStore.approve(officeId.value, shift.shiftId, auth.user.value.uid, Date.now());
  ui.push(ok ? 'Shift goedgekeurd.' : (shiftsStore.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
}

function openReject(shift: Shift): void {
  rejectingId.value = shift.shiftId;
  rejectReason.value = '';
}

async function confirmReject(): Promise<void> {
  if (!rejectingId.value || !auth.user.value) return;
  const ok = await shiftsStore.reject(
    officeId.value,
    rejectingId.value,
    rejectReason.value.trim() || 'Geen reden opgegeven',
    auth.user.value.uid,
    Date.now(),
  );
  ui.push(ok ? 'Shift afgewezen.' : (shiftsStore.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
  rejectingId.value = null;
}

async function deleteDraft(shift: Shift): Promise<void> {
  const ok = await shiftsStore.remove(officeId.value, shift.shiftId);
  ui.push(ok ? 'Concept verwijderd.' : (shiftsStore.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
}

// Re-subscribes whenever the active office changes — an Administrator
// switching offices should see that office's shifts/roster, not Gent's.
watch(
  officeId,
  (id) => {
    if (!id) return;
    shiftsStore.subscribe(id);
    employeesStore.subscribe(id);
  },
  { immediate: true },
);
onUnmounted(() => {
  shiftsStore.unsubscribe();
  employeesStore.unsubscribe();
});
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm text-neutral-mute">Kantoor · {{ officeId }}</p>
        <h2 class="mt-1 text-3xl font-bold tracking-tight">Planning</h2>
      </div>
      <button v-if="canDraft" class="bg-primary-pink px-4 py-2.5 text-sm font-bold text-white" @click="openCreate()">
        + Nieuwe shift
      </button>
    </section>

    <!-- FRD §8 — daily/weekly/monthly views toggle. -->
    <div class="flex gap-1 border-b border-black/10 pb-px">
      <button
        class="border-b-2 px-4 py-2 text-xs font-bold"
        :class="viewMode === 'lijst' ? 'border-primary-pink text-primary-pink' : 'border-transparent text-neutral-mute'"
        @click="viewMode = 'lijst'"
      >
        Lijst
      </button>
      <button
        class="border-b-2 px-4 py-2 text-xs font-bold"
        :class="viewMode === 'maand' ? 'border-primary-pink text-primary-pink' : 'border-transparent text-neutral-mute'"
        @click="viewMode = 'maand'"
      >
        Maand
      </button>
    </div>

    <!-- Monthly calendar — coverage, weekend highlighting, TL visibility per day. -->
    <section v-if="viewMode === 'maand'" class="border border-black/5 bg-white p-6">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold capitalize">{{ monthLabel }}</h3>
        <div class="flex gap-2">
          <button class="border border-black/10 px-2.5 py-1 text-sm font-bold hover:bg-[#faf9f7]" @click="shiftMonth(-1)">‹</button>
          <button class="border border-black/10 px-2.5 py-1 text-sm font-bold hover:bg-[#faf9f7]" @click="shiftMonth(1)">›</button>
        </div>
      </div>
      <div class="mt-5 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-mute">
        <span v-for="wd in weekdayLabels" :key="wd">{{ wd }}</span>
      </div>
      <div class="mt-1.5 grid grid-cols-7 gap-1.5">
        <div
          v-for="(cell, i) in monthCells"
          :key="cell ? cell.iso : `blank-${i}`"
          class="flex min-h-24 flex-col gap-1 border p-2 text-left"
          :class="[
            cell ? 'cursor-pointer hover:border-primary-pink/50' : 'border-transparent',
            cell?.isToday ? 'border-primary-pink/40 bg-primary-pink/5' : cell?.isWeekend ? 'border-black/10 bg-[#faf9f7]' : 'border-black/10 bg-white',
          ]"
          @click="cell && openDayFromMonth(cell.iso)"
        >
          <template v-if="cell">
            <span class="text-xs font-bold" :class="cell.isToday ? 'text-primary-pink' : 'text-neutral-ink'">{{ cell.dayNumber }}</span>
            <div v-if="cell.shiftCount" class="mt-auto space-y-1">
              <p class="text-[11px] font-semibold text-neutral-mute">{{ cell.shiftCount }} shift{{ cell.shiftCount === 1 ? '' : 's' }}</p>
              <div class="flex flex-wrap gap-1">
                <span v-if="cell.tlCount" class="rounded bg-primary-pink/10 px-1.5 py-0.5 text-[10px] font-bold text-primary-pink">{{ cell.tlCount }} TL</span>
                <span v-if="cell.pendingCount" class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{{ cell.pendingCount }} wacht</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </section>

    <!-- Staffing overview bar — client transcript: "40 shifts, 5 TL, 7 non-TL" as a literal segmented bar. -->
    <section class="grid gap-4 sm:grid-cols-3">
      <article class="border border-black/5 bg-white p-5">
        <p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Totaal shifts</p>
        <p class="mt-3 text-3xl font-bold">{{ totals.shifts }}</p>
      </article>
      <article class="border border-black/5 bg-white p-5">
        <p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Teamleiders ingepland</p>
        <p class="mt-3 text-3xl font-bold">{{ totals.teamLeaders }}</p>
        <div class="mt-3 flex h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            class="bg-primary-pink"
            :style="{ width: `${totals.teamLeaders + totals.nonTeamLeaders ? (totals.teamLeaders / (totals.teamLeaders + totals.nonTeamLeaders)) * 100 : 0}%` }"
          ></div>
        </div>
      </article>
      <article class="border border-black/5 bg-white p-5">
        <p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Wacht op goedkeuring</p>
        <p class="mt-3 text-3xl font-bold text-amber-600">{{ shiftsStore.pending.length }}</p>
      </article>
    </section>

    <!--
      Dense single scrolling table, day-divider rows instead of Notion-style
      padded cards per shift — client asked for stacked-not-side-by-side but
      also explicitly wants it tighter/more efficient than a literal Notion
      board, so this favours row density over whitespace.
    -->
    <section v-if="viewMode === 'lijst'" class="space-y-3">
      <div v-if="dateFilter" class="flex items-center gap-2 text-xs">
        <span class="text-neutral-mute">Gefilterd op</span>
        <span class="inline-flex items-center gap-2 bg-primary-pink/10 px-2.5 py-1 font-bold text-primary-pink">
          {{ new Date(dateFilter).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' }) }}
          <button class="text-primary-pink hover:underline" @click="dateFilter = null">✕</button>
        </span>
      </div>
      <div class="overflow-x-auto border border-black/5 bg-white">
      <table class="w-full min-w-[720px] text-left text-sm">
        <thead class="border-b border-black/5 bg-[#faf9f7] text-[10px] uppercase tracking-[0.16em] text-neutral-mute">
          <tr>
            <th class="px-5 py-3">Tijd</th>
            <th class="px-5 py-3">Type</th>
            <th class="px-5 py-3">Medewerker</th>
            <th class="px-5 py-3">Status</th>
            <th v-if="canDraft" class="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/5">
          <template v-for="[date, dayShifts] in dayGroups" :key="date">
            <tr class="bg-[#faf9f7]">
              <td colspan="5" class="px-5 py-2 text-xs font-bold text-neutral-ink">
                {{ new Date(date).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' }) }}
                <span class="ml-2 font-normal text-neutral-mute">{{ dayShifts.length }} shift{{ dayShifts.length === 1 ? '' : 's' }}</span>
              </td>
            </tr>
            <tr v-for="shift in dayShifts" :key="shift.shiftId" class="hover:bg-[#faf9f7]">
              <td class="px-5 py-3 font-mono text-xs">{{ shift.startTime }}–{{ shift.endTime }}</td>
              <td class="px-5 py-3 text-xs font-semibold text-neutral-mute">
                {{ shift.type }}<span v-if="shift.eventTitle"> — {{ shift.eventTitle }}</span>
              </td>
              <td class="px-5 py-3">
                <span class="font-semibold">{{ shift.employeeName }}</span>
                <span v-if="shift.employeeIsTeamLeader" class="ml-2 text-[10px] font-bold uppercase tracking-wider text-primary-pink">TL</span>
              </td>
              <td class="px-5 py-3">
                <span class="inline-block rounded px-2 py-0.5 text-[11px] font-bold" :class="statusClasses(shift.status)">
                  {{ statusLabels[shift.status] }}
                </span>
                <span v-if="shift.status === 'rejected' && shift.rejectionReason" class="ml-2 text-[11px] text-neutral-mute">
                  {{ shift.rejectionReason }}
                </span>
              </td>
              <td v-if="canDraft" class="px-5 py-3 text-right text-xs font-semibold">
                <button v-if="shift.status === 'draft'" class="text-neutral-ink hover:text-primary-pink" @click="submitShift(shift)">
                  Indienen
                </button>
                <button v-if="shift.status === 'draft'" class="ml-3 text-neutral-mute hover:text-semantic-danger" @click="deleteDraft(shift)">
                  Verwijderen
                </button>
                <template v-if="isAdmin && shift.status === 'pending'">
                  <button class="mr-3 text-emerald-700 hover:underline" @click="approveShift(shift)">Goedkeuren</button>
                  <button class="text-red-600 hover:underline" @click="openReject(shift)">Afwijzen</button>
                </template>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <p v-if="shiftsStore.isLoading" class="p-8 text-center text-sm text-neutral-mute">Laden…</p>
      <p v-else-if="!dayGroups.length" class="p-8 text-center text-sm text-neutral-mute">Nog geen shifts.</p>
      </div>
    </section>

    <div v-if="isFormOpen" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md border border-black/10 bg-white p-6">
        <h3 class="text-lg font-bold">Nieuwe shift</h3>
        <form class="mt-4 space-y-3" @submit.prevent="submitForm">
          <input v-model="form.date" type="date" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <select
            :value="form.assignedEmployeeId"
            class="w-full border-black/10 bg-[#faf9f7] text-sm"
            @change="onEmployeePicked(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="e in employeesStore.activeEmployees" :key="e.employeeId" :value="e.employeeId">
              {{ e.firstName }} {{ e.lastName }}{{ e.isTeamLeader ? ' (TL)' : '' }}
            </option>
          </select>
          <select :value="form.type" class="w-full border-black/10 bg-[#faf9f7] text-sm" @change="onTypeChange(($event.target as HTMLSelectElement).value as ShiftType)">
            <option value="D2D">{{ typeLabels.D2D }} (11:00–19:00)</option>
            <option value="Straat">{{ typeLabels.Straat }} (09:30–17:00)</option>
            <option value="Event">{{ typeLabels.Event }} (vrije uren)</option>
          </select>
          <input
            v-if="form.type === 'Event'"
            v-model="form.eventTitle"
            placeholder="Titel van het event"
            class="w-full border-black/10 bg-[#faf9f7] text-sm"
          />
          <div class="grid grid-cols-2 gap-3">
            <input v-model="form.startTime" type="time" :disabled="isTimeLocked" class="border-black/10 bg-[#faf9f7] text-sm disabled:opacity-50" />
            <input v-model="form.endTime" type="time" :disabled="isTimeLocked" class="border-black/10 bg-[#faf9f7] text-sm disabled:opacity-50" />
          </div>
          <input v-model="form.location" placeholder="Locatie (optioneel)" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <p v-if="formError" class="text-xs font-semibold text-semantic-danger">{{ formError }}</p>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="px-4 py-2 text-sm font-semibold text-neutral-mute" @click="isFormOpen = false">
              Annuleren
            </button>
            <button type="submit" class="bg-primary-pink px-4 py-2 text-sm font-bold text-white">Shift aanmaken</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="rejectingId" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-sm border border-black/10 bg-white p-6">
        <h3 class="text-lg font-bold">Shift afwijzen</h3>
        <textarea
          v-model="rejectReason"
          rows="3"
          placeholder="Reden (zichtbaar voor de teammanager)"
          class="mt-3 w-full border-black/10 bg-[#faf9f7] text-sm"
        ></textarea>
        <div class="mt-3 flex justify-end gap-2">
          <button class="px-4 py-2 text-sm font-semibold text-neutral-mute" @click="rejectingId = null">Annuleren</button>
          <button class="bg-red-600 px-4 py-2 text-sm font-bold text-white" @click="confirmReject">Afwijzen</button>
        </div>
      </div>
    </div>
  </div>
</template>
