<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import BaseButton from '@/components/ui/BaseButton.vue';
import { useAuth } from '@/composables/useAuth';

/**
 * Two situations land here:
 *   - the normal 403: signed in, has a role, route not allowed for it;
 *   - `?reason=profile`: the `/users/{uid}` read FAILED, so we don't know the
 *     role at all. That's a transient error, not a permission decision — the
 *     router sends those here rather than to /pending-approval, which would
 *     tell an already-approved user to wait for an approval they have.
 */
const route = useRoute();
const router = useRouter();
const auth = useAuth();

const isProfileError = computed(() => route.query.reason === 'profile');
const retrying = ref(false);

async function retry(): Promise<void> {
  retrying.value = true;
  await auth.retryProfileLoad();
  retrying.value = false;
  if (!auth.profileLoadFailed.value) await router.replace('/');
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center px-4">
    <section class="max-w-sm text-center">
      <template v-if="isProfileError">
        <p class="text-sm font-semibold uppercase tracking-wide text-semantic-danger">
          Verbindingsprobleem
        </p>
        <h1 class="mt-2 text-3xl font-bold text-neutral-ink">
          Je gegevens konden niet geladen worden
        </h1>
        <p class="mt-1 text-neutral-mute">
          Dit ligt niet aan je account — we konden je profiel even niet ophalen. Probeer het
          opnieuw.
        </p>
        <div class="mt-6 flex justify-center gap-3">
          <BaseButton :loading="retrying" @click="retry">Opnieuw proberen</BaseButton>
          <button class="px-4 py-2 text-sm font-semibold text-neutral-mute" @click="auth.signOut()">
            Uitloggen
          </button>
        </div>
      </template>
      <template v-else>
        <p class="text-sm font-semibold uppercase tracking-wide text-semantic-danger">403</p>
        <h1 class="mt-2 text-3xl font-bold text-neutral-ink">Geen toegang</h1>
        <p class="mt-1 text-neutral-mute">Je account heeft geen toegang tot deze pagina.</p>
        <div class="mt-6">
          <BaseButton @click="router.replace('/')">Terug naar dashboard</BaseButton>
        </div>
      </template>
    </section>
  </main>
</template>
