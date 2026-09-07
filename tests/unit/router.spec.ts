import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Router } from 'vue-router';

import { createAppRouter } from '@/router';
import { useAuthStore } from '@/stores/auth';
import { Roles } from '@/types/user';

async function navigate(router: Router, path: string) {
  await router.push(path);
  await router.isReady();
  return router.currentRoute.value;
}

describe('router guard', () => {
  let router: Router;

  beforeEach(() => {
    setActivePinia(createPinia());
    router = createAppRouter();
  });

  it('bounces an unauthenticated user on a protected route to /login', async () => {
    const route = await navigate(router, '/dashboard');
    expect(route.name).toBe('login');
    expect(route.query.redirect).toBe('/dashboard');
  });

  it('sends a signed-in user with no role yet ("pending") to /pending-approval', async () => {
    const auth = useAuthStore();
    auth.user = { uid: 'u1' } as never;
    const route = await navigate(router, '/dashboard');
    expect(route.name).toBe('pending-approval');
  });

  it('redirects a pending user away from /login and /signup', async () => {
    const auth = useAuthStore();
    auth.user = { uid: 'u1' } as never;
    expect((await navigate(router, '/login')).name).toBe('pending-approval');
    expect((await navigate(router, '/signup')).name).toBe('pending-approval');
  });

  it('sends a role-mismatched user to /unauthorized', async () => {
    const auth = useAuthStore();
    auth.user = { uid: 'u1' } as never;
    auth.role = Roles.TeamMember;
    const route = await navigate(router, '/employees');
    expect(route.name).toBe('unauthorized');
  });

  it('lets an Administrator reach every route, including the new /users page', async () => {
    const auth = useAuthStore();
    auth.user = { uid: 'admin-1' } as never;
    auth.role = Roles.Administrator;
    expect((await navigate(router, '/users')).name).toBe('users');
    expect((await navigate(router, '/employees')).name).toBe('employees');
  });

  it('redirects an already-resolved user away from /pending-approval', async () => {
    const auth = useAuthStore();
    auth.user = { uid: 'u1' } as never;
    auth.role = Roles.TeamMember;
    const route = await navigate(router, '/pending-approval');
    expect(route.name).toBe('dashboard');
  });

  /**
   * `/mijn-planning` is the TeamMember's own-shifts screen. It is deliberately
   * NOT open to managers: firestore.rules scopes a member to their own shifts,
   * and a manager landing here would see an empty page rather than the
   * office-wide `/planning` they actually want.
   */
  describe('/mijn-planning is TeamMember-only', () => {
    function signIn(role: (typeof Roles)[keyof typeof Roles]) {
      const auth = useAuthStore();
      auth.user = { uid: 'u1' } as never;
      auth.role = role;
    }

    it('lets a TeamMember in', async () => {
      signIn(Roles.TeamMember);
      expect((await navigate(router, '/mijn-planning')).name).toBe('my-planning');
    });

    it('bounces a TeamManager to /unauthorized', async () => {
      signIn(Roles.TeamManager);
      expect((await navigate(router, '/mijn-planning')).name).toBe('unauthorized');
    });

    it('bounces an Administrator to /unauthorized too', async () => {
      signIn(Roles.Administrator);
      expect((await navigate(router, '/mijn-planning')).name).toBe('unauthorized');
    });

    it('sends an unauthenticated visitor to /login with the redirect preserved', async () => {
      const route = await navigate(router, '/mijn-planning');
      expect(route.name).toBe('login');
      expect(route.query.redirect).toBe('/mijn-planning');
    });

    it('conversely, /planning is manager-side and closed to a TeamMember', async () => {
      signIn(Roles.TeamMember);
      expect((await navigate(router, '/planning')).name).toBe('unauthorized');
    });
  });

  describe('/audit is Administrator-only', () => {
    it('lets an Administrator in', async () => {
      const auth = useAuthStore();
      auth.user = { uid: 'admin-1' } as never;
      auth.role = Roles.Administrator;
      expect((await navigate(router, '/audit')).name).toBe('audit');
    });

    it.each([
      ['TeamManager', Roles.TeamManager],
      ['TeamMember', Roles.TeamMember],
    ])('bounces a %s to /unauthorized', async (_label, role) => {
      const auth = useAuthStore();
      auth.user = { uid: 'u1' } as never;
      auth.role = role;
      expect((await navigate(router, '/audit')).name).toBe('unauthorized');
    });

    it('sends an unauthenticated visitor to /login with the redirect preserved', async () => {
      const route = await navigate(router, '/audit');
      expect(route.name).toBe('login');
      expect(route.query.redirect).toBe('/audit');
    });

    it('sends a signed-in user with no role yet to /pending-approval, not /unauthorized', async () => {
      const auth = useAuthStore();
      auth.user = { uid: 'u1' } as never;
      expect((await navigate(router, '/audit')).name).toBe('pending-approval');
    });
  });

  /**
   * The guard stamps `?redirect=` on the bounce to /login; LoginView reads it
   * back and replaces to it after a successful sign-in. These tests pin both
   * halves of that contract at the router level — the query survives the round
   * trip, including its query string, and an authorised user can then reach it.
   */
  describe('the redirect query is honoured after login', () => {
    it('captures the full path, query string included', async () => {
      const route = await navigate(router, '/planning?week=2026-08-24');
      expect(route.name).toBe('login');
      expect(route.query.redirect).toBe('/planning?week=2026-08-24');
    });

    it('the captured path is reachable once the user signs in with a permitted role', async () => {
      const bounced = await navigate(router, '/employees');
      expect(bounced.query.redirect).toBe('/employees');

      const auth = useAuthStore();
      auth.user = { uid: 'u1' } as never;
      auth.role = Roles.TeamManager;

      // What LoginView does with the query it just read back.
      const resumed = await navigate(router, String(bounced.query.redirect));
      expect(resumed.name).toBe('employees');
      expect(resumed.fullPath).toBe('/employees');
    });

    it('a signed-in user hitting /login is sent to the dashboard, so the query is not re-applied blindly', async () => {
      const auth = useAuthStore();
      auth.user = { uid: 'u1' } as never;
      auth.role = Roles.TeamMember;
      expect((await navigate(router, '/login?redirect=/employees')).name).toBe('dashboard');
    });

    it('still bounces to /unauthorized when the captured path is off-limits for the role that logs in', async () => {
      const bounced = await navigate(router, '/audit');
      const auth = useAuthStore();
      auth.user = { uid: 'u1' } as never;
      auth.role = Roles.TeamMember;

      const resumed = await navigate(router, String(bounced.query.redirect));
      expect(resumed.name).toBe('unauthorized');
    });

    it('no redirect query is added for a public route', async () => {
      const route = await navigate(router, '/login');
      expect(route.name).toBe('login');
      expect(route.query.redirect).toBeUndefined();
    });
  });
});
