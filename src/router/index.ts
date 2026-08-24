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
    // Signed in but no role claim yet — self-signed-up, waiting on an admin
    // to grant access via the Users page. Distinct from /unauthorized, which
    // means "signed in, has a role, but not one allowed on this route."
    const isPending = isLoggedIn && auth.role === null;
    const allowedRoles = to.matched
      .flatMap((r) => r.meta.roles ?? [])
      .filter((role, index, all) => all.indexOf(role) === index);

    if (requiresAuth && !isLoggedIn) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }
    if ((to.name === 'login' || to.name === 'signup') && isLoggedIn) {
      return { name: isPending ? 'pending-approval' : 'dashboard' };
    }
    if (to.name === 'pending-approval') {
      return isPending ? true : { name: 'dashboard' };
    }
    if (requiresAuth && isPending) {
      return { name: 'pending-approval' };
    }
    if (requiresAuth && allowedRoles.length > 0) {
      if (auth.role === null || !allowedRoles.includes(auth.role)) {
        return { name: 'unauthorized' };
      }
    }
    return true;
  });

  router.afterEach((to) => {
    const base = 'People Marketing CRM';
    document.title = to.meta.title ? `${to.meta.title} · ${base}` : base;
  });

  return router;
}