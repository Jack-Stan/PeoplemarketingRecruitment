import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { authService } from '@/services/auth.service';
import { usersService } from '@/services/users.service';
import { useAuthStore } from '@/stores/auth';
import { Roles, type UserProfile } from '@/types/user';
import { friendlyError } from '@/utils/errors';

function profile(over: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'u1',
    email: 'a@b.nl',
    displayName: null,
    role: Roles.TeamMember,
    primaryOfficeId: 'office-1',
    desiredOfficeId: null,
    isTeamLeader: false,
    isActive: true,
    phone: null,
    emailVerified: false,
    ...over,
  } as UserProfile;
}

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
    expect(store.error).toBe(friendlyError({ code: 'auth/wrong-password' }));
  });

  it('signIn returns true on success', async () => {
    vi.mocked(authService.signIn).mockResolvedValueOnce({ uid: 'u1' } as never);
    vi.mocked(usersService.getOnce).mockResolvedValueOnce(profile({ uid: 'u1' }));

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
      phone: null,
      emailVerified: false,
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
    expect(store.error).toBe(friendlyError({ code: 'auth/email-already-in-use' }));
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
    const ok = await store.completeInvite(
      'invited@peoplemarketing.be',
      'https://x/complete-invite',
      'password123',
      'Invited Person',
      '+32499123456',
      'gent',
    );

    expect(ok).toBe(true);
    expect(authService.setPassword).toHaveBeenCalledWith({ uid: 'u4', email: 'invited@peoplemarketing.be' }, 'password123');
    expect(usersService.createProfile).toHaveBeenCalledWith(
      'u4',
      'invited@peoplemarketing.be',
      'Invited Person',
      'gent',
      '+32499123456',
    );
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
      phone: null,
      emailVerified: false,
    });

    const store = useAuthStore();
    const ok = await store.completeInvite(
      'invited@peoplemarketing.be',
      'https://x/complete-invite',
      'password123',
      'Invited Person',
      '+32499123456',
      'gent',
    );

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
      phone: null,
      emailVerified: false,
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

  describe('deleted profile (Auth account survives a Verwijderen)', () => {
    it('signIn with no /users doc signs straight back out with the removed message', async () => {
      vi.mocked(authService.signIn).mockResolvedValueOnce({ uid: 'gone', email: 'x@y.nl' } as never);

      const store = useAuthStore();
      const ok = await store.signIn('x@y.nl', 'pw');

      expect(ok).toBe(false);
      expect(authService.signOut).toHaveBeenCalled();
      expect(store.isAuthenticated).toBe(false);
      expect(store.error).toMatch(/verwijderd/);
    });

    it('a page-load hydrate with no doc signs out and leaves a reason for the login page', async () => {
      const store = useAuthStore();
      await store.hydrate({ uid: 'gone', email: 'x@y.nl' } as never, { revokeIfMissing: true });

      expect(store.isAuthenticated).toBe(false);
      expect(store.consumeSignedOutReason()).toMatch(/verwijderd/);
      expect(store.consumeSignedOutReason()).toBeNull();
    });

    it('the onAuthStateChanged hydrate mid-signup/invite does NOT sign the new account out', async () => {
      const store = useAuthStore();
      await store.hydrate({ uid: 'new', email: 'n@y.nl' } as never);

      expect(authService.signOut).not.toHaveBeenCalled();
      expect(store.isAuthenticated).toBe(true);
      expect(store.role).toBeNull();
    });

    it('signs out live when the doc disappears mid-session, but not on a never-existed null', async () => {
      let emit: (p: UserProfile | null) => void = () => {};
      vi.mocked(usersService.subscribeOwn).mockImplementationOnce(((_uid: string, cb: typeof emit) => {
        emit = cb;
        return () => {};
      }) as never);
      vi.mocked(usersService.getOnce).mockResolvedValueOnce(profile());

      const store = useAuthStore();
      await store.hydrate({ uid: 'u1', email: 'a@b.nl' } as never);
      expect(store.isAuthenticated).toBe(true);

      emit(null);
      await vi.waitFor(() => expect(store.isAuthenticated).toBe(false));
      expect(store.signedOutReason).toMatch(/verwijderd/);
    });

    it('signIn of a deactivated account now fails with a reason instead of returning true', async () => {
      vi.mocked(authService.signIn).mockResolvedValueOnce({ uid: 'u1', email: 'a@b.nl' } as never);
      vi.mocked(usersService.getOnce).mockResolvedValueOnce(profile({ isActive: false }));

      const store = useAuthStore();
      expect(await store.signIn('a@b.nl', 'pw')).toBe(false);
      expect(store.error).toMatch(/gedeactiveerd/);
    });
  });
});
