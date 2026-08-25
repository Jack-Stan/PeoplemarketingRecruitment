import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, type Unsubscribe } from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { AuditLogCreatePayload, AuditLogEntry } from '@/types/auditLog';

function auditLogCollection(officeId: string) {
  return collection(db, 'offices', officeId, 'auditLog');
}

/** Thin Firestore wrapper, same shape as every other service in this app — no business logic here. */
export const auditLogService = {
  async log(officeId: string, payload: AuditLogCreatePayload): Promise<void> {
    await addDoc(auditLogCollection(officeId), { ...payload, officeId, createdAt: serverTimestamp() });
  },

  subscribe(
    officeId: string,
    onChange: (entries: AuditLogEntry[]) => void,
    onError: (err: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(auditLogCollection(officeId), orderBy('createdAtMs', 'desc')),
      (snapshot) => {
        const entries = snapshot.docs.map((d) => ({ entryId: d.id, officeId, ...d.data() }) as AuditLogEntry);
        onChange(entries);
      },
      onError,
    );
  },
};

export type AuditLogService = typeof auditLogService;
