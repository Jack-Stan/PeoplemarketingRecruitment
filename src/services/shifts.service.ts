import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { Shift, ShiftCreatePayload, ShiftPatch } from '@/types/shift';
import { weekStartFor } from '@/types/shift';

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

  /** A TeamMember's own week — draft/pending/approved for the week they're currently planning. */
  subscribeMineForWeek(
    officeId: string,
    employeeId: string,
    weekStart: string,
    onChange: (shifts: Shift[]) => void,
    onError: (err: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(
        shiftsCollection(officeId),
        where('assignedEmployeeId', '==', employeeId),
        where('weekStart', '==', weekStart),
      ),
      (snapshot) => {
        const shifts = snapshot.docs.map((d) => ({ shiftId: d.id, officeId, ...d.data() }) as Shift);
        onChange(shifts);
      },
      onError,
    );
  },

  async create(officeId: string, createdBy: string, payload: ShiftCreatePayload): Promise<string> {
    const ref = await addDoc(shiftsCollection(officeId), {
      ...payload,
      officeId,
      weekStart: weekStartFor(payload.date),
      createdBy,
      submittedAt: null,
      decidedAt: null,
      decidedBy: null,
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

  async remove(officeId: string, shiftId: string): Promise<void> {
    await deleteDoc(doc(db, 'offices', officeId, 'shifts', shiftId));
  },

  /**
   * "Submit my week" — decision 008. Flips every `draft` shift the caller
   * owns for the week to `pending` in one atomic write, well under the
   * 500-op batch limit for a single person's week. `nowMs` is passed in
   * (rather than read here) because workflow scripts and tests can't call
   * `Date.now()` themselves and stamping consistently matters more than
   * server-exactness for `submittedAt`.
   */
  async submitWeek(officeId: string, draftShiftIds: string[], nowMs: number): Promise<void> {
    if (!draftShiftIds.length) return;
    const batch = writeBatch(db);
    for (const shiftId of draftShiftIds) {
      batch.update(doc(db, 'offices', officeId, 'shifts', shiftId), {
        status: 'pending',
        submittedAt: nowMs,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  },
};

export type ShiftsService = typeof shiftsService;
