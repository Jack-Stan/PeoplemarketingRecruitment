import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { DateWindow } from '@/services/shifts.service';
import type { Availability, AvailabilityCreatePayload } from '@/types/availability';
import { weekStartFor } from '@/utils/date';

function availabilityCollection(officeId: string) {
  return collection(db, 'offices', officeId, 'availability');
}

/** Thin Firestore wrapper for availability — same shape as shifts.service. */
export const availabilityService = {
  /**
   * A TeamLeader/admin's office-wide view — isCoverageViewer in
   * firestore.rules. `window` bounds it to a date range (single-field range
   * on `date`, no composite index needed); without one this re-reads every
   * availability mark the office has ever had.
   */
  subscribe(
    officeId: string,
    onChange: (rows: Availability[]) => void,
    onError: (err: unknown) => void,
    window?: DateWindow,
  ): Unsubscribe {
    return onSnapshot(
      window
        ? query(
            availabilityCollection(officeId),
            where('date', '>=', window.from),
            where('date', '<', window.toExclusive),
          )
        : availabilityCollection(officeId),
      (snapshot) => {
        onChange(
          snapshot.docs.map(
            (d) => ({ availabilityId: d.id, officeId, ...d.data() }) as Availability,
          ),
        );
      },
      onError,
    );
  },

  /**
   * A TeamMember's own marks — matches shiftsService.subscribeForEmployee's
   * reasoning. Pass `weekStart` to bound it to the week being planned; two
   * equality filters need no composite index (same shape as
   * shiftsService.subscribeMineForWeek, which has run in production since
   * decision 008).
   */
  subscribeForEmployee(
    officeId: string,
    employeeId: string,
    onChange: (rows: Availability[]) => void,
    onError: (err: unknown) => void,
    weekStart?: string,
  ): Unsubscribe {
    return onSnapshot(
      weekStart
        ? query(
            availabilityCollection(officeId),
            where('employeeId', '==', employeeId),
            where('weekStart', '==', weekStart),
          )
        : query(availabilityCollection(officeId), where('employeeId', '==', employeeId)),
      (snapshot) => {
        onChange(
          snapshot.docs.map(
            (d) => ({ availabilityId: d.id, officeId, ...d.data() }) as Availability,
          ),
        );
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
