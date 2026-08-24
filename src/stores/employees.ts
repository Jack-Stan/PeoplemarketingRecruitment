import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';

import { employeesService } from '@/services/employees.service';
import { friendlyError } from '@/utils/errors';
import type { Employee, EmployeeCreatePayload, EmployeePatch } from '@/types/employee';

/**
 * Employee roster store. Lives off a `onSnapshot` subscription started by
 * `subscribe(officeId)` — call it once (e.g. in EmployeeListView's onMounted)
 * and `unsubscribe()` on unmount to avoid leaking listeners across views.
 */
export const useEmployeesStore = defineStore('employees', () => {
  const employees = ref<Employee[]>([]);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  let unsub: Unsubscribe | null = null;

  const activeEmployees = computed(() => employees.value.filter((e) => e.isActive));
  const teamLeaders = computed(() => activeEmployees.value.filter((e) => e.isTeamLeader));

  function subscribe(officeId: string): void {
    unsubscribe();
    isLoading.value = true;
    unsub = employeesService.subscribe(
      officeId,
      (list) => {
        employees.value = list;
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

  /** `uid` is the employee doc ID — see decisions/007 and employeesService.create. */
  async function create(officeId: string, uid: string, payload: EmployeeCreatePayload): Promise<boolean> {
    error.value = null;
    try {
      await employeesService.create(officeId, uid, payload);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function update(officeId: string, employeeId: string, patch: EmployeePatch): Promise<boolean> {
    error.value = null;
    try {
      await employeesService.update(officeId, employeeId, patch);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  async function setActive(officeId: string, employeeId: string, isActive: boolean): Promise<boolean> {
    error.value = null;
    try {
      await employeesService.setActive(officeId, employeeId, isActive);
      return true;
    } catch (err) {
      error.value = friendlyError(err);
      return false;
    }
  }

  return {
    employees,
    isLoading,
    error,
    activeEmployees,
    teamLeaders,
    subscribe,
    unsubscribe,
    create,
    update,
    setActive,
  };
});
