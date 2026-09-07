# Decision 009 — Location coverage is gated on the `isTeamLeader` flag, not on role

**Date:** 2026-08-25 (shipped) — recorded retroactively 2026-09-07
**Status:** Accepted (documenting what already shipped)
**Deciders:** Stan, from the client's "teamleiders plan de zones" ask
**Related:** [[001-three-roles-not-two]], [[006-firestore-roles-no-claims]], [[2026-09-07-full-project-audit]]

## Context

The Location Manager (Leaflet map, canvassing zones, per-visit logging) shipped in the 2026-08-25→28
window with **no ticket, no decision note and no entry in `project-status.md`**. The authorization
model it introduced existed only as a comment inside `firestore.rules`. This note exists so the
decision is findable.

## Decision

Location and visit access is gated by a rules helper that is **orthogonal to the three roles**:

```
function isCoverageViewer(officeId) {
  return isStaffOf(officeId)
    || (sameOffice(officeId) && isActiveUser() && myProfile().isTeamLeader == true);
}
```

So a plain `TeamMember` cannot create or delete zones, but a `TeamMember` carrying the
`isTeamLeader: true` flag can — the same flag that already drives the team-leader headcount in the
staffing bar. Staff (Administrator, TeamManager) always pass.

## Why the flag and not a fourth role

[[001-three-roles-not-two]] fixed the role set at three, and a team leader is not a rank above
TeamMember — it is a per-shift/per-person marker the client already used. Adding `TeamLeader` as a
role would have forced every `role in [...]` check and the whole role ladder to be reworked, and
would have made a leader *lose* member abilities (own shifts, own availability). A boolean flag on
the existing role composes instead of replacing.

## Consequences

- The flag is now a **privilege**, not just a label. Anyone who can set `isTeamLeader` can grant zone
  write access. Rules restrict setting it to admins, and self-signup is forced to `isTeamLeader:false`
  (2026-09-01 review item B2).
- `isCoverageViewer` had **zero rules-test coverage** until 2026-09-07 — no test ever constructed a
  TeamMember with the flag set. Tests were added in the 2026-09-07 remediation round.
- Members can also bump a location's `timesVisited` counter. That write is deliberately narrow
  (`onlyVisitCounterChanged`) but cannot be coupled to the matching `visits` document by rules, so
  the counter is inflatable — coverage KPIs should be computed from `visits`, not the counter.
