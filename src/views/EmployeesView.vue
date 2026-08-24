<script setup lang="ts">
import { computed, ref } from 'vue';

const search = ref('');
const showInactive = ref(false);
const employees = [
  { name: 'Noah van Dijk', email: 'noah@peoplemarketing.nl', role: 'Team Leader', status: 'Active', shifts: 5, color: 'bg-[#111]' },
  { name: 'Olivia Smit', email: 'olivia@peoplemarketing.nl', role: 'Team Leader', status: 'Active', shifts: 4, color: 'bg-primary-pink' },
  { name: 'Liam de Jong', email: 'liam@peoplemarketing.nl', role: 'Team Member', status: 'Active', shifts: 3, color: 'bg-amber-500' },
  { name: 'Emma Visser', email: 'emma@peoplemarketing.nl', role: 'Team Member', status: 'Active', shifts: 4, color: 'bg-emerald-600' },
  { name: 'Daan Bakker', email: 'daan@peoplemarketing.nl', role: 'Team Member', status: 'Inactive', shifts: 0, color: 'bg-slate-400' },
];
const filtered = computed(() => employees.filter((employee) => (showInactive.value || employee.status === 'Active') && `${employee.name} ${employee.email}`.toLowerCase().includes(search.value.toLowerCase())));
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6"><section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p class="text-sm text-neutral-mute">Main office · 32 employees</p><h2 class="mt-1 text-3xl font-bold tracking-tight">Employees</h2></div><button class="bg-primary-pink px-4 py-2.5 text-sm font-bold text-white">+ Add employee</button></section><div class="flex flex-col gap-3 border border-black/5 bg-white p-4 sm:flex-row"><input v-model="search" class="min-w-0 flex-1 border-black/10 bg-[#faf9f7] text-sm focus:border-primary-pink focus:ring-primary-pink" placeholder="Search employees by name or email" type="search"><label class="flex items-center gap-2 px-2 text-xs font-semibold"><input v-model="showInactive" type="checkbox" class="border-black/20 text-primary-pink focus:ring-primary-pink"> Show inactive</label></div><section class="overflow-x-auto border border-black/5 bg-white"><table class="w-full min-w-[700px] text-left text-sm"><thead class="border-b border-black/5 bg-[#faf9f7] text-[10px] uppercase tracking-[0.16em] text-neutral-mute"><tr><th class="px-5 py-4">Employee</th><th class="px-5 py-4">Role</th><th class="px-5 py-4">Status</th><th class="px-5 py-4">This week</th><th class="px-5 py-4"></th></tr></thead><tbody class="divide-y divide-black/5"><tr v-for="employee in filtered" :key="employee.email" class="hover:bg-[#faf9f7]"><td class="px-5 py-4"><div class="flex items-center gap-3"><span class="grid h-9 w-9 place-items-center rounded-full text-xs font-bold text-white" :class="employee.color">{{ employee.name.split(' ').map((part) => part[0]).join('') }}</span><div><p class="font-bold">{{ employee.name }}</p><p class="text-xs text-neutral-mute">{{ employee.email }}</p></div></div></td><td class="px-5 py-4"><span class="text-xs font-semibold" :class="employee.role === 'Team Leader' ? 'text-primary-pink' : 'text-neutral-mute'">{{ employee.role }}</span></td><td class="px-5 py-4"><span class="inline-flex items-center gap-2 text-xs"><i class="h-2 w-2 rounded-full" :class="employee.status === 'Active' ? 'bg-emerald-500' : 'bg-neutral-300'"></i>{{ employee.status }}</span></td><td class="px-5 py-4 font-bold">{{ employee.shifts }} shifts</td><td class="px-5 py-4 text-right text-lg text-neutral-mute">···</td></tr></tbody></table><p v-if="!filtered.length" class="p-8 text-center text-sm text-neutral-mute">No employees found.</p></section></div>
</template>
