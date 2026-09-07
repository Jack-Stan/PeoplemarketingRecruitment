# Decision 009 — Street-lead status is a separate axis, not a simplified pipeline

**Date:** 2026-09-06
**Status:** ✅ Accepted (Stan, 2026-09-06) and implemented — option A.
**Context:** `meetings/2026-08-25-client-callback-new-asks.md` §3

## Context

The client asked for per-person data on street-recruited leads: analytics, a status of
`no show | planned | hired`, and a link to whoever signed them up. The attribution half
(`recruitedBy`) shipped in #2. The status half was deliberately held because the three states the
client named overlap the seven-stage pipeline already in `LeadStage`:

| Client's word | Nearest existing stage |
|---|---|
| planned | `interview_planned` |
| no show | `no_show` |
| hired | `hired` |

That overlap admits two incompatible readings, and they produce different products:

**A. A separate status for street leads** — the pipeline stays as-is; street signups additionally
carry their own three-state outcome.

**B. Simplify the whole funnel to three states** — `LeadStage` collapses to the client's three,
and `LeadStage`'s other four values disappear.

Building B when the client meant A means throwing away a working funnel, `LEAD_STAGE_LABELS`, the
stage filter tabs, `qualityStats`, and `funnelCounts`. Building A when they meant B means shipping
a second status nobody wanted. Neither is cheap to undo, so it was raised rather than guessed.

## Decision

**Option A.** Stan confirmed 2026-09-06: *"Its a different status for street leads."*

`StreetLeadStatus` (`planned | no_show | hired`) is a new type, and `RecruitmentLead.streetStatus`
holds it, nullable. `LeadStage` is untouched. `no_show` and `hired` therefore exist in both types
with deliberately different meanings — in `StreetLeadStatus` they describe what happened to a
street signup, in `LeadStage` they describe the interview outcome.

A lead is "street-recruited" iff `recruitedBy` is set. That's the marker the UI keys off: only such
leads get a street-status control, and only they appear in per-recruiter analytics.

## Consequences

- `byRecruiterPerformance` groups by `recruitedBy` and counts `streetStatus`, never `stage`.
- The hire percentage is over *decided* signups (`hired + no_show`). Leads still `planned` or with
  no status yet are reported in their own columns instead of being folded into the denominator,
  where they would understate every recruiter early in a week.
- Street-status changes are audit-logged (`recruitment_street_status_changed`) like stage changes.

## Known hazard — the two axes can disagree

Nothing keeps `stage` and `streetStatus` in sync. A lead can read `stage: rejected` and
`streetStatus: hired` at the same time, and no code stops it — that is inherent to option A, not an
oversight in the implementation. Both are shown in the leads table so a contradiction is at least
visible to whoever is looking.

If that divergence turns out to bite in practice, the options are to derive one from the other
(which collapses back toward option B) or to add a reconciliation rule. **Neither should be built
without asking the client first** — the same trap this decision exists to avoid.
