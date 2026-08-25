import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import { createAppRouter } from './router';
import { authService } from './services/auth.service';
import { auth } from './services/firebase';
import { useAuthStore } from './stores/auth';

import './assets/tailwind.css';

const app = createApp(App);
const pinia = createPinia();
const router = createAppRouter();

app.use(pinia);
app.use(router);

// Hydrate auth from any persisted Firebase session before mounting so
// role-based route checks don't run against an empty claim state.
//
// `auth.authStateReady()` (not "wait for the first onAuthStateChanged
// callback") is the fix for a real bug: switching persistence mode on every
// sign-in (see authService.signIn's setPersistence call, needed for
// "Aangemeld blijven") can make Firebase emit a transient/duplicate auth
// state during initial load. The old "resolve on first callback" pattern
// occasionally caught that transient null, hydrated as signed-out, mounted,
// and the router guard bounced straight to /login — the real user then
// arrived a moment later but nothing re-ran the guard, so the tab was stuck
// on /login despite "remember me" actually being valid. `authStateReady()`
// is Firebase's own primitive for "wait until the real initial state is
// settled," which sidesteps this entirely.
const authStore = useAuthStore();

async function bootstrap(): Promise<void> {
  await auth.authStateReady();
  await authStore.hydrate(auth.currentUser);
  authService.onAuthStateChanged((fbUser) => void authStore.hydrate(fbUser));
  await router.isReady();
  app.mount('#app');
}

void bootstrap();