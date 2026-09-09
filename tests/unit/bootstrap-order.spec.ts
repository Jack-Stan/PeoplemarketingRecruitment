import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import type { Pinia } from 'pinia';

import { createAppRouter } from '@/router';
import { useAuthStore } from '@/stores/auth';
import { Roles } from '@/types/user';

/**
 * Pins the "logged out on every refresh despite remember-me" bug (prod,
 * 2026-09-09). vue-router 4 kicks off the initial navigation — and therefore
 * `beforeEach` — synchronously inside `app.use(router)`, NOT at
 * `router.isReady()` or `mount()`. main.ts used to install the router before
 * `authStateReady()`/`hydrate()`, so the guard saw an empty auth store,
 * bounced to /login, and nothing re-ran it once the persisted user landed.
 */
describe('bootstrap order: router install vs auth hydration', () => {
  let pinia: Pinia;
  const Root = defineComponent({ render: () => h('div') });

  function hydrateAsAdmin(): void {
    const auth = useAuthStore();
    auth.user = { uid: 'admin-1' } as never;
    auth.role = Roles.Administrator;
  }

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    // A refresh on a deep link: the browser is already at /dashboard.
    window.history.replaceState({}, '', '/dashboard');
  });

  it('BUG SHAPE — router installed before hydrate lands on /login even though auth is valid', async () => {
    const app = createApp(Root).use(pinia);
    const router = createAppRouter();
    app.use(router); // initial navigation starts here, guard sees no user
    // `authStateReady()` + `hydrate()` need real I/O (IndexedDB, Firestore),
    // so the persisted user lands at least one macrotask later.
    await new Promise((resolve) => setTimeout(resolve, 0));
    hydrateAsAdmin();
    await router.isReady();

    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/dashboard');
    expect(useAuthStore().isAuthenticated).toBe(true); // ...and yet
  });

  it('FIX — router installed after hydrate stays on /dashboard', async () => {
    const app = createApp(Root).use(pinia);
    const router = createAppRouter();
    hydrateAsAdmin(); // main.ts awaits authStateReady()+hydrate() first...
    app.use(router); // ...and only then installs the router
    await router.isReady();

    expect(router.currentRoute.value.name).toBe('dashboard');
  });
});
