<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { RouterLink } from 'vue-router';

import { useAuth } from '@/composables/useAuth';
import { useRecruitmentStore } from '@/stores/recruitment';
import { useShiftsStore } from '@/stores/shifts';
import { weekStartFor } from '@/types/shift';

const auth = useAuth();
const shiftsStore = useShiftsStore();
const recruitmentStore = useRecruitmentStore();
const isMember = computed(() => auth.role.value === 'TeamMember');

const today = new Date().toISOString().slice(0, 10);
const todayLabel = new Date(`${today}T00:00:00`).toLocaleDateString('nl-BE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const upcoming = computed(() =>
  shiftsStore.shifts
    .filter((s) => s.date >= today && s.status === 'approved')
    .sort((a, b) => a.date.localeCompare(b.date)),
);
const completedCount = computed(
  () => shiftsStore.shifts.filter((s) => s.status === 'approved' && s.date < today).length,
);
const pendingCount = computed(() => shiftsStore.shifts.filter((s) => s.status === 'pending').length);

/** Real admin-side numbers — was hardcoded mock data, see the FRD/duplication audit. */
const currentWeekStart = computed(() => weekStartFor(today));
const weekShifts = computed(() => {
  const start = currentWeekStart.value;
  const endExclusive = new Date(`${start}T00:00:00`);
  endExclusive.setDate(endExclusive.getDate() + 7);
  const end = endExclusive.toISOString().slice(0, 10);
  return shiftsStore.shifts.filter((s) => s.date >= start && s.date < end);
});
const todaysShifts = computed(() => shiftsStore.shifts.filter((s) => s.date === today));
const todaysTeamLeaderCount = computed(
  () => new Set(todaysShifts.value.filter((s) => s.employeeIsTeamLeader).map((s) => s.assignedEmployeeId)).size,
);
const weekApprovedCount = computed(() => weekShifts.value.filter((s) => s.status === 'approved').length);

/** Segmented daily bar for the current week — client transcript's staffing overview, real data. */
const weeklyStaffing = computed(() => {
  const byDate = new Map<string, { total: number; leaders: number }>();
  for (const s of weekShifts.value) {
    const bucket = byDate.get(s.date) ?? { total: 0, leaders: 0 };
    bucket.total += 1;
    if (s.employeeIsTeamLeader) bucket.leaders += 1;
    byDate.set(s.date, bucket);
  }
  const days = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  const maxTotal = Math.max(1, ...days.map(([, d]) => d.total));
  return days.map(([date, d]) => ({
    day: new Date(date).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric' }),
    total: d.total,
    leaders: d.leaders,
    fill: Math.round((d.total / maxTotal) * 100),
  }));
});

const recruitmentPulse = computed(() => {
  const c = recruitmentStore.funnelCounts;
  const total = Math.max(1, c.new + c.interviewPlanned + c.attended + c.hired);
  return [
    { label: 'Nieuwe leads', value: c.new, color: 'bg-[#111]', pct: (c.new / total) * 100 },
    { label: 'Sollicitatie gepland', value: c.interviewPlanned, color: 'bg-primary-pink', pct: (c.interviewPlanned / total) * 100 },
    { label: 'Opgekomen', value: c.attended, color: 'bg-emerald-500', pct: (c.attended / total) * 100 },
    { label: 'Aangenomen', value: c.hired, color: 'bg-amber-400', pct: (c.hired / total) * 100 },
  ];
});

onMounted(() => {
  if (!auth.officeId.value) return;
  if (isMember.value) {
    if (auth.user.value) shiftsStore.subscribeMine(auth.officeId.value, auth.user.value.uid);
  } else {
    shiftsStore.subscribe(auth.officeId.value);
    recruitmentStore.subscribe(auth.officeId.value);
  }
});
onUnmounted(() => {
  shiftsStore.unsubscribe();
  if (!isMember.value) recruitmentStore.unsubscribe();
});
</script>

<template>
  <div v-if="isMember" class="mx-auto max-w-3xl space-y-8">
    <section>
      <p class="text-sm text-neutral-mute">Jouw shifts</p>
      <h2 class="mt-1 text-3xl font-bold tracking-tight">
        Fijn je te zien, {{ auth.user.value?.displayName || auth.user.value?.email }}.
      </h2>
    </section>
    <section class="grid gap-4 sm:grid-cols-2">
      <article class="border border-black/5 bg-white p-5">
        <p class="text-xs font-bold uppercase tracking-[0.16em] text-neutral-mute">Shifts voltooid</p>
        <p class="mt-4 text-3xl font-bold">{{ completedCount }}</p>
      </article>
      <article class="border border-black/5 bg-white p-5">
        <p class="text-xs font-bold uppercase tracking-[0.16em] text-neutral-mute">Wacht op goedkeuring</p>
        <p class="mt-4 text-3xl font-bold">{{ pendingCount }}</p>
      </article>
    </section>
    <section class="border border-black/5 bg-white p-6">
      <h3 class="text-lg font-bold">Aankomende shifts</h3>
      <ul v-if="upcoming.length" class="mt-4 divide-y divide-black/5">
        <li v-for="s in upcoming" :key="s.shiftId" class="flex items-center justify-between py-3 text-sm">
          <span class="font-semibold">{{ s.date }}</span>
          <span class="text-neutral-mute">{{ s.type }} · {{ s.startTime }}–{{ s.endTime }}</span>
        </li>
      </ul>
      <p v-else class="mt-4 text-sm text-neutral-mute">Nog geen aankomende shifts ingepland.</p>
    </section>
    <RouterLink
      to="/mijn-planning"
      class="inline-flex items-center justify-center bg-primary-pink px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-pink-alt"
    >
      Mijn planning openen <span class="ml-3">→</span>
    </RouterLink>
  </div>

  <div v-else class="mx-auto max-w-7xl space-y-8">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm text-neutral-mute capitalize">{{ todayLabel }}</p>
        <h2 class="mt-1 text-3xl font-bold tracking-tight">Goedemorgen, baas.</h2>
      </div>
      <RouterLink to="/planning"
        class="inline-flex items-center justify-center bg-primary-pink px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-pink-alt">
        Planning openen <span class="ml-3">→</span></RouterLink>
    </section>
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article class="min-h-32 border border-black/5 bg-neutral-ink p-5 text-white">
        <p class="text-xs font-bold uppercase tracking-[0.16em] opacity-60">Vandaag ingepland</p>
        <p class="mt-4 text-3xl font-bold">{{ todaysShifts.length }}</p>
        <p class="mt-1 text-xs opacity-70">{{ todaysTeamLeaderCount }} teamleiders</p>
      </article>
      <article class="min-h-32 border border-black/5 bg-white p-5">
        <p class="text-xs font-bold uppercase tracking-[0.16em] opacity-60">Shifts deze week</p>
        <p class="mt-4 text-3xl font-bold">{{ weekShifts.length }}</p>
        <p class="mt-1 text-xs opacity-70">{{ weekApprovedCount }} goedgekeurd</p>
      </article>
      <article class="min-h-32 border border-black/5 bg-white p-5">
        <p class="text-xs font-bold uppercase tracking-[0.16em] opacity-60">Open leads</p>
        <p class="mt-4 text-3xl font-bold">{{ recruitmentStore.openCount }}</p>
        <p class="mt-1 text-xs opacity-70">{{ recruitmentStore.funnelCounts.interviewPlanned }} sollicitaties gepland</p>
      </article>
      <article class="min-h-32 border border-black/5 bg-primary-pink p-5 text-white">
        <p class="text-xs font-bold uppercase tracking-[0.16em] opacity-60">Wacht op goedkeuring</p>
        <p class="mt-4 text-3xl font-bold">{{ pendingCount }}</p>
        <p class="mt-1 text-xs opacity-70">Nog te beoordelen</p>
      </article>
    </section>
    <section class="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <article class="border border-black/5 bg-white p-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold">Deze week in één oogopslag</h3>
            <p class="mt-1 text-xs text-neutral-mute">Ingeplande medewerkers per dag</p>
          </div>
          <RouterLink to="/planning" class="text-xs font-bold text-primary-pink">Naar planning →</RouterLink>
        </div>
        <div v-if="weeklyStaffing.length" class="mt-8 flex h-48 items-end justify-between gap-3 border-b border-black/10 px-2">
          <div v-for="day in weeklyStaffing" :key="day.day" class="flex flex-1 flex-col items-center gap-2"><span
              class="text-xs font-bold">{{ day.total }}</span>
            <div class="flex w-full max-w-12 flex-col justify-end bg-primary-pink/15"
              :style="{ height: `${day.fill}%` }">
              <div class="h-2 bg-primary-pink"></div>
            </div><span class="text-[11px] text-neutral-mute">{{ day.day }}</span>
          </div>
        </div>
        <p v-else class="mt-8 text-sm text-neutral-mute">Nog geen shifts deze week.</p>
      </article>
      <article class="border border-black/5 bg-white p-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold">Rekrutering</h3>
            <p class="mt-1 text-xs text-neutral-mute">Huidige funnel</p>
          </div>
          <RouterLink to="/recruitment" class="text-xs font-bold text-primary-pink">Open pipeline →</RouterLink>
        </div>
        <div class="mt-7 space-y-4">
          <div v-for="item in recruitmentPulse" :key="item.label">
            <div class="mb-1 flex justify-between text-xs"><span>{{ item.label }}</span><strong>{{ item.value
                }}</strong></div>
            <div class="h-2 bg-neutral-100">
              <div class="h-full" :class="item.color" :style="{ width: `${item.pct}%` }"></div>
            </div>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
