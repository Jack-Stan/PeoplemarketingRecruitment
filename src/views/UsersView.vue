<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { officesService } from '@/services/offices.service';
import { useAuth } from '@/composables/useAuth';
import { useUsersStore } from '@/stores/users';
import { useUiStore } from '@/stores/ui';
import { Roles, type Role, type UserProfile } from '@/types/user';

const auth = useAuth();
const store = useUsersStore();
const ui = useUiStore();

// Admins can only ever assign their own office (firestore.rules enforces
// this) — so there's one office to assign into, not a picker. We still
// resolve every office's name (offices are public-readable) so the table can
// show which office a pending user actually applied to.
const ownOfficeId = computed(() => auth.officeId.value ?? '');
const officeNames = ref<Record<string, string>>({});

const editingUid = ref<string | null>(null);
const form = ref<{ role: Role; isTeamLeader: boolean }>({
  role: Roles.TeamMember,
  isTeamLeader: false,
});
const saving = ref(false);

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

function closeEdit(): void {
  editingUid.value = null;
}

async function submit(): Promise<void> {
  if (!editingUid.value || !ownOfficeId.value) return;
  saving.value = true;
  const ok = await store.assignRole(editingUid.value, form.value.role, ownOfficeId.value, form.value.isTeamLeader);
  saving.value = false;
  ui.push(ok ? 'Role assigned.' : (store.error ?? 'Something went wrong.'), ok ? 'success' : 'error');
  if (ok) closeEdit();
}

onMounted(async () => {
  store.subscribe();
  try {
    const offices = await officesService.listActive();
    officeNames.value = Object.fromEntries(offices.map((o) => [o.officeId, o.name]));
  } catch {
    ui.push('Could not load office names.', 'error');
  }
});
onUnmounted(() => store.unsubscribe());
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <section>
      <p class="text-sm text-neutral-mute">
        {{ store.pendingUsers.length }} pending approval · you can assign into
        {{ officeLabel(ownOfficeId) }}
      </p>
      <h2 class="mt-1 text-3xl font-bold tracking-tight">Users</h2>
    </section>

    <section class="overflow-x-auto border border-black/5 bg-white">
      <table class="w-full min-w-[800px] text-left text-sm">
        <thead class="border-b border-black/5 bg-[#faf9f7] text-[10px] uppercase tracking-[0.16em] text-neutral-mute">
          <tr>
            <th class="px-5 py-4">User</th>
            <th class="px-5 py-4">Role</th>
            <th class="px-5 py-4">Office</th>
            <th class="px-5 py-4">Team Leader</th>
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
                Pending
              </span>
              <span v-else class="text-xs font-semibold">{{ u.role }}</span>
            </td>
            <td class="px-5 py-4 text-xs text-neutral-mute">
              <span v-if="u.role === null">
                Applied to {{ officeLabel(u.desiredOfficeId) }}
                <span v-if="wantsOtherOffice(u)" class="ml-1 font-semibold text-semantic-danger" title="Not your office — you can only approve them into your own.">
                  ⚠ not yours
                </span>
              </span>
              <span v-else>{{ officeLabel(u.primaryOfficeId) }}</span>
            </td>
            <td class="px-5 py-4 text-xs text-neutral-mute">{{ u.isTeamLeader ? 'Yes' : 'No' }}</td>
            <td class="px-5 py-4 text-right">
              <button class="text-xs font-semibold text-neutral-ink hover:text-primary-pink" @click="openEdit(u)">
                {{ u.role === null ? 'Assign role' : 'Edit' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="store.isLoading" class="p-8 text-center text-sm text-neutral-mute">Loading…</p>
      <p v-else-if="!sorted.length" class="p-8 text-center text-sm text-neutral-mute">No users yet.</p>
    </section>

    <div v-if="editingUid" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md border border-black/10 bg-white p-6">
        <h3 class="text-lg font-bold">Assign role</h3>
        <p class="mt-1 text-xs text-neutral-mute">Office: {{ officeLabel(ownOfficeId) }}</p>
        <form class="mt-4 space-y-3" @submit.prevent="submit">
          <select v-model="form.role" class="w-full border-black/10 bg-[#faf9f7] text-sm">
            <option :value="Roles.TeamMember">Team Member</option>
            <option :value="Roles.TeamManager">Team Manager</option>
            <option :value="Roles.Administrator">Administrator</option>
          </select>
          <label class="flex items-center gap-2 text-xs font-semibold">
            <input v-model="form.isTeamLeader" type="checkbox" class="border-black/20 text-primary-pink focus:ring-primary-pink" />
            Team Leader
          </label>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="px-4 py-2 text-sm font-semibold text-neutral-mute" @click="closeEdit">
              Cancel
            </button>
            <button type="submit" class="bg-primary-pink px-4 py-2 text-sm font-bold text-white" :disabled="saving">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
