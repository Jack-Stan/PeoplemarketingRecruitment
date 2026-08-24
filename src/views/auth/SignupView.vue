<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { useAuth } from '@/composables/useAuth';
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

async function onSubmit(): Promise<void> {
  submitting.value = true;
  const ok = await auth.signUp(email.value.trim(), password.value, displayName.value.trim(), officeId.value);
  submitting.value = false;
  if (ok) {
    ui.push('Account created — waiting on admin approval.', 'success');
    await router.replace('/pending-approval');
  } else {
    ui.push(auth.error.value ?? 'Sign-up failed', 'error');
  }
}

onMounted(async () => {
  try {
    offices.value = await officesService.listActive();
    officeId.value = offices.value[0]?.officeId ?? '';
  } catch {
    ui.push('Could not load the office list — try again shortly.', 'error');
  }
});
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-neutral-surface px-4">
    <section class="w-full max-w-sm rounded-lg bg-neutral-white p-8 shadow-md">
      <header class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-neutral-ink">People Marketing</h1>
        <p class="mt-1 text-sm text-neutral-mute">Create your account</p>
      </header>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <BaseInput
          v-model="displayName"
          label="Name"
          type="text"
          autocomplete="name"
          required
          placeholder="Your name"
        />
        <BaseInput
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email"
          required
          placeholder="you@peoplemarketing.nl"
        />
        <BaseInput
          v-model="password"
          label="Password"
          type="password"
          autocomplete="new-password"
          required
        />
        <div class="flex flex-col gap-1">
          <label for="signup-office" class="text-sm font-medium text-neutral-ink">
            Office<span class="text-semantic-danger">*</span>
          </label>
          <select
            id="signup-office"
            v-model="officeId"
            required
            class="block w-full rounded-md border border-neutral-line bg-neutral-white px-3 py-2 text-neutral-ink focus:border-primary-pink focus:outline-none focus:ring-1 focus:ring-primary-pink"
          >
            <option v-if="!offices.length" value="" disabled>Loading offices…</option>
            <option v-for="o in offices" :key="o.officeId" :value="o.officeId">{{ o.name }}</option>
          </select>
        </div>
        <BaseButton
          type="submit"
          block
          :loading="submitting"
          :disabled="!displayName || !email || !password || !officeId"
        >
          Create account
        </BaseButton>
      </form>

      <p class="mt-6 text-center text-xs text-neutral-mute">
        Already have an account?
        <RouterLink to="/login" class="font-semibold text-primary-pink">Sign in</RouterLink>
      </p>
    </section>
  </main>
</template>
