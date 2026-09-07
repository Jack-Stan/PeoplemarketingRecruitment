# FRD → Tickets Map

**Updated 2026-09-07** — this table under-reported ~8 shipped sections until then. Quick lookup from **Functional Requirements Document v0.1** (§ numbers in the FRD PDF) to the ticket that closes each requirement out.

| FRD § | Requirement | Ticket |
|---|---|---|
| §5 User Roles | Three-role model (Administrator / TeamManager / TeamMember) | ✅ Done — all three enforced end-to-end (rules + router guard), deployed to prod 2026-08-24. Self-signup added (scope addition, not in FRD text): a new account starts with no role ("pending") until an Administrator assigns Administrator/TeamManager/TeamMember + office + Team Leader flag from `/users` in-app. See `decisions/001`, `005`, `006`. |
| §6 Employee Management | List, profiles, Team Leader flag, active/inactive state | ✅ Done — `EmployeesView`, roster sync, `functie` ladder. No dedicated detail view (inline modal instead). [[ticket-02-employee-crud]] |
| §7 Shift Management | Create shifts, assign employees, status workflow | ✅ Done — `PlanningView` + `MyPlanningView`. Open defect: a manager can un-approve. [[ticket-03-shift-create]] |
| §8 Planning Calendar | Daily / weekly / monthly views, weekend coverage, TL visibility | ✅ Done — month grid + week views, staffing bar with TL counts. |
| §9 Planning Approval | `draft → pending → approved/rejected`, who can do what | ✅ Done — rules-enforced. |
| §10 Staffing Overview | Daily TL counts, weekly/monthly aggregates | ✅ Done — staffing bar + Dashboard. |
| §11 Historical Planning | Immutable period snapshots | 🔴 **Not deliverable as specified.** `/periods` has rules reserved but **no type, no service, no write path** — nothing ever writes a snapshot. Needs a decision: build a snapshot writer, or redefine §11 as live aggregation over `/shifts` (which `HistoryView` already does). |
| §12 Recruitment Leads | Lead intake fields | ✅ Done — [[ticket-04-recruitment-crud]]. Missing: consent/notice capture (GDPR, see [[gdpr-data-inventory]]). |
| §13 Recruitment Pipeline | New Lead → Contacted → Interview → Attended/No-Show → Hired/Rejected | ✅ Done — stages live. Missing: interview datetime/interviewer, per-stage timestamps, duplicate detection. |
| §14 Recruitment Dashboard | Funnel stats | ✅ Done — funnel on `DashboardView`. Known defect C5: some stages drop out of the denominator. |
| §15 Recruitment Quality Reporting | Attendance rate, no-show rate, conversion, source perf | ✅ Done. Known defect C4: CV-rejections count as attended. |
| §16 Admin Dashboard | Cross-module KPIs | ✅ Done — real data, role-split. [[ticket-06-dashboards-history]] |
| §17 Historical Reporting | Per-period aggregates across both modules | 🔴 Same blocker as §11 — no `/periods` writer. `HistoryView` covers the shift half by live aggregation. |
| §18 Multi-Office | Designed-in but not exposed until Phase 2 | ✅ Done and deployed 2026-08-25 — admin office switcher, admins are staff of every office. |
| §19 Security & Privacy | RBAC, HTTPS, audit history, GDPR review | 🟡 RBAC ✅, HTTPS ✅ (Netlify), audit history ✅ **but best-effort only** — it is client-written and fire-and-forget, so it is an activity feed, not evidence (see [[2026-09-07-full-project-audit]] H4). GDPR review 🔴 — no retention, erasure or consent mechanism in the app; manual Admin-SDK scripts only. |
| §20 Technical Architecture | Vue3, Pinia, Vue Router, Tailwind, Firebase (replaced Supabase) | ✅ Done (scaffold) |
| §21 MVP scope | Auth, Employees, Planning, Recruitment, Dashboard, History | ✅ MVP shipped and live. |
| §23 Open Questions | Pending user input | See `project-status.md` |
| — (not in FRD text) | Shift types D2D / Straat / Event with fixed hours | `decisions/004-shift-types.md`, Ticket 03 |
| — (not in FRD text) | Recruitment auto-messaging (hired/rejected/invite templates) | 🔴 Blocked — Cloud Function approach banned by [[006-firestore-roles-no-claims]], needs external automation. [[ticket-05-recruitment-automation]] |
| — (not in FRD text) | Location Manager: canvassing zones, map, visit logging | ✅ Shipped 2026-08-28, undocumented until 2026-09-07. See [[009-coverage-viewer-teamleader-flag]]. **Employee monitoring — GDPR purpose not yet documented.** |
| — (not in FRD text) | Availability marking by members | ✅ Shipped 2026-08-28. |
| — (not in FRD text) | `functie` job ladder, admin-assigned | ✅ Shipped 2026-09-01. |

> Note: §5 originally listed only Administrator + Employee. Stan confirmed with the client on 2026-08-24 that **three roles** are needed. See `decisions/001-three-roles-not-two.md`.

> Note: role/officeId/isTeamLeader are stored and checked entirely in Firestore now (`/users/{uid}`), not Firebase custom claims — Stan opted to keep the project on the free Spark plan rather than upgrade to Blaze for a Cloud Function. See `decisions/006-firestore-roles-no-claims.md`. Doesn't change anything in the FRD itself, just the implementation mechanism behind §5/§19.

> Note: re-extracted the PDF (`pdftotext`) 2026-08-24 and confirmed it's the same **v0.1, dated 24 August 2026** already summarized in this table — no version drift. Two things worth flagging from a full re-read: (1) §20 Technical Architecture still literally says Supabase/PostgreSQL in the document text — `decisions/002-firebase-not-supabase.md` overrides this, FRD itself was never updated; (2) §23 Business/Future Q6-8 (branding guidelines, logo/colours, existing templates) are answered — partially and messily — by the client transcript, see `meetings/2026-08-24-client-transcript-shifts-recruitment.md`.