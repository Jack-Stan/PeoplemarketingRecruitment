<script setup lang="ts">
import { computed, ref } from 'vue';

import { useAuth } from '@/composables/useAuth';
import { useAuditLogStore } from '@/stores/auditLog';
import { useUsersStore } from '@/stores/users';
import { useUiStore } from '@/stores/ui';
import { FUNCTIES, ROLE_LABELS, Roles, type Functie, type Role, type UserProfile } from '@/types/user';

/**
 * Role-assign modal, shared by UsersView (list) and UserDetailView (detail
 * page) — was originally only on UsersView, extracted once a second caller
 * needed the exact same form + last-admin guard + audit-log write.
 */
const props = defineProps<{
  user: UserProfile;
  ownOfficeId: string | null;
  officeLabel: (officeId: string | null) => string;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();

const auth = useAuth();
const store = useUsersStore();
const auditLog = useAuditLogStore();
const ui = useUiStore();

/**
 * Office the assignment applies to: the user's CURRENT office when they
 * already have one, the admin's active office only for first-time approval
 * (pending users have primaryOfficeId null). Previously this always sent the
 * admin's switcher office, silently MOVING a cross-office user on any
 * role/functie edit — see the 2026-09-01 app review, finding A2.
 */
const targetOfficeId = computed(() => props.user.primaryOfficeId ?? props.ownOfficeId);

const form = ref<{ role: Role; isTeamLeader: boolean; functie: Functie | null }>({
  role: props.user.role ?? Roles.TeamMember,
  isTeamLeader: props.user.isTeamLeader,
  functie: props.user.functie ?? null,
});
const saving = ref(false);

/**
 * Guard against demoting the last Administrator — this exact thing locked
 * the whole app out of every admin-gated action in a prior session (had to
 * be fixed from a terminal via grantRole.ts + FORCE_PROD). Client-side
 * only: firestore.rules can't cheaply count "how many other admins exist"
 * inside a single-document rule, so this is a UI guardrail, not a security
 * boundary — a determined admin could still do it via the console. Good
 * enough to stop an accidental click, which is what actually happened.
 */
const willRemoveLastAdmin = computed(
  () =>
    props.user.role === 'Administrator' &&
    form.value.role !== 'Administrator' &&
    store.adminCountFor(targetOfficeId.value ?? '') <= 1,
);

async function submit(): Promise<void> {
  if (!targetOfficeId.value || willRemoveLastAdmin.value) return;
  saving.value = true;
  const ok = await store.assignRole(
    props.user.uid,
    form.value.role,
    targetOfficeId.value,
    form.value.isTeamLeader,
    form.value.functie,
  );
  saving.value = false;
  ui.push(ok ? 'Rol toegewezen.' : (store.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
  if (ok) {
    if (auth.user.value && targetOfficeId.value) {
      auditLog.log(targetOfficeId.value, {
        actorUid: auth.user.value.uid,
        actorEmail: auth.user.value.email ?? '',
        action: 'role_assigned',
        targetLabel: `${props.user.displayName || props.user.email} → ${ROLE_LABELS[form.value.role]}`,
        details:
          [form.value.isTeamLeader ? 'Teamleider' : null, form.value.functie]
            .filter(Boolean)
            .join(' · ') || null,
        createdAtMs: Date.now(),
      });
    }
    emit('saved');
  }
}
</script>

<template>
  <div class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
    <div class="w-full max-w-md border border-black/10 bg-white p-6">
      <h3 class="text-lg font-bold">Rol toewijzen</h3>
      <p class="mt-1 text-xs text-neutral-mute">Kantoor: {{ officeLabel(targetOfficeId) }}</p>
      <form class="mt-4 space-y-3" @submit.prevent="submit">
        <select v-model="form.role" class="w-full border-black/10 bg-[#faf9f7] text-sm">
          <option :value="Roles.TeamMember">Teamlid</option>
          <option :value="Roles.TeamManager">Teammanager</option>
          <option :value="Roles.Administrator">Beheerder</option>
        </select>
        <div>
          <label class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute" for="functie-select">Functie</label>
          <select id="functie-select" v-model="form.functie" class="mt-1 w-full border-black/10 bg-[#faf9f7] text-sm">
            <option :value="null">Geen functie</option>
            <option v-for="f in FUNCTIES" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>
        <label class="flex items-center gap-2 text-xs font-semibold">
          <input v-model="form.isTeamLeader" type="checkbox" class="border-black/20 text-primary-pink focus:ring-primary-pink" />
          Teamleider
        </label>
        <p v-if="willRemoveLastAdmin" class="text-xs font-semibold text-semantic-danger">
          {{ user.displayName || user.email }} is de laatste beheerder van {{ officeLabel(targetOfficeId) }}
          — wijs eerst iemand anders als beheerder toe.
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="px-4 py-2 text-sm font-semibold text-neutral-mute" @click="emit('close')">
            Annuleren
          </button>
          <button type="submit" class="bg-primary-pink px-4 py-2 text-sm font-bold text-white disabled:opacity-50" :disabled="saving || willRemoveLastAdmin">
            Opslaan
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
