# Dev Plan — CRM (Planning & Recruitment Platform)

**Generated:** 2026-08-24, from FRD v0.1 + client transcript + existing scaffold.
**Architecture note:** this is a Vue 3 + Firestore app — no traditional REST API layer. The plan below uses this project's real layering instead of a generic Data→Business→Api→Client template:

```
Data     → Firestore collections/rules/types  (firestore.rules, src/types/*)
Service  → thin Firestore wrappers            (src/services/*.service.ts)
Store    → Pinia, reactive/live subscriptions  (src/stores/*.ts)
Client   → views + components                 (src/views/*, src/components/*)
```

The one exception is Ticket 05 (recruitment auto-messaging), which was going to need a real backend — a Firebase Cloud Function — because it holds a third-party API secret that can't live in the browser bundle. **That's now a real open blocker, not just a technical detail**: Stan decided 2026-08-24 to keep this project on the free Spark plan permanently (Cloud Functions require Blaze). See `decisions/006-firestore-roles-no-claims.md` and the `project_spark_plan_no_blaze` Claude memory. Ticket 05 needs Stan's explicit sign-off on either upgrading to Blaze or finding a free-tier-compatible way to hold that secret before it can be built — don't assume a Cloud Function is available.

## Sequence

| # | Ticket | Status | Depends on |
|---|---|---|---|
| 00 | Scaffold | ✅ Done | — |
| 01 | Auth hardening + RBAC | 🔨 Starting now | 00 |
| 02 | Employee CRUD | 📋 Planned | 01 |
| 03 | Shift creation + approval (D2D/Straat/Event types) | 📋 Planned | 01, 02 |
| 04 | Recruitment leads + pipeline | 📋 Planned | 01 |
| 05 | Recruitment auto-messaging (needs a secret-holding backend) | 📋 Blocked — needs client on send channel AND Stan on Blaze vs. free-tier alternative | 04 |
| 06 | Admin dashboard + historical reporting | 📋 Planned | 02, 03, 04 |

04 can run in parallel with 02/03 once 01 lands — no data dependency between Employee/Shift and Recruitment.

## Blocking questions before full build-out (see individual tickets + `project-status.md`)

1. Metric definition for "N Team Leaders" — unique headcount vs. shift count (blocks Ticket 06)
2. Recruitment message send channel — WhatsApp Business API vs email (blocks Ticket 05)
3. Exact recruitment lead fields — need client's current Google Doc (blocks Ticket 04 field set, not the pipeline mechanics)
4. Google Calendar backing for Event shifts, or plain free-text — currently building free-text first (Ticket 03 / `decisions/004-shift-types.md`)

None of these block starting Ticket 01 — RBAC doesn't touch any of them.

## Focused re-plan, 2026-08-24 (Stan interrupted mid-session)

Stan called a halt mid-Ticket-03 — too much happening in parallel (rules deploy, prod claims, shift UI, dashboard wiring all at once). Decision: **stop, start a new session scoped to just auth + rights + Firestore data model**, done properly, before touching any more feature UI. New requirement surfaced in the same breath: **self-signup** (not just admin-created accounts) plus an **admin Users page** to grant rights to whoever signs up. See the kickoff prompt Stan is using for that session, and `tickets/ticket-01-rbac.md` scope-addition note for the detail (SignupView, pending-role state, UsersView, first real Cloud Function for role assignment).

Everything built so far (Employee CRUD, Planning/Shifts UI) stays as-is — not thrown away, just paused. Resume from `dev-plan.md`'s sequence table once the auth/rights/data-model session is done.

**Update, same day, end of that session:** auth/rights/data-model session is done — self-signup, pending-approval, admin Users page, all deployed to prod and verified live. Mid-session pivot: custom claims + the planned Cloud Function were dropped entirely (Stan ruled out Blaze permanently), role data now lives only in Firestore. See `decisions/006-firestore-roles-no-claims.md`. Stan also asked for a role-split Dashboard (done, minimally) and flagged that a second office is a real near-term thing, not just backlog. Next session is scoped to the rest of the Firestore data model (shifts, real client data from Stan's Notion doc, recruitment leads shape) — see `session-prompts/2026-08-24-firestore-data-model-shifts.md`.

## Colours

Resolved 2026-08-24 — Stan confirmed keep the existing pink `#EC4899` placeholder, no further client sign-off needed right now. `decisions/003-pink-placeholder-hex.md` stands as final for now.
