import type { Role } from './user';

export type EmploymentType = 'FullTime' | 'PartTime' | 'Flex';

export interface Employee {
  employeeId: string;
  officeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  isTeamLeader: boolean;
  weeklyContractHours: number | null;
  employmentType: EmploymentType;
  avatarUrl: string | null;
}

export type EmployeeCreatePayload = Omit<Employee, 'employeeId' | 'officeId'>;
export type EmployeePatch = Partial<Omit<Employee, 'employeeId' | 'officeId'>>;
