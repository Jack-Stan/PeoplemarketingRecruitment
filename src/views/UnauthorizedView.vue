<script setup lang="ts">
import { useRouter } from 'vue-router';

import BaseButton from '@/components/ui/BaseButton.vue';

const router = useRouter();
</script>

<template>
  <main class="flex min-h-screen items-center justify-center px-4">
    <section class="text-center">
      <p class="text-sm font-semibold uppercase tracking-wide text-semantic-danger">403</p>
      <h1 class="mt-2 text-3xl font-bold text-neutral-ink">Geen toegang</h1>
      <p class="mt-1 text-neutral-mute">Je account heeft geen toegang tot deze pagina.</p>
      <div class="mt-6">
        <BaseButton @click="router.replace('/')">Terug naar dashboard</BaseButton>
      </div>
    </section>
  </main>
</template>