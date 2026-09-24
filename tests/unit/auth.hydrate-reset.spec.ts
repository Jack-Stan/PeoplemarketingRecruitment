import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { usersService } from '@/services/users.service';
import { useAuthStore } from '@/stores/auth';
import { Roles, type UserProfile } from '@/types/user';

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

// 2026-09-24 verification (EOGHAN): the hydrate de-dup split hydrate() into
// hydrate() + doHydrate() and dropped the clear() that used to run before
// every fresh hydrate. profileLoadFailed is only ever reset by clear(), so a
// failed load stuck forever and the /unauthorized retry button never worked.
describe('auth store: a fresh hydrate starts from a clean slate', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(usersService.subscribeOwn).mockImplementation((() => () => {}) as never);
  });

  it('retryProfileLoad recovers after a failed profile read', async () => {
    vi.mocked(usersService.getOnce).mockRejectedValueOnce(
      Object.assign(new Error('unavailable'), { code: 'unavailable' }),
    );
    const store = useAuthStore();
    await store.hydrate({ uid: 'u1', email: 'a@b.nl' } as never);
    expect(store.profileLoadFailed).toBe(true);

    vi.mocked(usersService.getOnce).mockResolvedValueOnce(
      profile({ role: Roles.TeamManager, primaryOfficeId: 'office-gent' }),
    );
    await store.retryProfileLoad();

    expect(store.profileLoadFailed).toBe(false);
    expect(store.role).toBe(Roles.TeamManager);
    expect(store.officeId).toBe('office-gent');
  });

  it("a different uid's failed load does not inherit the previous user's role", async () => {
    vi.mocked(usersService.getOnce).mockResolvedValueOnce(
      profile({ uid: 'admin', role: Roles.Administrator, primaryOfficeId: 'office-1' }),
    );
    const store = useAuthStore();
    await store.hydrate({ uid: 'admin', email: 'admin@b.nl' } as never);
    expect(store.role).toBe(Roles.Administrator);

    vi.mocked(usersService.getOnce).mockRejectedValueOnce(
      Object.assign(new Error('unavailable'), { code: 'unavailable' }),
    );
    await store.hydrate({ uid: 'u2', email: 'u2@b.nl' } as never);

    expect(store.profileLoadFailed).toBe(true);
    expect(store.role).toBeNull();
    expect(store.officeId).toBeNull();
  });
});
