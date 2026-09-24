import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { Office } from '@/types/office';

export const officesService = {
  /**
   * Every active office — used by SignupView's office picker. Office docs
   * are intentionally public-readable (see firestore.rules) so a visitor
   * with no account yet can say which office they're applying to.
   */
  async listActive(): Promise<Office[]> {
    const snapshot = await getDocs(query(collection(db, 'offices'), where('isActive', '==', true)));
    // Doc id wins: the `gent` doc also stores an `officeId: 'Gent'` field, and
    // spreading data last let that override the id — pickers then submitted
    // "Gent", which never matches primaryOfficeId "gent" (UsersView flagged
    // those signups as "ander kantoor").
    return snapshot.docs.map((d) => ({ ...d.data(), officeId: d.id }) as Office);
  },
};

export type OfficesService = typeof officesService;
