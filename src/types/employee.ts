import type { Functie, Role } from './user';

export type EmploymentType = 'FullTime' | 'PartTime' | 'Flex';

export interface Employee {
  employeeId: string;
  officeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  /**
   * Roster mirror of the user doc's functie (same reason role/isTeamLeader
   * are mirrored: a TeamManager can't read other people's /users docs).
   * Optional — docs from before the field existed don't have it.
   */
  functie?: Functie | null;
  isActive: boolean;
  isTeamLeader: boolean;
  weeklyContractHours: number | null;
  employmentType: EmploymentType;
  avatarUrl: string | null;
}

export type EmployeeCreatePayload = Omit<Employee, 'employeeId' | 'officeId'>;
export type EmployeePatch = Partial<Omit<Employee, 'employeeId' | 'officeId'>>;
