export type ShiftType = 'D2D' | 'Straat' | 'Event';
export type ShiftStatus = 'draft' | 'pending' | 'approved' | 'rejected';

/** Fixed hours per decision 004 — Event is free-text, left out here on purpose. */
export const FIXED_SHIFT_HOURS: Record<Exclude<ShiftType, 'Event'>, { start: string; end: string }> = {
  D2D: { start: '11:00', end: '19:00' },
  Straat: { start: '09:30', end: '17:00' },
};

/** Monday of the ISO week containing `date` (yyyy-MM-dd in, yyyy-MM-dd out). */
export function weekStartFor(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export interface Shift {
  shiftId: string;
  officeId: string;
  assignedEmployeeId: string;
  date: string; // ISO yyyy-MM-dd
  /** Monday of the week this shift belongs to — decision 008, drives weekly submit + the approval queue grouping. */
  weekStart: string;
  type: ShiftType;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: ShiftStatus;
  rejectionReason: string | null;

  /**
   * Denormalised at create time — decision 008 / ticket-03 §2. A TeamMember
   * cannot read the roster (rules deny an unfiltered `/employees` query), so
   * a planner needs the name on the shift itself. `employeeIsTeamLeader` is a
   * point-in-time snapshot on purpose: the staffing bar's TL headcount trend
   * would silently rewrite history if it read the roster live instead.
   */
  employeeName: string;
  employeeIsTeamLeader: boolean;

  /** Event-only free text; null for D2D/Straat. */
  eventTitle: string | null;
  location: string | null;
  notes: string | null;

  /** Who drafted this — an admin's draft vs a member's own plan, for FRD §9's self-approval question. */
  createdBy: string;
  submittedAt: number | null; // epoch ms, client-set (see shifts.service submitWeek)
  decidedAt: number | null;
  decidedBy: string | null;

  /** Reserved for the committed-but-not-built Google Calendar sync on Event shifts (decision 004 update). */
  calendarEventId: string | null;
}

/** Simple half-open interval overlap check on "HH:mm" strings — string compare works since they're zero-padded. */
export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export type ShiftCreatePayload = Omit<
  Shift,
  'shiftId' | 'officeId' | 'weekStart' | 'createdBy' | 'submittedAt' | 'decidedAt' | 'decidedBy'
>;
export type ShiftPatch = Partial<Omit<Shift, 'shiftId' | 'officeId'>>;
