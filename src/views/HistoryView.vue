<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue';

import { useAuth } from '@/composables/useAuth';
import { useActiveOffice } from '@/composables/useActiveOffice';
import { useShiftsStore } from '@/stores/shifts';
import type { Shift } from '@/types/shift';

/**
 * Real Firestore-backed shift history — replaces the earlier static mock.
 * Admin/manager see the whole office's completed shifts; a TeamMember sees
 * only their own (same read-rule split as everywhere else in this app).
 *
 * TL headcount trend (client transcript: "where am I losing/gaining team
 * leaders") is computed live from `/shifts` rather than a written `/periods`
 * snapshot — there's no Cloud Function to write one any more (decisions/006)
 * and the client's own ask is a trend to look at, not an immutable audit
 * record, so a live client-side aggregate is honest and good enough. Revisit
 * with a real `/periods` design only if an actual immutability requirement
 * shows up.
 */
const auth = useAuth();
const shiftsStore = useShiftsStore();
const { officeId } = useActiveOffice();
const isMember = computed(() => auth.role.value === 'TeamMember');

const monthLabel = (yyyymm: string) =>
  new Date(`${yyyymm}-01T00:00:00`).toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' });

const monthlyRows = computed(() => {
  const byMonth = new Map<string, Shift[]>();
  for (const s of shiftsStore.shifts) {
    const key = s.date.slice(0, 7);
    const bucket = byMonth.get(key) ?? [];
    bucket.push(s);
    byMonth.set(key, bucket);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, shifts]) => {
      const approved = shifts.filter((s) => s.status === 'approved');
      const tlIds = new Set(approved.filter((s) => s.employeeIsTeamLeader).map((s) => s.assignedEmployeeId));
      return {
        month,
        label: monthLabel(month),
        total: shifts.length,
        approved: approved.length,
        teamLeaders: tlIds.size,
      };
    });
});

/** Oldest → newest, with month-over-month delta, for the trend chart below. */
const teamLeaderTrend = computed(() => {
  const chronological = [...monthlyRows.value].sort((a, b) => a.month.localeCompare(b.month));
  const maxCount = Math.max(1, ...chronological.map((r) => r.teamLeaders));
  return chronological.map((r, i) => ({
    ...r,
    fill: Math.round((r.teamLeaders / maxCount) * 100),
    delta: i === 0 ? null : r.teamLeaders - chronological[i - 1].teamLeaders,
  }));
});

watch(
  officeId,
  (id) => {
    if (!id || !auth.user.value) return;
    if (isMember.value) {
      shiftsStore.subscribeMine(id, auth.user.value.uid);
    } else {
      shiftsStore.subscribe(id);
    }
  },
  { immediate: true },
);
onUnmounted(() => shiftsStore.unsubscribe());
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <section>
      <p class="text-sm text-neutral-mute">{{ isMember ? 'Jouw shiftgeschiedenis' : 'Shiftgeschiedenis per maand' }}</p>
      <h2 class="mt-1 text-3xl font-bold tracking-tight">Geschiedenis</h2>
    </section>

    <section v-if="!isMember && teamLeaderTrend.length" class="border border-black/5 bg-white p-6">
      <div>
        <h3 class="text-lg font-bold">Teamleiders per maand</h3>
        <p class="mt-1 text-xs text-neutral-mute">Waar win of verlies je teamleiders?</p>
      </div>
      <div class="mt-8 flex h-40 items-end justify-between gap-3 overflow-x-auto border-b border-black/10 px-2">
        <div v-for="row in teamLeaderTrend" :key="row.month" class="flex flex-1 flex-col items-center gap-2">
          <span class="flex items-center gap-1 text-xs font-bold">
            {{ row.teamLeaders }}
            <span
              v-if="row.delta !== null && row.delta !== 0"
              :class="row.delta > 0 ? 'text-emerald-600' : 'text-semantic-danger'"
            >
              {{ row.delta > 0 ? '▲' : '▼' }}{{ Math.abs(row.delta) }}
            </span>
          </span>
          <div class="flex w-full max-w-12 flex-col justify-end bg-primary-pink/15" :style="{ height: `${row.fill}%` }">
            <div class="h-2 bg-primary-pink"></div>
          </div>
          <span class="whitespace-nowrap text-[11px] capitalize text-neutral-mute">{{ row.label }}</span>
        </div>
      </div>
    </section>

    <section class="overflow-x-auto border border-black/5 bg-white">
      <table class="w-full min-w-[650px] text-left text-sm">
        <thead class="border-b border-black/5 bg-[#faf9f7] text-[10px] uppercase tracking-[0.16em] text-neutral-mute">
          <tr>
            <th class="px-5 py-4">Maand</th>
            <th class="px-5 py-4">Shifts</th>
            <th class="px-5 py-4">Goedgekeurd</th>
            <th v-if="!isMember" class="px-5 py-4">Teamleiders</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/5">
          <tr v-for="row in monthlyRows" :key="row.month" class="hover:bg-[#faf9f7]">
            <td class="px-5 py-4 font-bold capitalize">{{ row.label }}</td>
            <td class="px-5 py-4">{{ row.total }}</td>
            <td class="px-5 py-4">{{ row.approved }}</td>
            <td v-if="!isMember" class="px-5 py-4">{{ row.teamLeaders }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="shiftsStore.isLoading" class="p-8 text-center text-sm text-neutral-mute">Laden…</p>
      <p v-else-if="!monthlyRows.length" class="p-8 text-center text-sm text-neutral-mute">Nog geen geschiedenis.</p>
    </section>

    <p v-if="!isMember" class="text-xs text-neutral-mute">
      Rekruteringsgeschiedenis volgt nog — dat wordt meegenomen zodra de rekruteringsmodule langer meedraait.
    </p>
  </div>
</template>
