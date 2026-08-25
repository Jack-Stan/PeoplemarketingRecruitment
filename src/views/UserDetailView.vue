<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { useActiveOffice } from '@/composables/useActiveOffice';
import { useOfficeNames } from '@/composables/useOfficeNames';
import { useUserActions } from '@/composables/useUserActions';
import { useUsersStore } from '@/stores/users';
import { useUiStore } from '@/stores/ui';
import { ROLE_LABELS } from '@/types/user';
import UserRoleEditModal from '@/components/UserRoleEditModal.vue';

const route = useRoute();
const router = useRouter();
const store = useUsersStore();
const ui = useUiStore();

const { officeId: ownOfficeId } = useActiveOffice();
const { officeLabel, loadOfficeNames } = useOfficeNames();
const { isSelf, isUserActive, toggleActive, removeUser } = useUserActions(officeLabel, ownOfficeId);

const uid = computed(() => String(route.params.uid));
const user = computed(() => store.users.find((u) => u.uid === uid.value) ?? null);
// Verification badges exist so a contact detail can be trusted — moot for
// an Administrator, who already has full access regardless of role.
const skipVerification = computed(() => user.value?.role === 'Administrator');

const isEditingRole = ref(false);
const isEditingPhone = ref(false);
const phoneDraft = ref('');
const savingPhone = ref(false);

function startEditPhone(): void {
  phoneDraft.value = user.value?.phone ?? '';
  isEditingPhone.value = true;
}

async function savePhone(): Promise<void> {
  if (!user.value) return;
  savingPhone.value = true;
  const ok = await store.setPhone(user.value.uid, phoneDraft.value.trim() || null);
  savingPhone.value = false;
  ui.push(ok ? 'Telefoonnummer opgeslagen.' : (store.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
  if (ok) isEditingPhone.value = false;
}

async function copy(value: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    ui.push(`${label} gekopieerd.`, 'success');
  } catch {
    ui.push('Kopiëren is niet gelukt — je browser blokkeert klembordtoegang.', 'error');
  }
}

async function onDelete(): Promise<void> {
  if (!user.value) return;
  const done = await removeUser(user.value);
  if (done) router.push('/users');
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
  <div class="mx-auto max-w-4xl space-y-6">
    <RouterLink to="/users" class="text-xs font-semibold text-neutral-mute hover:text-primary-pink">← Terug naar gebruikers</RouterLink>

    <template v-if="user">
      <section class="flex items-center gap-4 border border-black/5 bg-white p-5">
        <span
          class="grid h-14 w-14 place-items-center rounded-full text-lg font-bold text-white"
          :class="user.isTeamLeader ? 'bg-primary-pink' : 'bg-[#111]'"
        >
          {{ (user.displayName || user.email).slice(0, 2).toUpperCase() }}
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-2xl font-bold tracking-tight">{{ user.displayName || user.email }}</h2>
          <span class="inline-flex items-center gap-2 text-xs text-neutral-mute">
            <i class="h-2 w-2 rounded-full" :class="isUserActive(user) ? 'bg-emerald-500' : 'bg-neutral-300'"></i>
            {{ isUserActive(user) ? 'Actief' : 'Inactief' }}
          </span>
        </div>
      </section>

      <section class="border border-black/5 bg-white p-6">
        <h3 class="text-sm font-bold">Contact</h3>
        <div class="mt-4 space-y-5">
          <div class="border-b border-black/5 pb-5">
            <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">E-mail</p>
            <div class="mt-1.5 flex items-center gap-2">
              <p class="text-base">{{ user.email }}</p>
              <span
                v-if="!skipVerification"
                class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                :class="user.emailVerified ? 'bg-emerald-500/10 text-emerald-600' : 'bg-neutral-200 text-neutral-mute'"
              >
                {{ user.emailVerified ? 'Geverifieerd' : 'Niet geverifieerd' }}
              </span>
            </div>
            <div class="mt-3 flex gap-2">
              <button
                class="grid h-9 w-9 place-items-center border border-black/10 hover:border-primary-pink hover:text-primary-pink"
                title="E-mailadres kopiëren"
                @click="copy(user.email, 'E-mailadres')"
              >
                <span aria-hidden="true">⧉</span>
              </button>
              <a
                :href="`mailto:${user.email}`"
                class="grid h-9 w-9 place-items-center border border-black/10 hover:border-primary-pink hover:text-primary-pink"
                title="Mailen"
              >
                <span aria-hidden="true">✉</span>
              </a>
            </div>
          </div>

          <div v-if="!isEditingPhone">
            <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Telefoon</p>
            <p class="mt-1.5 text-base">{{ user.phone || 'Niet ingesteld' }}</p>
            <div class="mt-3 flex gap-2">
              <template v-if="user.phone">
                <button
                  class="grid h-9 w-9 place-items-center border border-black/10 hover:border-primary-pink hover:text-primary-pink"
                  title="Telefoonnummer kopiëren"
                  @click="copy(user.phone, 'Telefoonnummer')"
                >
                  <span aria-hidden="true">⧉</span>
                </button>
                <a
                  :href="`tel:${user.phone}`"
                  class="grid h-9 w-9 place-items-center bg-primary-pink text-white"
                  title="Bellen"
                >
                  <span aria-hidden="true">☎</span>
                </a>
              </template>
              <button
                class="grid h-9 w-9 place-items-center border border-black/10 hover:border-primary-pink hover:text-primary-pink"
                :title="user.phone ? 'Telefoonnummer bewerken' : 'Telefoonnummer toevoegen'"
                @click="startEditPhone"
              >
                <span aria-hidden="true">{{ user.phone ? '✎' : '+' }}</span>
              </button>
            </div>
          </div>
          <div v-else>
            <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Telefoon</p>
            <form class="mt-1.5 flex items-center gap-2" @submit.prevent="savePhone">
              <input
                v-model="phoneDraft"
                type="tel"
                placeholder="+32 4xx xx xx xx"
                class="min-w-0 flex-1 border-black/10 bg-[#faf9f7] text-sm"
              />
              <button type="submit" class="bg-primary-pink px-3 py-2 text-xs font-bold text-white disabled:opacity-50" :disabled="savingPhone">
                Opslaan
              </button>
              <button type="button" class="px-3 py-2 text-xs font-semibold text-neutral-mute" @click="isEditingPhone = false">
                Annuleren
              </button>
            </form>
          </div>
        </div>
      </section>

      <section class="border border-black/5 bg-white p-6">
        <h3 class="text-sm font-bold">Toegang</h3>
        <dl class="mt-4 grid grid-cols-3 gap-6 text-sm">
          <div>
            <dt class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Rol</dt>
            <dd class="mt-1.5">
              <span v-if="user.role === null" class="rounded-full bg-primary-pink/10 px-2 py-1 text-xs font-semibold text-primary-pink">In afwachting</span>
              <span v-else class="text-base font-semibold">{{ ROLE_LABELS[user.role] }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Kantoor</dt>
            <dd class="mt-1.5 text-base">{{ officeLabel(user.primaryOfficeId ?? user.desiredOfficeId) }}</dd>
          </div>
          <div>
            <dt class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Teamleider</dt>
            <dd class="mt-1.5 text-base">{{ user.isTeamLeader ? 'Ja' : 'Nee' }}</dd>
          </div>
        </dl>
        <div class="mt-5 flex gap-2 border-t border-black/5 pt-5">
          <button
            class="grid h-9 w-9 place-items-center border border-black/10 hover:border-primary-pink hover:text-primary-pink"
            :title="user.role === null ? 'Rol toewijzen' : 'Rol bewerken'"
            @click="isEditingRole = true"
          >
            <span aria-hidden="true">⚙</span>
          </button>
          <button
            v-if="!isSelf(user) && user.role !== null"
            class="grid h-9 w-9 place-items-center border border-black/10 text-neutral-mute hover:border-primary-pink hover:text-primary-pink"
            :title="isUserActive(user) ? 'Deactiveren' : 'Heractiveren'"
            @click="toggleActive(user)"
          >
            <span aria-hidden="true">⏻</span>
          </button>
          <button
            v-if="!isSelf(user)"
            class="grid h-9 w-9 place-items-center border border-black/10 text-neutral-mute hover:border-semantic-danger hover:text-semantic-danger"
            title="Verwijderen"
            @click="onDelete"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </section>

      <UserRoleEditModal
        v-if="isEditingRole"
        :user="user"
        :own-office-id="ownOfficeId"
        :office-label="officeLabel"
        @close="isEditingRole = false"
        @saved="isEditingRole = false"
      />
    </template>

    <p v-else-if="store.isLoading" class="p-8 text-center text-sm text-neutral-mute">Laden…</p>
    <p v-else class="border border-black/5 bg-white p-8 text-center text-sm text-neutral-mute">
      Gebruiker niet gevonden. <RouterLink to="/users" class="font-semibold text-primary-pink underline">Terug naar gebruikers</RouterLink>
    </p>
  </div>
</template>
