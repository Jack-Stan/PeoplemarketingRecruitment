<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { useAuth } from '@/composables/useAuth';
import { useOfficeNames } from '@/composables/useOfficeNames';
import { useUiStore } from '@/stores/ui';
import { usersService } from '@/services/users.service';
import { isValidEmail } from '@/utils/validators';
import { ROLE_LABELS } from '@/types/user';
import type { UserProfile } from '@/types/user';

const auth = useAuth();
const route = useRoute();
const ui = useUiStore();
const { officeLabel, loadOfficeNames } = useOfficeNames();

const tab = ref<'profile' | 'faq'>(route.query.tab === 'faq' ? 'faq' : 'profile');
const profile = ref<UserProfile | null>(null);
const isLoading = ref(true);
// Verification badges/actions exist so a colleague or admin can trust a
// contact detail — moot for an Administrator, who already has full access
// regardless. Skip the nagging for that role.
const skipVerification = computed(() => profile.value?.role === 'Administrator');

async function loadProfile(): Promise<void> {
  const uid = auth.user.value?.uid;
  profile.value = uid ? await usersService.getOnce(uid) : null;
}

onMounted(async () => {
  await Promise.all([loadProfile(), loadOfficeNames()]);
  isLoading.value = false;
  // Auth's `emailVerified` can be stale if the link was clicked in another
  // tab/session — refresh it and mirror the result onto the profile so the
  // badge below (and the admin's view in Gebruikers) both stay current.
  const verified = await auth.refreshEmailVerified();
  if (profile.value) profile.value.emailVerified = verified;
});

// --- Email verification -------------------------------------------------
const sendingVerification = ref(false);
async function resendVerification(): Promise<void> {
  sendingVerification.value = true;
  const ok = await auth.resendVerificationEmail();
  sendingVerification.value = false;
  ui.push(ok ? 'Verificatiemail verstuurd — check je inbox.' : (auth.error.value ?? 'Kon de mail niet versturen.'), ok ? 'success' : 'error');
}

// --- Email address change ------------------------------------------------
const isChangingEmail = ref(false);
const newEmail = ref('');
const emailPassword = ref('');
const changingEmail = ref(false);

function startChangeEmail(): void {
  newEmail.value = '';
  emailPassword.value = '';
  isChangingEmail.value = true;
}

async function submitChangeEmail(): Promise<void> {
  if (!isValidEmail(newEmail.value)) {
    ui.push('Geef een geldig e-mailadres op.', 'error');
    return;
  }
  changingEmail.value = true;
  const ok = await auth.changeEmail(newEmail.value.trim(), emailPassword.value);
  changingEmail.value = false;
  ui.push(
    ok ? `Bevestigingslink verstuurd naar ${newEmail.value.trim()} — klik erop om de wijziging af te ronden.` : (auth.error.value ?? 'Er ging iets mis.'),
    ok ? 'success' : 'error',
  );
  if (ok) isChangingEmail.value = false;
}

// --- Phone number (self-service) -----------------------------------------
const isEditingPhone = ref(false);
const phoneDraft = ref('');
const savingPhone = ref(false);

function startEditPhone(): void {
  phoneDraft.value = profile.value?.phone ?? '';
  isEditingPhone.value = true;
}

async function savePhone(): Promise<void> {
  const uid = auth.user.value?.uid;
  if (!uid) return;
  savingPhone.value = true;
  try {
    await usersService.setOwnPhone(uid, phoneDraft.value.trim() || null);
    await loadProfile();
    isEditingPhone.value = false;
    ui.push('Telefoonnummer opgeslagen.', 'success');
  } catch {
    ui.push('Kon het telefoonnummer niet opslaan.', 'error');
  } finally {
    savingPhone.value = false;
  }
}

const faqs = [
  {
    q: 'Hoe wijzig ik mijn wachtwoord?',
    a: 'Log uit en klik op "Wachtwoord vergeten" op het inlogscherm om een reset-e-mail te ontvangen.',
  },
  {
    q: 'Hoe wijzig ik mijn e-mailadres?',
    a: 'Onder "Mijn gegevens" bij E-mail op Wijzigen. Je krijgt een bevestigingslink op je nieuwe adres — pas na het klikken is de wijziging definitief.',
  },
  {
    q: 'Hoe wijzig ik mijn telefoonnummer?',
    a: 'Onder "Mijn gegevens" bij Telefoon op Bewerken.',
  },
  {
    q: 'Waarom zie ik bepaalde pagina’s niet in het menu?',
    a: 'Het menu toont enkel pagina’s die passen bij jouw rol (Teamlid, Teammanager of Beheerder). Neem contact op met een beheerder als je denkt dat dit niet klopt.',
  },
  {
    q: 'Bij wie kan ik terecht met vragen over mijn planning?',
    a: 'Neem contact op met je teammanager of de beheerder van je kantoor.',
  },
];
const openFaq = ref<number | null>(null);
function toggleFaq(i: number): void {
  openFaq.value = openFaq.value === i ? null : i;
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <h2 class="text-2xl font-bold tracking-tight">Instellingen</h2>

    <div class="flex gap-1 border-b border-black/5">
      <button
        class="border-b-2 px-4 py-2 text-sm font-semibold"
        :class="tab === 'profile' ? 'border-primary-pink text-primary-pink' : 'border-transparent text-neutral-mute hover:text-neutral-ink'"
        @click="tab = 'profile'"
      >
        Mijn gegevens
      </button>
      <button
        class="border-b-2 px-4 py-2 text-sm font-semibold"
        :class="tab === 'faq' ? 'border-primary-pink text-primary-pink' : 'border-transparent text-neutral-mute hover:text-neutral-ink'"
        @click="tab = 'faq'"
      >
        FAQ
      </button>
    </div>

    <section v-if="tab === 'profile'" class="space-y-4">
      <p v-if="isLoading" class="border border-black/5 bg-white py-6 text-center text-sm text-neutral-mute">Laden…</p>

      <template v-else-if="profile">
        <div class="border border-black/5 bg-white p-5">
          <dl class="grid grid-cols-2 gap-4 text-sm">
            <div class="col-span-2">
              <dt class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Naam</dt>
              <dd class="mt-0.5">{{ profile.displayName || '—' }}</dd>
            </div>
            <div>
              <dt class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Rol</dt>
              <dd class="mt-0.5">{{ profile.role ? ROLE_LABELS[profile.role] : '—' }}</dd>
            </div>
            <div>
              <dt class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Kantoor</dt>
              <dd class="mt-0.5">{{ officeLabel(profile.primaryOfficeId) }}</dd>
            </div>
          </dl>
        </div>

        <div class="border border-black/5 bg-white p-5">
          <h3 class="text-sm font-bold">Contact</h3>
          <div class="mt-3 space-y-3">
            <div class="flex items-center justify-between gap-3 border-b border-black/5 pb-3">
              <div class="min-w-0">
                <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">E-mail</p>
                <p class="flex items-center gap-2 truncate text-sm">
                  {{ profile.email }}
                  <span
                    v-if="!skipVerification"
                    class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    :class="profile.emailVerified ? 'bg-emerald-500/10 text-emerald-600' : 'bg-neutral-200 text-neutral-mute'"
                  >
                    {{ profile.emailVerified ? 'Geverifieerd' : 'Niet geverifieerd' }}
                  </span>
                </p>
              </div>
              <div class="flex shrink-0 gap-2">
                <button
                  v-if="!skipVerification && !profile.emailVerified"
                  class="border border-black/10 px-3 py-1.5 text-xs font-semibold hover:border-primary-pink hover:text-primary-pink disabled:opacity-50"
                  :disabled="sendingVerification"
                  @click="resendVerification"
                >
                  Verificatiemail versturen
                </button>
                <button class="border border-black/10 px-3 py-1.5 text-xs font-semibold text-neutral-mute hover:border-primary-pink hover:text-primary-pink" @click="startChangeEmail">
                  Wijzigen
                </button>
              </div>
            </div>

            <form v-if="isChangingEmail" class="space-y-2 border-b border-black/5 pb-3" @submit.prevent="submitChangeEmail">
              <input v-model="newEmail" type="email" required placeholder="nieuw@adres.be" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
              <input v-model="emailPassword" type="password" required placeholder="Huidig wachtwoord (ter bevestiging)" class="w-full border-black/10 bg-[#faf9f7] text-sm" />
              <div class="flex gap-2">
                <button type="submit" class="bg-primary-pink px-3 py-2 text-xs font-bold text-white disabled:opacity-50" :disabled="changingEmail">
                  Bevestigingslink versturen
                </button>
                <button type="button" class="px-3 py-2 text-xs font-semibold text-neutral-mute" @click="isChangingEmail = false">Annuleren</button>
              </div>
            </form>

            <div v-if="!isEditingPhone" class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-mute">Telefoon</p>
                <p class="truncate text-sm">{{ profile.phone || 'Niet ingesteld' }}</p>
              </div>
              <button class="shrink-0 border border-black/10 px-3 py-1.5 text-xs font-semibold text-neutral-mute hover:border-primary-pink hover:text-primary-pink" @click="startEditPhone">
                {{ profile.phone ? 'Bewerken' : '+ Toevoegen' }}
              </button>
            </div>
            <form v-else class="flex items-center gap-2" @submit.prevent="savePhone">
              <input v-model="phoneDraft" type="tel" placeholder="+32 4xx xx xx xx" class="min-w-0 flex-1 border-black/10 bg-[#faf9f7] text-sm" />
              <button type="submit" class="bg-primary-pink px-3 py-2 text-xs font-bold text-white disabled:opacity-50" :disabled="savingPhone">Opslaan</button>
              <button type="button" class="px-3 py-2 text-xs font-semibold text-neutral-mute" @click="isEditingPhone = false">Annuleren</button>
            </form>
          </div>
        </div>
      </template>

      <p v-else class="border border-black/5 bg-white py-6 text-center text-sm text-neutral-mute">Kon je gegevens niet laden.</p>
    </section>

    <section v-else class="divide-y divide-black/5 border border-black/5 bg-white">
      <div v-for="(item, i) in faqs" :key="item.q">
        <button class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-semibold" @click="toggleFaq(i)">
          {{ item.q }}
          <span class="text-neutral-mute">{{ openFaq === i ? '−' : '+' }}</span>
        </button>
        <p v-if="openFaq === i" class="px-5 pb-4 text-sm text-neutral-mute">{{ item.a }}</p>
      </div>
    </section>
  </div>
</template>
