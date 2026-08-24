# Ticket 03 — Shift creation + approval queue

**Status:** 📋 Planned — re-scoped 2026-08-24 (third session, data-model pass)
**Goal:** Employees plan their own week; admins/managers draft on their behalf; admin approves/rejects.
**Depends on:** `decisions/007-employee-doc-id-must-be-uid.md` (blocker), `decisions/008-self-service-shift-signup.md`

> ⚠️ Ticket 03 was never scoped end-to-end. `src/types/shift.ts`, `shifts.service.ts`, `stores/shifts.ts`
> and `PlanningView.vue` all exist and work for the admin/manager path, but against a **skeleton
> schema**. The sections below are the gap between that skeleton and a document that can hold the
> client's real workflow.

---

## 1. Current shift document (what's actually there)

```ts
interface Shift {
  shiftId; officeId;
  assignedEmployeeId: string;
  date: string;            // yyyy-MM-dd
  type: 'D2D' | 'Straat' | 'Event';
  startTime; endTime;      // HH:mm
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
}
```
`shifts.service.ts` also writes `createdAt` / `updatedAt` that **the type doesn't declare** — the
interface is already lying about the document shape.

## 2. Proposed fields, each with the requirement that forces it

| Field | Type | Why it exists | Source |
|---|---|---|---|
| `weekStart` | `string` (ISO Monday) | "plan up to and including Sunday" — needed to batch-submit a week and to group the approval queue | transcript |
| `employeeName` | `string` | **Denormalised.** Rules deny a TeamMember reading the roster (own doc only), so a member-facing planning view *cannot* join `shifts → employees` to show a name | `firestore.rules` |
| `employeeIsTeamLeader` | `boolean` | **Denormalised, and snapshot-at-time.** The staffing bar ("40 shifts, 5 TL, 7 non-TL") and the TL headcount *trend over time* both break if this is read live — a person promoted to TL today would retroactively rewrite last month's history | transcript §History |
| `eventTitle` | `string \| null` | Event shifts are arbitrary; "Event" alone is not a label a planner can read | `decisions/004` |
| `location` | `string \| null` | D2D/Straat are field work; the current doc says *when* but never *where* | inferred — **confirm with client** |
| `notes` | `string \| null` | free text, admin↔employee | inferred — **confirm** |
| `createdBy` | `uid` | "who drafted this" — an admin's own draft vs a member's self-plan are different things for the approval queue, and FRD §9 asks whether an admin may approve their own | FRD §9 |
| `createdAt` / `updatedAt` | `Timestamp` | already written, just undeclared | bug |
| `submittedAt` | `Timestamp \| null` | Sunday-cutoff enforcement + "who submitted late" | transcript |
| `decidedAt` / `decidedBy` | `Timestamp \| null` / `uid \| null` | audit trail for approve **and** reject; currently a rejection records a reason but not who rejected it or when | FRD §9 |
| `calendarEventId` | `string \| null` | Google Calendar sync for Event shifts is a **committed** future step, not a maybe — reserving the field now is free, retrofitting is a migration | `decisions/004` update |

**Deliberately NOT added:** an `'open'` status, a `capacity` field, or a `shiftClaims` collection —
see `decisions/008` for why open-slot claiming is a different product the client hasn't asked for.

## 3. Known defects in the existing skeleton

1. 🔴 **`assignedEmployeeId` can never match a uid** — `employeesService.create` uses `addDoc`, so
   member-facing shift reads return nothing. See `decisions/007`. **Blocks everything member-facing.**
2. 🟡 **Type lies about `createdAt`/`updatedAt`** (above).
3. 🟡 **A TeamManager can walk an approved shift backwards.** `firestore.rules` allows non-admins any
   write whose *incoming* status is `draft`/`pending`, without checking the *existing* status — so a
   manager can flip `approved → pending`. Ticket 03 §3 says backwards moves are admin-only. Needs
   `resource.data.status` guards, not just `request.resource.data.status`.
4. 🟡 **No overlap validation.** `PlanningView.submitForm` checks `start < end` only. Same employee,
   same day, two shifts — allowed. Client-side pre-check + a store-level guard (rules can't do this;
   Firestore rules cannot query other documents).
5. 🟡 **`shiftsService` has no `list`, no date-range filter, no `delete`.** Every read is a live
   subscription over the office's *entire* shift history — fine at 40 shifts, a real cost problem
   after a year. Needs `where('weekStart', '==', ...)` / range-scoped subscriptions before go-live.
6. 🟢 **`/offices/gent` doc ID is lowercase, `officeId` field is `"Gent"`.** Still unresolved. Any
   denormalised `officeId` written onto shifts inherits the ambiguity — pick one before seeding real data.

## 4. Scope

1. **Types** — `src/types/shift.ts` extended per §2; `ShiftCreatePayload` drops server-set fields.
2. **`shifts.service.ts`** — `subscribeForWeek(officeId, weekStart)`, `subscribeMineForWeek`,
   `submitWeek(officeId, uid, weekStart)` (`writeBatch`), `remove(officeId, shiftId)`.
3. **`shifts.ts` store** — week-scoped state, `staffingTotals` getter (shifts / TL / non-TL) driven off
   the denormalised flag, not a roster join.
4. **Rules** — member self-create/self-edit per `decisions/008`; fix defect 3; member delete of own draft.
5. **Views** — vertical stacked list, Notion-style, **not** a weekly grid (client, WhatsApp);
   `MyPlanningView` (member: my week, add shift, submit week, history) + admin approval queue grouped
   by `(employee, weekStart)`.
6. **Staffing overview bar** — literal segmented bar (TL vs non-TL), per transcript, not just numbers.

## Acceptance

- TeamMember drafts three shifts for next week → "Submit week" → all three go `pending` in one write
- Admin sees them grouped under that employee's week → approves → member's dashboard updates live
- Member sees their own past/completed shifts; sees **no** other employee's shifts (rules-enforced)
- TeamManager cannot move an `approved` shift back to `pending`
- Staffing bar totals match the shift list without reading `/employees`

## Open questions — need the client, via Stan

- [ ] Does the admin ever **post open shifts** staff sign up for, or do staff always propose their own? (`decisions/008` — flips the design if the former)
- [ ] Hard **Sunday cutoff**: can an employee still edit next week's plan after Sunday, or does it lock?
- [ ] Can an admin approve their **own** draft? (FRD §9)
- [ ] Can an **approved** shift be edited, or must it be rejected and redrafted?
- [ ] Does a shift need a **location** field, or is that implied by the type?
- [ ] Can a roster entry exist for someone with **no login account**? (`decisions/007` consequence)
