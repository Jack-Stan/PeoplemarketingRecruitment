# FRD → Tickets Map

Quick lookup from **Functional Requirements Document v0.1** (§ numbers in the FRD PDF) to the ticket that closes each requirement out.

| FRD § | Requirement | Ticket |
|---|---|---|
| §5 User Roles | Three-role model (Administrator / TeamManager / TeamMember) | ✅ Done — all three enforced end-to-end (rules + router guard), deployed to prod 2026-08-24. Self-signup added (scope addition, not in FRD text): a new account starts with no role ("pending") until an Administrator assigns Administrator/TeamManager/TeamMember + office + Team Leader flag from `/users` in-app. See `decisions/001`, `005`, `006`. |
| §6 Employee Management | List, profiles, Team Leader flag, active/inactive state | Ticket 02 |
| §7 Shift Management | Create shifts, assign employees, status workflow | Ticket 03 |
| §8 Planning Calendar | Daily / weekly / monthly views, weekend coverage, TL visibility | Ticket 03+ |
| §9 Planning Approval | `draft → pending → approved/rejected`, who can do what | Ticket 01 + 03 |
| §10 Staffing Overview | Daily TL counts, weekly/monthly aggregates | Ticket 03+ (dashboards later) |
| §11 Historical Planning | Immutable period snapshots | Ticket 04+ (periods doc, write-locked by rules) |
| §12 Recruitment Leads | Lead intake fields | Ticket 04+ |
| §13 Recruitment Pipeline | New Lead → Contacted → Interview → Attended/No-Show → Hired/Rejected | Ticket 04+ |
| §14 Recruitment Dashboard | Funnel stats | Ticket 05+ |
| §15 Recruitment Quality Reporting | Attendance rate, no-show rate, conversion, source perf | Ticket 05+ |
| §16 Admin Dashboard | Cross-module KPIs | Ticket 05+ |
| §17 Historical Reporting | Per-period aggregates across both modules | Ticket 05+ |
| §18 Multi-Office | Designed-in but not exposed until Phase 2 | Backlog |
| §19 Security & Privacy | RBAC, HTTPS, audit history, GDPR review | 🟡 RBAC done (office-scoped, role-gated per collection, deployed to prod). HTTPS/audit history/GDPR review not started — later ticket. |
| §20 Technical Architecture | Vue3, Pinia, Vue Router, Tailwind, Firebase (replaced Supabase) | ✅ Done (scaffold) |
| §21 MVP scope | Auth, Employees, Planning, Recruitment, Dashboard, History | Roadmap |
| §23 Open Questions | Pending user input | See `project-status.md` |
| — (not in FRD text) | Shift types D2D / Straat / Event with fixed hours | `decisions/004-shift-types.md`, Ticket 03 |
| — (not in FRD text) | Recruitment auto-messaging (hired/rejected/invite templates) | Ticket 04+ |

> Note: §5 originally listed only Administrator + Employee. Stan confirmed with the client on 2026-08-24 that **three roles** are needed. See `decisions/001-three-roles-not-two.md`.

> Note: role/officeId/isTeamLeader are stored and checked entirely in Firestore now (`/users/{uid}`), not Firebase custom claims — Stan opted to keep the project on the free Spark plan rather than upgrade to Blaze for a Cloud Function. See `decisions/006-firestore-roles-no-claims.md`. Doesn't change anything in the FRD itself, just the implementation mechanism behind §5/§19.

> Note: re-extracted the PDF (`pdftotext`) 2026-08-24 and confirmed it's the same **v0.1, dated 24 August 2026** already summarized in this table — no version drift. Two things worth flagging from a full re-read: (1) §20 Technical Architecture still literally says Supabase/PostgreSQL in the document text — `decisions/002-firebase-not-supabase.md` overrides this, FRD itself was never updated; (2) §23 Business/Future Q6-8 (branding guidelines, logo/colours, existing templates) are answered — partially and messily — by the client transcript, see `meetings/2026-08-24-client-transcript-shifts-recruitment.md`.