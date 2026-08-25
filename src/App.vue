<script setup lang="ts">
import { RouterView } from 'vue-router';
import BaseToast from '@/components/ui/BaseToast.vue';
import ConfirmDialogHost from '@/components/ui/ConfirmDialogHost.vue';
import AppShell from '@/components/AppShell.vue';
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