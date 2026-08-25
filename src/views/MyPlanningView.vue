<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { useAuth } from '@/composables/useAuth';
import { useShiftsStore } from '@/stores/shifts';
import { useUiStore } from '@/stores/ui';
import { FIXED_SHIFT_HOURS, weekStartFor, type Shift, type ShiftCreatePayload } from '@/types/shift';

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

/** Weekly agenda grid — client + Stan both asked to see the week as a calendar, not a flat list. */
const weekDays = computed(() => {
  const start = new Date(`${currentWeekStart.value}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return {
      iso,
      weekday: d.toLocaleDateString('nl-BE', { weekday: 'short' }),
      dayNumber: d.getDate(),
      isToday: iso === today,
      shifts: sortedShifts.value.filter((s) => s.date === iso),
    };
  });
});

function openCreate(date?: string): void {
  form.value = makeEmptyForm();
  if (date) form.value.date = date;
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
  <div class="mx-auto max-w-6xl space-y-6">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm text-neutral-mute">Mijn planning · week van {{ weekLabel }}</p>
        <h2 class="mt-1 text-3xl font-bold tracking-tight">Plan jouw week</h2>
      </div>
      <button class="bg-primary-pink px-4 py-2.5 text-sm font-bold text-white" @click="openCreate()">
        + Dag toevoegen
      </button>
    </section>

    <section class="border border-black/5 bg-white p-6">
      <p v-if="shiftsStore.isLoading" class="text-sm text-neutral-mute">Laden…</p>
      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        <div
          v-for="day in weekDays"
          :key="day.iso"
          class="flex min-h-32 flex-col gap-2 border p-3"
          :class="day.isToday ? 'border-primary-pink/40 bg-primary-pink/5' : 'border-black/10 bg-[#faf9f7]'"
        >
          <div class="flex items-center justify-between">
            <p class="text-xs font-bold uppercase tracking-[0.1em]" :class="day.isToday ? 'text-primary-pink' : 'text-neutral-mute'">
              {{ day.weekday }} {{ day.dayNumber }}
            </p>
            <button
              class="text-xs font-bold text-neutral-mute hover:text-primary-pink"
              title="Dag toevoegen"
              @click="openCreate(day.iso)"
            >
              +
            </button>
          </div>
          <div v-if="!day.shifts.length" class="flex-1"></div>
          <div v-for="shift in day.shifts" :key="shift.shiftId" class="border border-black/10 bg-white p-2 text-xs">
            <p class="font-semibold">Ik werk deze dag</p>
            <p v-if="shift.location" class="text-neutral-mute">{{ shift.location }}</p>
            <div class="mt-1 flex items-center justify-between">
              <span class="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold" :class="statusClasses(shift.status)">
                {{ statusLabels[shift.status] }}
              </span>
              <button
                v-if="shift.status === 'draft'"
                class="text-[10px] font-semibold text-neutral-mute hover:text-semantic-danger"
                @click="removeDraft(shift)"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      </div>

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
