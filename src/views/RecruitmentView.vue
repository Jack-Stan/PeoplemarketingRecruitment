<script setup lang="ts">
import { computed, ref } from 'vue';

const selected = ref('All leads');
const stages = ['All leads', 'New lead', 'Contacted', 'Interview planned', 'Hired'];
const leads = [
  { name: 'Fleur Jansen', source: 'Referral', stage: 'Interview planned', date: 'Today', detail: 'Tomorrow · 10:30' },
  { name: 'Yara Peters', source: 'Instagram', stage: 'New lead', date: 'Today', detail: 'Added 2h ago' },
  { name: 'Mats Willems', source: 'Website', stage: 'Contacted', date: 'Yesterday', detail: 'Follow-up due' },
  { name: 'Julia Meijer', source: 'Indeed', stage: 'Hired', date: '22 Aug', detail: 'Starting 1 Sep' },
  { name: 'Bram Kuiper', source: 'Referral', stage: 'Interview planned', date: '21 Aug', detail: 'Friday · 14:00' },
];
const visibleLeads = computed(() => selected.value === 'All leads' ? leads : leads.filter((lead) => lead.stage === selected.value));
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6"><section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="text-sm text-neutral-mute">August 2026 · Main office</p><h2 class="mt-1 text-3xl font-bold tracking-tight">Recruitment pipeline</h2></div><button class="bg-primary-pink px-4 py-2.5 text-sm font-bold text-white">+ Add lead</button></section><section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><article v-for="item in [{label:'New leads',value:27},{label:'Contacted',value:14},{label:'Interviews',value:9},{label:'Attended',value:6},{label:'Hired',value:3}]" :key="item.label" class="border border-black/5 bg-white p-5"><p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">{{ item.label }}</p><p class="mt-3 text-3xl font-bold">{{ item.value }}</p></article></section><div class="flex gap-1 overflow-x-auto border-b border-black/10 pb-px"><button v-for="stage in stages" :key="stage" class="whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold" :class="selected === stage ? 'border-primary-pink text-primary-pink' : 'border-transparent text-neutral-mute'" @click="selected = stage">{{ stage }}</button></div><section class="overflow-x-auto border border-black/5 bg-white"><table class="w-full min-w-[700px] text-left text-sm"><thead class="border-b border-black/5 bg-[#faf9f7] text-[10px] uppercase tracking-[0.16em] text-neutral-mute"><tr><th class="px-5 py-4">Candidate</th><th class="px-5 py-4">Source</th><th class="px-5 py-4">Stage</th><th class="px-5 py-4">Last activity</th><th class="px-5 py-4"></th></tr></thead><tbody class="divide-y divide-black/5"><tr v-for="lead in visibleLeads" :key="lead.name" class="hover:bg-[#faf9f7]"><td class="px-5 py-4 font-bold">{{ lead.name }}</td><td class="px-5 py-4 text-xs text-neutral-mute">{{ lead.source }}</td><td class="px-5 py-4"><span class="inline-block bg-primary-pink/10 px-2.5 py-1 text-xs font-bold text-primary-pink">{{ lead.stage }}</span></td><td class="px-5 py-4"><p class="text-xs font-semibold">{{ lead.date }}</p><p class="text-[11px] text-neutral-mute">{{ lead.detail }}</p></td><td class="px-5 py-4 text-right text-lg text-neutral-mute">···</td></tr></tbody></table></section></div>
</template>
