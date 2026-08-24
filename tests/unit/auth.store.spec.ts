import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth';
import { Roles } from '@/types/user';

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('starts unauthenticated with no role/office', () => {
    const store = useAuthStore();
    expect(store.isAuthenticated).toBe(false);
    expect(store.role).toBeNull();
    expect(store.officeId).toBeNull();
    expect(store.isTeamLeader).toBe(false);
    expect(store.appUser).toBeNull();
  });

  it('signIn delegates to authService and surfaces a friendly error on failure', async () => {
    vi.mocked(authService.signIn).mockRejectedValueOnce(
      Object.assign(new Error('auth/wrong-password'), { code: 'auth/wrong-password' }),
    );

    const store = useAuthStore();
    const ok = await store.signIn('a@b.nl', 'badpw');
    expect(ok).toBe(false);
    expect(store.error).toMatch(/Email or password is incorrect/i);
  });

  it('signIn returns true on success', async () => {
    vi.mocked(authService.signIn).mockResolvedValueOnce({ uid: 'u1' } as never);

    const store = useAuthStore();
    const ok = await store.signIn('a@b.nl', 'goodpw');
    expect(ok).toBe(true);
    expect(store.error).toBeNull();
  });

  it('hydrate populates role + officeId from custom claims', async () => {
    vi.mocked(authService.getClaims).mockResolvedValueOnce({
      role: Roles.TeamManager,
      officeId: 'office-amsterdam',
      isTeamLeader: true,
    });

    const store = useAuthStore();
    await store.hydrate({ uid: 'u1', email: 'mgr@peoplemarketing.nl' } as never);

    expect(store.isAuthenticated).toBe(true);
    expect(store.role).toBe(Roles.TeamManager);
    expect(store.officeId).toBe('office-amsterdam');
    expect(store.isTeamLeader).toBe(true);
    expect(store.appUser?.email).toBe('mgr@peoplemarketing.nl');
  });

  it('hasRole is true only for matching role', () => {
    const store = useAuthStore();
    expect(store.hasRole(Roles.Administrator)).toBe(false);

    store.role = Roles.Administrator;
    expect(store.hasRole(Roles.Administrator)).toBe(true);
    expect(store.hasRole(Roles.TeamManager, Roles.TeamMember)).toBe(false);
  });

  it('signOut clears user, role and office', async () => {
    vi.mocked(authService.getClaims).mockResolvedValueOnce({
      role: Roles.Administrator,
      officeId: 'office-1',
    });
    vi.mocked(authService.signOut).mockResolvedValueOnce(undefined);

    const store = useAuthStore();
    await store.hydrate({ uid: 'u1', email: 'boss@peoplemarketing.nl' } as never);
    expect(store.isAuthenticated).toBe(true);

    await store.signOut();
    expect(store.isAuthenticated).toBe(false);
    expect(store.role).toBeNull();
    expect(store.officeId).toBeNull();
  });
});