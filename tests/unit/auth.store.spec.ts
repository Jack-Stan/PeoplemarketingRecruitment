import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { authService } from '@/services/auth.service';
import { usersService } from '@/services/users.service';
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

  it('hydrate populates role + officeId from the /users/{uid} Firestore doc', async () => {
    vi.mocked(usersService.getOnce).mockResolvedValueOnce({
      uid: 'u1',
      email: 'mgr@peoplemarketing.nl',
      displayName: null,
      role: Roles.TeamManager,
      primaryOfficeId: 'office-amsterdam',
      desiredOfficeId: null,
      isTeamLeader: true,
      isActive: true,
    });

    const store = useAuthStore();
    await store.hydrate({ uid: 'u1', email: 'mgr@peoplemarketing.nl' } as never);

    expect(store.isAuthenticated).toBe(true);
    expect(store.role).toBe(Roles.TeamManager);
    expect(store.officeId).toBe('office-amsterdam');
    expect(store.isTeamLeader).toBe(true);
    expect(store.appUser?.email).toBe('mgr@peoplemarketing.nl');
  });

  it('signUp creates the Auth account, mirrors a pending /users profile, and hydrates with no role', async () => {
    vi.mocked(authService.signUp).mockResolvedValueOnce({ uid: 'u2', email: 'new@peoplemarketing.nl' } as never);
    vi.mocked(usersService.createProfile).mockResolvedValueOnce(undefined);

    const store = useAuthStore();
    const ok = await store.signUp('new@peoplemarketing.nl', 'goodpw', 'New Person', 'office-gent');

    expect(ok).toBe(true);
    expect(usersService.createProfile).toHaveBeenCalledWith(
      'u2',
      'new@peoplemarketing.nl',
      'New Person',
      'office-gent',
    );
    expect(store.isAuthenticated).toBe(true);
    expect(store.role).toBeNull();
  });

  it('signUp surfaces a friendly error when the email is already taken', async () => {
    vi.mocked(authService.signUp).mockRejectedValueOnce(
      Object.assign(new Error('auth/email-already-in-use'), { code: 'auth/email-already-in-use' }),
    );

    const store = useAuthStore();
    const ok = await store.signUp('taken@peoplemarketing.nl', 'goodpw', 'Someone', 'office-gent');
    expect(ok).toBe(false);
    expect(store.error).toMatch(/already exists/i);
  });

  it('hydrate stays live: a role change pushed via subscribeOwn updates the store without a re-login', async () => {
    vi.mocked(usersService.getOnce).mockResolvedValueOnce(null);
    let pushUpdate: (profile: unknown) => void = () => {};
    vi.mocked(usersService.subscribeOwn).mockImplementationOnce((_uid, onChange) => {
      pushUpdate = onChange as (profile: unknown) => void;
      return () => {};
    });

    const store = useAuthStore();
    await store.hydrate({ uid: 'u3', email: 'pending@peoplemarketing.nl' } as never);
    expect(store.role).toBeNull();

    pushUpdate({
      uid: 'u3',
      email: 'pending@peoplemarketing.nl',
      displayName: null,
      role: Roles.TeamMember,
      primaryOfficeId: 'office-gent',
      desiredOfficeId: 'office-gent',
      isTeamLeader: false,
      isActive: true,
    });

    expect(store.role).toBe(Roles.TeamMember);
    expect(store.officeId).toBe('office-gent');
  });

  it('hasRole is true only for matching role', () => {
    const store = useAuthStore();
    expect(store.hasRole(Roles.Administrator)).toBe(false);

    store.role = Roles.Administrator;
    expect(store.hasRole(Roles.Administrator)).toBe(true);
    expect(store.hasRole(Roles.TeamManager, Roles.TeamMember)).toBe(false);
  });

  it('sendInvite delegates to authService and surfaces a friendly error on failure', async () => {
    vi.mocked(authService.sendInvite).mockRejectedValueOnce(
      Object.assign(new Error('auth/operation-not-allowed'), { code: 'auth/operation-not-allowed' }),
    );

    const store = useAuthStore();
    const ok = await store.sendInvite('new@peoplemarketing.be', 'gent');
    expect(ok).toBe(false);
    expect(authService.sendInvite).toHaveBeenCalledWith('new@peoplemarketing.be', 'gent');
  });

  it('completeInvite signs in, creates a pending profile if none exists, and hydrates', async () => {
    vi.mocked(authService.completeInvite).mockResolvedValueOnce({ uid: 'u4', email: 'invited@peoplemarketing.be' } as never);
    vi.mocked(usersService.getOnce).mockResolvedValueOnce(null);
    vi.mocked(usersService.createProfile).mockResolvedValueOnce(undefined);

    const store = useAuthStore();
    const ok = await store.completeInvite('invited@peoplemarketing.be', 'https://x/complete-invite', 'Invited Person', 'gent');

    expect(ok).toBe(true);
    expect(usersService.createProfile).toHaveBeenCalledWith('u4', 'invited@peoplemarketing.be', 'Invited Person', 'gent');
    expect(store.isAuthenticated).toBe(true);
    expect(store.role).toBeNull();
  });

  it('completeInvite does not overwrite an existing profile (re-clicking the link)', async () => {
    vi.mocked(authService.completeInvite).mockResolvedValueOnce({ uid: 'u4', email: 'invited@peoplemarketing.be' } as never);
    vi.mocked(usersService.getOnce).mockResolvedValueOnce({
      uid: 'u4',
      email: 'invited@peoplemarketing.be',
      displayName: 'Invited Person',
      role: null,
      primaryOfficeId: null,
      desiredOfficeId: 'gent',
      isTeamLeader: false,
      isActive: true,
    });

    const store = useAuthStore();
    const ok = await store.completeInvite('invited@peoplemarketing.be', 'https://x/complete-invite', 'Invited Person', 'gent');

    expect(ok).toBe(true);
    expect(usersService.createProfile).not.toHaveBeenCalled();
  });

  it('signOut clears user, role and office', async () => {
    vi.mocked(usersService.getOnce).mockResolvedValueOnce({
      uid: 'u1',
      email: 'boss@peoplemarketing.nl',
      displayName: null,
      role: Roles.Administrator,
      primaryOfficeId: 'office-1',
      desiredOfficeId: null,
      isTeamLeader: false,
      isActive: true,
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