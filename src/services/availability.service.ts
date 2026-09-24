import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
   * targets the same doc instead of creating a second row for the same day.
   *
   * On an existing doc `setDoc` is an UPDATE, which firestore.rules denies
   * (availability is presence-based: marking = create, unmarking = delete).
   * The store's isMarked guard only covers rows already in memory, so a mark
   * from a second tab or a stale snapshot hit that denial. The rule is right;
   * so on permission-denied, re-read the doc: if it exists the day is already
   * marked, which is what the caller wanted. A pre-write getDoc can't replace
   * this — a plain member may not read a doc that doesn't exist yet (the read
   * rule checks resource.data.employeeId), so it would deny every first mark. */
  async create(officeId: string, payload: AvailabilityCreatePayload): Promise<string> {
    const id = `${payload.employeeId}_${payload.date}`;
    const ref = doc(availabilityCollection(officeId), id);
    try {
      await setDoc(ref, {
        ...payload,
        weekStart: weekStartFor(payload.date),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      if ((err as { code?: string } | null)?.code !== 'permission-denied') throw err;
      let exists = false;
      try {
        exists = (await getDoc(ref)).exists();
      } catch {
        // Can't confirm it's already there — report the original denial.
      }
      if (!exists) throw err;
    }
    return id;
  },

  async remove(officeId: string, availabilityId: string): Promise<void> {
    await deleteDoc(doc(db, 'offices', officeId, 'availability', availabilityId));
  },
};

export type AvailabilityService = typeof availabilityService;
