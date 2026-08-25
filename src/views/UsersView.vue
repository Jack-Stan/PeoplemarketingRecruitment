<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAuth } from '@/composables/useAuth';
import { useActiveOffice } from '@/composables/useActiveOffice';
import { useOfficeNames } from '@/composables/useOfficeNames';
import { useUserActions } from '@/composables/useUserActions';
import { isValidEmail } from '@/utils/validators';
import { useUsersStore } from '@/stores/users';
import { useUiStore } from '@/stores/ui';
import { ROLE_LABELS, type UserProfile } from '@/types/user';
import UserRoleEditModal from '@/components/UserRoleEditModal.vue';

const auth = useAuth();
const router = useRouter();
const store = useUsersStore();
const ui = useUiStore();

// Multi-office: an Administrator assigns into whichever office they've
// switched to in AppShell's office switcher (see useActiveOffice) — same
// approve/assign flow as always, just pointed at a different office.
const { officeId: ownOfficeId } = useActiveOffice();
const { officeLabel, loadOfficeNames } = useOfficeNames();
const { isUserActive, toggleActive, removeUser } = useUserActions(officeLabel, ownOfficeId);

const editingUid = ref<string | null>(null);
const editingUser = computed(() => store.users.find((u) => u.uid === editingUid.value) ?? null);

// Kebab (⋮) menu — only one row's menu open at a time. Teleported to <body>
// (see template) so it can't get clipped by the table's overflow-x-auto
// scroll container, which also clips vertically per the CSS overflow spec
// once one axis is non-visible.
const openMenuUid = ref<string | null>(null);
const menuUser = computed(() => store.users.find((u) => u.uid === openMenuUid.value) ?? null);
const menuPos = ref<{ top: number; left: number }>({ top: 0, left: 0 });

function toggleMenu(uid: string, event: MouseEvent): void {
  if (openMenuUid.value === uid) {
    openMenuUid.value = null;
    return;
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  menuPos.value = { top: rect.bottom + 4, left: rect.right - 176 };
  openMenuUid.value = uid;
}
function closeMenu(): void {
  openMenuUid.value = null;
}
function openRow(uid: string): void {
  router.push(`/users/${uid}`);
}

const inviteEmail = ref('');
const inviting = ref(false);
const search = ref('');
const filterOffice = ref('');
const filterRole = ref('');
const filterStatus = ref('');

type SortKey = 'name' | 'role' | 'office' | 'teamleader' | 'status';
const sortColumns: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Gebruiker' },
  { key: 'role', label: 'Rol' },
  { key: 'office', label: 'Kantoor' },
  { key: 'teamleader', label: 'Teamleider' },
  { key: 'status', label: 'Status' },
];
const sortKey = ref<SortKey>('name');
const sortDir = ref<'asc' | 'desc'>('asc');
const ROLE_RANK: Record<string, number> = { Administrator: 0, TeamManager: 1, TeamMember: 2 };

function setSort(key: SortKey): void {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = 'asc';
  }
}

function compareUsers(a: UserProfile, b: UserProfile): number {
  let cmp = 0;
  switch (sortKey.value) {
    case 'name':
      cmp = (a.displayName || a.email).localeCompare(b.displayName || b.email);
      break;
    case 'role': {
      const ar = a.role === null ? -1 : (ROLE_RANK[a.role] ?? 0);
      const br = b.role === null ? -1 : (ROLE_RANK[b.role] ?? 0);
      cmp = ar - br;
      break;
    }
    case 'office':
      cmp = officeLabel(a.primaryOfficeId ?? a.desiredOfficeId).localeCompare(officeLabel(b.primaryOfficeId ?? b.desiredOfficeId));
      break;
    case 'teamleader':
      cmp = Number(a.isTeamLeader) - Number(b.isTeamLeader);
      break;
    case 'status':
      cmp = Number(isUserActive(a)) - Number(isUserActive(b));
      break;
  }
  return sortDir.value === 'asc' ? cmp : -cmp;
}

/** Every office any listed user is tied to — not just active ones (loadOfficeNames only covers those). */
const officeOptions = computed(() => {
  const ids = new Set(store.users.map((u) => u.primaryOfficeId ?? u.desiredOfficeId).filter((id): id is string => !!id));
  return [...ids].map((id) => ({ id, name: officeLabel(id) })).sort((a, b) => a.name.localeCompare(b.name));
});

const sorted = computed(() =>
  [...store.users]
    // Never show the signed-in admin their own row — a mis-click on
    // Bewerken/Deactiveren here demoted or locked out an admin account
    // twice already this project (see project-status.md near-lockouts).
    // Manage your own account elsewhere, not from this list.
    .filter((u) => u.uid !== auth.user.value?.uid)
    .filter((u) => {
      const q = search.value.trim().toLowerCase();
      if (!q) return true;
      return (
        (u.displayName ?? '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.role ? ROLE_LABELS[u.role].toLowerCase().includes(q) : false)
      );
    })
    .filter((u) => !filterOffice.value || (u.primaryOfficeId ?? u.desiredOfficeId) === filterOffice.value)
    .filter((u) => !filterRole.value || (filterRole.value === 'pending' ? u.role === null : u.role === filterRole.value))
    .filter((u) => !filterStatus.value || (filterStatus.value === 'active' ? isUserActive(u) : !isUserActive(u)))
    .sort(compareUsers),
);

function wantsOtherOffice(u: UserProfile): boolean {
  return u.role === null && !!u.desiredOfficeId && u.desiredOfficeId !== ownOfficeId.value;
}

function openEdit(u: UserProfile): void {
  editingUid.value = u.uid;
}

function closeEdit(): void {
  editingUid.value = null;
}

async function sendInvite(): Promise<void> {
  if (!isValidEmail(inviteEmail.value) || !ownOfficeId.value) {
    ui.push('Geef een geldig e-mailadres op.', 'error');
    return;
  }
  inviting.value = true;
  const ok = await auth.sendInvite(inviteEmail.value.trim(), ownOfficeId.value);
  inviting.value = false;
  ui.push(
    ok ? `Uitnodiging verstuurd naar ${inviteEmail.value.trim()}.` : (auth.error.value ?? 'Kon de uitnodiging niet versturen.'),
    ok ? 'success' : 'error',
  );
  if (ok) inviteEmail.value = '';
}

onMounted(async () => {
  store.subscribe();
  try {
    await loadOfficeNames();
  } catch {
    ui.push('Kon de lijst met kantoren niet laden.', 'error');
  }
});
onUnmounted(() => store.unsubscribe());
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <h2 class="text-3xl font-bold tracking-tight">Gebruikers</h2>

    <!--
      "Admin just sends a sign-up mail to a new employee" — passwordless
      email-link invite via Firebase Auth's own mail relay (see
      authService.sendInvite). The invited person still lands as a pending
      account below; nothing here bypasses approval.
    -->
    <section class="border border-black/5 bg-white p-5">
      <h3 class="text-sm font-bold">Nieuwe medewerker uitnodigen</h3>
      <p class="mt-1 text-xs text-neutral-mute">
        Stuurt een e-mail met een aanmeldlink naar {{ officeLabel(ownOfficeId) }} — geen wachtwoord nodig.
      </p>
      <form class="mt-3 flex flex-col gap-2 sm:flex-row" @submit.prevent="sendInvite">
        <input
          v-model="inviteEmail"
          type="email"
          required
          placeholder="naam@voorbeeld.be"
          class="min-w-0 flex-1 border-black/10 bg-[#faf9f7] text-sm"
        />
        <button
          type="submit"
          class="whitespace-nowrap bg-primary-pink px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          :disabled="inviting"
        >
          Uitnodiging versturen
        </button>
      </form>
    </section>

    <div class="flex flex-col gap-3 border border-black/5 bg-white p-4 sm:flex-row">
      <input
        v-model="search"
        class="min-w-0 flex-1 border-black/10 bg-[#faf9f7] text-sm focus:border-primary-pink focus:ring-primary-pink"
        placeholder="Zoek gebruikers op naam, e-mail of rol"
        type="search"
      />
      <select v-model="filterOffice" class="border-black/10 bg-[#faf9f7] text-sm focus:border-primary-pink focus:ring-primary-pink">
        <option value="">Alle kantoren</option>
        <option v-for="o in officeOptions" :key="o.id" :value="o.id">{{ o.name }}</option>
      </select>
      <select v-model="filterRole" class="border-black/10 bg-[#faf9f7] text-sm focus:border-primary-pink focus:ring-primary-pink">
        <option value="">Alle rollen</option>
        <option value="pending">In afwachting</option>
        <option v-for="(label, role) in ROLE_LABELS" :key="role" :value="role">{{ label }}</option>
      </select>
      <select v-model="filterStatus" class="border-black/10 bg-[#faf9f7] text-sm focus:border-primary-pink focus:ring-primary-pink">
        <option value="">Alle statussen</option>
        <option value="active">Actief</option>
        <option value="inactive">Inactief</option>
      </select>
    </div>

    <section class="overflow-x-auto border border-black/5 bg-white">
      <table class="w-full min-w-[900px] text-left text-sm">
        <thead class="border-b border-black/5 bg-[#faf9f7] text-[10px] uppercase tracking-[0.16em] text-neutral-mute">
          <tr>
            <th v-for="col in sortColumns" :key="col.key" class="px-5 py-4">
              <button
                class="flex items-center gap-1 font-bold uppercase tracking-[0.16em] text-neutral-mute outline-none transition-colors hover:text-neutral-ink focus-visible:text-primary-pink"
                @click="setSort(col.key)"
              >
                {{ col.label }}
                <span class="text-[9px]" :class="sortKey === col.key ? 'text-primary-pink' : 'text-neutral-mute/50'">
                  {{ sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕' }}
                </span>
              </button>
            </th>
            <th class="px-5 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/5">
          <tr
            v-for="(u, i) in sorted"
            :key="u.uid"
            class="cursor-pointer hover:bg-primary-pink/5"
            :class="[i % 2 === 1 ? 'bg-[#faf9f7]/60' : 'bg-white', { 'opacity-50': !isUserActive(u) }]"
            @click="openRow(u.uid)"
          >
            <td class="px-5 py-4">
              <p class="font-bold">{{ u.displayName || u.email }}</p>
              <p class="text-xs text-neutral-mute">{{ u.email }}</p>
            </td>
            <td class="px-5 py-4">
              <span
                v-if="u.role === null"
                class="rounded-full bg-primary-pink/10 px-2 py-1 text-xs font-semibold text-primary-pink"
              >
                In afwachting
              </span>
              <span v-else class="text-xs font-semibold">{{ ROLE_LABELS[u.role] }}</span>
            </td>
            <td class="px-5 py-4 text-xs text-neutral-mute">
              <span v-if="u.role === null">
                Aangevraagd voor {{ officeLabel(u.desiredOfficeId) }}
                <span v-if="wantsOtherOffice(u)" class="ml-1 font-semibold text-semantic-danger" title="Ander kantoor dan je nu beheert — schakel over via het kantoor-menu links.">
                  ⚠ ander kantoor
                </span>
              </span>
              <span v-else>{{ officeLabel(u.primaryOfficeId) }}</span>
            </td>
            <td class="px-5 py-4 text-xs text-neutral-mute">{{ u.isTeamLeader ? 'Ja' : 'Nee' }}</td>
            <td class="px-5 py-4">
              <span class="inline-flex items-center gap-2 text-xs">
                <i class="h-2 w-2 rounded-full" :class="isUserActive(u) ? 'bg-emerald-500' : 'bg-neutral-300'"></i>
                {{ isUserActive(u) ? 'Actief' : 'Inactief' }}
              </span>
            </td>
            <td class="px-5 py-4 text-right" @click.stop>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-neutral-mute hover:bg-black/5 hover:text-neutral-ink"
                @click="toggleMenu(u.uid, $event)"
              >
                ⋮
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="store.isLoading" class="p-8 text-center text-sm text-neutral-mute">Laden…</p>
      <p v-else-if="!sorted.length" class="p-8 text-center text-sm text-neutral-mute">Geen gebruikers gevonden.</p>
    </section>

    <!--
      Teleported to <body> instead of living inside the table cell — the
      table's overflow-x-auto scroll container also clips vertically (CSS
      overflow rule: once either axis is non-visible, "visible" on the other
      computes to auto), which was cutting this menu down to a sliver.
    -->
    <Teleport to="body">
      <template v-if="menuUser">
        <div class="fixed inset-0 z-40" @click="closeMenu"></div>
        <div
          class="fixed z-50 w-44 border border-black/10 bg-white py-1 text-left shadow-lg"
          :style="{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }"
        >
          <button class="block w-full px-4 py-2 text-xs font-semibold hover:bg-[#faf9f7]" @click="closeMenu(); openEdit(menuUser)">
            {{ menuUser.role === null ? 'Rol toewijzen' : 'Bewerken' }}
          </button>
          <button
            v-if="menuUser.role !== null"
            class="block w-full px-4 py-2 text-xs font-semibold hover:bg-[#faf9f7]"
            @click="closeMenu(); toggleActive(menuUser)"
          >
            {{ isUserActive(menuUser) ? 'Deactiveren' : 'Heractiveren' }}
          </button>
          <button
            class="block w-full px-4 py-2 text-xs font-semibold text-semantic-danger hover:bg-[#faf9f7]"
            @click="closeMenu(); removeUser(menuUser)"
          >
            Verwijderen
          </button>
        </div>
      </template>
    </Teleport>

    <UserRoleEditModal
      v-if="editingUser"
      :user="editingUser"
      :own-office-id="ownOfficeId"
      :office-label="officeLabel"
      @close="closeEdit"
      @saved="closeEdit"
    />
  </div>
</template>
