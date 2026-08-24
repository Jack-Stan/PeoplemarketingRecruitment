import { createRouter, createWebHistory } from 'vue-router';

import { routes } from './routes';
import { useAuthStore } from '@/stores/auth';

/**
 * Router + global guard. The guard:
 *   1. Bounces unauthenticated users on protected routes to /login.
 *   2. Redirects already-signed-in users away from /login to /dashboard.
 *   3. (Ticket 1) Enforces `meta.roles` allowlists.
 */
export function createAppRouter() {
  const router = createRouter({
    history: createWebHistory(),
    routes,
  });

  router.beforeEach((to) => {
    const auth = useAuthStore();
    const requiresAuth = to.matched.some((r) => r.meta.requiresAuth);
    const isLoggedIn = auth.isAuthenticated;

    if (requiresAuth && !isLoggedIn) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }
    if (to.name === 'login' && isLoggedIn) {
      return { name: 'dashboard' };
    }
    return true;
  });

  router.afterEach((to) => {
    const base = 'People Marketing CRM';
    document.title = to.meta.title ? `${to.meta.title} · ${base}` : base;
  });

  return router;
}