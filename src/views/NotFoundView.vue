<script setup lang="ts">
import { useRouter } from 'vue-router';

import BaseButton from '@/components/ui/BaseButton.vue';

const router = useRouter();
</script>

<template>
  <main class="flex min-h-screen items-center justify-center px-4">
    <section class="text-center">
      <p class="text-sm font-semibold uppercase tracking-wide text-primary-pink">404</p>
      <h1 class="mt-2 text-3xl font-bold text-neutral-ink">Pagina niet gevonden</h1>
      <p class="mt-1 text-neutral-mute">De pagina die je zocht bestaat niet.</p>
      <div class="mt-6">
        <BaseButton @click="router.replace('/')">Terug naar dashboard</BaseButton>
      </div>
    </section>
  </main>
</template>