# Ticket 03 — Shift creation + approval queue

**Status:** 📋 Planned
**Goal:** Admins/team managers can draft shifts, submit for approval, and (admin) approve/reject. Employees see their own shifts.

## Scope

1. **`shifts.service.ts`** — `list(officeId, { employeeId?, status?, range? })`, `create(officeId, payload)`, `update(...)`, `submitForApproval(officeId, shiftId)`, `approve(officeId, shiftId)`, `reject(officeId, shiftId, reason)`.
2. **`shifts.ts` Pinia store** — live subscription, status transitions tracked.
3. **State machine** — `draft → pending → approved | rejected`. Backwards moves (approved → pending) allowed by admin only.
4. **Views + components**
   - `views/planning/PlanningBoardView.vue` — weekly grid; rows = employees, cols = days; cell click → `ShiftForm`
   - `views/planning/ShiftEditorView.vue` — admin drag-create (later ticket)
   - `views/planning/ApprovalQueueView.vue` — admin-only pending list with approve/reject buttons
   - `components/planning/{ShiftGrid, ShiftCell, ShiftForm, ShiftStatusBadge}.vue`
5. **Validation** — `start < end`, no overlap on same employee/day (rule check before submit), status transitions enforced.
6. **Rules** — admins + managers draft/submit; admin only approves/rejects; member reads own.

## Acceptance

- TeamManager creates draft shift for a team member → submits for approval
- Admin sees shift in `/approval-queue` → approves → status becomes `approved`
- TeamMember sees the shift on their planning
- Admin cannot approve their own draft if rules forbid it (per FRD §9 open question — confirm with client)

## FRD coverage

§7 (Shift Management), §9 (Planning Approval workflow), partial §10 (Staffing Overview when aggregating).

## Open questions

- Who can create shifts? (FRD §23 Q1) — confirmed in Ticket 01: admins + managers
- Can an admin approve their own planning? — needs client sign-off
- Can approved planning be edited? — needs client sign-off
- Should rejection require a reason? — recommendation: **yes**, stored as `rejectionReason`