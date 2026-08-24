# Ticket 04 — Recruitment leads + pipeline

**Status:** 📋 Planned
**Goal:** Replace the client's Google Docs lead sheet. Admins + TeamManagers create/view leads, move them through the pipeline, TeamMembers get read access to the list per the transcript ("echte gebruiker gewoon aan deze lijst kan").

## Scope

1. **`recruitment.service.ts`** — `list(officeId, { status? })`, `get(...)`, `create(officeId, payload)`, `updateStatus(officeId, leadId, status)`, `setInterviewOutcome(...)`.
2. **`recruitment.ts` Pinia store** — live subscription, grouped by pipeline stage for the funnel view.
3. **Pipeline stages** (FRD §13, confirmed by transcript): `NewLead → Contacted → InterviewPlanned → InterviewAttended|InterviewNoShow → Hired|Rejected`. Forward-only by default (client hasn't confirmed backwards moves — FRD §23).
4. **Views + components**
   - `views/recruitment/LeadListView.vue` — all roles read; admin/manager write
   - `views/recruitment/LeadDetailView.vue`
   - `components/recruitment/{LeadForm, LeadPipelineBadge, LeadsWeekBar}.vue` — `LeadsWeekBar` implements the "zoveel leads deze week" bar from the transcript, same visual primitive as the staffing bar in Ticket 03.
5. **Fields** — placeholder set until client's Google Doc is confirmed (FRD §23 Recruitment Q1-2, still open): name, phone, email, source, dateAdded, status, interviewDate, notes, outcome.
6. **Rules** — admin + manager read/write; member read-only.

## Acceptance

- Manager creates a lead → appears in list live
- Moving a lead through every pipeline stage updates its badge and the weekly bar count
- TeamMember can view the list, cannot edit
- 3+ store unit tests + 1+ rule spec

## FRD coverage

§12 (Recruitment Leads), §13 (Pipeline)

## Open questions (blocking exact field set)

- Client's current Google Doc fields — Stan to obtain (FRD §23 Recruitment Q1)
- Can leads move backwards through the pipeline?
- Who besides admin/manager can change status?
