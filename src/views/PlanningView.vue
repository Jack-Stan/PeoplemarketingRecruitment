<script setup lang="ts">
import { ref } from 'vue';

const view = ref('Week');
const days = ['Mon 24', 'Tue 25', 'Wed 26', 'Thu 27', 'Fri 28', 'Sat 29', 'Sun 30'];
const shifts = [
  { name: 'Morning team', time: '08:00 - 16:00', people: 'Noah · Olivia · Liam', leader: true, day: 0 },
  { name: 'Afternoon team', time: '12:00 - 20:00', people: 'Emma · Lucas · Mila', leader: true, day: 1 },
  { name: 'Event crew', time: '09:00 - 17:00', people: 'Sophie · Daan', leader: false, day: 2 },
  { name: 'Morning team', time: '08:00 - 16:00', people: 'Noah · Sem · Sara', leader: true, day: 3 },
  { name: 'Full floor', time: '10:00 - 18:00', people: 'Olivia · Liam · Emma · Lucas', leader: true, day: 4 },
];
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="text-sm text-neutral-mute">24 - 30 August 2026</p><h2 class="mt-1 text-3xl font-bold tracking-tight">Planning calendar</h2></div><div class="flex gap-2"><button v-for="option in ['Day','Week','Month']" :key="option" class="border px-3 py-2 text-xs font-bold" :class="view === option ? 'border-neutral-ink bg-neutral-ink text-white' : 'border-black/10 bg-white'" @click="view = option">{{ option }}</button><button class="bg-primary-pink px-4 py-2 text-xs font-bold text-white">+ New shift</button></div></section>
    <section class="grid gap-4 sm:grid-cols-3"><article class="border border-black/5 bg-white p-5"><p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Total shifts</p><p class="mt-3 text-3xl font-bold">42</p></article><article class="border border-black/5 bg-white p-5"><p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Team Leaders</p><p class="mt-3 text-3xl font-bold">16</p></article><article class="border border-black/5 bg-white p-5"><p class="text-xs uppercase tracking-[0.16em] text-neutral-mute">Approval</p><p class="mt-3 text-xl font-bold text-amber-600">Draft <span class="text-xs font-normal text-neutral-mute">· last edited today</span></p></article></section>
    <section class="overflow-hidden border border-black/5 bg-white"><div class="grid min-w-[900px] grid-cols-7 border-b border-black/5 bg-[#faf9f7]"> <div v-for="(day,index) in days" :key="day" class="border-r border-black/5 p-4" :class="index === 0 ? 'bg-primary-pink text-white' : ''"><p class="text-xs font-bold uppercase tracking-wider opacity-70">{{ day.split(' ')[0] }}</p><p class="mt-2 text-2xl font-bold">{{ day.split(' ')[1] }}</p><p class="mt-1 text-[11px] opacity-70">{{ index < 5 ? `${[18,21,16,20,23][index]} scheduled` : '—' }}</p></div></div><div class="grid min-w-[900px] grid-cols-7 divide-x divide-black/5"><div v-for="(_,index) in days" :key="index" class="min-h-[390px] space-y-3 bg-white p-3"><div v-for="shift in shifts.filter((item) => item.day === index)" :key="shift.name + shift.day" class="border-l-4 p-3" :class="shift.leader ? 'border-primary-pink bg-primary-pink/10' : 'border-neutral-300 bg-neutral-50'"><p class="text-xs font-bold">{{ shift.name }}</p><p class="mt-1 text-[11px] text-neutral-mute">{{ shift.time }}</p><p class="mt-3 text-[11px]">{{ shift.people }}</p><span v-if="shift.leader" class="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider text-primary-pink">Team Leader included</span></div></div></div></section>
  </div>
</template>
