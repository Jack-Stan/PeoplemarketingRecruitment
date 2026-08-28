import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where, type Unsubscribe } from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { Availability, AvailabilityCreatePayload } from '@/types/availability';
import { weekStartFor } from '@/types/availability';

function availabilityCollection(officeId: string) {
  return collection(db, 'offices', officeId, 'availability');
}

/** Thin Firestore wrapper for availability — same shape as shifts.service. */
export const availabilityService = {
  /** A TeamLeader/admin's office-wide view — isCoverageViewer in firestore.rules. */
  subscribe(officeId: string, onChange: (rows: Availability[]) => void, onError: (err: unknown) => void): Unsubscribe {
    return onSnapshot(
      availabilityCollection(officeId),
      (snapshot) => {
        onChange(snapshot.docs.map((d) => ({ availabilityId: d.id, officeId, ...d.data() }) as Availability));
      },
      onError,
    );
  },

  /** A TeamMember's own marks — matches shiftsService.subscribeForEmployee's reasoning. */
  subscribeForEmployee(
    officeId: string,
    employeeId: string,
    onChange: (rows: Availability[]) => void,
    onError: (err: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(availabilityCollection(officeId), where('employeeId', '==', employeeId)),
      (snapshot) => {
        onChange(snapshot.docs.map((d) => ({ availabilityId: d.id, officeId, ...d.data() }) as Availability));
      },
      onError,
    );
  },

  /** Deterministic id (employeeId_date) — a duplicate mark() call (double-click, two tabs)
   * overwrites the same doc instead of creating a second row for the same day. */
  async create(officeId: string, payload: AvailabilityCreatePayload): Promise<string> {
    const id = `${payload.employeeId}_${payload.date}`;
    await setDoc(doc(availabilityCollection(officeId), id), {
      ...payload,
      weekStart: weekStartFor(payload.date),
      createdAt: serverTimestamp(),
    });
    return id;
  },

  async remove(officeId: string, availabilityId: string): Promise<void> {
    await deleteDoc(doc(db, 'offices', officeId, 'availability', availabilityId));
  },
};

export type AvailabilityService = typeof availabilityService;
