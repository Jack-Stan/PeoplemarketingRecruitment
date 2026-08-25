<script setup lang="ts">
import { onUnmounted, watch } from 'vue';

import { useActiveOffice } from '@/composables/useActiveOffice';
import { useAuditLogStore } from '@/stores/auditLog';
import { AUDIT_ACTION_LABELS } from '@/types/auditLog';

/**
 * FRD §19 — read-only view of the append-only audit trail. Follows the
 * office switcher like every other admin screen (useActiveOffice), so
 * switching to another office shows that office's log, not Gent's.
 */
const { officeId } = useActiveOffice();
const store = useAuditLogStore();

watch(
  officeId,
  (id) => {
    if (id) store.subscribe(id);
  },
  { immediate: true },
);
onUnmounted(() => store.unsubscribe());
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <section>
      <p class="text-sm text-neutral-mute">Kantoor · {{ officeId }}</p>
      <h2 class="mt-1 text-3xl font-bold tracking-tight">Audit trail</h2>
      <p class="mt-1 text-xs text-neutral-mute">
        Alleen-lezen, niet te bewerken of te verwijderen — een logboek van goedkeuringen, rol-toewijzingen en
        wijzigingen aan medewerkers en de rekruteringspijplijn.
      </p>
    </section>

    <section class="overflow-x-auto border border-black/5 bg-white">
      <table class="w-full min-w-[700px] text-left text-sm">
        <thead class="border-b border-black/5 bg-[#faf9f7] text-[10px] uppercase tracking-[0.16em] text-neutral-mute">
          <tr>
            <th class="px-5 py-4">Wanneer</th>
            <th class="px-5 py-4">Door</th>
            <th class="px-5 py-4">Actie</th>
            <th class="px-5 py-4">Betreft</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/5">
          <tr v-for="entry in store.entries" :key="entry.entryId" class="hover:bg-[#faf9f7]">
            <td class="px-5 py-4 whitespace-nowrap font-mono text-xs text-neutral-mute">
              {{ new Date(entry.createdAtMs).toLocaleString('nl-BE') }}
            </td>
            <td class="px-5 py-4 text-xs">{{ entry.actorEmail }}</td>
            <td class="px-5 py-4">
              <span class="inline-block bg-primary-pink/10 px-2.5 py-1 text-xs font-bold text-primary-pink">
                {{ AUDIT_ACTION_LABELS[entry.action] }}
              </span>
            </td>
            <td class="px-5 py-4 text-xs">
              {{ entry.targetLabel }}
              <span v-if="entry.details" class="text-neutral-mute"> — {{ entry.details }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="store.isLoading" class="p-8 text-center text-sm text-neutral-mute">Laden…</p>
      <p v-else-if="!store.entries.length" class="p-8 text-center text-sm text-neutral-mute">Nog geen logboekvermeldingen.</p>
    </section>
  </div>
</template>
