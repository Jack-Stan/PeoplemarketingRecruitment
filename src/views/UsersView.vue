<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { officesService } from '@/services/offices.service';
import { useAuth } from '@/composables/useAuth';
import { useActiveOffice } from '@/composables/useActiveOffice';
import { isValidEmail } from '@/utils/validators';
import { useAuditLogStore } from '@/stores/auditLog';
import { useUsersStore } from '@/stores/users';
import { useUiStore } from '@/stores/ui';
import { ROLE_LABELS, Roles, type Role, type UserProfile } from '@/types/user';

const auth = useAuth();
const store = useUsersStore();
const auditLog = useAuditLogStore();
const ui = useUiStore();

// Multi-office: an Administrator assigns into whichever office they've
// switched to in AppShell's office switcher (see useActiveOffice) — same
// approve/assign flow as always, just pointed at a different office. We
// still resolve every office's name (offices are public-readable) so the
// table can show which office a pending user actually applied to.
const { officeId: ownOfficeId } = useActiveOffice();
const officeNames = ref<Record<string, string>>({});

const editingUid = ref<string | null>(null);
const form = ref<{ role: Role; isTeamLeader: boolean }>({
  role: Roles.TeamMember,
  isTeamLeader: false,
});
const saving = ref(false);

const editingUser = computed(() => store.users.find((u) => u.uid === editingUid.value) ?? null);
const willRemoveLastAdmin = computed(
  () => !!editingUser.value && wouldRemoveLastAdmin(editingUser.value, form.value.role),
);

const inviteEmail = ref('');
const inviting = ref(false);

const sorted = computed(() =>
  [...store.users].sort((a, b) => {
    if ((a.role === null) !== (b.role === null)) return a.role === null ? -1 : 1;
    return a.email.localeCompare(b.email);
  }),
);

function officeLabel(officeId: string | null): string {
  if (!officeId) return '—';
  return officeNames.value[officeId] ?? officeId;
}

function wantsOtherOffice(u: UserProfile): boolean {
  return u.role === null && !!u.desiredOfficeId && u.desiredOfficeId !== ownOfficeId.value;
}

function openEdit(u: UserProfile): void {
  editingUid.value = u.uid;
  form.value = {
    role: u.role ?? Roles.TeamMember,
    isTeamLeader: u.isTeamLeader,
  };
}

/**
 * Guard against demoting the last Administrator — this exact thing locked
 * the whole app out of every admin-gated action same session (had to be
 * fixed from a terminal via grantRole.ts + FORCE_PROD). Client-side only:
 * firestore.rules can't cheaply count "how many other admins exist" inside
 * a single-document rule, so this is a UI guardrail, not a security
 * boundary — a determined admin could still do it via the console. Good
 * enough to stop an accidental click, which is what actually happened.
 */
function wouldRemoveLastAdmin(u: UserProfile, nextRole: Role): boolean {
  return u.role === 'Administrator' && nextRole !== 'Administrator' && store.adminCountFor(ownOfficeId.value) <= 1;
}

function closeEdit(): void {
  editingUid.value = null;
}

async function submit(): Promise<void> {
  if (!editingUid.value || !ownOfficeId.value) return;
  const editingUser = store.users.find((u) => u.uid === editingUid.value);
  if (editingUser && wouldRemoveLastAdmin(editingUser, form.value.role)) {
    ui.push(`${editingUser.displayName || editingUser.email} is de laatste beheerder van ${officeLabel(ownOfficeId.value)} — wijs eerst iemand anders als beheerder toe.`, 'error');
    return;
  }
  saving.value = true;
  const ok = await store.assignRole(editingUid.value, form.value.role, ownOfficeId.value, form.value.isTeamLeader);
  saving.value = false;
  ui.push(ok ? 'Rol toegewezen.' : (store.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
  if (ok) {
    if (auth.user.value) {
      auditLog.log(ownOfficeId.value, {
        actorUid: auth.user.value.uid,
        actorEmail: auth.user.value.email ?? '',
        action: 'role_assigned',
        targetLabel: `${editingUser?.displayName || editingUser?.email} → ${ROLE_LABELS[form.value.role]}`,
        details: form.value.isTeamLeader ? 'Teamleider' : null,
        createdAtMs: Date.now(),
      });
    }
    closeEdit();
  }
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
    const offices = await officesService.listActive();
    officeNames.value = Object.fromEntries(offices.map((o) => [o.officeId, o.name]));
  } catch {
    ui.push('Kon de lijst met kantoren niet laden.', 'error');
  }
});
onUnmounted(() => store.unsubscribe());
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <section>
      <p class="text-sm text-neutral-mute">
        {{ store.pendingUsers.length }} wachten op goedkeuring · je kan toewijzen aan
        {{ officeLabel(ownOfficeId) }}
      </p>
      <h2 class="mt-1 text-3xl font-bold tracking-tight">Gebruikers</h2>
    </section>

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

    <section class="overflow-x-auto border border-black/5 bg-white">
      <table class="w-full min-w-[800px] text-left text-sm">
        <thead class="border-b border-black/5 bg-[#faf9f7] text-[10px] uppercase tracking-[0.16em] text-neutral-mute">
          <tr>
            <th class="px-5 py-4">Gebruiker</th>
            <th class="px-5 py-4">Rol</th>
            <th class="px-5 py-4">Kantoor</th>
            <th class="px-5 py-4">Teamleider</th>
            <th class="px-5 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/5">
          <tr v-for="u in sorted" :key="u.uid" class="hover:bg-[#faf9f7]">
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
            <td class="px-5 py-4 text-right">
              <button class="text-xs font-semibold text-neutral-ink hover:text-primary-pink" @click="openEdit(u)">
                {{ u.role === null ? 'Rol toewijzen' : 'Bewerken' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="store.isLoading" class="p-8 text-center text-sm text-neutral-mute">Laden…</p>
      <p v-else-if="!sorted.length" class="p-8 text-center text-sm text-neutral-mute">Nog geen gebruikers.</p>
    </section>

    <div v-if="editingUid" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md border border-black/10 bg-white p-6">
        <h3 class="text-lg font-bold">Rol toewijzen</h3>
        <p class="mt-1 text-xs text-neutral-mute">Kantoor: {{ officeLabel(ownOfficeId) }}</p>
        <form class="mt-4 space-y-3" @submit.prevent="submit">
          <select v-model="form.role" class="w-full border-black/10 bg-[#faf9f7] text-sm">
            <option :value="Roles.TeamMember">Teamlid</option>
            <option :value="Roles.TeamManager">Teammanager</option>
            <option :value="Roles.Administrator">Beheerder</option>
          </select>
          <label class="flex items-center gap-2 text-xs font-semibold">
            <input v-model="form.isTeamLeader" type="checkbox" class="border-black/20 text-primary-pink focus:ring-primary-pink" />
            Teamleider
          </label>
          <p v-if="willRemoveLastAdmin" class="text-xs font-semibold text-semantic-danger">
            {{ editingUser?.displayName || editingUser?.email }} is de laatste beheerder van {{ officeLabel(ownOfficeId) }}
            — wijs eerst iemand anders als beheerder toe.
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="px-4 py-2 text-sm font-semibold text-neutral-mute" @click="closeEdit">
              Annuleren
            </button>
            <button type="submit" class="bg-primary-pink px-4 py-2 text-sm font-bold text-white disabled:opacity-50" :disabled="saving || willRemoveLastAdmin">
              Opslaan
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
