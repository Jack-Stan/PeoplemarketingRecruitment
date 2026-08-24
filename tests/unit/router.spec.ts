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
});
