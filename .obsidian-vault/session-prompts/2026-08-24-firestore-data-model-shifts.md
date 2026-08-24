# Session kickoff prompt — Firestore data model deep-dive (shifts + beyond)

Paste this into a new Claude Code session in `C:\RFT\Projects\CRM`:

---

Read the vault first: `.obsidian-vault/index.md`, `project-status.md`, `tickets/ticket-01-rbac.md`, `decisions/005-users-employees-datamodel.md`, and `decisions/006-firestore-roles-no-claims.md`. Also check Claude's own memory for this project (`project_spark_plan_no_blaze`) before proposing anything server-side.

**Where things stand:** Ticket 01 (auth/rights) is done and deployed — self-signup, `/pending-approval`, and an admin Users page all work, verified live against prod via the local dev server. Big thing to know: **role/officeId/isTeamLeader live entirely in Firestore (`/users/{uid}`), not custom claims** — there is no Cloud Function in this project and there will not be one unless Stan explicitly reverses the "stay on Spark" decision. Don't propose Cloud Functions/Blaze as a solution to anything without flagging it first.

**This session's focus: scope out the rest of the Firestore data model properly** — shifts, and whatever else is needed to hold real client data — before building more feature UI. Stan specifically wants this as its own pass, same as the auth/rights session before it. Concretely:

1. **Shifts** — `src/types/shift.ts` / `firestore.rules` already have a skeleton (`draft → pending → approved/rejected`, D2D/Straat/Event types, fixed hours per `decisions/004-shift-types.md`), but Ticket 03 itself was never really scoped end-to-end. Work through: what fields does a real shift document need for the client's actual workflow (see the client transcript at `meetings/2026-08-24-client-transcript-shifts-recruitment.md` — weekly cycle up to Sunday, staffing overview bar, TL headcount trend), and what's still just a placeholder in `PlanningView.vue`/`shifts.service.ts`.

2. **Self-service "sign up for a shift"** — Stan asked for this mid-last-session (worker/student view: see available shifts, sign up, see history of shifts taken/completed). It was explicitly NOT built last session because the current shift model only supports *admin/manager assigns an employee to a shift*, not *employee claims an open shift*. This needs a real design decision: does an "open" shift status/concept get added to the existing `Shift` type, or is this a separate collection? Work through the tradeoffs before touching rules or UI.

3. **Real client data** — Stan has a Notion page (`https://app.notion.com/p/Dashboard-Gent-Home-...`) with the client's actual data that needs to land in Firestore. It's a private page Claude Code can't fetch directly (confirmed last session — WebFetch only sees an empty shell). Ask Stan to paste the actual fields/structure, or export it, before assuming a schema. Once you have it, figure out whether it needs a one-time import script (Admin SDK, similar to `scripts/seed.ts`/`scripts/grantRole.ts`) or manual entry via the app's own CRUD once it exists.

4. **Recruitment leads / periods** — both exist in `firestore.rules` already but have zero real data and no service/store/view layer yet (Ticket 04/06). Worth deciding now, while you're in the data model headspace, whether their shape needs to change given what's been learned building `users`/`employees`/`shifts` — but don't build the UI for these this session unless Stan explicitly expands scope again (he did that twice last session — expect it, don't assume the plan survives contact).

**Known landmines from last session:**
- Local Firestore emulator is still broken (JDK21/Windows loopback-selector bug) — same as before, rules changes get deployed straight to prod and verified there. Flag again if fixed or still broken.
- `/offices/gent` doc ID is lowercase, `officeId` field is `"Gent"` (capital) — still unresolved, still low priority.
- Any Firebase Auth account with claims set before 2026-08-24 (this session) has no matching `/users/{uid}` doc unless someone's since run `grantRole.ts`/`assignRole` on it — check for this before assuming every account works; it's a real lockout risk (already happened once and was caught).
- The Netlify-deployed frontend is stale — doesn't have signup/pending-approval/Users yet, only the local dev server (pointed at prod Firebase) has been verified live. If this session's work needs live testing, redeploying to Netlify is a prerequisite worth raising with Stan.
- Multi-office is a real near-term requirement (Stan confirmed), not just FRD §18 backlog — Gent is the one office in scope right now, but design with a second one in mind. Cross-office admin assignment is still an open question (see `decisions/005`).

Typecheck (`./node_modules/.bin/vue-tsc --noEmit` — plain `npx vue-tsc` misbehaves in this environment) and run `npm test` before calling anything done. Update the vault (`tickets/ticket-03-shift-create.md`, `project-status.md`, new decision docs as needed) as you go.
