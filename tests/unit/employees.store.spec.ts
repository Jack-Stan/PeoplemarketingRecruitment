import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/services/employees.service', () => ({
  employeesService: {
    subscribe: vi.fn(() => () => {}),
    create: vi.fn(),
    update: vi.fn(),
    setActive: vi.fn(),
  },
}));

import { employeesService } from '@/services/employees.service';
import { useEmployeesStore } from '@/stores/employees';
import type { Employee } from '@/types/employee';

const EMP_ADMIN: Employee = {
  employeeId: 'e1',
  officeId: 'office-main',
  firstName: 'Big',
  lastName: 'Boss',
  email: 'boss@peoplemarketing.nl',
  phone: null,
  role: 'Administrator',
  isActive: true,
  isTeamLeader: true,
  weeklyContractHours: 40,
  employmentType: 'FullTime',
  avatarUrl: null,
};

const EMP_INACTIVE: Employee = {
  ...EMP_ADMIN,
  employeeId: 'e2',
  email: 'gone@peoplemarketing.nl',
  isActive: false,
  isTeamLeader: false,
};

describe('employees store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('starts empty', () => {
    const store = useEmployeesStore();
    expect(store.employees).toEqual([]);
    expect(store.activeEmployees).toEqual([]);
    expect(store.teamLeaders).toEqual([]);
  });

  it('subscribe populates employees from the live callback', () => {
    vi.mocked(employeesService.subscribe).mockImplementationOnce((_officeId, onChange) => {
      onChange([EMP_ADMIN, EMP_INACTIVE]);
      return () => {};
    });

    const store = useEmployeesStore();
    store.subscribe('office-main');

    expect(store.employees).toHaveLength(2);
    expect(store.activeEmployees).toEqual([EMP_ADMIN]);
    expect(store.teamLeaders).toEqual([EMP_ADMIN]);
    expect(store.isLoading).toBe(false);
  });

  it('subscribe surfaces a friendly error via the onError callback', () => {
    vi.mocked(employeesService.subscribe).mockImplementationOnce((_officeId, _onChange, onError) => {
      onError(Object.assign(new Error('nope'), { code: 'permission-denied' }));
      return () => {};
    });

    const store = useEmployeesStore();
    store.subscribe('office-main');

    expect(store.error).toMatch(/permission/i);
  });

  it('create keys the employee doc by the Auth uid (decisions/007)', async () => {
    vi.mocked(employeesService.create).mockResolvedValueOnce('uid-123');

    const store = useEmployeesStore();
    const ok = await store.create('office-main', 'uid-123', {
      firstName: 'New',
      lastName: 'Hire',
      email: 'new@peoplemarketing.nl',
      phone: null,
      role: 'TeamMember',
      isActive: true,
      isTeamLeader: false,
      weeklyContractHours: 20,
      employmentType: 'PartTime',
      avatarUrl: null,
    });

    expect(ok).toBe(true);
    expect(employeesService.create).toHaveBeenCalledWith(
      'office-main',
      'uid-123',
      expect.objectContaining({ email: 'new@peoplemarketing.nl' }),
    );
  });

  it('create surfaces the service error and returns false', async () => {
    vi.mocked(employeesService.create).mockRejectedValueOnce(
      new Error('That account is already on this office roster.'),
    );

    const store = useEmployeesStore();
    const ok = await store.create('office-main', 'uid-123', {
      firstName: 'Dupe',
      lastName: 'Hire',
      email: 'dupe@peoplemarketing.nl',
      phone: null,
      role: 'TeamMember',
      isActive: true,
      isTeamLeader: false,
      weeklyContractHours: null,
      employmentType: 'Flex',
      avatarUrl: null,
    });

    expect(ok).toBe(false);
    expect(store.error).toMatch(/already on this office roster/i);
  });

  it('setActive soft-disables via the service', async () => {
    vi.mocked(employeesService.setActive).mockResolvedValueOnce(undefined);

    const store = useEmployeesStore();
    const ok = await store.setActive('office-main', 'e1', false);

    expect(ok).toBe(true);
    expect(employeesService.setActive).toHaveBeenCalledWith('office-main', 'e1', false);
  });

  it('unsubscribe calls the stored unsubscribe function', () => {
    const unsubFn = vi.fn();
    vi.mocked(employeesService.subscribe).mockReturnValueOnce(unsubFn);

    const store = useEmployeesStore();
    store.subscribe('office-main');
    store.unsubscribe();

    expect(unsubFn).toHaveBeenCalled();
  });
});
