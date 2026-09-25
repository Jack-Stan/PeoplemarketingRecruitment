<script setup lang="ts">
import { onMounted, ref } from 'vue';

/**
 * reCAPTCHA v2 "I'm not a robot" checkbox. The token is what EmailJS checks
 * before it will send the admin mail (see notifications.service.ts) — the
 * secret key sits in the EmailJS template settings, never in this app.
 *
 * Renders nothing when VITE_RECAPTCHA_SITE_KEY is unset (local dev, or mail
 * notifications switched off), so forms must only require a token when
 * `notificationsService.needsCaptcha()` is true. Tokens are single-use and expire after
 * ~2 minutes; call `reset()` after a failed submit.
 */
interface Grecaptcha {
  render(el: HTMLElement, opts: Record<string, unknown>): number;
  reset(id?: number): void;
}
declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
    __onRecaptchaLoad?: () => void;
  }
}

const token = defineModel<string>({ default: '' });
const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const el = ref<HTMLElement | null>(null);
const failed = ref(false);
let widgetId: number | null = null;

let loader: Promise<Grecaptcha> | null = null;
function loadScript(): Promise<Grecaptcha> {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  loader ??= new Promise((resolve, reject) => {
    window.__onRecaptchaLoad = () => resolve(window.grecaptcha as Grecaptcha);
    const s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js?onload=__onRecaptchaLoad&render=explicit&hl=nl';
    s.async = true;
    s.onerror = () => {
      loader = null;
      reject(new Error('reCAPTCHA failed to load'));
    };
    document.head.appendChild(s);
  });
  return loader;
}

onMounted(async () => {
  if (!siteKey || !el.value) return;
  try {
    const g = await loadScript();
    widgetId = g.render(el.value, {
      sitekey: siteKey,
      callback: (t: string) => (token.value = t),
      'expired-callback': () => (token.value = ''),
      'error-callback': () => (token.value = ''),
    });
  } catch {
    failed.value = true;
  }
});

function reset(): void {
  token.value = '';
  if (widgetId !== null) window.grecaptcha?.reset(widgetId);
}
defineExpose({ reset });
</script>

<template>
  <div v-if="siteKey">
    <div ref="el" />
    <p v-if="failed" class="mt-1 text-xs text-semantic-danger">
      Kon de robotcontrole niet laden — ververs de pagina en probeer opnieuw.
    </p>
  </div>
</template>
