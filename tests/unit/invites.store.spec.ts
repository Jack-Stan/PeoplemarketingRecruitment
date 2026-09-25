import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/services/invites.service', () => ({
  invitesService: {
    subscribeAll: vi.fn(() => () => {}),
    record: vi.fn(),
    remove: vi.fn(),
  },
}));

import { invitesService } from '@/services/invites.service';
import { useInvitesStore } from '@/stores/invites';
import { useUsersStore } from '@/stores/users';
import type { Invite } from '@/types/invite';
import type { UserProfile } from '@/types/user';

function ts(ms: number) {
  return { toMillis: () => ms, toDate: () => new Date(ms) } as unknown as Invite['invitedAt'];
}
function invite(email: string, ms: number | null): Invite {
  return { email, officeId: 'office-main', invitedBy: 'admin-1', invitedAt: ms === null ? null : ts(ms) };
}

describe('invites store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(invitesService.record).mockReset();
  });

  it('openInvites hides anyone who already has an account (case-insensitive), newest first', () => {
    const store = useInvitesStore();
    const users = useUsersStore();
    users.users = [{ uid: 'u1', email: 'done@example.com' } as UserProfile];
    store.invites = [
      invite('old@example.com', 1_000),
      invite('Done@Example.com', 3_000),
      invite('new@example.com', 2_000),
      // local snapshot before the server timestamp lands — must sort to the top
      invite('justnow@example.com', null),
    ];
    expect(store.openInvites.map((i) => i.email)).toEqual([
      'justnow@example.com',
      'new@example.com',
      'old@example.com',
    ]);
  });

  it('record never rejects — the invite mail already went out', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(invitesService.record).mockRejectedValue({ code: 'permission-denied' });
    const store = useInvitesStore();
    await expect(store.record('a@example.com', 'office-main', 'admin-1')).resolves.toBeUndefined();
  });
});
