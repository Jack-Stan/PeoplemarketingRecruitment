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

async function onSubmit(): Promise<void> {
  submitting.value = true;
  const ok = await auth.signIn(email.value.trim(), password.value);
  submitting.value = false;
  if (ok) {
    ui.push('Signed in', 'success');
    const redirect = (route.query.redirect as string | undefined) ?? '/dashboard';
    await router.replace(redirect);
  } else {
    ui.push(auth.error.value ?? 'Sign-in failed', 'error');
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-neutral-surface px-4">
    <section class="w-full max-w-sm rounded-lg bg-neutral-white p-8 shadow-md">
      <header class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-neutral-ink">People Marketing</h1>
        <p class="mt-1 text-sm text-neutral-mute">Sign in to continue</p>
      </header>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <BaseInput
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email"
          required
          placeholder="you@peoplemarketing.nl"
        />
        <BaseInput
          v-model="password"
          label="Password"
          type="password"
          autocomplete="current-password"
          required
        />
        <BaseButton type="submit" block :loading="submitting" :disabled="!email || !password">
          Sign in
        </BaseButton>
      </form>

      <p class="mt-6 text-center text-xs text-neutral-mute">
        No account yet?
        <RouterLink to="/signup" class="font-semibold text-primary-pink">Create one</RouterLink>
      </p>
    </section>
  </main>
</template>