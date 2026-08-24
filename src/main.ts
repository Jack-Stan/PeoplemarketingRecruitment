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

// Hydrate auth from any persisted Firebase session, then mount once we've
// decided where to land. The router guard runs after this resolves.
const authStore = useAuthStore();
authService.onAuthStateChanged((fbUser) => {
  void authStore.hydrate(fbUser);
});

router.isReady().then(() => app.mount('#app'));