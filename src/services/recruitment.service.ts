import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { RecruitmentLead, RecruitmentLeadCreatePayload, RecruitmentLeadPatch } from '@/types/recruitmentLead';

function leadsCollection(officeId: string) {
  return collection(db, 'offices', officeId, 'recruitmentLeads');
}

/**
 * Thin Firestore wrapper for recruitment leads — mirrors employees/shifts
 * services. `firestore.rules` already had `/recruitmentLeads` gated
 * (staff write, member read-only) from Ticket 01; this is the first client
 * code that actually talks to it.
 */
export const recruitmentService = {
  subscribe(
    officeId: string,
    onChange: (leads: RecruitmentLead[]) => void,
    onError: (err: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(
      leadsCollection(officeId),
      (snapshot) => {
        const leads = snapshot.docs.map((d) => ({ leadId: d.id, officeId, ...d.data() }) as RecruitmentLead);
        onChange(leads);
      },
      onError,
    );
  },

  async create(officeId: string, nowMs: number, payload: RecruitmentLeadCreatePayload): Promise<string> {
    const ref = await addDoc(leadsCollection(officeId), {
      ...payload,
      officeId,
      createdAtMs: nowMs,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(officeId: string, leadId: string, patch: RecruitmentLeadPatch): Promise<void> {
    await updateDoc(doc(db, 'offices', officeId, 'recruitmentLeads', leadId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  },
};

export type RecruitmentService = typeof recruitmentService;
