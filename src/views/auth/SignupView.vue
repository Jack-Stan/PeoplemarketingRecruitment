<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import RecaptchaCheckbox from '@/components/ui/RecaptchaCheckbox.vue';
import logoUrl from '@/assets/logo.svg';
import { useAuth } from '@/composables/useAuth';
import { notificationsService } from '@/services/notifications.service';
import { officesService } from '@/services/offices.service';
import { useUiStore } from '@/stores/ui';
import type { Office } from '@/types/office';

const router = useRouter();
const auth = useAuth();
const ui = useUiStore();

const displayName = ref('');
const email = ref('');
const password = ref('');
const officeId = ref('');
const offices = ref<Office[]>([]);
const submitting = ref(false);
const needsCaptcha = notificationsService.needsCaptcha();
const captchaToken = ref('');
const captcha = ref<InstanceType<typeof RecaptchaCheckbox> | null>(null);

async function onSubmit(): Promise<void> {
  submitting.value = true;
  const ok = await auth.signUp(
    email.value.trim(),
    password.value,
    displayName.value.trim(),
    officeId.value,
  );
  submitting.value = false;
  if (ok) {
    // Fire-and-forget: never rejects, and the admin nav badge covers a lost mail.
    void notificationsService.notifyPendingSignup({
      name: displayName.value.trim(),
      email: email.value.trim(),
      officeName: offices.value.find((o) => o.officeId === officeId.value)?.name ?? officeId.value,
      captchaToken: captchaToken.value,
    });
    ui.push('Account aangemaakt — wachten op goedkeuring door een beheerder.', 'success');
    await router.replace('/pending-approval');
  } else {
    captcha.value?.reset(); // tokens are single-use
    ui.push(auth.error.value ?? 'Aanmelden mislukt', 'error');
  }
}

onMounted(async () => {
  try {
    offices.value = await officesService.listActive();
    officeId.value = offices.value[0]?.officeId ?? '';
  } catch {
    ui.push('Kon de lijst met kantoren niet laden — probeer het zo weer.', 'error');
  }
});
</script>

<template>
  <!-- Same branded card as LoginView. Phone: top-aligned with vertical
       padding so the form scrolls instead of hiding behind the keyboard. -->
  <main
    class="relative flex min-h-screen items-start justify-center bg-neutral-black px-4 py-8 sm:items-center"
    style="
      background-image: radial-gradient(circle at 100% 0%, rgba(230, 0, 126, 0.3), transparent 45%),
        radial-gradient(circle at 0% 100%, rgba(255, 61, 138, 0.2), transparent 45%);
    "
  >
    <section class="relative w-full max-w-sm overflow-hidden rounded-lg bg-neutral-white shadow-md">
      <header class="flex flex-col items-center rounded-t-lg bg-neutral-black p-6 text-center">
        <img :src="logoUrl" alt="People Marketing" class="h-10 w-auto sm:h-12" />
        <p class="mt-3 text-sm text-white/70">Maak je account aan</p>
      </header>

      <div class="border-t-2 border-primary-pink p-5 sm:p-8">
        <form class="space-y-4" @submit.prevent="onSubmit">
          <BaseInput
            v-model="displayName"
            label="Naam"
            type="text"
            autocomplete="name"
            required
            placeholder="Voornaam Achternaam"
          />
          <BaseInput
            v-model="email"
            label="E-mail"
            type="email"
            autocomplete="email"
            required
            placeholder="naam@voorbeeld.be"
          />
          <BaseInput
            v-model="password"
            label="Wachtwoord"
            type="password"
            autocomplete="new-password"
            required
            placeholder="Minstens 6 tekens"
            :error="password && password.length < 6 ? 'Minstens 6 tekens' : ''"
          />
          <div class="flex flex-col gap-1">
            <label for="signup-office" class="text-sm font-medium text-neutral-ink">
              Kantoor<span class="text-semantic-danger">*</span>
            </label>
            <select
              id="signup-office"
              v-model="officeId"
              required
              class="block w-full rounded-md border border-neutral-line bg-neutral-white px-3 py-2 text-neutral-ink focus:border-primary-pink focus:outline-none focus:ring-1 focus:ring-primary-pink"
            >
              <option v-if="!offices.length" value="" disabled>Kantoren laden…</option>
              <option v-for="o in offices" :key="o.officeId" :value="o.officeId">{{ o.name }}</option>
            </select>
          </div>
          <RecaptchaCheckbox v-if="needsCaptcha" ref="captcha" v-model="captchaToken" />
          <BaseButton
            type="submit"
            block
            :loading="submitting"
            :disabled="
              !displayName ||
              !email ||
              password.length < 6 ||
              !officeId ||
              (needsCaptcha && !captchaToken)
            "
          >
            Account aanmaken
          </BaseButton>
        </form>

        <p class="mt-6 text-center text-xs text-neutral-mute">
          Heb je al een account?
          <RouterLink to="/login" class="font-semibold text-primary-pink">Aanmelden</RouterLink>
        </p>
      </div>
    </section>
  </main>
</template>
