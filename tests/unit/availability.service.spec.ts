import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({ db: {} }));

const setDocMock = vi.fn();
const getDocMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  deleteDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  onSnapshot: vi.fn(),
  query: vi.fn(() => ({})),
  serverTimestamp: vi.fn(),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  where: vi.fn(() => ({})),
}));

import { availabilityService } from '@/services/availability.service';
import type { AvailabilityCreatePayload } from '@/types/availability';

const PAYLOAD = {
  employeeId: 'emp-1',
  employeeName: 'Mia Member',
  employeeIsTeamLeader: false,
  date: '2026-09-28',
} as unknown as AvailabilityCreatePayload;

const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

describe('availabilityService.create', () => {
  beforeEach(() => {
    setDocMock.mockReset();
    getDocMock.mockReset();
  });

  it('writes the deterministic employeeId_date doc', async () => {
    setDocMock.mockResolvedValueOnce(undefined);
    await expect(availabilityService.create('office-main', PAYLOAD)).resolves.toBe('emp-1_2026-09-28');
    expect(getDocMock).not.toHaveBeenCalled();
  });

  // 2026-09-24 audit — setDoc on an existing id is an update, which the
  // rules deny; a day already marked from another tab must count as done.
  it('treats a denied write on an already-existing mark as success', async () => {
    setDocMock.mockRejectedValueOnce(denied());
    getDocMock.mockResolvedValueOnce({ exists: () => true });
    await expect(availabilityService.create('office-main', PAYLOAD)).resolves.toBe('emp-1_2026-09-28');
  });

  it('still rejects a denied write when no doc exists', async () => {
    setDocMock.mockRejectedValueOnce(denied());
    getDocMock.mockResolvedValueOnce({ exists: () => false });
    await expect(availabilityService.create('office-main', PAYLOAD)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects with the original denial when the re-read itself fails', async () => {
    setDocMock.mockRejectedValueOnce(denied());
    getDocMock.mockRejectedValueOnce(denied());
    await expect(availabilityService.create('office-main', PAYLOAD)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('does not swallow non-permission errors', async () => {
    setDocMock.mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }));
    await expect(availabilityService.create('office-main', PAYLOAD)).rejects.toMatchObject({ code: 'unavailable' });
    expect(getDocMock).not.toHaveBeenCalled();
  });
});
