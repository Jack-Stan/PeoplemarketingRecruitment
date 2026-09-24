import { beforeEach, describe, expect, it, vi } from 'vitest';

// tests/setup.ts mocks the whole auth service for store tests — this file
// tests the real wrapper, so undo that and mock the SDK underneath instead.
vi.unmock('@/services/auth.service');
vi.mock('@/config/firebase', () => ({ getAppBaseUrl: () => 'http://localhost' }));

const reloadMock = vi.fn();
vi.mock('firebase/auth', () => ({
  reload: (...args: unknown[]) => reloadMock(...args),
}));

import type { User } from 'firebase/auth';
import { authService } from '@/services/auth.service';

function fakeUser(verifiedAfterReload: boolean) {
  const user = {
    emailVerified: false,
    getIdToken: vi.fn().mockResolvedValue('token'),
  };
  reloadMock.mockImplementationOnce(async () => {
    user.emailVerified = verifiedAfterReload;
  });
  return user;
}

describe('authService.refreshEmailVerified', () => {
  beforeEach(() => reloadMock.mockReset());

  // 2026-09-24 audit — reload() alone leaves the ID token's email_verified
  // claim stale, so rules deny the self-update that mirrors it.
  it('force-refreshes the ID token once Auth reports the email verified', async () => {
    const user = fakeUser(true);
    await expect(authService.refreshEmailVerified(user as unknown as User)).resolves.toBe(true);
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(user.getIdToken).toHaveBeenCalledWith(true);
    // Reload must land before the token refresh, or the claim is still stale.
    expect(reloadMock.mock.invocationCallOrder[0]).toBeLessThan(
      user.getIdToken.mock.invocationCallOrder[0],
    );
  });

  it('skips the token refresh while still unverified', async () => {
    const user = fakeUser(false);
    await expect(authService.refreshEmailVerified(user as unknown as User)).resolves.toBe(false);
    expect(user.getIdToken).not.toHaveBeenCalled();
  });
});
