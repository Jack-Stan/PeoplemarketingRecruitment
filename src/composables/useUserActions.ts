import type { Ref } from 'vue';

import { useAuth } from '@/composables/useAuth';
import { useAuditLogStore } from '@/stores/auditLog';
import { useUsersStore } from '@/stores/users';
import { useConfirmStore } from '@/stores/confirm';
import { useUiStore } from '@/stores/ui';
import type { UserProfile } from '@/types/user';

/**
 * Deactivate/delete actions for a `/users/{uid}` account, shared by
 * UsersView (list) and UserDetailView (detail page). `officeLabel` is
 * injected so error messages can name the office; `ownOfficeId` is the
 * audit-log fallback for a pending user with no `primaryOfficeId` yet.
 */
export function useUserActions(
  officeLabel: (officeId: string | null) => string,
  ownOfficeId: Ref<string | null>,
) {
  const auth = useAuth();
  const store = useUsersStore();
  const auditLog = useAuditLogStore();
  const ui = useUiStore();
  const confirm = useConfirmStore();

  /**
   * Which office's audit log this action belongs in: the user's own office,
   * falling back to the acting admin's. Can still come back empty for a
   * pending user when the admin has no office either — `auditLog.record`
   * skips and warns in that case rather than building `offices//auditLog`,
   * an invalid path whose throw used to be swallowed silently.
   */
  function auditOfficeFor(u: UserProfile): string {
    return u.primaryOfficeId ?? ownOfficeId.value ?? '';
  }

  function isSelf(u: UserProfile): boolean {
    return auth.user.value?.uid === u.uid;
  }

  /** Missing isActive (pre-dates the field, e.g. script-created accounts) must read as active, not inactive. */
  function isUserActive(u: UserProfile): boolean {
    return u.isActive !== false;
  }

  /** Same guard as demoting via role-assign — an office can't be left with zero Administrators. */
  function wouldRemoveLastAdminByStatus(u: UserProfile): boolean {
    return (
      u.role === 'Administrator' &&
      isUserActive(u) &&
      store.adminCountFor(u.primaryOfficeId ?? '') <= 1
    );
  }

  async function toggleActive(u: UserProfile): Promise<void> {
    const nextActive = !isUserActive(u);
    if (!nextActive && wouldRemoveLastAdminByStatus(u)) {
      ui.push(
        `${u.displayName || u.email} is de laatste beheerder van ${officeLabel(u.primaryOfficeId)} — wijs eerst iemand anders toe.`,
        'error',
      );
      return;
    }
    const ok = await store.setActive(u.uid, nextActive);
    ui.push(
      ok
        ? `${u.displayName || u.email} is nu ${nextActive ? 'actief' : 'inactief'}.`
        : store.error ?? 'Er ging iets mis.',
      ok ? 'success' : 'error',
    );
    if (ok) {
      void auditLog.record(
        auditOfficeFor(u),
        nextActive ? 'user_reactivated' : 'user_deactivated',
        u.displayName || u.email,
      );
    }
  }

  /** Returns whether the delete actually went through — callers on the detail page use this to navigate back. */
  async function removeUser(u: UserProfile): Promise<boolean> {
    if (isSelf(u)) {
      ui.push('Je kan je eigen account niet verwijderen.', 'error');
      return false;
    }
    if (wouldRemoveLastAdminByStatus(u)) {
      ui.push(
        `${u.displayName || u.email} is de laatste beheerder van ${officeLabel(u.primaryOfficeId)} — wijs eerst iemand anders toe.`,
        'error',
      );
      return false;
    }
    const sure = await confirm.ask(
      `${u.displayName || u.email} verwijderen? Dit verwijdert het gebruikersprofiel (rol/kantoor) permanent — het account kan opnieuw uitgenodigd worden.`,
      { title: 'Gebruiker verwijderen', danger: true },
    );
    if (!sure) return false;
    const ok = await store.deleteUser(u.uid);
    ui.push(
      ok ? `${u.displayName || u.email} verwijderd.` : store.error ?? 'Er ging iets mis.',
      ok ? 'success' : 'error',
    );
    if (ok) {
      void auditLog.record(auditOfficeFor(u), 'user_deleted', u.displayName || u.email);
    }
    return ok;
  }

  return { isSelf, isUserActive, wouldRemoveLastAdminByStatus, toggleActive, removeUser };
}
