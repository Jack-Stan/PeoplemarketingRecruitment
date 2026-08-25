<script setup lang="ts">
import { useConfirmStore } from '@/stores/confirm';

const confirm = useConfirmStore();
</script>

<template>
  <div v-if="confirm.isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div class="w-full max-w-sm border border-black/10 bg-white p-6">
      <h3 class="text-lg font-bold">{{ confirm.title }}</h3>
      <p class="mt-2 text-sm text-neutral-mute">{{ confirm.message }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button class="px-4 py-2 text-sm font-semibold text-neutral-mute" @click="confirm.resolve(false)">
          Annuleren
        </button>
        <button
          class="px-4 py-2 text-sm font-bold text-white"
          :class="confirm.danger ? 'bg-semantic-danger' : 'bg-primary-pink'"
          @click="confirm.resolve(true)"
        >
          Bevestigen
        </button>
      </div>
    </div>
  </div>
</template>
