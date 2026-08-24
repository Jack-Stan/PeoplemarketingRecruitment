<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { useAuth } from '@/composables/useAuth';
import { useEmployeesStore } from '@/stores/employees';
import { useUiStore } from '@/stores/ui';
import { useUsersStore } from '@/stores/users';
import { isValidEmail, isValidName } from '@/utils/validators';
import type { Employee, EmployeeCreatePayload } from '@/types/employee';

const auth = useAuth();
const store = useEmployeesStore();
const usersStore = useUsersStore();
const ui = useUiStore();

const officeId = computed(() => auth.officeId.value ?? '');
const isAdmin = computed(() => auth.role.value === 'Administrator');

const search = ref('');
const showInactive = ref(false);
const isFormOpen = ref(false);
const editingId = ref<string | null>(null);
const formError = ref<string | null>(null);
/**
 * The account this roster entry belongs to. The employee doc ID **is** the
 * Auth uid (decisions/007), so adding someone to the roster means picking an
 * existing, already-approved account — there is no way to invent one here.
 */
const selectedUid = ref<string>('');

const emptyForm: EmployeeCreatePayload = {
  firstName: '',
  lastName: '',
  email: '',
  phone: null,
  role: 'TeamMember',
  isActive: true,
  isTeamLeader: false,
  weeklyContractHours: null,
  employmentType: 'FullTime',
  avatarUrl: null,
};
const form = ref<EmployeeCreatePayload>({ ...emptyForm });

/**
 * Accounts that can still be added: approved into THIS office (a pending user
 * has `primaryOfficeId: null` and is rejected by firestore.rules anyway) and
 * not already on the roster.
 */
const eligibleAccounts = computed(() => {
  const taken = new Set(store.employees.map((e) => e.employeeId));
  return usersStore.users.filter(
    (u) => u.primaryOfficeId === officeId.value && u.role !== null && !taken.has(u.uid),
  );
});

function accountLabel(uid: string): string {
  const u = usersStore.users.find((x) => x.uid === uid);
  if (!u) return uid;
  return u.displayName ? `${u.displayName} — ${u.email}` : u.email;
}

/** Best-effort split of a free-text display name into first/last. */
function splitName(displayName: string | null): { firstName: string; lastName: string } {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function onAccountPicked(uid: string): void {
  selectedUid.value = uid;
  const u = usersStore.users.find((x) => x.uid === uid);
  if (!u) return;
  const { firstName, lastName } = splitName(u.displayName);
  form.value = {
    ...form.value,
    firstName: firstName || form.value.firstName,
    lastName: lastName || form.value.lastName,
    email: u.email,
    role: u.role ?? 'TeamMember',
    isTeamLeader: u.isTeamLeader,
  };
}

const filtered = computed(() =>
  store.employees.filter(
    (e) =>
      (showInactive.value || e.isActive) &&
      `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
);

function initialsOf(e: Pick<Employee, 'firstName' | 'lastName'>): string {
  return `${e.firstName[0] ?? ''}${e.lastName[0] ?? ''}`.toUpperCase();
}

function openCreate(): void {
  editingId.value = null;
  form.value = { ...emptyForm };
  selectedUid.value = '';
  formError.value = null;
  isFormOpen.value = true;
}

function openEdit(e: Employee): void {
  editingId.value = e.employeeId;
  selectedUid.value = e.employeeId;
  form.value = {
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    phone: e.phone,
    role: e.role,
    isActive: e.isActive,
    isTeamLeader: e.isTeamLeader,
    weeklyContractHours: e.weeklyContractHours,
    employmentType: e.employmentType,
    avatarUrl: e.avatarUrl,
  };
  formError.value = null;
  isFormOpen.value = true;
}

function closeForm(): void {
  isFormOpen.value = false;
}

async function submitForm(): Promise<void> {
  if (!editingId.value && !selectedUid.value) {
    formError.value = 'Pick the account this employee signs in with.';
    return;
  }
  if (!isValidName(form.value.firstName) || !isValidName(form.value.lastName)) {
    formError.value = 'First and last name are required.';
    return;
  }
  if (!isValidEmail(form.value.email)) {
    formError.value = 'Enter a valid email address.';
    return;
  }
  formError.value = null;

  const ok = editingId.value
    ? await store.update(officeId.value, editingId.value, form.value)
    : await store.create(officeId.value, selectedUid.value, form.value);

  if (ok) {
    ui.push(editingId.value ? 'Employee updated.' : 'Employee added.', 'success');
    isFormOpen.value = false;
  } else {
    formError.value = store.error;
  }
}

async function toggleActive(e: Employee): Promise<void> {
  const ok = await store.setActive(officeId.value, e.employeeId, !e.isActive);
  ui.push(
    ok ? `${e.firstName} is now ${!e.isActive ? 'active' : 'inactive'}.` : (store.error ?? 'Something went wrong.'),
    ok ? 'success' : 'error',
  );
}

onMounted(() => {
  if (!officeId.value) return;
  store.subscribe(officeId.value);
  // /users is admin-only readable — a TeamManager on this page would just
  // eat a permission-denied, and they can't add employees anyway.
  if (isAdmin.value) usersStore.subscribe();
});
onUnmounted(() => {
  store.unsubscribe();
  usersStore.unsubscribe();
});
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <section class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm text-neutral-mute">Main office · {{ store.activeEmployees.length }} active employees</p>
        <h2 class="mt-1 text-3xl font-bold tracking-tight">Employees</h2>
      </div>
      <button
        v-if="isAdmin"
        class="bg-primary-pink px-4 py-2.5 text-sm font-bold text-white"
        @click="openCreate"
      >
        + Add employee
      </button>
    </section>

    <div class="flex flex-col gap-3 border border-black/5 bg-white p-4 sm:flex-row">
      <input
        v-model="search"
        class="min-w-0 flex-1 border-black/10 bg-[#faf9f7] text-sm focus:border-primary-pink focus:ring-primary-pink"
        placeholder="Search employees by name or email"
        type="search"
      />
      <label class="flex items-center gap-2 px-2 text-xs font-semibold">
        <input v-model="showInactive" type="checkbox" class="border-black/20 text-primary-pink focus:ring-primary-pink" />
        Show inactive
      </label>
    </div>

    <section class="overflow-x-auto border border-black/5 bg-white">
      <table class="w-full min-w-[700px] text-left text-sm">
        <thead class="border-b border-black/5 bg-[#faf9f7] text-[10px] uppercase tracking-[0.16em] text-neutral-mute">
          <tr>
            <th class="px-5 py-4">Employee</th>
            <th class="px-5 py-4">Role</th>
            <th class="px-5 py-4">Status</th>
            <th class="px-5 py-4">Contract</th>
            <th v-if="isAdmin" class="px-5 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-black/5">
          <tr v-for="e in filtered" :key="e.employeeId" class="hover:bg-[#faf9f7]">
            <td class="px-5 py-4">
              <div class="flex items-center gap-3">
                <span
                  class="grid h-9 w-9 place-items-center rounded-full text-xs font-bold text-white"
                  :class="e.isTeamLeader ? 'bg-primary-pink' : 'bg-[#111]'"
                >
                  {{ initialsOf(e) }}
                </span>
                <div>
                  <p class="font-bold">{{ e.firstName }} {{ e.lastName }}</p>
                  <p class="text-xs text-neutral-mute">{{ e.email }}</p>
                </div>
              </div>
            </td>
            <td class="px-5 py-4">
              <span class="text-xs font-semibold" :class="e.isTeamLeader ? 'text-primary-pink' : 'text-neutral-mute'">
                {{ e.isTeamLeader ? 'Team Leader' : 'Team Member' }}
              </span>
            </td>
            <td class="px-5 py-4">
              <span class="inline-flex items-center gap-2 text-xs">
                <i class="h-2 w-2 rounded-full" :class="e.isActive ? 'bg-emerald-500' : 'bg-neutral-300'"></i>
                {{ e.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-5 py-4 text-xs text-neutral-mute">
              {{ e.weeklyContractHours ? `${e.weeklyContractHours}h / wk` : '—' }}
            </td>
            <td v-if="isAdmin" class="px-5 py-4 text-right">
              <button class="mr-3 text-xs font-semibold text-neutral-ink hover:text-primary-pink" @click="openEdit(e)">
                Edit
              </button>
              <button class="text-xs font-semibold text-neutral-mute hover:text-semantic-danger" @click="toggleActive(e)">
                {{ e.isActive ? 'Disable' : 'Reactivate' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="store.isLoading" class="p-8 text-center text-sm text-neutral-mute">Loading…</p>
      <p v-else-if="!filtered.length" class="p-8 text-center text-sm text-neutral-mute">No employees found.</p>
    </section>

    <div v-if="isFormOpen" class="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md border border-black/10 bg-white p-6">
        <h3 class="text-lg font-bold">{{ editingId ? 'Edit employee' : 'Add employee' }}</h3>
        <!--
          Create mode picks an existing account: the employee doc ID is the
          Auth uid (decisions/007), so there is nothing to add here for a
          person who hasn't signed up and been approved into this office yet.
        -->
        <form class="mt-4 space-y-3" @submit.prevent="submitForm">
          <div v-if="!editingId">
            <label class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Account</label>
            <select
              :value="selectedUid"
              class="mt-1 w-full border-black/10 bg-[#faf9f7] text-sm"
              @change="onAccountPicked(($event.target as HTMLSelectElement).value)"
            >
              <option value="" disabled>Select an approved account…</option>
              <option v-for="u in eligibleAccounts" :key="u.uid" :value="u.uid">
                {{ accountLabel(u.uid) }}
              </option>
            </select>
            <p v-if="!eligibleAccounts.length" class="mt-1 text-xs text-neutral-mute">
              No unassigned accounts for this office. Approve someone on the
              <RouterLink to="/users" class="font-semibold underline">Users</RouterLink> page first.
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <input v-model="form.firstName" placeholder="First name" class="border-black/10 bg-[#faf9f7] text-sm" />
            <input v-model="form.lastName" placeholder="Last name" class="border-black/10 bg-[#faf9f7] text-sm" />
          </div>
          <input
            v-model="form.email"
            type="email"
            placeholder="Email"
            :disabled="!editingId"
            class="w-full border-black/10 bg-[#faf9f7] text-sm disabled:opacity-60"
          />
          <input v-model="form.phone" placeholder="Phone (optional)" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
          <div class="grid grid-cols-2 gap-3">
            <select v-model="form.role" class="border-black/10 bg-[#faf9f7] text-sm">
              <option value="TeamMember">Team Member</option>
              <option value="TeamManager">Team Manager</option>
              <option value="Administrator">Administrator</option>
            </select>
            <label class="flex items-center gap-2 text-xs font-semibold">
              <input v-model="form.isTeamLeader" type="checkbox" class="border-black/20 text-primary-pink focus:ring-primary-pink" />
              Team Leader
            </label>
          </div>
          <p v-if="formError" class="text-xs font-semibold text-semantic-danger">{{ formError }}</p>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="px-4 py-2 text-sm font-semibold text-neutral-mute" @click="closeForm">
              Cancel
            </button>
            <button type="submit" class="bg-primary-pink px-4 py-2 text-sm font-bold text-white">
              {{ editingId ? 'Save' : 'Add' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
