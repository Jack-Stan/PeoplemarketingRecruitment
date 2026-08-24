import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { Shift, ShiftCreatePayload, ShiftPatch } from '@/types/shift';

function shiftsCollection(officeId: string) {
  return collection(db, 'offices', officeId, 'shifts');
}

/**
 * Thin Firestore wrapper for shifts. Status transitions (submit/approve/reject)
 * are all just `update` calls with a new `status` — the state machine itself
 * lives in the store, this layer stays dumb on purpose.
 */
export const shiftsService = {
  subscribe(
    officeId: string,
    onChange: (shifts: Shift[]) => void,
    onError: (err: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(
      shiftsCollection(officeId),
      (snapshot) => {
        const shifts = snapshot.docs.map((d) => ({ shiftId: d.id, officeId, ...d.data() }) as Shift);
        onChange(shifts);
      },
      onError,
    );
  },

  /**
   * A plain `subscribe(officeId)` collection read (no `where`) is denied
   * outright for a TeamMember — Firestore rules validate per-document, and
   * an unfiltered query can't prove every result satisfies "only your own
   * shifts", so it fails the whole query rather than filtering it. This
   * query constrains to `assignedEmployeeId == employeeId` up front, which
   * does satisfy the rule and is what a TeamMember's own dashboard/history
   * must use instead of `subscribe`.
   */
  subscribeForEmployee(
    officeId: string,
    employeeId: string,
    onChange: (shifts: Shift[]) => void,
    onError: (err: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(shiftsCollection(officeId), where('assignedEmployeeId', '==', employeeId)),
      (snapshot) => {
        const shifts = snapshot.docs.map((d) => ({ shiftId: d.id, officeId, ...d.data() }) as Shift);
        onChange(shifts);
      },
      onError,
    );
  },

  async create(officeId: string, payload: ShiftCreatePayload): Promise<string> {
    const ref = await addDoc(shiftsCollection(officeId), {
      ...payload,
      officeId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(officeId: string, shiftId: string, patch: ShiftPatch): Promise<void> {
    await updateDoc(doc(db, 'offices', officeId, 'shifts', shiftId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  },
};

export type ShiftsService = typeof shiftsService;
