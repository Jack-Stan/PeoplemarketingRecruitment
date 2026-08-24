<script setup lang="ts">
import { RouterLink } from 'vue-router';

const staffing = [
  { day: 'Mon 24', total: 18, leaders: 5, fill: 90 },
  { day: 'Tue 25', total: 21, leaders: 6, fill: 100 },
  { day: 'Wed 26', total: 16, leaders: 4, fill: 80 },
  { day: 'Thu 27', total: 20, leaders: 5, fill: 95 },
  { day: 'Fri 28', total: 23, leaders: 6, fill: 100 },
];
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-8">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="text-sm text-neutral-mute">Monday, 24 August 2026</p><h2 class="mt-1 text-3xl font-bold tracking-tight">Good morning, Big Boss.</h2></div><RouterLink to="/planning" class="inline-flex items-center justify-center bg-primary-pink px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-pink-alt">Open planning <span class="ml-3">→</span></RouterLink></section>
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><article v-for="metric in [{label:'Today scheduled', value:'18', note:'5 Team Leaders', tone:'bg-neutral-ink text-white'},{label:'Shifts this week', value:'42', note:'+8% vs last week', tone:'bg-white'},{label:'Open leads', value:'27', note:'9 interviews planned', tone:'bg-white'},{label:'Planning status', value:'Draft', note:'Due for approval Friday', tone:'bg-primary-pink text-white'}]" :key="metric.label" class="min-h-32 border border-black/5 p-5" :class="metric.tone"><p class="text-xs font-bold uppercase tracking-[0.16em] opacity-60">{{ metric.label }}</p><p class="mt-4 text-3xl font-bold">{{ metric.value }}</p><p class="mt-1 text-xs opacity-70">{{ metric.note }}</p></article></section>
    <section class="grid gap-6 xl:grid-cols-[1.6fr_1fr]"><article class="border border-black/5 bg-white p-6"><div class="flex items-center justify-between"><div><h3 class="text-lg font-bold">This week at a glance</h3><p class="mt-1 text-xs text-neutral-mute">Scheduled employees by day</p></div><RouterLink to="/planning" class="text-xs font-bold text-primary-pink">View calendar →</RouterLink></div><div class="mt-8 flex h-48 items-end justify-between gap-3 border-b border-black/10 px-2"><div v-for="day in staffing" :key="day.day" class="flex flex-1 flex-col items-center gap-2"><span class="text-xs font-bold">{{ day.total }}</span><div class="flex w-full max-w-12 flex-col justify-end bg-primary-pink/15" :style="{ height: `${day.fill}%` }"><div class="h-2 bg-primary-pink"></div></div><span class="text-[11px] text-neutral-mute">{{ day.day }}</span></div></div></article><article class="border border-black/5 bg-white p-6"><div class="flex items-center justify-between"><div><h3 class="text-lg font-bold">Recruitment pulse</h3><p class="mt-1 text-xs text-neutral-mute">Current funnel</p></div><RouterLink to="/recruitment" class="text-xs font-bold text-primary-pink">Open pipeline →</RouterLink></div><div class="mt-7 space-y-4"><div v-for="item in [{label:'New leads',value:27,color:'bg-[#111]'},{label:'Interview planned',value:9,color:'bg-primary-pink'},{label:'Attended',value:6,color:'bg-emerald-500'},{label:'Hired',value:3,color:'bg-amber-400'}]" :key="item.label"><div class="mb-1 flex justify-between text-xs"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div><div class="h-2 bg-neutral-100"><div class="h-full" :class="item.color" :style="{ width: `${item.value / 27 * 100}%` }"></div></div></div></div></article></section>
  </div>
</template>