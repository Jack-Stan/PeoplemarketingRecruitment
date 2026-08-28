import { weekStartFor } from '@/types/shift';

export { weekStartFor };

/**
 * Self-attested availability — separate from Shift on purpose. A shift is
 * "assigned to work"; availability is "could work" before anyone assigns
 * anything. Presence-based like a location visit log: a doc for
 * (employeeId, date) means "marked available that day", deleting it means
 * "not marked" — no separate boolean needed.
 */
export interface Availability {
  availabilityId: string;
  officeId: string;
  employeeId: string;
  employeeName: string;
  employeeIsTeamLeader: boolean;
  date: string; // ISO yyyy-MM-dd
  weekStart: string; // Monday of the ISO week, mirrors Shift.weekStart
}

export type AvailabilityCreatePayload = Omit<Availability, 'availabilityId' | 'officeId' | 'weekStart'>;
