import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';

import { invitesService } from '@/services/invites.service';
import { useUsersStore } from '@/stores/users';
import { friendlyError } from '@/utils/errors';
import type { Invite } from '@/types/invite';

/**
 * Admin-only list of sent invites. `openInvites` = invited but no account yet
 * (no /users doc with that email) — the invitee can't mark their own invite
 * done, so completion is derived from the users store UsersView already has
 * subscribed. Newest first.
 */
export const useInvitesStore = defineStore('invites', () => {
  const invites = ref<Invite[]>([]);
  const error = ref<string | null>(null);
  let unsub: Unsubscribe | null = null;

  const usersStore = useUsersStore();
  const openInvites = computed(() => {
    const registered = new Set(usersStore.users.map((u) => u.email?.toLowerCase()));
    return invites.value
      .filter((i) => !registered.has(i.email.toLowerCase()))
      .sort((a, b) => (b.invitedAt?.toMillis() ?? Infinity) - (a.invitedAt?.toMillis() ?? Infinity));
  });

  function subscribe(): void {
    unsubscribe();
    unsub = invitesService.subscribeAll(
      (list) => {
        invites.value = list;
        error.value = null;
      },
      (err) => (error.value = friendlyError(err)),
    );
  }

  function unsubscribe(): void {
    unsub?.();
    unsub = null;
  }

  /**
   * Best-effort: the invite mail has already gone out when this runs, so a
   * failed record just means it won't show in the list — never a failed invite.
   */
  async function record(email: string, officeId: string, invitedBy: string): Promise<void> {
    try {
      await invitesService.record(email, officeId, invitedBy);
    } catch (err) {
      console.warn('[invites] could not record invite', err);
    }
  }

  async function remove(email: string): Promise<boolean> {
    error.value = null;
    try {
      await invitesService.remove(email);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  return { invites, openInvites, error, subscribe, unsubscribe, record, remove };
});
