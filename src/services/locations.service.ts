import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/services/firebase';
import type {
  Location,
  LocationCreatePayload,
  LocationPatch,
  LocationVisit,
  LocationVisitCreatePayload,
} from '@/types/location';

export const locationsService = {
  subscribe(officeId: string, onChange: (list: Location[]) => void, onError: (err: unknown) => void): Unsubscribe {
    return onSnapshot(
      collection(db, 'offices', officeId, 'locations'),
      (snapshot) =>
        onChange(
          snapshot.docs.map((d) => ({ locationId: d.id, officeId, ...d.data() }) as Location),
        ),
      onError,
    );
  },

  async create(officeId: string, payload: LocationCreatePayload): Promise<void> {
    await addDoc(collection(db, 'offices', officeId, 'locations'), {
      ...payload,
      timesVisited: 0,
      lastVisitedAt: null,
    });
  },

  async update(officeId: string, locationId: string, patch: LocationPatch): Promise<void> {
    await updateDoc(doc(db, 'offices', officeId, 'locations', locationId), patch);
  },

  async remove(officeId: string, locationId: string): Promise<void> {
    await deleteDoc(doc(db, 'offices', officeId, 'locations', locationId));
  },

  subscribeVisits(
    officeId: string,
    locationId: string,
    onChange: (visits: LocationVisit[]) => void,
    onError: (err: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(collection(db, 'offices', officeId, 'locations', locationId, 'visits'), orderBy('visitedAt', 'desc')),
      (snapshot) =>
        onChange(snapshot.docs.map((d) => ({ visitId: d.id, locationId, ...d.data() }) as LocationVisit)),
      onError,
    );
  },

  /**
   * Logs a visit and bumps the parent location's denormalised
   * `timesVisited`/`lastVisitedAt` counters in one batch, so the list view
   * never has to fan out a read per location to show "visited 4x".
   */
  async logVisit(officeId: string, locationId: string, payload: LocationVisitCreatePayload): Promise<void> {
    const batch = writeBatch(db);
    const visitRef = doc(collection(db, 'offices', officeId, 'locations', locationId, 'visits'));
    batch.set(visitRef, payload);
    batch.update(doc(db, 'offices', officeId, 'locations', locationId), {
      timesVisited: increment(1),
      lastVisitedAt: payload.visitedAt,
    });
    await batch.commit();
  },
};

export type LocationsService = typeof locationsService;
