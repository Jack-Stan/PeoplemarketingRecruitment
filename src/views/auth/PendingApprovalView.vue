<script setup lang="ts">
import { useRouter } from 'vue-router';

import BaseButton from '@/components/ui/BaseButton.vue';
import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const auth = useAuth();

async function signOut(): Promise<void> {
  await auth.signOut();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center px-4">
    <section class="w-full max-w-sm text-center">
      <p class="text-sm font-semibold uppercase tracking-wide text-primary-pink">Bijna zover</p>
      <h1 class="mt-2 text-3xl font-bold text-neutral-ink">Wachten op goedkeuring</h1>
      <p class="mt-2 text-neutral-mute">
        Je account ({{ auth.user.value?.email }}) is aangemeld, maar een beheerder moet je nog
        een rol en kantoor toewijzen voor je de app kan gebruiken.
      </p>
      <div class="mt-6">
        <BaseButton variant="ghost" @click="signOut">Afmelden</BaseButton>
      </div>
    </section>
  </main>
</template>
