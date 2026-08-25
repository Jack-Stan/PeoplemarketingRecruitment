<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';

import { useAuth } from '@/composables/useAuth';
import { useActiveOffice } from '@/composables/useActiveOffice';
import { useRecruitmentStore } from '@/stores/recruitment';
import { useUiStore } from '@/stores/ui';
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type LeadSource,
  type LeadStage,
  type RecruitmentLeadCreatePayload,
} from '@/types/recruitmentLead';

const auth = useAuth();
const store = useRecruitmentStore();
const ui = useUiStore();

const { officeId } = useActiveOffice();
const canManage = computed(() => auth.role.value === 'Administrator' || auth.role.value === 'TeamManager');

const selectedStage = ref<LeadStage | 'all'>('all');
const visibleLeads = computed(() =>
  selectedStage.value === 'all' ? store.leads : store.leads.filter((l) => l.stage === selectedStage.value),
);

const sources: LeadSource[] = ['WhatsApp', 'Instagram', 'Website', 'Doorverwijzing', 'Anders'];

const isFormOpen = ref(false);
const formError = ref<string | null>(null);
function makeEmptyForm(): RecruitmentLeadCreatePayload {
  return {
    name: '',
    email: null,
    phone: null,
    source: 'WhatsApp',
    stage: 'new',
    notes: null,
    createdBy: auth.user.value?.uid ?? '',
  };
}
const form = ref<RecruitmentLeadCreatePayload>(makeEmptyForm());

function openCreate(): void {
  form.value = makeEmptyForm();
  formError.value = null;
  isFormOpen.value = true;
}

async function submitForm(): Promise<void> {
  if (!form.value.name.trim()) {
    formError.value = 'Naam is verplicht.';
    return;
  }
  formError.value = null;
  const ok = await store.create(officeId.value, Date.now(), form.value);
  if (ok) {
    ui.push('Lead toegevoegd.', 'success');
    isFormOpen.value = false;
  } else {
    formError.value = store.error;
  }
}

async function moveStage(leadId: string, stage: LeadStage): Promise<void> {
  const ok = await store.setStage(officeId.value, leadId, stage);
  ui.push(ok ? 'Fase bijgewerkt.' : (store.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
}

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
  <div class="mx-auto max-w-7xl space-y-6">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm text-neutral-mute">{{ store.leadsThisWeek }} nieuwe leads deze week · Kantoor {{ officeId }}</p>
        <h2 class="mt-1 text-3xl font-bold tracking-tight">Rekrutering</h2>
      </div>
      <button v-if="canManage" class="bg-primary-pink px-4 py-2.5 text-sm font-bold text-white" @click="openCreate">
        + Lead toevoegen
      </button>
    </section>

    <!-- Funnel — client transcript: "zoveel leads deze week", same bar primitive as the staffing overview. -->
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <article class="border border-black/5 bg-white p-5">
        <p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Nieuw</p>
        <p class="mt-3 text-3xl font-bold">{{ store.funnelCounts.new }}</p>
      </article>
      <article class="border border-black/5 bg-white p-5">
        <p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Gecontacteerd</p>
        <p class="mt-3 text-3xl font-bold">{{ store.funnelCounts.contacted }}</p>
      </article>
      <article class="border border-black/5 bg-white p-5">
        <p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Sollicitatie gepland</p>
        <p class="mt-3 text-3xl font-bold">{{ store.funnelCounts.interviewPlanned }}</p>
      </article>
      <article class="border border-black/5 bg-white p-5">
        <p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Opgekomen</p>
        <p class="mt-3 text-3xl font-bold">{{ store.funnelCounts.attended }}</p>
      </article>
      <article class="border border-black/5 bg-white p-5">
        <p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Aangenomen</p>
        <p class="mt-3 text-3xl font-bold text-emerald-600">{{ store.funnelCounts.hired }}</p>
      </article>
    </section>

    <!-- FRD §15 Recruitment Quality Reporting — attendance/no-show/conversion + performance per bron. -->
    <section v-if="canManage" class="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
      <div class="grid grid-cols-3 gap-4">
        <article class="border border-black/5 bg-white p-5">
          <p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Opkomst</p>
          <p class="mt-3 text-3xl font-bold text-emerald-600">{{ store.qualityStats.attendanceRate }}%</p>
        </article>
        <article class="border border-black/5 bg-white p-5">
          <p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">No-show</p>
          <p class="mt-3 text-3xl font-bold text-semantic-danger">{{ store.qualityStats.noShowRate }}%</p>
        </article>
        <article class="border border-black/5 bg-white p-5">
          <p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Conversie</p>
          <p class="mt-3 text-3xl font-bold">{{ store.qualityStats.conversionRate }}%</p>
        </article>
      </div>
      <div class="border border-black/5 bg-white p-5">
        <h3 class="text-sm font-bold">Prestatie per bron</h3>
        <div class="mt-4 space-y-3">
          <div v-for="row in store.bySourcePerformance" :key="row.source" class="flex items-center gap-3 text-xs">
            <span class="w-28 shrink-0 font-semibold">{{ row.source }}</span>
            <div class="h-2 flex-1 bg-neutral-100">
              <div class="h-full bg-primary-pink" :style="{ width: `${row.hiredRate}%` }"></div>
            </div>
            <span class="w-20 shrink-0 text-right text-neutral-mute">{{ row.hired }}/{{ row.total }} aangenomen</span>
          </div>
          <p v-if="!store.bySourcePerformance.length" class="text-neutral-mute">Nog geen leads.</p>
        </div>
      </div>
    </section>

    <div class="flex gap-1 overflow-x-auto border-b border-black/10 pb-px">
      <button
        class="whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold"
        :class="selectedStage === 'all' ? 'border-primary-pink text-primary-pink' : 'border-transparent text-neutral-mute'"
        @click="selectedStage = 'all'"
      >
        Alle leads
      </button>
      <button
        v-for="stage in LEAD_STAGES"
        :key="stage"
        class="whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold"
        :class="selectedStage === stage ? 'border-primary-pink text-primary-pink' : 'border-transparent text-neutral-mute'"
        @click="selectedStage = stage"
      >
        {{ LEAD_STAGE_LABELS[stage] }}
      </button>
    </div>

    <section class="overflow-x-auto border border-black/5 bg-white">
      <table class="w-full min-w-[700px] text-left text-sm">
        <thead class="border-b border-black/5 bg-[#faf9f7] text-[10px] uppercase tracking-[0.16em] text-neutral-mute">
          <tr>
            <th class="px-5 py-4">Kandidaat</th>
            <th class="px-5 py-4">Bron</th>
            <th class="px-5 py-4">Fase</th>
            <th class="px-5 py-4">Contact</th>
            <th v-if="canManage" class="px-5 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/5">
          <tr v-for="lead in visibleLeads" :key="lead.leadId" class="hover:bg-[#faf9f7]">
            <td class="px-5 py-4">
              <p class="font-bold">{{ lead.name }}</p>
              <p v-if="lead.notes" class="text-[11px] text-neutral-mute">{{ lead.notes }}</p>
            </td>
            <td class="px-5 py-4 text-xs text-neutral-mute">{{ lead.source }}</td>
            <td class="px-5 py-4">
              <span class="inline-block bg-primary-pink/10 px-2.5 py-1 text-xs font-bold text-primary-pink">
                {{ LEAD_STAGE_LABELS[lead.stage] }}
              </span>
            </td>
            <td class="px-5 py-4 text-xs text-neutral-mute">
              <p v-if="lead.email">{{ lead.email }}</p>
              <p v-if="lead.phone">{{ lead.phone }}</p>
            </td>
            <td v-if="canManage" class="px-5 py-4 text-right">
              <select
                :value="lead.stage"
                class="border-black/10 bg-[#faf9f7] text-xs"
                @change="moveStage(lead.leadId, ($event.target as HTMLSelectElement).value as LeadStage)"
              >
                <option v-for="stage in LEAD_STAGES" :key="stage" :value="stage">{{ LEAD_STAGE_LABELS[stage] }}</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="store.isLoading" class="p-8 text-center text-sm text-neutral-mute">Laden…</p>
      <p v-else-if="!visibleLeads.length" class="p-8 text-center text-sm text-neutral-mute">Nog geen leads.</p>
    </section>

    <div v-if="isFormOpen" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md border border-black/10 bg-white p-6">
        <h3 class="text-lg font-bold">Lead toevoegen</h3>
        <form class="mt-4 space-y-3" @submit.prevent="submitForm">
          <input v-model="form.name" placeholder="Naam" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <input v-model="form.email" type="email" placeholder="E-mail (optioneel)" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <input v-model="form.phone" placeholder="Telefoon (optioneel)" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <select v-model="form.source" class="w-full border-black/10 bg-[#faf9f7] text-sm">
            <option v-for="s in sources" :key="s" :value="s">{{ s }}</option>
          </select>
          <textarea v-model="form.notes" rows="2" placeholder="Notities (optioneel)" class="w-full border-black/10 bg-[#faf9f7] text-sm"></textarea>
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
