import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';

import { shiftsService } from '@/services/shifts.service';
import { friendlyError } from '@/utils/errors';
import { timesOverlap, type Shift, type ShiftCreatePayload } from '@/types/shift';

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
  const draftIds = computed(() => shifts.value.filter((s) => s.status === 'draft').map((s) => s.shiftId));
  const byDate = computed(() => {
    const grouped = new Map<string, Shift[]>();
    for (const shift of [...shifts.value].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
      const bucket = grouped.get(shift.date) ?? [];
      bucket.push(shift);
      grouped.set(shift.date, bucket);
    }
    return grouped;
  });

  /** Staffing overview bar totals — client transcript's "40 shifts, 5 TL, 7 non-TL". */
  const staffingTotals = computed(() => {
    const tlIds = new Set(shifts.value.filter((s) => s.employeeIsTeamLeader).map((s) => s.assignedEmployeeId));
    const nonTlIds = new Set(shifts.value.filter((s) => !s.employeeIsTeamLeader).map((s) => s.assignedEmployeeId));
    return { shifts: shifts.value.length, teamLeaders: tlIds.size, nonTeamLeaders: nonTlIds.size };
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

  /** A TeamMember's current planning week — see shiftsService.subscribeMineForWeek. */
  function subscribeMineForWeek(officeId: string, employeeId: string, weekStart: string): void {
    unsubscribe();
    isLoading.value = true;
    unsub = shiftsService.subscribeMineForWeek(
      officeId,
      employeeId,
      weekStart,
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

  /**
   * ticket-03 defect #4 — no overlap check existed at all. Only checks
   * against whatever's currently loaded in `shifts`, which is exactly what
   * every caller (PlanningView's office-wide subscribe, MyPlanningView's
   * own-week subscribe) already has in view — good enough since Firestore
   * rules can't query other documents to enforce this server-side.
   */
  function hasOverlap(
    assignedEmployeeId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeShiftId?: string,
  ): boolean {
    return shifts.value.some(
      (s) =>
        s.shiftId !== excludeShiftId &&
        s.assignedEmployeeId === assignedEmployeeId &&
        s.date === date &&
        s.status !== 'rejected' &&
        timesOverlap(startTime, endTime, s.startTime, s.endTime),
    );
  }

  async function create(officeId: string, createdBy: string, payload: ShiftCreatePayload): Promise<boolean> {
    error.value = null;
    try {
      await shiftsService.create(officeId, createdBy, payload);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function remove(officeId: string, shiftId: string): Promise<boolean> {
    error.value = null;
    try {
      await shiftsService.remove(officeId, shiftId);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  /** "Submit my week" — batches every current draft to pending. See decisions/008. */
  async function submitWeek(officeId: string, nowMs: number): Promise<boolean> {
    error.value = null;
    try {
      await shiftsService.submitWeek(officeId, draftIds.value, nowMs);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function submitForApproval(officeId: string, shiftId: string): Promise<boolean> {
    return transition(officeId, shiftId, { status: 'pending' });
  }

  async function approve(officeId: string, shiftId: string, decidedBy: string, nowMs: number): Promise<boolean> {
    return transition(officeId, shiftId, {
      status: 'approved',
      rejectionReason: null,
      decidedBy,
      decidedAt: nowMs,
    });
  }

  async function reject(
    officeId: string,
    shiftId: string,
    reason: string,
    decidedBy: string,
    nowMs: number,
  ): Promise<boolean> {
    return transition(officeId, shiftId, {
      status: 'rejected',
      rejectionReason: reason,
      decidedBy,
      decidedAt: nowMs,
    });
  }

  async function transition(
    officeId: string,
    shiftId: string,
    patch: {
      status: Shift['status'];
      rejectionReason?: string | null;
      decidedBy?: string;
      decidedAt?: number;
    },
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
    draftIds,
    byDate,
    staffingTotals,
    subscribe,
    subscribeMine,
    subscribeMineForWeek,
    unsubscribe,
    hasOverlap,
    create,
    remove,
    submitWeek,
    submitForApproval,
    approve,
    reject,
  };
});
