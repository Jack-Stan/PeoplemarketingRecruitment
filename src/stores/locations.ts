import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';

import { locationsService } from '@/services/locations.service';
import { friendlyError } from '@/utils/errors';
import type {
  Location,
  LocationCreatePayload,
  LocationPatch,
  LocationVisit,
  LocationVisitCreatePayload,
} from '@/types/location';

export const useLocationsStore = defineStore('locations', () => {
  const locations = ref<Location[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  let unsub: Unsubscribe | null = null;

  const visits = ref<LocationVisit[]>([]);
  let visitsUnsub: Unsubscribe | null = null;

  function subscribe(officeId: string): void {
    unsubscribe();
    isLoading.value = true;
    unsub = locationsService.subscribe(
      officeId,
      (list) => {
        locations.value = list;
        isLoading.value = false;
        error.value = null;
      },
      (err) => {
        error.value = friendlyError(err);
        isLoading.value = false;
      },
    );
  }

  function unsubscribe(): void {
    unsub?.();
    unsub = null;
  }

  function subscribeVisits(officeId: string, locationId: string): void {
    unsubscribeVisits();
    visitsUnsub = locationsService.subscribeVisits(
      officeId,
      locationId,
      (list) => (visits.value = list),
      (err) => (error.value = friendlyError(err)),
    );
  }

  function unsubscribeVisits(): void {
    visitsUnsub?.();
    visitsUnsub = null;
    visits.value = [];
  }

  async function create(officeId: string, payload: LocationCreatePayload): Promise<boolean> {
    error.value = null;
    try {
      await locationsService.create(officeId, payload);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function update(officeId: string, locationId: string, patch: LocationPatch): Promise<boolean> {
    error.value = null;
    try {
      await locationsService.update(officeId, locationId, patch);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function remove(officeId: string, locationId: string): Promise<boolean> {
    error.value = null;
    try {
      await locationsService.remove(officeId, locationId);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function logVisit(officeId: string, locationId: string, payload: LocationVisitCreatePayload): Promise<boolean> {
    error.value = null;
    try {
      await locationsService.logVisit(officeId, locationId, payload);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  return {
    locations,
    isLoading,
    error,
    visits,
    subscribe,
    unsubscribe,
    subscribeVisits,
    unsubscribeVisits,
    create,
    update,
    remove,
    logVisit,
  };
});
