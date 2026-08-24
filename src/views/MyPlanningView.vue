<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { useAuth } from '@/composables/useAuth';
import { useShiftsStore } from '@/stores/shifts';
import { useUiStore } from '@/stores/ui';
import { FIXED_SHIFT_HOURS, weekStartFor, type Shift, type ShiftCreatePayload, type ShiftType } from '@/types/shift';

/**
 * TeamMember self-service planning — decision 008. Employee-authored: the
 * member drafts their own shifts for the current week and submits the whole
 * week in one action; an admin approves/rejects via PlanningView's queue.
 * Not open-slot claiming — see decisions/008 for why that's a different
 * (unrequested) feature.
 */
const auth = useAuth();
const shiftsStore = useShiftsStore();
const ui = useUiStore();

const officeId = computed(() => auth.officeId.value ?? '');
const uid = computed(() => auth.user.value?.uid ?? '');

const today = new Date().toISOString().slice(0, 10);
const currentWeekStart = ref(weekStartFor(today));

const isFormOpen = ref(false);
const formError = ref<string | null>(null);

function makeEmptyForm(): ShiftCreatePayload {
  return {
    assignedEmployeeId: uid.value,
    date: today,
    type: 'D2D',
    startTime: FIXED_SHIFT_HOURS.D2D.start,
    endTime: FIXED_SHIFT_HOURS.D2D.end,
    status: 'draft',
    rejectionReason: null,
    employeeName: auth.user.value?.displayName || auth.user.value?.email || '',
    employeeIsTeamLeader: auth.isTeamLeader.value,
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

const statusLabels: Record<Shift['status'], string> = {
  draft: 'Concept',
  pending: 'In afwachting',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
};
function statusClasses(status: Shift['status']): string {
  return {
    draft: 'bg-neutral-200 text-neutral-mute',
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  }[status];
}

const sortedShifts = computed(() => [...shiftsStore.shifts].sort((a, b) => a.date.localeCompare(b.date)));
const draftCount = computed(() => shiftsStore.draftIds.length);
const weekLabel = computed(() => {
  const start = new Date(`${currentWeekStart.value}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long' });
  return `${fmt(start)} – ${fmt(end)}`;
});

function openCreate(): void {
  form.value = makeEmptyForm();
  formError.value = null;
  isFormOpen.value = true;
}

async function submitForm(): Promise<void> {
  if (form.value.startTime >= form.value.endTime) {
    formError.value = 'Starttijd moet voor eindtijd liggen.';
    return;
  }
  if (weekStartFor(form.value.date) !== currentWeekStart.value) {
    formError.value = 'Kies een datum in de huidige week.';
    return;
  }
  if (shiftsStore.hasOverlap(uid.value, form.value.date, form.value.startTime, form.value.endTime)) {
    formError.value = 'Je hebt die dag al een overlappende shift.';
    return;
  }
  formError.value = null;
  const ok = await shiftsStore.create(officeId.value, uid.value, form.value);
  if (ok) {
    ui.push('Shift toegevoegd aan je week.', 'success');
    isFormOpen.value = false;
  } else {
    formError.value = shiftsStore.error;
  }
}

async function removeDraft(shift: Shift): Promise<void> {
  const ok = await shiftsStore.remove(officeId.value, shift.shiftId);
  ui.push(ok ? 'Concept verwijderd.' : (shiftsStore.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
}

async function submitWeek(): Promise<void> {
  const ok = await shiftsStore.submitWeek(officeId.value, Date.now());
  ui.push(
    ok ? 'Je week is ingediend ter goedkeuring.' : (shiftsStore.error ?? 'Er ging iets mis.'),
    ok ? 'success' : 'error',
  );
}

function subscribe(): void {
  if (officeId.value && uid.value) {
    shiftsStore.subscribeMineForWeek(officeId.value, uid.value, currentWeekStart.value);
  }
}

onMounted(subscribe);
onUnmounted(() => shiftsStore.unsubscribe());
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm text-neutral-mute">Mijn planning · week van {{ weekLabel }}</p>
        <h2 class="mt-1 text-3xl font-bold tracking-tight">Plan jouw week</h2>
      </div>
      <button class="bg-primary-pink px-4 py-2.5 text-sm font-bold text-white" @click="openCreate">
        + Shift toevoegen
      </button>
    </section>

    <section class="border border-black/5 bg-white p-6">
      <ul v-if="sortedShifts.length" class="divide-y divide-black/5">
        <li v-for="shift in sortedShifts" :key="shift.shiftId" class="flex items-center justify-between py-3 text-sm">
          <div>
            <p class="font-semibold">
              {{ new Date(shift.date).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' }) }}
            </p>
            <p class="text-xs text-neutral-mute">
              {{ shift.type }}<span v-if="shift.eventTitle"> — {{ shift.eventTitle }}</span> ·
              {{ shift.startTime }}–{{ shift.endTime }}
              <span v-if="shift.location"> · {{ shift.location }}</span>
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span class="inline-block rounded px-2 py-0.5 text-[11px] font-bold" :class="statusClasses(shift.status)">
              {{ statusLabels[shift.status] }}
            </span>
            <button
              v-if="shift.status === 'draft'"
              class="text-xs font-semibold text-neutral-mute hover:text-semantic-danger"
              @click="removeDraft(shift)"
            >
              Verwijderen
            </button>
          </div>
        </li>
      </ul>
      <p v-else-if="shiftsStore.isLoading" class="text-sm text-neutral-mute">Laden…</p>
      <p v-else class="text-sm text-neutral-mute">Nog geen shifts deze week. Voeg er een toe om te beginnen.</p>

      <div v-if="draftCount" class="mt-6 flex items-center justify-between border-t border-black/5 pt-4">
        <p class="text-xs text-neutral-mute">{{ draftCount }} concept-shift{{ draftCount === 1 ? '' : 's' }} klaar om in te dienen.</p>
        <button class="bg-neutral-ink px-4 py-2 text-xs font-bold text-white hover:bg-black" @click="submitWeek">
          Week indienen
        </button>
      </div>
    </section>

    <div v-if="isFormOpen" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md border border-black/10 bg-white p-6">
        <h3 class="text-lg font-bold">Shift toevoegen</h3>
        <form class="mt-4 space-y-3" @submit.prevent="submitForm">
          <input v-model="form.date" type="date" :min="currentWeekStart" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <select :value="form.type" class="w-full border-black/10 bg-[#faf9f7] text-sm" @change="onTypeChange(($event.target as HTMLSelectElement).value as ShiftType)">
            <option value="D2D">D2D (deur-tot-deur) — 11:00–19:00</option>
            <option value="Straat">Straat — 09:30–17:00</option>
            <option value="Event">Event — vrije uren</option>
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
            <button type="submit" class="bg-primary-pink px-4 py-2 text-sm font-bold text-white">Toevoegen</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
