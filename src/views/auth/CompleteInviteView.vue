<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { useAuth } from '@/composables/useAuth';
import { authService } from '@/services/auth.service';
import { isValidName } from '@/utils/validators';
import { useUiStore } from '@/stores/ui';

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

const passwordsMatch = computed(() => password.value === confirmPassword.value);
const canSubmit = computed(
  () =>
    !!email.value &&
    isValidName(firstName.value) &&
    isValidName(lastName.value) &&
    password.value.length >= 6 &&
    passwordsMatch.value,
);

onMounted(() => {
  isValidLink.value = authService.isInviteLink(window.location.href);
  if (!isValidLink.value) {
    ui.push('Deze uitnodigingslink is ongeldig of verlopen.', 'error');
  }
});

async function onSubmit(): Promise<void> {
  if (!canSubmit.value) {
    if (!passwordsMatch.value) ui.push('Wachtwoorden komen niet overeen.', 'error');
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
          <BaseInput v-model="email" label="E-mailadres" type="email" autocomplete="email" required />
          <div class="grid grid-cols-2 gap-3">
            <BaseInput v-model="firstName" label="Voornaam" type="text" autocomplete="given-name" required />
            <BaseInput v-model="lastName" label="Achternaam" type="text" autocomplete="family-name" required />
          </div>
          <BaseInput v-model="phone" label="Telefoon" type="tel" autocomplete="tel" placeholder="+32 4xx xx xx xx" />
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
