<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

const toneClasses = {
  info: 'bg-neutral-black text-neutral-white',
  success: 'bg-semantic-success text-neutral-white',
  warning: 'bg-semantic-warning text-neutral-white',
  error: 'bg-semantic-danger text-neutral-white',
} as const;

const items = computed(() => ui.toasts);
</script>

<template>
  <div class="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2">
    <div
      v-for="toast in items"
      :key="toast.id"
      class="pointer-events-auto min-w-[200px] max-w-sm rounded-md px-4 py-2 text-sm shadow-lg"
      :class="toneClasses[toast.tone]"
      role="status"
      @click="ui.dismiss(toast.id)"
    >
      {{ toast.message }}
    </div>
  </div>
</template>