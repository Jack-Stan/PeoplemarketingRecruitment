import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';

import { auditLogService } from '@/services/auditLog.service';
import { useAuthStore } from '@/stores/auth';
import { friendlyError } from '@/utils/errors';
import type { AuditAction, AuditLogCreatePayload, AuditLogEntry } from '@/types/auditLog';

export const useAuditLogStore = defineStore('auditLog', () => {
  const entries = ref<AuditLogEntry[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  let unsub: Unsubscribe | null = null;

  function subscribe(officeId: string): void {
    unsubscribe();
    isLoading.value = true;
    unsub = auditLogService.subscribe(
      officeId,
      (list) => {
        entries.value = list;
        isLoading.value = false;
        error.value = null;
      },
      (err) => {
        error.value = friendlyError(err);
        isLoading.value = false;
      },
    );
  }

  function unsubscribe(): void {
    unsub?.();
    unsub = null;
  }

  /**
   * Fire-and-forget on purpose: the action being logged (approving a shift,
   * assigning a role, ...) has already succeeded by the time this is called.
   * A failed audit write is bad, but rolling back — or even surfacing an
   * error for — the real action over it would be worse.
   */
  async function log(officeId: string, payload: AuditLogCreatePayload): Promise<void> {
    try {
      await auditLogService.log(officeId, payload);
    } catch {
      // Swallowed — see above.
    }
  }

  /**
   * The one way call sites should write an audit entry. Stamps the actor from
   * the auth store and `createdAtMs` here instead of making eight views
   * repeat the same four fields — firestore.rules requires actorUid to equal
   * the caller's uid, actorEmail their token email, officeId the path, and a
   * fresh createdAtMs, so a hand-assembled payload is a rules rejection
   * waiting to happen.
   *
   * Skips (and warns) on an empty officeId: `offices//auditLog` is an invalid
   * document path, which throws inside `log`'s catch and vanishes silently —
   * a dropped audit entry nobody can see is worse than a console warning.
   */
  async function record(
    officeId: string,
    action: AuditAction,
    targetLabel: string,
    details: string | null = null,
  ): Promise<void> {
    const auth = useAuthStore();
    if (!officeId) {
      // eslint-disable-next-line no-console -- see comment above; a silently
      // dropped audit write is exactly what this replaces.
      console.warn(`[auditLog] "${action}" on "${targetLabel}" not logged: no office in context.`);
      return;
    }
    if (!auth.user) return;
    await log(officeId, {
      actorUid: auth.user.uid,
      actorEmail: auth.user.email ?? '',
      action,
      targetLabel,
      details,
      createdAtMs: Date.now(),
    });
  }

  return { entries, isLoading, error, subscribe, unsubscribe, log, record };
});
