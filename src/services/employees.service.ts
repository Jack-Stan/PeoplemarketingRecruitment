import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/services/firebase';
import type { Employee, EmployeeCreatePayload, EmployeePatch } from '@/types/employee';
import type { Role } from '@/types/user';

function employeesCollection(officeId: string) {
  return collection(db, 'offices', officeId, 'employees');
}

/**
 * Thin Firestore wrapper for the employee roster. Mirrors `authService` —
 * no business logic here, that lives in the store. Live reads go through
 * `subscribe`; writes are one-shot promises.
 */
export const employeesService = {
  subscribe(
    officeId: string,
    onChange: (employees: Employee[]) => void,
    onError: (err: unknown) => void,
  ): Unsubscribe {
    return onSnapshot(
      employeesCollection(officeId),
      (snapshot) => {
        const employees = snapshot.docs.map(
          (d) => ({ employeeId: d.id, officeId, ...d.data() }) as Employee,
        );
        onChange(employees);
      },
      onError,
    );
  },

  /**
   * The employee doc ID **is** the Auth uid — never an auto-generated one
   * (decisions/007). `firestore.rules` checks `request.auth.uid == employeeId`
   * for a member reading their own roster entry, and
   * `resource.data.assignedEmployeeId == request.auth.uid` for their own
   * shifts; an `addDoc` random ID can never satisfy either, so an employee
   * created that way is invisible to the person it represents.
   *
   * Consequence: adding someone to the roster requires them to have an
   * account first. That's the Users page's job (`/users/{uid}`) — this is
   * "promote an existing account to staff", not "type a name into a list".
   */
  async create(officeId: string, uid: string, payload: EmployeeCreatePayload): Promise<string> {
    const ref = doc(db, 'offices', officeId, 'employees', uid);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      throw new Error('That account is already on this office roster.');
    }
    await setDoc(ref, {
      ...payload,
      employeeId: uid,
      officeId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return uid;
  },

  async update(officeId: string, employeeId: string, patch: EmployeePatch): Promise<void> {
    await updateDoc(doc(db, 'offices', officeId, 'employees', employeeId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  },

  /** Soft delete only — never hard-delete, history must be preserved (FRD §6). */
  async setActive(officeId: string, employeeId: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(db, 'offices', officeId, 'employees', employeeId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * `/users/{uid}` is the only place role/isTeamLeader are ever assigned
   * (UsersView, decisions/006) — the roster's copy of those two fields exists
   * only because `firestore.rules` denies a TeamManager reading other
   * people's `/users` docs, so shift-stamping and the roster UI need a
   * same-office-readable copy to work from. Call this right after
   * `usersService.assignRole` so that copy never drifts from the real
   * source. Best-effort: a no-op if the person isn't on this office's roster
   * (yet) — nothing to keep in sync until `employeesService.create` runs.
   */
  async syncRoleAndTeamLeader(
    officeId: string,
    employeeId: string,
    role: Role,
    isTeamLeader: boolean,
  ): Promise<void> {
    const ref = doc(db, 'offices', officeId, 'employees', employeeId);
    const existing = await getDoc(ref);
    if (!existing.exists()) return;
    await updateDoc(ref, { role, isTeamLeader, updatedAt: serverTimestamp() });
  },
};

export type EmployeesService = typeof employeesService;
