import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * App-wide confirm dialog — replaces the browser's native `window.confirm()`
 * (which renders as an ugly "localhost:5173 says" chrome popup, breaking the
 * styled UI) with an in-app modal. One instance, mounted once in App.vue;
 * any component calls `await useConfirmStore().ask(message)` and gets a
 * Promise<boolean> back, same call shape as window.confirm had.
 */
export const useConfirmStore = defineStore('confirm', () => {
  const isOpen = ref(false);
  const title = ref('Bevestigen');
  const message = ref('');
  const danger = ref(false);
  let resolver: ((value: boolean) => void) | null = null;

  function ask(msg: string, opts?: { title?: string; danger?: boolean }): Promise<boolean> {
    message.value = msg;
    title.value = opts?.title ?? 'Bevestigen';
    danger.value = opts?.danger ?? false;
    isOpen.value = true;
    return new Promise((resolve) => {
      resolver = resolve;
    });
  }

  function resolve(value: boolean): void {
    isOpen.value = false;
    resolver?.(value);
    resolver = null;
  }

  return { isOpen, title, message, danger, ask, resolve };
});
