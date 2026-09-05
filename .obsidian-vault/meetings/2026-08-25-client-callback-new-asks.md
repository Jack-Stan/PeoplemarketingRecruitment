# 2026-08-25 — Client callback, new asks

**Source:** Stan, back from a client call, raw brain-dump relayed to Claude same day. Not a transcript —
Stan's own paraphrase, order as given, deliberately not tidied into priority before capture.

---

## Raw list (as given)

1. Auto call when clicking on a phone number
2. Auto mail close to plan
3. Per-person data on street-recruited leads ("people that they recruit on the street to work for him") —
   needs analytics, a status (no show / planned / hired), and must link to the person who signed them up
4. TODO-style: devops/notification — "see what's possible on the yoke" (client's own vague phrasing per Stan)
5. Location shift
6. Hours delete (greyzone)
7. [briggsandwalker.com/agency-field-marketing](https://briggsandwalker.com/agency-field-marketing/) — client wants a knock-off/inspired version
8. Shift planning: not with hours, and people can't see which type of shift
9. SMS planning automated → n8n & Node.js
10. Data after deleting users needs to be saved

---

## Interpretation + where each lands (Claude's read, not client-confirmed)

### 1. Click-to-call on phone numbers
Straightforward — `tel:` links on any rendered phone number (recruitment leads, employee records). No backend
needed. Candidate: small addition to `RecruitmentView`/`LeadDetailView` and wherever employee phone numbers
render. **Not yet scoped as a ticket** — small enough to fold into Ticket 04 polish.

### 2. "Auto mail close to plan"
**Ambiguous, needs Stan to clarify with the client before scoping.** Two plausible readings:
- Auto-email when a weekly shift plan is finalized/closed off (e.g. Sunday cutoff per `decisions/008`)
- Auto-email reminder as the plan deadline approaches ("close to" = near in time, not "closed")
Don't guess which — the fix is a different trigger (event vs. scheduled) either way.

### 3. Street-recruited leads: per-recruiter analytics + status
This is a **real extension of Ticket 04** (`tickets/ticket-04-recruitment-crud.md`), not a new module. Two
concrete asks:
- A `status` on each lead restricted to exactly `no show | planned | hired` — narrower than the existing
  pipeline stages in ticket-04 (`NewLead → Contacted → InterviewPlanned → InterviewAttended|InterviewNoShow
  → Hired|Rejected`). Need to reconcile: is this a *different* simplified status for street-recruited leads
  specifically, or does the client want the whole pipeline simplified to these three? **Ask before building** —
  building the wrong one means redoing the funnel UI in `LeadsWeekBar`/`RecruitmentView`.
- A `recruitedBy` field linking each lead to the staff member who signed them up on the street, with
  analytics per recruiter (how many leads → how many hired, presumably a leaderboard/funnel-by-recruiter view).
  This is new — nothing in the current `RecruitmentLead` type carries an attribution field. Straightforward
  Firestore field + query addition once the status question above is settled.

### 4. DevOps / notifications — "see what's possible on the yoke"
Too vague to scope. Read as: client wants to know what notification options exist (push? email? SMS?) without
a specific ask yet. Pair with item 9 (SMS via n8n) — likely the same conversation. **Research task, not a
build task** — needs a follow-up question to the client on what "notification" means to them (shift approved?
new lead? plan closing?).

### 5. "Location shift"
Too short to scope as-is. Could mean: (a) shifts need a location field beyond the existing D2D/Straat/Event
type (`decisions/004-shift-types.md`), or (b) the ability to *shift* (move) a scheduled shift's location.
**Needs Stan to get the fuller sentence from the client** — flagging rather than guessing.

### 6. "Hours delete (greyzone)"
Read as: someone wants the ability to delete logged/worked hours after the fact, and Stan is flagging it
himself as a grey area — likely a labour-law/audit concern, not just a feature request. **This should not be
built without a explicit decision** — it directly conflicts with the append-only audit trail just shipped
(§19, `project-status.md` "Audit trail built"). If hours can be silently deleted, the audit trail is
undermined. Recommend: if this is needed at all, it should be a soft-delete/void with a mandatory reason,
logged to `auditLog` like every other mutation — never a hard delete. Flag to Stan as a compliance risk to
raise with the client, not just implement on request.

### 7. Knock-off of briggsandwalker.com/agency-field-marketing
Client wants a version of the linked field-marketing agency site/platform. **Not visited/scraped by Claude** —
that's a design-reference request for Stan to review with the client (what specifically they like: layout?
features? copy?) before it becomes actionable. Pure link-drop isn't enough to scope from.

### 8. Shift planning: hours hidden, shift type hidden
Reads as a **bug/regression report**, not a new feature: the client is saying the current planning UI shows
hours (shouldn't) and doesn't show which shift type (D2D/Straat/Event) it is (should). Worth checking
`PlanningView.vue`/`MyPlanningView.vue` against this directly — if true, this is higher priority than the
open-ended items above since it sounds like the shipped feature doesn't match what they asked for.
**Needs Stan to confirm exactly what's wrong before Claude touches the views** — "not with hours" could mean
hours shouldn't be entered at all (contradicts the FRD's D2D/Straat/Event distinction, since Event has a
free-text time range per `decisions/004`) or just shouldn't be *displayed* prominently.

### 9. SMS planning automated → n8n & Node.js
Directly relevant to **Ticket 05** (`tickets/ticket-05-recruitment-automation.md`), which has been blocked on
"what send channel" since 2026-08-24. This may be the client's answer, or may be a separate ask (SMS for
shift planning, not recruitment messaging) — the raw note doesn't say which. Notably: **n8n avoids the
Spark-plan/Cloud-Functions block** (`project_spark_plan_no_blaze` memory) since it's an external
automation tool, not a Firebase Cloud Function — worth surfacing to Stan as a way to unblock Ticket 05 without
touching the Blaze plan. Needs Stan to confirm: (a) is this for recruitment messaging, shift-plan
notifications, or both, and (b) does the client already run n8n somewhere, or is that also new infra to stand up.

### 10. User data retention after deletion
**Direct GDPR concern** — ties straight into the data inventory already prepared
(`gdpr-data-inventory.md`, see `project-status.md` "GDPR review" note). Currently unclear what "delete user"
even does in the app today — worth an audit of whether any hard-delete path exists on `/users/{uid}` or
`/offices/{id}/employees/{uid}` before deciding what "needs to be saved" means (soft-delete flag? export
before purge? indefinite retention, which itself may be a GDPR problem the other direction?). **Do not
implement a deletion/retention change without this going through the same legal/human review the rest of
GDPR is waiting on** — this is a policy decision, not a code task Claude should decide unilaterally.

---

## Shipped so far

- **Item 1 (click-to-call)** — done. Lead phone numbers in `RecruitmentView` are `tel:` links and emails are
  `mailto:` links. `UserDetailView` already had a call button; the leads table was the remaining gap
  (`EmployeesView` never rendered phone, so nothing to do there).
- **Item 3, `recruitedBy` half** — done. `RecruitmentLead.recruitedBy` holds an `employeeId` (= uid,
  decisions/007), nullable for legacy docs and non-street sources. Captured via a "Geworven door" selector on
  the add-lead form and shown as its own column in the leads table — **staff only**: a TeamMember may read
  `/recruitmentLeads` but only their own `/employees/{uid}` doc, so they can't resolve recruiter ids to names.
  The view subscribes to the roster only when the viewer is allowed to list it, and hides the column
  otherwise. Lead reads now normalize `age`/`recruitedBy` to `null` in `recruitment.service.ts`, since
  Firestore omits those fields entirely on docs written before they existed.
  **Not built: the per-recruiter analytics/leaderboard** — it groups by whatever status model wins the
  question below, so building the view now risks redoing it.
- **Unrelated but adjacent** — a required `age` field on the lead form shipped in #1, from Michiel's
  2026-09-05 WhatsApp ask.

Still open and unchanged: the status-model question in item 3 (three-state `no show | planned | hired` vs.
the existing seven-stage pipeline) blocks both the analytics view and any funnel rework.

## Summary for Stan

Most of this list is **not yet buildable as-is** — six of the ten items need one clarifying question back to
the client before Claude should touch code (2, 4, 5, 6, 7, 9 partially, 10). Two are cheap/clear enough to
just build (1, and the `recruitedBy` half of 3). One is a possible regression worth checking first (8). One
(6) is a compliance flag, not a feature request, and should probably go back to the client as "are you sure?"
rather than get built on request.
