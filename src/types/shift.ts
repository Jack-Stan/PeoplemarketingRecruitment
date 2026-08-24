export type ShiftType = 'D2D' | 'Straat' | 'Event';
export type ShiftStatus = 'draft' | 'pending' | 'approved' | 'rejected';

/** Fixed hours per decision 004 — Event is free-text, left out here on purpose. */
export const FIXED_SHIFT_HOURS: Record<Exclude<ShiftType, 'Event'>, { start: string; end: string }> = {
  D2D: { start: '11:00', end: '19:00' },
  Straat: { start: '09:30', end: '17:00' },
};

export interface Shift {
  shiftId: string;
  officeId: string;
  assignedEmployeeId: string;
  date: string; // ISO yyyy-MM-dd
  type: ShiftType;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: ShiftStatus;
  rejectionReason: string | null;
}

export type ShiftCreatePayload = Omit<Shift, 'shiftId' | 'officeId'>;
export type ShiftPatch = Partial<Omit<Shift, 'shiftId' | 'officeId'>>;
