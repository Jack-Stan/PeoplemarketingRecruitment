<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { useAuth } from '@/composables/useAuth';
import { authService } from '@/services/auth.service';
import { useUiStore } from '@/stores/ui';

/**
 * Landing page for an admin-sent invite link (see authService.sendInvite /
 * UsersView's "Uitnodigen" tab). Firebase's email-link sign-in can be opened
 * on a different device than it was requested on, so the email itself isn't
 * fully trusted from the URL alone — it's prefilled but always confirmable.
 */
const route = useRoute();
const router = useRouter();
const auth = useAuth();
const ui = useUiStore();

const email = ref(String(route.query.email ?? ''));
const desiredOfficeId = ref(String(route.query.office ?? ''));
const displayName = ref('');
const isValidLink = ref(false);
const submitting = ref(false);

onMounted(() => {
  isValidLink.value = authService.isInviteLink(window.location.href);
  if (!isValidLink.value) {
    ui.push('Deze uitnodigingslink is ongeldig of verlopen.', 'error');
  }
});

async function onSubmit(): Promise<void> {
  submitting.value = true;
  const ok = await auth.completeInvite(
    email.value.trim(),
    window.location.href,
    displayName.value.trim(),
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
  <main class="flex min-h-screen items-center justify-center bg-neutral-surface px-4">
    <section class="w-full max-w-sm rounded-lg bg-neutral-white p-8 shadow-md">
      <header class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-neutral-ink">PeopleMarketing</h1>
        <p class="mt-1 text-sm text-neutral-mute">Rond je uitnodiging af</p>
      </header>

      <template v-if="isValidLink">
        <form class="space-y-4" @submit.prevent="onSubmit">
          <BaseInput
            v-model="email"
            label="E-mailadres"
            type="email"
            autocomplete="email"
            required
            placeholder="jij@peoplemarketing.be"
          />
          <BaseInput
            v-model="displayName"
            label="Naam"
            type="text"
            autocomplete="name"
            required
            placeholder="Voor- en achternaam"
          />
          <BaseButton type="submit" block :loading="submitting" :disabled="!email || !displayName">
            Account aanmaken
          </BaseButton>
        </form>
        <p class="mt-4 text-center text-xs text-neutral-mute">
          Geen wachtwoord nodig — deze link logt je meteen in.
        </p>
      </template>
      <p v-else class="text-center text-sm text-neutral-mute">
        Vraag de beheerder om een nieuwe uitnodiging te versturen.
      </p>
    </section>
  </main>
</template>
