import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';

import { shiftsService } from '@/services/shifts.service';
import { friendlyError } from '@/utils/errors';
import type { Shift, ShiftCreatePayload } from '@/types/shift';

/**
 * Shifts store. State machine: draft -> pending -> approved | rejected.
 * Approve/reject are admin-only in `firestore.rules`; the store doesn't
 * re-check role here — it just calls `update` and lets the rules be the
 * source of truth, same as every other store in this app.
 */
export const useShiftsStore = defineStore('shifts', () => {
  const shifts = ref<Shift[]>([]);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  let unsub: Unsubscribe | null = null;

  const pending = computed(() => shifts.value.filter((s) => s.status === 'pending'));
  const byDate = computed(() => {
    const grouped = new Map<string, Shift[]>();
    for (const shift of [...shifts.value].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
      const bucket = grouped.get(shift.date) ?? [];
      bucket.push(shift);
      grouped.set(shift.date, bucket);
    }
    return grouped;
  });

  function subscribe(officeId: string): void {
    unsubscribe();
    isLoading.value = true;
    unsub = shiftsService.subscribe(
      officeId,
      (list) => {
        shifts.value = list;
        isLoading.value = false;
        error.value = null;
      },
      (err) => {
        error.value = friendlyError(err);
        isLoading.value = false;
      },
    );
  }

  /** A TeamMember's own dashboard/history — see shiftsService.subscribeForEmployee. */
  function subscribeMine(officeId: string, employeeId: string): void {
    unsubscribe();
    isLoading.value = true;
    unsub = shiftsService.subscribeForEmployee(
      officeId,
      employeeId,
      (list) => {
        shifts.value = list;
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

  async function create(officeId: string, payload: ShiftCreatePayload): Promise<boolean> {
    error.value = null;
    try {
      await shiftsService.create(officeId, payload);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function submitForApproval(officeId: string, shiftId: string): Promise<boolean> {
    return transition(officeId, shiftId, { status: 'pending' });
  }

  async function approve(officeId: string, shiftId: string): Promise<boolean> {
    return transition(officeId, shiftId, { status: 'approved', rejectionReason: null });
  }

  async function reject(officeId: string, shiftId: string, reason: string): Promise<boolean> {
    return transition(officeId, shiftId, { status: 'rejected', rejectionReason: reason });
  }

  async function transition(
    officeId: string,
    shiftId: string,
    patch: { status: Shift['status']; rejectionReason?: string | null },
  ): Promise<boolean> {
    error.value = null;
    try {
      await shiftsService.update(officeId, shiftId, patch);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  return {
    shifts,
    isLoading,
    error,
    pending,
    byDate,
    subscribe,
    subscribeMine,
    unsubscribe,
    create,
    submitForApproval,
    approve,
    reject,
  };
});
