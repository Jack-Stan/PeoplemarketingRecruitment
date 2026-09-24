<script setup lang="ts">
import { watch } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import BaseToast from '@/components/ui/BaseToast.vue';
import ConfirmDialogHost from '@/components/ui/ConfirmDialogHost.vue';
import AppShell from '@/components/AppShell.vue';

// The store can sign a user out on its own mid-session (admin deleted or
// deactivated them). The route guard only runs on navigation, so without
// this they'd keep looking at a page they no longer have access to.
const router = useRouter();
const authStore = useAuthStore();
watch(
  () => authStore.signedOutReason,
  (reason) => {
    if (reason && router.currentRoute.value.name !== 'login') void router.replace({ name: 'login' });
  },
);
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <AppShell v-if="route.meta.requiresAuth && !route.meta.noShell">
      <component :is="Component" />
    </AppShell>
    <component :is="Component" v-else />
  </RouterView>
  <BaseToast />
  <ConfirmDialogHost />
</template>
