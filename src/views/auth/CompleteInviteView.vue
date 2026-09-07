<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { useAuth } from '@/composables/useAuth';
import { authService } from '@/services/auth.service';
import { officesService } from '@/services/offices.service';
import { isValidName } from '@/utils/validators';
import { useUiStore } from '@/stores/ui';
import type { Office } from '@/types/office';

/**
 * Landing page for an admin-sent invite link (see authService.sendInvite /
 * UsersView's "Uitnodigen" tab). Firebase's email-link sign-in can be opened
 * on a different device than it was requested on, so the email itself isn't
 * fully trusted from the URL alone — it's prefilled but always confirmable.
 * The link click proves email ownership; this form then collects a real
 * password (so the link isn't needed for every future login) plus name and
 * phone, same fields UserDetailView shows an admin later.
 */
const route = useRoute();
const router = useRouter();
const auth = useAuth();
const ui = useUiStore();

const email = ref(String(route.query.email ?? ''));
const desiredOfficeId = ref(String(route.query.office ?? ''));
const firstName = ref('');
const lastName = ref('');
const phone = ref('');
const password = ref('');
const confirmPassword = ref('');
const isValidLink = ref(false);
const submitting = ref(false);

/**
 * The office MUST be resolved before submitting. `completeInvite` sets the
 * password first (irreversible) and only then writes the profile doc, and the
 * rules reject a profile with an empty desiredOfficeId — so an invite link
 * missing `?office=` used to burn the account: password set, no profile, no
 * retry, stuck on /pending-approval forever. When the param is absent we show
 * the same office picker SignupView has instead of submitting blind.
 */
const offices = ref<Office[]>([]);
const needsOfficePicker = computed(() => !String(route.query.office ?? '').trim());

const passwordsMatch = computed(() => password.value === confirmPassword.value);
const canSubmit = computed(
  () =>
    !!email.value &&
    !!desiredOfficeId.value &&
    isValidName(firstName.value) &&
    isValidName(lastName.value) &&
    password.value.length >= 6 &&
    passwordsMatch.value,
);

onMounted(async () => {
  isValidLink.value = authService.isInviteLink(window.location.href);
  if (!isValidLink.value) {
    ui.push('Deze uitnodigingslink is ongeldig of verlopen.', 'error');
    return;
  }
  // Offices are public-readable (decisions/005), so this works pre-account.
  try {
    offices.value = await officesService.listActive();
  } catch {
    ui.push('Kon de lijst met kantoren niet laden — probeer het zo weer.', 'error');
    return;
  }
  const known = offices.value.some((o) => o.officeId === desiredOfficeId.value);
  if (!known) {
    // Either no ?office= at all, or one that no longer exists — either way the
    // profile write would be denied, so make the user pick a real one.
    desiredOfficeId.value = offices.value.length === 1 ? offices.value[0].officeId : '';
  }
});

async function onSubmit(): Promise<void> {
  if (!canSubmit.value) {
    if (!passwordsMatch.value) ui.push('Wachtwoorden komen niet overeen.', 'error');
    else if (!desiredOfficeId.value) ui.push('Kies eerst een kantoor.', 'error');
    return;
  }
  submitting.value = true;
  const displayName = `${firstName.value.trim()} ${lastName.value.trim()}`.trim();
  const ok = await auth.completeInvite(
    email.value.trim(),
    window.location.href,
    password.value,
    displayName,
    phone.value.trim(),
    desiredOfficeId.value,
  );
  submitting.value = false;
  if (ok) {
    ui.push('Account aangemaakt — wacht op goedkeuring door een beheerder.', 'success');
    await router.replace('/pending-approval');
  } else {
    ui.push(auth.error.value ?? 'Kon de uitnodiging niet voltooien.', 'error');
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-neutral-surface px-4 py-10">
    <section class="w-full max-w-sm rounded-lg bg-neutral-white p-8 shadow-md">
      <header class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-neutral-ink">PeopleMarketing</h1>
        <p class="mt-1 text-sm text-neutral-mute">Welkom bij het team — rond je account af</p>
      </header>

      <template v-if="isValidLink">
        <form class="space-y-4" @submit.prevent="onSubmit">
          <BaseInput
            v-model="email"
            label="E-mailadres"
            type="email"
            autocomplete="email"
            required
          />
          <div class="grid grid-cols-2 gap-3">
            <BaseInput
              v-model="firstName"
              label="Voornaam"
              type="text"
              autocomplete="given-name"
              required
            />
            <BaseInput
              v-model="lastName"
              label="Achternaam"
              type="text"
              autocomplete="family-name"
              required
            />
          </div>
          <BaseInput
            v-model="phone"
            label="Telefoon"
            type="tel"
            autocomplete="tel"
            placeholder="+32 4xx xx xx xx"
          />
          <div v-if="needsOfficePicker || !desiredOfficeId" class="flex flex-col gap-1">
            <label for="invite-office" class="text-sm font-medium text-neutral-ink">
              Kantoor<span class="text-semantic-danger">*</span>
            </label>
            <select
              id="invite-office"
              v-model="desiredOfficeId"
              required
              class="block w-full rounded-md border border-neutral-line bg-neutral-white px-3 py-2 text-neutral-ink focus:border-primary-pink focus:outline-none focus:ring-1 focus:ring-primary-pink"
            >
              <option v-if="!offices.length" value="" disabled>Kantoren laden…</option>
              <option v-else value="" disabled>Kies je kantoor</option>
              <option v-for="o in offices" :key="o.officeId" :value="o.officeId">
                {{ o.name }}
              </option>
            </select>
          </div>
          <BaseInput
            v-model="password"
            label="Wachtwoord"
            type="password"
            autocomplete="new-password"
            required
            placeholder="Minstens 6 tekens"
          />
          <BaseInput
            v-model="confirmPassword"
            label="Bevestig wachtwoord"
            type="password"
            autocomplete="new-password"
            required
            :error="confirmPassword && !passwordsMatch ? 'Komt niet overeen' : ''"
          />
          <BaseButton type="submit" block :loading="submitting" :disabled="!canSubmit">
            Account aanmaken
          </BaseButton>
        </form>
      </template>
      <p v-else class="text-center text-sm text-neutral-mute">
        Vraag de beheerder om een nieuwe uitnodiging te versturen.
      </p>
    </section>
  </main>
</template>
