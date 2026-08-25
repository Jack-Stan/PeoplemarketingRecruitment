/**
 * FRD §19 — audit trail for sensitive admin/manager actions. Append-only by
 * design (see firestore.rules: create allowed, update/delete never) — an
 * audit log that anyone can edit isn't one.
 */
export type AuditAction =
  | 'shift_approved'
  | 'shift_rejected'
  | 'role_assigned'
  | 'employee_created'
  | 'employee_deactivated'
  | 'employee_reactivated'
  | 'user_deactivated'
  | 'user_reactivated'
  | 'user_deleted'
  | 'recruitment_stage_changed';

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  shift_approved: 'Shift goedgekeurd',
  shift_rejected: 'Shift afgewezen',
  role_assigned: 'Rol toegewezen',
  employee_created: 'Medewerker toegevoegd',
  employee_deactivated: 'Medewerker gedeactiveerd',
  employee_reactivated: 'Medewerker gereactiveerd',
  user_deactivated: 'Gebruiker gedeactiveerd',
  user_reactivated: 'Gebruiker gereactiveerd',
  user_deleted: 'Gebruiker verwijderd',
  recruitment_stage_changed: 'Rekrutering: fase gewijzigd',
};

export interface AuditLogEntry {
  entryId: string;
  officeId: string;
  actorUid: string;
  /** Denormalised at write time — an audit trail should stay readable even if the actor's account is later deleted. */
  actorEmail: string;
  action: AuditAction;
  /** Human-readable description of what was acted on, e.g. "Jan Peeters · 2026-08-25" or "Maria D. → Teammanager". */
  targetLabel: string;
  details: string | null;
  /** Client-stamped, consistent with createdAtMs elsewhere in this app (recruitmentLead, shift) — drives ordering/display. */
  createdAtMs: number;
}

export type AuditLogCreatePayload = Omit<AuditLogEntry, 'entryId' | 'officeId'>;
