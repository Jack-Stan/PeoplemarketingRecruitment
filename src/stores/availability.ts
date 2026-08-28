import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';

import { availabilityService } from '@/services/availability.service';
import { friendlyError } from '@/utils/errors';
import type { Availability, AvailabilityCreatePayload } from '@/types/availability';

export const useAvailabilityStore = defineStore('availability', () => {
  const rows = ref<Availability[]>([]);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  let unsub: Unsubscribe | null = null;

  const byDate = computed(() => {
    const grouped = new Map<string, Availability[]>();
    for (const row of rows.value) {
      const bucket = grouped.get(row.date) ?? [];
      bucket.push(row);
      grouped.set(row.date, bucket);
    }
    return grouped;
  });

  function subscribe(officeId: string): void {
    unsubscribe();
    isLoading.value = true;
    unsub = availabilityService.subscribe(
      officeId,
      (list) => {
        rows.value = list;
        isLoading.value = false;
        error.value = null;
      },
      (err) => {
        error.value = friendlyError(err);
        isLoading.value = false;
      },
    );
  }

  function subscribeMine(officeId: string, employeeId: string): void {
    unsubscribe();
    isLoading.value = true;
    unsub = availabilityService.subscribeForEmployee(
      officeId,
      employeeId,
      (list) => {
        rows.value = list;
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

  function isMarked(employeeId: string, date: string): Availability | undefined {
    return rows.value.find((r) => r.employeeId === employeeId && r.date === date);
  }

  async function mark(officeId: string, payload: AvailabilityCreatePayload): Promise<boolean> {
    error.value = null;
    try {
      await availabilityService.create(officeId, payload);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function unmark(officeId: string, availabilityId: string): Promise<boolean> {
    error.value = null;
    try {
      await availabilityService.remove(officeId, availabilityId);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  return { rows, isLoading, error, byDate, subscribe, subscribeMine, unsubscribe, isMarked, mark, unmark };
});
