import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/services/firebase';
import type {
  RecruitmentLead,
  RecruitmentLeadCreatePayload,
  RecruitmentLeadPatch,
} from '@/types/recruitmentLead';

function leadsCollection(officeId: string) {
  return collection(db, 'offices', officeId, 'recruitmentLeads');
}

/**
 * Thin Firestore wrapper for recruitment leads — mirrors employees/shifts
 * services. `firestore.rules` already had `/recruitmentLeads` gated
 * (staff write, member read-only) from Ticket 01; this is the first client
 * code that actually talks to it.
 */
/**
 * Newest-N cap on the live lead subscription. The pipeline is append-only and
 * grows forever; an unbounded collection subscription re-reads all of it on
 * every mount/office switch, which is a real Spark-quota (50k reads/day)
 * risk. 200 covers the funnel counters and the whole visible board with room
 * to spare; anything older stays in Firestore.
 */
export const RECENT_LEADS_LIMIT = 200;

export const recruitmentService = {
  /**
   * Newest `max` leads. `orderBy` on the single `createdAtMs` field with no
   * `where` needs no composite index — `firestore.indexes.json` is empty and
   * has no deploy step, so an index-requiring query would 500 in production.
   */
  subscribe(
    officeId: string,
    onChange: (leads: RecruitmentLead[]) => void,
    onError: (err: unknown) => void,
    max: number = RECENT_LEADS_LIMIT,
  ): Unsubscribe {
    return onSnapshot(
      query(leadsCollection(officeId), orderBy('createdAtMs', 'desc'), limit(max)),
      (snapshot) => {
        const leads = snapshot.docs.map(
          (d) => ({ leadId: d.id, officeId, ...d.data() }) as RecruitmentLead,
        );
        onChange(leads);
      },
      onError,
    );
  },

  async create(
    officeId: string,
    nowMs: number,
    payload: RecruitmentLeadCreatePayload,
  ): Promise<string> {
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
