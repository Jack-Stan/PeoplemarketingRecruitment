<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { useAuth } from '@/composables/useAuth';
import { useUiStore } from '@/stores/ui';

const router = useRouter();
const route = useRoute();
const auth = useAuth();
const ui = useUiStore();

const email = ref('');
const password = ref('');
const submitting = ref(false);

const isResetMode = ref(false);
const resetEmail = ref('');
const resetting = ref(false);

async function onSubmit(): Promise<void> {
  submitting.value = true;
  const ok = await auth.signIn(email.value.trim(), password.value);
  submitting.value = false;
  if (ok) {
    ui.push('Aangemeld', 'success');
    const redirect = (route.query.redirect as string | undefined) ?? '/dashboard';
    await router.replace(redirect);
  } else {
    ui.push(auth.error.value ?? 'Aanmelden mislukt', 'error');
  }
}

function openReset(): void {
  resetEmail.value = email.value;
  isResetMode.value = true;
}

async function onSendReset(): Promise<void> {
  resetting.value = true;
  const ok = await auth.sendPasswordReset(resetEmail.value.trim());
  resetting.value = false;
  // Same message either way — never reveal whether an email address has an
  // account (Firebase's own reset-email API doesn't leak that either).
  ui.push('Als dat e-mailadres een account heeft, is er een reset-link onderweg.', 'success');
  if (ok) isResetMode.value = false;
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-neutral-surface px-4">
    <section class="w-full max-w-sm rounded-lg bg-neutral-white p-8 shadow-md">
      <header class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-neutral-ink">People Marketing</h1>
        <p class="mt-1 text-sm text-neutral-mute">Meld je aan om verder te gaan</p>
      </header>

      <form v-if="!isResetMode" class="space-y-4" @submit.prevent="onSubmit">
        <BaseInput
          v-model="email"
          label="E-mail"
          type="email"
          autocomplete="email"
          required
          placeholder="jij@peoplemarketing.nl"
        />
        <BaseInput
          v-model="password"
          label="Wachtwoord"
          type="password"
          autocomplete="current-password"
          required
        />
        <BaseButton type="submit" block :loading="submitting" :disabled="!email || !password">
          Aanmelden
        </BaseButton>
        <p class="text-center text-xs">
          <button type="button" class="font-semibold text-primary-pink hover:underline" @click="openReset">
            Wachtwoord vergeten?
          </button>
        </p>
      </form>

      <form v-else class="space-y-4" @submit.prevent="onSendReset">
        <p class="text-xs text-neutral-mute">
          Vul je e-mailadres in en we sturen je een link om je wachtwoord opnieuw in te stellen.
        </p>
        <BaseInput
          v-model="resetEmail"
          label="E-mail"
          type="email"
          autocomplete="email"
          required
          placeholder="jij@peoplemarketing.nl"
        />
        <BaseButton type="submit" block :loading="resetting" :disabled="!resetEmail">
          Reset-link versturen
        </BaseButton>
        <p class="text-center text-xs">
          <button type="button" class="font-semibold text-neutral-mute hover:underline" @click="isResetMode = false">
            Terug naar aanmelden
          </button>
        </p>
      </form>

      <p v-if="!isResetMode" class="mt-6 text-center text-xs text-neutral-mute">
        Nog geen account?
        <RouterLink to="/signup" class="font-semibold text-primary-pink">Account aanmaken</RouterLink>
      </p>
    </section>
  </main>
</template>