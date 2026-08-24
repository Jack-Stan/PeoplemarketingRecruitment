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
      <p class="text-sm font-semibold uppercase tracking-wide text-primary-pink">Almost there</p>
      <h1 class="mt-2 text-3xl font-bold text-neutral-ink">Waiting on approval</h1>
      <p class="mt-2 text-neutral-mute">
        Your account ({{ auth.user.value?.email }}) is signed in, but an administrator still
        needs to assign you a role and office before you can use the app.
      </p>
      <div class="mt-6">
        <BaseButton variant="ghost" @click="signOut">Sign out</BaseButton>
      </div>
    </section>
  </main>
</template>
