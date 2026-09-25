import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { Invite } from '@/types/invite';

/** Admin-only record of sent invite links — see types/invite.ts. */
export const invitesService = {
  subscribeAll(onChange: (invites: Invite[]) => void, onError: (err: unknown) => void): Unsubscribe {
    return onSnapshot(
      collection(db, 'invites'),
      (snapshot) => onChange(snapshot.docs.map((d) => d.data() as Invite)),
      onError,
    );
  },

  /** Doc id is the lowercased email, so re-sending just bumps `invitedAt`. */
  async record(email: string, officeId: string, invitedBy: string): Promise<void> {
    await setDoc(doc(db, 'invites', email.toLowerCase()), {
      email,
      officeId,
      invitedBy,
      invitedAt: serverTimestamp(),
    });
  },

  async remove(email: string): Promise<void> {
    await deleteDoc(doc(db, 'invites', email.toLowerCase()));
  },
};
