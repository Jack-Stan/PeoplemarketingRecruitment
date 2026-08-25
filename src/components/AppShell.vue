<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { brand } from '@/assets/brand';
import logoUrl from '@/assets/logo.svg';
import { officesService } from '@/services/offices.service';
import { useOfficeContextStore } from '@/stores/officeContext';
import type { Office } from '@/types/office';

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
  { label: 'Locaties', to: '/locations', icon: '⌖' },
  { label: 'Rekrutering', to: '/recruitment', icon: '◎' },
  { label: 'Geschiedenis', to: '/history', icon: '◷' },
]);
// Admin-only pages, grouped under their own "Beheer" section in the sidebar
// instead of sitting flat in the workspace list with everything else.
const adminLinks = computed(() =>
  auth.hasRole('Administrator')
    ? [
        { label: 'Gebruikers', to: '/users', icon: '☺' },
        { label: 'Audit trail', to: '/audit', icon: '⎘' },
      ]
    : [],
);
const allLinks = computed(() => [...links.value, ...adminLinks.value]);
/** `/users` should still highlight while on a `/users/:uid` detail page. */
function isLinkActive(to: string): boolean {
  return route.path === to || route.path.startsWith(`${to}/`);
}
const accountLabel = computed(() => auth.displayName.value || auth.user.value?.email || 'Administrator');
const initials = computed(() => accountLabel.value.slice(0, 2).toUpperCase());
async function signOut(): Promise<void> {
  await auth.signOut();
  await router.replace({ name: 'login' });
}

/** Account menu — click-outside via a document listener since there's no shared dropdown component yet. */
const isAccountMenuOpen = ref(false);
const accountMenuRef = ref<HTMLElement | null>(null);
function closeAccountMenu(e: MouseEvent): void {
  if (accountMenuRef.value && !accountMenuRef.value.contains(e.target as Node)) isAccountMenuOpen.value = false;
}
onMounted(() => document.addEventListener('click', closeAccountMenu));
onUnmounted(() => document.removeEventListener('click', closeAccountMenu));

/**
 * Below the `lg` breakpoint the sidebar collapses (see the `aside` below),
 * so this dropdown is the only nav — was a horizontally-scrolling flat row
 * of every link (workspace + Beheer + no account access at all), now a
 * proper menu grouped the same way the sidebar is, plus account actions so
 * a narrow-viewport user can still reach Instellingen/Uitloggen.
 */
const isMobileMenuOpen = ref(false);
const mobileMenuRef = ref<HTMLElement | null>(null);
function closeMobileMenu(e: MouseEvent): void {
  if (mobileMenuRef.value && !mobileMenuRef.value.contains(e.target as Node)) isMobileMenuOpen.value = false;
}
onMounted(() => document.addEventListener('click', closeMobileMenu));
onUnmounted(() => document.removeEventListener('click', closeMobileMenu));
watch(route, () => (isMobileMenuOpen.value = false));

/**
 * Multi-office switcher — Administrator only. Every office-scoped view reads
 * from `useActiveOffice()`, which follows this selection for an admin; a
 * TeamManager/TeamMember never sees this and stays locked to their own
 * office (firestore.rules enforces that server-side regardless).
 */
const officeContext = useOfficeContextStore();
const offices = ref<Office[]>([]);
const isAdmin = computed(() => auth.hasRole('Administrator'));

onMounted(async () => {
  if (!isAdmin.value) return;
  try {
    offices.value = await officesService.listActive();
  } catch {
    offices.value = [];
  }
});

watch(
  () => auth.officeId.value,
  (homeOfficeId) => {
    if (isAdmin.value && !officeContext.activeOfficeId && homeOfficeId) {
      officeContext.setActiveOffice(homeOfficeId);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="min-h-screen bg-[#f6f5f3] text-neutral-ink">
    <aside class="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-[#111111] text-white lg:flex">
      <div class="border-b border-white/10 px-7 py-6"><img :src="logoUrl" :alt="brand.logo.alt" class="h-8 w-auto" /><p class="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/40">Operations</p></div>
      <div v-if="isAdmin && offices.length > 1" class="border-b border-white/10 px-5 py-4">
        <label class="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Kantoor</label>
        <select
          :value="officeContext.activeOfficeId"
          class="mt-2 w-full border-white/20 bg-white/10 py-1.5 text-sm text-white focus:border-primary-pink focus:ring-primary-pink"
          @change="officeContext.setActiveOffice(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="o in offices" :key="o.officeId" :value="o.officeId" class="text-neutral-ink">{{ o.name }}</option>
        </select>
      </div>
      <nav class="flex-1 space-y-1 px-3 py-7">
        <p class="px-4 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Workspace</p>
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="flex items-center gap-3 border-l-2 px-4 py-3 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white" :class="isLinkActive(link.to) ? 'border-primary-pink bg-white/10 text-white' : 'border-transparent'"><span class="w-5 text-primary-pink">{{ link.icon }}</span>{{ link.label }}</RouterLink>
        <template v-if="adminLinks.length">
          <p class="px-4 pb-3 pt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Beheer</p>
          <RouterLink v-for="link in adminLinks" :key="link.to" :to="link.to" class="flex items-center gap-3 border-l-2 px-4 py-3 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white" :class="isLinkActive(link.to) ? 'border-primary-pink bg-white/10 text-white' : 'border-transparent'"><span class="w-5 text-primary-pink">{{ link.icon }}</span>{{ link.label }}</RouterLink>
        </template>
      </nav>
      <div ref="accountMenuRef" class="relative border-t border-white/10 p-4">
        <div v-if="isAccountMenuOpen" class="absolute inset-x-4 bottom-full mb-2 border border-white/10 bg-[#1a1a1a] py-1 shadow-lg">
          <RouterLink to="/settings" class="block px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white" @click="isAccountMenuOpen = false">Instellingen</RouterLink>
          <RouterLink to="/settings?tab=faq" class="block px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white" @click="isAccountMenuOpen = false">FAQ</RouterLink>
          <button class="block w-full border-t border-white/10 px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white" @click="signOut">Uitloggen</button>
        </div>
        <button class="flex w-full items-center gap-3 px-2 py-3 text-left" title="Account" @click="isAccountMenuOpen = !isAccountMenuOpen">
          <span class="grid h-9 w-9 place-items-center rounded-full bg-primary-pink text-xs font-bold">{{ initials }}</span>
          <span class="min-w-0 flex-1 truncate text-xs">{{ accountLabel }}</span>
          <span class="text-white/50">⋯</span>
        </button>
      </div>
    </aside>
    <div class="lg:pl-64">
      <nav class="flex items-center justify-between border-b border-black/5 bg-white px-5 py-2 lg:hidden">
        <img :src="logoUrl" :alt="brand.logo.alt" class="h-6 w-auto" />
        <div ref="mobileMenuRef" class="relative">
          <button
            class="flex items-center gap-2 border border-black/10 px-3 py-1.5 text-xs font-semibold"
            @click="isMobileMenuOpen = !isMobileMenuOpen"
          >
            {{ allLinks.find((l) => isLinkActive(l.to))?.label ?? 'Menu' }}
            <span class="text-neutral-mute">{{ isMobileMenuOpen ? '▲' : '▼' }}</span>
          </button>
          <div v-if="isMobileMenuOpen" class="absolute right-0 z-30 mt-2 w-56 border border-black/10 bg-white py-1 shadow-lg">
            <p class="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Workspace</p>
            <RouterLink
              v-for="link in links"
              :key="link.to"
              :to="link.to"
              class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium"
              :class="isLinkActive(link.to) ? 'bg-primary-pink/5 text-primary-pink' : 'text-neutral-ink hover:bg-[#faf9f7]'"
            >
              <span class="w-4 text-primary-pink">{{ link.icon }}</span>{{ link.label }}
            </RouterLink>
            <template v-if="adminLinks.length">
              <p class="border-t border-black/5 px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Beheer</p>
              <RouterLink
                v-for="link in adminLinks"
                :key="link.to"
                :to="link.to"
                class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium"
                :class="isLinkActive(link.to) ? 'bg-primary-pink/5 text-primary-pink' : 'text-neutral-ink hover:bg-[#faf9f7]'"
              >
                <span class="w-4 text-primary-pink">{{ link.icon }}</span>{{ link.label }}
              </RouterLink>
            </template>
            <div class="border-t border-black/5 pt-1">
              <RouterLink to="/settings" class="block px-4 py-2.5 text-sm text-neutral-ink hover:bg-[#faf9f7]">Instellingen</RouterLink>
              <button class="block w-full px-4 py-2.5 text-left text-sm text-neutral-ink hover:bg-[#faf9f7]" @click="signOut">Uitloggen</button>
            </div>
          </div>
        </div>
      </nav>
      <main class="p-5 sm:p-8"><slot /></main>
    </div>
  </div>
</template>
