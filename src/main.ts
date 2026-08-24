import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import { createAppRouter } from './router';
import { authService } from './services/auth.service';
import { useAuthStore } from './stores/auth';

import './assets/tailwind.css';

const app = createApp(App);
const pinia = createPinia();
const router = createAppRouter();

app.use(pinia);
app.use(router);

// Hydrate auth from any persisted Firebase session before mounting so
// role-based route checks don't run against an empty claim state.
const authStore = useAuthStore();
const authReady = new Promise<void>((resolve) => {
  let initialized = false;
  authService.onAuthStateChanged((fbUser) => {
    void authStore.hydrate(fbUser).finally(() => {
      if (!initialized) {
        initialized = true;
        resolve();
      }
    });
  });
});

void authReady.then(() => {
  void router.isReady().then(() => app.mount('#app'));
});