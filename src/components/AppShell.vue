<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const route = useRoute();
const router = useRouter();
const auth = useAuth();
// Route table gates by role too — this list additionally keeps a TeamMember
// from ever seeing a nav link to a page the guard would bounce them out of.
const links = computed(() => [
  { label: 'Overzicht', to: '/dashboard', icon: '▦' },
  ...(auth.hasRole('TeamMember') ? [{ label: 'Mijn planning', to: '/mijn-planning', icon: '▣' }] : []),
  ...(auth.hasRole('Administrator', 'TeamManager') ? [{ label: 'Planning', to: '/planning', icon: '▣' }] : []),
  ...(auth.hasRole('Administrator', 'TeamManager') ? [{ label: 'Medewerkers', to: '/employees', icon: '♙' }] : []),
  ...(auth.hasRole('Administrator', 'TeamManager') ? [{ label: 'Rekrutering', to: '/recruitment', icon: '◎' }] : []),
  { label: 'Geschiedenis', to: '/history', icon: '◷' },
  ...(auth.hasRole('Administrator') ? [{ label: 'Gebruikers', to: '/users', icon: '☺' }] : []),
]);
const initials = computed(() => (auth.user.value?.email?.slice(0, 2) ?? 'PM').toUpperCase());
async function signOut(): Promise<void> {
  await auth.signOut();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <div class="min-h-screen bg-[#f6f5f3] text-neutral-ink">
    <aside class="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-[#111111] text-white lg:flex">
      <div class="border-b border-white/10 px-7 py-6"><p class="text-sm font-bold">PeopleMarketing</p><p class="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/40">Operations</p></div>
      <nav class="flex-1 space-y-1 px-3 py-7"><p class="px-4 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Workspace</p><RouterLink v-for="link in links" :key="link.to" :to="link.to" class="flex items-center gap-3 border-l-2 px-4 py-3 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white" :class="route.path === link.to ? 'border-primary-pink bg-white/10 text-white' : 'border-transparent'"><span class="w-5 text-primary-pink">{{ link.icon }}</span>{{ link.label }}</RouterLink></nav>
      <div class="border-t border-white/10 p-4"><button class="flex w-full items-center gap-3 px-2 py-3 text-left" title="Sign out" @click="signOut"><span class="grid h-9 w-9 place-items-center rounded-full bg-primary-pink text-xs font-bold">{{ initials }}</span><span class="min-w-0 flex-1 truncate text-xs">{{ auth.user.value?.email ?? 'Administrator' }}</span><span class="text-white/50">↪</span></button></div>
    </aside>
    <div class="lg:pl-64">
      <header class="flex h-20 items-center justify-between border-b border-black/5 bg-white px-5 sm:px-8"><div><p class="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-pink">PeopleMarketing / {{ route.meta.title }}</p><h1 class="mt-1 text-xl font-bold tracking-tight">{{ route.meta.title }}</h1></div><span class="grid h-9 w-9 place-items-center rounded-full bg-neutral-ink text-xs font-bold text-white">{{ initials }}</span></header>
      <nav class="flex gap-1 overflow-x-auto border-b border-black/5 bg-white px-5 py-2 lg:hidden"><RouterLink v-for="link in links" :key="link.to" :to="link.to" class="whitespace-nowrap px-3 py-2 text-xs font-semibold" :class="route.path === link.to ? 'text-primary-pink' : 'text-neutral-mute'">{{ link.label }}</RouterLink></nav>
      <main class="p-5 sm:p-8"><slot /></main>
    </div>
  </div>
</template>
