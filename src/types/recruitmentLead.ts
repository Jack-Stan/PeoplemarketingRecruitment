/**
 * Recruitment pipeline stages — FRD §13 (New Lead → Contacted → Interview →
 * Attended/No-Show → Hired/Rejected) reconciled with the client transcript's
 * own Dutch stage names (aangenomen / niet aangenomen / op sollicitatie
 * gekomen / niet op sollicitatie gekomen — see
 * meetings/2026-08-24-client-transcript-shifts-recruitment.md). Stage VALUES
 * stay in English/snake_case (internal identifiers); only their on-screen
 * labels are Dutch — same split as Role values vs role labels elsewhere.
 */
export type LeadStage =
  | 'new'
  | 'contacted'
  | 'interview_planned'
  | 'attended'
  | 'no_show'
  | 'hired'
  | 'rejected';

export const LEAD_STAGES: LeadStage[] = [
  'new',
  'contacted',
  'interview_planned',
  'attended',
  'no_show',
  'hired',
  'rejected',
];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: 'Nieuw',
  contacted: 'Gecontacteerd',
  interview_planned: 'Sollicitatie gepland',
  attended: 'Op sollicitatie gekomen',
  no_show: 'Niet op sollicitatie gekomen',
  hired: 'Aangenomen',
  rejected: 'Niet aangenomen',
};

/** Stages a funnel considers "still open" — used for the weekly leads bar and simple counts. */
export const OPEN_LEAD_STAGES: LeadStage[] = ['new', 'contacted', 'interview_planned'];

export type LeadSource = 'WhatsApp' | 'Instagram' | 'Website' | 'Doorverwijzing' | 'Anders';

export interface RecruitmentLead {
  leadId: string;
  officeId: string;
  name: string;
  age: number | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  stage: LeadStage;
  notes: string | null;
  /**
   * Employee who signed this lead up on the street — the attribution the
   * client asked for in meetings/2026-08-25-client-callback-new-asks.md (§3),
   * and the key per-recruiter analytics will group by. Holds an
   * `employeeId` (= uid, see decisions/007). Distinct from `createdBy`, which
   * is whoever typed the lead into the CRM — often the same person, but not
   * always. Null for street-recruit-agnostic leads (Website, Instagram) and
   * for docs created before the field existed.
   */
  recruitedBy: string | null;
  createdBy: string;
  /** Epoch ms, client-stamped at create time — drives the "leads this week" bar. */
  createdAtMs: number;
}

export type RecruitmentLeadCreatePayload = Omit<RecruitmentLead, 'leadId' | 'officeId' | 'createdAtMs' | 'age'> & {
  age: number;
};
export type RecruitmentLeadPatch = Partial<Omit<RecruitmentLead, 'leadId' | 'officeId'>>;
