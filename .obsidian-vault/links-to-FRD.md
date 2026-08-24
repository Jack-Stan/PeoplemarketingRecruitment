# FRD → Tickets Map

Quick lookup from **Functional Requirements Document v0.1** (§ numbers in the FRD PDF) to the ticket that closes each requirement out.

| FRD § | Requirement | Ticket |
|---|---|---|
| §5 User Roles | Three-role model (Administrator / TeamManager / TeamMember) | ✅ Done (scaffold); Ticket 01 for full RBAC enforcement |
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
| §19 Security & Privacy | RBAC, HTTPS, audit history, GDPR review | Ticket 01 + later |
| §20 Technical Architecture | Vue3, Pinia, Vue Router, Tailwind, Firebase (replaced Supabase) | ✅ Done (scaffold) |
| §21 MVP scope | Auth, Employees, Planning, Recruitment, Dashboard, History | Roadmap |
| §23 Open Questions | Pending user input | See `project-status.md` |

> Note: §5 originally listed only Administrator + Employee. Stan confirmed with the client on 2026-08-24 that **three roles** are needed. See `decisions/001-three-roles-not-two.md`.