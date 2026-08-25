import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';

import { auditLogService } from '@/services/auditLog.service';
import { friendlyError } from '@/utils/errors';
import type { AuditLogCreatePayload, AuditLogEntry } from '@/types/auditLog';

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

  return { entries, isLoading, error, subscribe, unsubscribe, log };
});
