# Decision 008 — Self-service shift signup: employees create their own shifts, not "claim open slots"

**Date:** 2026-08-24 (third session, data-model pass)
**Status:** ✅ Accepted (Stan, 2026-08-24) and implemented — option A.
**Blocked on:** `decisions/007` (a member can't self-assign until `employeeId == uid` holds)

## Context

Stan asked mid-session-2 for a worker/student view: see available shifts, sign up, see history of
shifts taken/completed. It was deliberately not built because the model only supports
"admin/manager assigns an employee to a shift". Session 2 framed the gap as *"we need an open/
unassigned shift concept"*. **That framing is probably wrong** — re-reading the client transcript:

> **Weekly cycle**: employees plan shifts up to and including Sunday, monthly.
> **Approval flow** confirmed: employee submits → admin approves/rejects.
> (`meetings/2026-08-24-client-transcript-shifts-recruitment.md`)

The client's real flow is **employee-authored**: the employee says "I'm working Tuesday D2D", the
admin approves. There is no mention of the admin publishing a pool of unclaimed slots. Those are two
genuinely different products:

| | Employee-authored | Open-slot claiming |
|---|---|---|
| Who creates the shift | the employee | the admin/manager |
| What the employee does | proposes their own availability | takes a slot from a fixed pool |
| Capacity control | none — admin approves/rejects | admin sets N slots up front |
| Matches transcript | ✅ "plannen zichzelf in", submit → approve | ❌ not mentioned anywhere |

## Options

**A. Employee-authored (recommended).**
No new status, no new collection, no new type. The existing `draft → pending → approved | rejected`
machine already describes it exactly; the only thing stopping it is `firestore.rules`, where
`create` on `/offices/{o}/shifts/{s}` is gated behind `isStaffOf()` (admin + manager only).

The change is ~6 lines of rules:
```
allow create: if isStaffOf(officeId)
  || (isMember() && sameOffice(officeId)
      && request.resource.data.assignedEmployeeId == request.auth.uid
      && request.resource.data.status in ['draft', 'pending']);
allow update: if isStaffOf(officeId) && (isAdmin() || request.resource.data.status in ['draft','pending'])
  || (isMember() && sameOffice(officeId)
      && resource.data.assignedEmployeeId == request.auth.uid
      && resource.data.status in ['draft', 'pending']          // can't touch an approved shift
      && request.resource.data.assignedEmployeeId == request.auth.uid  // can't reassign to someone else
      && request.resource.data.status in ['draft', 'pending']);
```
Plus a delete rule so a member can bin their own *unapproved* draft (currently admin-only).

**B. Add `'open'` to `ShiftStatus`.**
Rejected: `open` is not on the approval axis. `draft/pending/approved/rejected` answers "how far
through approval is this"; `open/claimed` answers "does this have a person on it". Cramming both into
one enum makes every existing filter (`pending`, `byDate`, the staffing bar) ambiguous, and produces
nonsense states (`open` + `rejected`?). If open slots ever ship, they need a **second field**
(`assignmentStatus`), not a fifth value in the first one.

**C. Separate `shiftClaims` subcollection.**
Only earns its keep if a slot can be *over-subscribed* (5 people want 3 spots, admin picks). Nothing
in the transcript asks for that. Real cost: every member-facing "am I on this?" read becomes a join
across two collections, and the staffing bar has to reconcile both. Park it.

## Recommendation

Ship **A**. It is a rules change plus a member-facing view, not a data-model change. If the client
later asks for admin-published slots, add `assignmentStatus: 'open' | 'assigned'` + `capacity` then —
option A does not block it, and B/C would have pre-paid for a feature nobody asked for.

**Ask the client (via Stan) to confirm** before building: *"does the admin ever post open shifts that
staff sign up for, or do staff always propose their own?"* If it's the former, this decision flips.

## What shipped

- `Shift` type extended: `weekStart`, `employeeName`/`employeeIsTeamLeader` (denormalised, point-in-time),
  `eventTitle`, `location`, `notes`, `createdBy`, `submittedAt`, `decidedAt`/`decidedBy`, `calendarEventId`
  (reserved). See `tickets/ticket-03-shift-create.md` for the field-by-field rationale.
- `firestore.rules` — shift `create`/`update`/`delete` split three ways (admin / manager / member-owns-shift),
  matching this decision's option A rules sketch. Also fixed ticket-03 defect #3 in passing: a manager could
  previously walk an `approved` shift back to `pending` because only the *incoming* status was checked —
  `update` now also requires `resource.data.status in ['draft','pending']` for non-admins.
- `shiftsService.submitWeek` — `writeBatch` flipping every current `draft` to `pending` in one call, per the
  "weekly submit gesture" sketch below. `subscribeMineForWeek` scopes a member's live view to one week.
- `MyPlanningView.vue` (new, route `/mijn-planning`, TeamMember-only) — add/remove own draft shifts for the
  current week, "Week indienen" batch-submits. `PlanningView.vue`'s admin/manager quick-add form gained the
  Event title / location fields and now stamps `employeeName`/`employeeIsTeamLeader` at create time.
- `AppShell.vue` nav made role-aware (previously showed links a TeamMember's route guard would immediately
  bounce them out of) and translated to Dutch alongside every new/touched view — see the Dutch-translation
  note in `project-status.md`.
- 31 → 34 unit tests, typecheck clean. **`firestore.rules` change not yet deployed to prod** — same as 007.

## The one thing A does need: a weekly submit gesture

The transcript's "up to and including Sunday" implies the employee submits a **week**, not a shift at
a time. Cheapest shape that supports it without a new collection:

- add `weekStart: string` (ISO Monday, `yyyy-MM-dd`) denormalised onto each shift at create time
- "Submit my week" = a `writeBatch` flipping every `draft` shift with that `weekStart` + own uid to
  `pending` in one atomic write (≤500 docs, nowhere near the limit)
- the admin's approval queue groups by `(employeeId, weekStart)` — a UI grouping, not a data change

A separate `planningSubmissions/{uid}_{weekStart}` doc (locked/unlocked, submittedAt) is only needed
if the client wants a hard cutoff that blocks edits after Sunday. **Open question for the client.**

## References

- `meetings/2026-08-24-client-transcript-shifts-recruitment.md`
- `decisions/004-shift-types.md`, `decisions/007-employee-doc-id-must-be-uid.md`
- `tickets/ticket-03-shift-create.md`
