import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { Office } from '@/types/office';

export const officesService = {
  /**
   * Single-office lookup, used by UsersView to show the admin's own office
   * name. firestore.rules only lets an admin grant their own office (see
   * decisions/006), so there's no need for a full office picker there —
   * cross-office admin assignment is an open question for later, noted in
   * the vault.
   */
  async get(officeId: string): Promise<Office | null> {
    const snap = await getDoc(doc(db, 'offices', officeId));
    return snap.exists() ? ({ officeId: snap.id, ...snap.data() } as Office) : null;
  },

  /**
   * Every active office — used by SignupView's office picker. Office docs
   * are intentionally public-readable (see firestore.rules) so a visitor
   * with no account yet can say which office they're applying to.
   */
  async listActive(): Promise<Office[]> {
    const snapshot = await getDocs(query(collection(db, 'offices'), where('isActive', '==', true)));
    return snapshot.docs.map((d) => ({ officeId: d.id, ...d.data() }) as Office);
  },
};

export type OfficesService = typeof officesService;
