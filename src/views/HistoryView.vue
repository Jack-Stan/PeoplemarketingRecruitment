<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';

import { useAuth } from '@/composables/useAuth';
import { useShiftsStore } from '@/stores/shifts';
import type { Shift } from '@/types/shift';

/**
 * Real Firestore-backed shift history — replaces the earlier static mock.
 * Admin/manager see the whole office's completed shifts; a TeamMember sees
 * only their own (same read-rule split as everywhere else in this app).
 *
 * Deliberately NOT the full "TL headcount trend over time" report from the
 * client transcript / ticket-06 — that needs a real snapshot cadence
 * decision (the old `/periods` write path was a Cloud Function that no
 * longer exists, see decisions/006) and hasn't been scoped yet. This groups
 * whatever's live in `/shifts` by month, which is honest about what's
 * actually there instead of showing invented numbers.
 */
const auth = useAuth();
const shiftsStore = useShiftsStore();
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

onMounted(() => {
  if (!auth.officeId.value || !auth.user.value) return;
  if (isMember.value) {
    shiftsStore.subscribeMine(auth.officeId.value, auth.user.value.uid);
  } else {
    shiftsStore.subscribe(auth.officeId.value);
  }
});
onUnmounted(() => shiftsStore.unsubscribe());
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <section>
      <p class="text-sm text-neutral-mute">{{ isMember ? 'Jouw shiftgeschiedenis' : 'Shiftgeschiedenis per maand' }}</p>
      <h2 class="mt-1 text-3xl font-bold tracking-tight">Geschiedenis</h2>
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

    <p class="text-xs text-neutral-mute">
      Rekruteringsgeschiedenis en de teamleider-trendgrafiek volgen nog — daarvoor is eerst een echte
      dataset nodig (zie ticket-06).
    </p>
  </div>
</template>
