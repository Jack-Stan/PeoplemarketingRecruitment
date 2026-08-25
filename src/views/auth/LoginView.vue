<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import logoUrl from '@/assets/logo.svg';
import { useAuth } from '@/composables/useAuth';
import { useUiStore } from '@/stores/ui';

const router = useRouter();
const route = useRoute();
const auth = useAuth();
const ui = useUiStore();

// Body's global background is white (tailwind.css) — pin it black just while
// this page is mounted so overscroll/pre-paint edges don't show white behind
// the black login screen.
onMounted(() => {
  document.body.style.backgroundColor = '#000000';
});
onUnmounted(() => {
  document.body.style.backgroundColor = '';
});

const email = ref('');
const password = ref('');
const rememberMe = ref(false);
const submitting = ref(false);

const isResetMode = ref(false);
const resetEmail = ref('');
const resetting = ref(false);

async function onSubmit(): Promise<void> {
  submitting.value = true;
  const ok = await auth.signIn(email.value.trim(), password.value, rememberMe.value);
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
  <main
    class="relative flex min-h-screen items-center justify-center bg-neutral-black px-4"
    style="background-image: radial-gradient(circle at 100% 0%, rgba(230,0,126,0.3), transparent 45%), radial-gradient(circle at 0% 100%, rgba(255,61,138,0.2), transparent 45%)"
  >
    <section class="relative w-full max-w-sm overflow-hidden rounded-lg bg-neutral-white shadow-md">
      <header class="flex flex-col items-center rounded-t-lg bg-neutral-black px-8 py-8 text-center">
        <img :src="logoUrl" alt="People Marketing" class="h-12 w-auto" />
      </header>

      <div class="border-t-2 border-primary-pink p-8">
      <form v-if="!isResetMode" class="space-y-4" @submit.prevent="onSubmit">
        <BaseInput
          v-model="email"
          label="E-mail"
          type="email"
          autocomplete="username"
          required
        />
        <BaseInput
          v-model="password"
          label="Wachtwoord"
          type="password"
          autocomplete="current-password"
          required
        />
        <label
          v-if="email && password"
          class="flex cursor-pointer items-center gap-2 text-sm text-neutral-ink select-none"
        >
          <input
            v-model="rememberMe"
            type="checkbox"
            class="h-5 w-5 rounded border-2 border-neutral-ink text-primary-pink focus:ring-primary-pink"
          />
          Aangemeld blijven
        </label>
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
      </div>
    </section>
  </main>
</template>