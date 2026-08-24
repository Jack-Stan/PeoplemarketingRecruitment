import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  expiresAt: number;
}

/**
 * Tiny UI store for toasts. The Ticket 0 scaffold only needs success/error
 * toasts for login feedback — keep the API small.
 */
export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([]);
  let nextId = 1;

  function push(message: string, tone: Toast['tone'] = 'info', ttlMs = 4000): void {
    const id = nextId++;
    const expiresAt = Date.now() + ttlMs;
    toasts.value.push({ id, message, tone, expiresAt });
    setTimeout(() => dismiss(id), ttlMs);
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return { toasts, push, dismiss };
});