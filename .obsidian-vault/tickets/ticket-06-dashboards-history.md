# Ticket 06 — Admin dashboard + historical reporting

**Status:** 📋 Planned
**Goal:** Cross-module KPI dashboard (FRD §16) + historical trend views (FRD §11, §17), including the client's team-leader-headcount-over-time ask from the transcript.

## Scope

1. **`periods.service.ts`** — read-only from client (writes happen via a scheduled Cloud Function that snapshots each week/month once closed — FRD §11 "retain previous planning rather than replacing it").
2. **Dashboard aggregation** — client explicitly wants segmented-bar visualizations, not just numbers: staffing bar ("40 shifts, 5 TL, 7 non-TL") and leads-this-week bar. Reuse `LeadsWeekBar`-style component from Ticket 04 for a `StaffingBar` here.
3. **Views**
   - `views/DashboardView.vue` (already scaffolded, currently placeholder) — wire real aggregates
   - `views/HistoryView.vue` (already scaffolded) — period picker + TL headcount trend line + staffing/recruitment history tables
4. **Metric definition** — FRD §10 flags an ambiguity explicitly: "7 Team Leaders this week" could mean unique TLs worked vs. TL-shifts scheduled. **Must confirm with client before building** — pick the wrong one and the whole dashboard is wrong on day one.

## Acceptance

- Dashboard shows today's staffing bar + this-week leads bar, both live
- History view lets admin pick a past week/month and see TL headcount trend
- Clicking a dashboard number (e.g. "3 Team Leaders") drills into the underlying employee list (FRD §16 explicit ask)

## FRD coverage

§10, §11, §14, §15, §16, §17

## Open questions

- Metric definition: unique TLs vs. TL-shifts (FRD §10, blocking)
- Exact "quality report" definition for recruitment (FRD §15, blocking for that half of this ticket)
