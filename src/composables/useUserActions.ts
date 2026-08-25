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
export function useUserActions(officeLabel: (officeId: string | null) => string, ownOfficeId: Ref<string | null>) {
  const auth = useAuth();
  const store = useUsersStore();
  const auditLog = useAuditLogStore();
  const ui = useUiStore();
  const confirm = useConfirmStore();

  function isSelf(u: UserProfile): boolean {
    return auth.user.value?.uid === u.uid;
  }

  /** Missing isActive (pre-dates the field, e.g. script-created accounts) must read as active, not inactive. */
  function isUserActive(u: UserProfile): boolean {
    return u.isActive !== false;
  }

  /** Same guard as demoting via role-assign — an office can't be left with zero Administrators. */
  function wouldRemoveLastAdminByStatus(u: UserProfile): boolean {
    return u.role === 'Administrator' && isUserActive(u) && store.adminCountFor(u.primaryOfficeId ?? '') <= 1;
  }

  async function toggleActive(u: UserProfile): Promise<void> {
    const nextActive = !isUserActive(u);
    if (!nextActive && wouldRemoveLastAdminByStatus(u)) {
      ui.push(`${u.displayName || u.email} is de laatste beheerder van ${officeLabel(u.primaryOfficeId)} — wijs eerst iemand anders toe.`, 'error');
      return;
    }
    const ok = await store.setActive(u.uid, nextActive);
    ui.push(
      ok ? `${u.displayName || u.email} is nu ${nextActive ? 'actief' : 'inactief'}.` : (store.error ?? 'Er ging iets mis.'),
      ok ? 'success' : 'error',
    );
    if (ok && auth.user.value) {
      auditLog.log(u.primaryOfficeId ?? ownOfficeId.value ?? '', {
        actorUid: auth.user.value.uid,
        actorEmail: auth.user.value.email ?? '',
        action: nextActive ? 'user_reactivated' : 'user_deactivated',
        targetLabel: u.displayName || u.email,
        details: null,
        createdAtMs: Date.now(),
      });
    }
  }

  /** Returns whether the delete actually went through — callers on the detail page use this to navigate back. */
  async function removeUser(u: UserProfile): Promise<boolean> {
    if (isSelf(u)) {
      ui.push('Je kan je eigen account niet verwijderen.', 'error');
      return false;
    }
    if (wouldRemoveLastAdminByStatus(u)) {
      ui.push(`${u.displayName || u.email} is de laatste beheerder van ${officeLabel(u.primaryOfficeId)} — wijs eerst iemand anders toe.`, 'error');
      return false;
    }
    const sure = await confirm.ask(
      `${u.displayName || u.email} verwijderen? Dit verwijdert het gebruikersprofiel (rol/kantoor) permanent — het account kan opnieuw uitgenodigd worden.`,
      { title: 'Gebruiker verwijderen', danger: true },
    );
    if (!sure) return false;
    const ok = await store.deleteUser(u.uid);
    ui.push(ok ? `${u.displayName || u.email} verwijderd.` : (store.error ?? 'Er ging iets mis.'), ok ? 'success' : 'error');
    if (ok && auth.user.value) {
      auditLog.log(u.primaryOfficeId ?? ownOfficeId.value ?? '', {
        actorUid: auth.user.value.uid,
        actorEmail: auth.user.value.email ?? '',
        action: 'user_deleted',
        targetLabel: u.displayName || u.email,
        details: null,
        createdAtMs: Date.now(),
      });
    }
    return ok;
  }

  /**
   * Admin manually attests a phone number as verified/unverified — there's
   * no Firebase Phone Auth in this app (SMS OTP needs the Blaze plan), so
   * this is a "yes, I confirmed this by calling them" toggle, not automated.
   */
  async function setPhoneVerified(u: UserProfile, verified: boolean): Promise<void> {
    const ok = await store.setPhoneVerified(u.uid, verified);
    ui.push(
      ok ? `Telefoonnummer van ${u.displayName || u.email} is nu ${verified ? 'geverifieerd' : 'ongeverifieerd'}.` : (store.error ?? 'Er ging iets mis.'),
      ok ? 'success' : 'error',
    );
    if (ok && auth.user.value) {
      auditLog.log(u.primaryOfficeId ?? ownOfficeId.value ?? '', {
        actorUid: auth.user.value.uid,
        actorEmail: auth.user.value.email ?? '',
        action: 'phone_verified_changed',
        targetLabel: `${u.displayName || u.email} → ${verified ? 'geverifieerd' : 'ongeverifieerd'}`,
        details: null,
        createdAtMs: Date.now(),
      });
    }
  }

  return { isSelf, isUserActive, wouldRemoveLastAdminByStatus, toggleActive, removeUser, setPhoneVerified };
}
