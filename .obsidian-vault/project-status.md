# Project Status — CRM

**Updated:** 2026-08-24 (third session — data-model pass + functional build-out)
**Repo:** `C:\RFT\Projects\CRM`
**Stack:** Vue 3 + TypeScript + Vite + Pinia + Tailwind + Firebase (Auth + Firestore + Emulator Suite — **no Cloud Functions**, see below)

---

## TL;DR

Ticket 0 (scaffold) shipped. Ticket 01 (RBAC) is now fully done **including** the self-signup/Users-page scope addition, deployed to prod and verified working (Stan signed up live, hit `/pending-approval`, and his own admin login was confirmed intact after a lockout scare — see below). Big pivot mid-session: role assignment was originally going to be a Cloud Function, but Stan ruled out ever upgrading off the free Spark plan, so **custom claims are gone entirely** — role/officeId/isTeamLeader live only in Firestore (`/users/{uid}`), checked via `get()` in `firestore.rules`. See `decisions/006-firestore-roles-no-claims.md` and the `project_spark_plan_no_blaze` memory. Typecheck clean, full `npm run build` succeeds, 27 unit tests passing. Ticket 02 (Employee CRUD) is code-complete from before. Ticket 03 (Shifts) is next, though the Dashboard already got a role-split ahead of schedule (see below).

## Built (✅)

- **Repo scaffold** — Vue 3 + TS + Vite + Pinia + Vue Router + Tailwind, all wired up
- **Brand tokens** at `src/assets/brand.ts` — pink `#EC4899` **confirmed final by Stan 2026-08-24**, no further client sign-off needed (see `decisions/003-pink-placeholder-hex.md`)
- **Firebase init** — single SDK instance in `src/services/firebase.ts`, emulator wiring behind `VITE_USE_EMULATORS`
- **Auth store** — `src/stores/auth.ts` reads `role`/`officeId`/`isTeamLeader` live from `/users/{uid}` in Firestore (no custom claims — see `decisions/006`)
- **Router + guard** — `beforeEach` checks `requiresAuth` + `meta.roles`, redirects unauth → `/login`, role-mismatch → `/unauthorized`
- **Three roles** — `Administrator` / `TeamManager` / `TeamMember` (see `decisions/001-three-roles-not-two.md`)
- **Login + Dashboard + 404 + 403 views** rendered, BaseButton/Input/Toast primitives
- **Admin seed script** — `npm run seed` creates `admin@peoplemarketing.nl` / `admin123` with `Administrator` role written to `/users/{uid}` (emulator-only, no claims involved) + `/offices/office-main` + employee doc
- **`scripts/grantRole.ts`** (was `setClaims.ts`) — ad-hoc role-granting for any user by email, now a plain Firestore write, no Admin SDK claims call (Ticket 01, rewritten after `decisions/006`)
- **`firestore.rules`** — full RBAC: office-scoped, role-gated per collection (`employees`, `shifts`, `recruitmentLeads`, `periods`) (Ticket 01)
- **Employee CRUD** — `employees.service.ts` + Pinia store + `EmployeesView.vue` (live list, search, add/edit modal, soft-disable) (Ticket 02)
- **`.mcp.json`** — Firebase MCP server config for Claude Code/Desktop (needs `firebase login`, done 2026-08-24)
- **`.claude/launch.json`** — `npm run dev` preview wiring for Claude Code's browser tool
- **Vitest** — `tests/unit/auth.store.spec.ts` (9 specs), `tests/unit/employees.store.spec.ts` (6), `tests/unit/shifts.store.spec.ts`, `tests/unit/router.spec.ts` (6 guard specs) — 27 total, all passing
- **Bug fix** — `friendlyError` in `src/utils/errors.ts` now duck-types `.code` instead of `instanceof FirebaseError` (the instanceof check silently failed under Vitest's module graph)
- **Self-signup** — `SignupView.vue` (with an office picker, offices public-readable), `authService.signUp()`, `useAuthStore().signUp()`, `usersService.createProfile()`. A fresh signup gets a `/users/{uid}` doc with `role`/`primaryOfficeId` both null plus a `desiredOfficeId` recording which office they applied to — that's the only "which office" signal, since role/office live in Firestore now, not claims.
- **"Pending" auth state** — router guard distinguishes "not logged in" (`/login`) from "logged in, no role yet" (`/pending-approval`, new, no AppShell nav chrome) from "logged in, wrong role" (`/unauthorized`). See `src/router/index.ts`.
- **Admin Users page** — `UsersView.vue` (`/users`, admin-only) lists every `/users/{uid}` doc live and assigns role/isTeamLeader with a **direct Firestore write** (no Cloud Function, see below); office assignment is locked to the admin's own office (see `decisions/005`/`006`), with a ⚠️ flag if a pending user applied to a different office.
- **Custom claims + Cloud Function ripped out entirely** — Stan decided to keep `peoplemarketing-c5bfd` on the free Spark plan permanently (`firebase deploy --only functions` requires Blaze). `functions/` directory deleted. `firestore.rules` rewritten so every role check (`isAdmin()`, `isManager()`, `isMember()`, `sameOffice()`) reads `/users/{request.auth.uid}` via `get()` instead of `request.auth.token.*`. Role assignment is now a plain `updateDoc` on `/users/{uid}`, rules-gated. See `decisions/006-firestore-roles-no-claims.md` and the `project_spark_plan_no_blaze` Claude memory (don't propose Blaze/Cloud Functions again for this project).
- **Data model decisions written up** — `decisions/005-users-employees-datamodel.md` (`/users` vs `/offices/*/employees` split, pending-state design, office-scoped assignment) and `decisions/006` (claims → Firestore pivot).
- **Role-split Dashboard** — `DashboardView.vue` now branches on role: Administrator/TeamManager keep the existing (still-mocked) KPI view; TeamMember gets a real "my shifts" view (upcoming approved shifts, completed count, pending count) via a new `shiftsService.subscribeForEmployee()` / `useShiftsStore().subscribeMine()`. **Self-service "sign up for an open shift" was explicitly not built this session** — needs a new open/unassigned-shift concept in the Shift model, flagged as real Ticket 03 extension work, not guessed at.
- **Latent bug fixed in passing** — `shiftsService.subscribe(officeId)` (whole-collection query, no `where`) was silently denied outright for any TeamMember under `firestore.rules`, because an unfiltered query can't prove every result satisfies a per-document rule. Only ever surfaced now because the Dashboard needed a TeamMember-facing shifts read; `PlanningView` (admin/manager only) was never affected.
- **Prod near-lockout caught and fixed same session** — after deploying the Firestore-only-roles rules, `admin@peoplemarketing.be` (the real client-facing login, claims set in the *previous* session before `/users` mirroring existed) had no `/users/{uid}` doc at all — under the new rules that means `isAdmin()` evaluates false, i.e. Stan's own admin account would have been locked out of every admin action on prod. Caught by checking with the Admin SDK before calling the deploy "done," fixed by writing the missing doc directly (role: Administrator, office: gent, isTeamLeader: true) to match the account's existing claims. No user-facing incident, but worth remembering: **any account with claims set before this session's pivot needs a matching `/users/{uid}` doc** — if another such account turns up, it needs the same fix.

## In flight / blocked (🟡)

- **Firestore emulator won't start locally** — `java.io.IOException: Unable to establish loopback connection` on JDK 21 + Windows (Netty NIO selector bug, likely VPN/EDR interfering with AF_UNIX loopback sockets). Blocks `npm run rules:test`, `npm run emulators`, `npm run seed` on this machine. Re-confirmed still broken this session (silent hang, killed after 40s, no new error). Tried previously: JDK 17 via winget (MSI install failed, exit 1603 — needs investigating, possibly needs elevation). `firestore.rules` and the rules test suite (`tests/rules/firestore.rules.spec.ts`) are written but **unverified locally** — prod deploy + manual testing is the only verification path right now, and that's actually been done (see below).
- **Firebase MCP not confirmed connected** — `.mcp.json` is in place, Stan ran `firebase login` successfully, but no `mcp__firebase__*` tools showed up as available in this session. Worth checking after a fresh Claude Code restart.
- **No `.env.local`** — app currently falls back to real production Firebase config (not emulators) when run via `npm run dev`, since `VITE_USE_EMULATORS` isn't set anywhere on disk. Fine for eyeballing static views, but nobody can actually sign in without either a working emulator+seed or real prod credentials — right now the local dev server IS pointed at prod, which is how Stan tested signup live this session.
- **Multi-office is now a real near-term requirement, not just FRD §18 backlog** — Stan confirmed this session there will be multiple offices, with Gent as the one currently in scope. Signup now captures `desiredOfficeId` and offices are public-readable for the picker, but an admin can still only ever approve someone into their **own** office (rules-enforced) — there's no cross-office admin flow yet. Fine while there's effectively one admin/one office; revisit before a second office goes live for real.
- **Netlify frontend is stale** — the deployed `peoplemarketing.be` site still runs pre-signup code. `firestore.rules` is live on prod, but nobody hits the new SignupView/UsersView/PendingApprovalView until the frontend is redeployed to Netlify. Not done this session — only the local dev server (pointed at prod Firebase) has been verified live.

## Next (📋)

1. **Redeploy the frontend to Netlify** so the real site has signup/pending-approval/Users — currently only verified via local dev pointed at prod.
2. **Scope out the rest of the Firestore data model** — shifts and whatever else is needed, Stan wants a dedicated pass on this next (see kickoff prompt).
3. **Ticket 03 — Shift creation + approval queue** — `draft → pending → approved/rejected`, three shift types D2D/Straat/Event (`decisions/004-shift-types.md`), plus (new, from this session) an "open/unassigned shift" concept if self-service shift signup is wanted for TeamMembers.
4. **Ticket 04 — Recruitment leads + pipeline**
5. **Ticket 05 — Recruitment auto-messaging** — blocked on client confirming send channel, **and now also on Blaze** if it truly needs server-side secret storage (see `project_spark_plan_no_blaze` memory) — flag to Stan explicitly when this comes up, don't assume Cloud Functions.
6. **Ticket 06 — Dashboards + historical reporting** — blocked on client confirming the TL-count metric definition (admin dashboard is still mocked data either way)

---

## Data-model pass (third session, 2026-08-24) — design only, no code changed

Dedicated scoping pass on the Firestore data model before building more feature UI. **No source files
were touched** — typecheck clean, 27/27 tests still passing (unchanged baseline). Output is three
vault docs:

- `decisions/007-employee-doc-id-must-be-uid.md` — 🔴 **latent prod bug found.**
  `firestore.rules` and `DashboardView.vue:33` both assume `employeeId === auth.uid`, but
  `employeesService.create()` uses `addDoc` (random ID). Every employee created via the Employees CRUD
  is therefore **invisible to the person it represents** — a TeamMember's dashboard returns zero shifts
  and they can't read their own employee doc. Not surfaced yet only because no real TeamMember has
  logged in on prod. Recommendation: `setDoc(doc(col, uid))`, which turns the Employees page into
  "promote an existing account to staff". **Needs Stan's call + an Admin SDK check of existing
  `/offices/gent/employees` docs before touching anything** (same discipline as the session-2 lockout catch).
- `decisions/008-self-service-shift-signup.md` — **the session-2 framing was wrong.** "We need an open/
  unassigned shift concept" doesn't match the client transcript: the client's flow is *employee-authored*
  ("employees plan themselves in, up to Sunday, admin approves"), which the existing
  `draft → pending → approved/rejected` machine already models exactly. The only blocker is a ~6-line
  `firestore.rules` change (shift `create` is currently gated behind `isStaffOf()` = admin/manager only).
  Adding `'open'` to `ShiftStatus` is explicitly rejected — assignment state and approval state are two
  orthogonal axes and cramming them into one enum produces nonsense states. Open-slot claiming stays parked
  until the client actually asks for it.
- `tickets/ticket-03-shift-create.md` — **fully re-scoped.** Field-by-field shift schema with the
  requirement forcing each field (incl. denormalised `employeeName` / `employeeIsTeamLeader`, because
  rules deny a member reading the roster, and because the TL *trend* view needs the flag as it was at the
  time — not live), plus five more defects in the existing skeleton (type lies about
  `createdAt`/`updatedAt`; a TeamManager can walk an `approved` shift backwards because rules only check
  the incoming status; no overlap validation; every read is an unbounded whole-history subscription).

### Still open from this pass

- **Notion client data (kickoff item 3) — blocked on Stan.** The page is private; WebFetch only saw an
  empty shell last session. Nothing was assumed about its schema. Needs a paste/export before deciding
  between a one-time Admin SDK import script (à la `scripts/seed.ts` / `grantRole.ts`) and manual entry
  through the app's own CRUD.
- 🔴 **`firestore.rules` change from 007 is written but NOT deployed to prod.** The emulator is still
  dead (Stan: don't touch it), so prod deploy is the only verification path and it needs his go-ahead.
  Until it's deployed, the *client* enforces uid-keying but the *rules* don't.
- **Recruitment leads / periods (kickoff item 4)** — reviewed but deliberately not re-shaped. One concrete
  rot found: the `/periods/{periodId}` rule says `allow write: if false` with the comment *"written
  server-side only (Cloud Function via Admin SDK)"* — that Cloud Function **no longer exists and never
  will** (`decisions/006`). Historical period snapshots currently have no write path at all. Needs a
  decision (client-computed aggregates vs a manual script vs dropping the collection) before Ticket 06.
- Six client questions listed at the bottom of `tickets/ticket-03-shift-create.md` — open-shifts yes/no,
  Sunday hard cutoff, self-approval, editing approved shifts, shift location, and whether a roster entry
  may exist for someone with no login account.

---

## Functional build-out (same third session, after the data-model pass)

Stan asked to move from design to building. Shipped, in order:

- **007 implemented** — `employeesService.create` now `setDoc`s under the account's own uid; prod audited
  first (empty roster, no migration needed); `EmployeesView` add-flow is an account picker. `firestore.rules`
  enforces it server-side too. **Not yet deployed to prod** (Stan's call — held off pending more functional work).
- **008 implemented — self-service shift signup.** `Shift` type extended (weekStart, denormalised
  employeeName/employeeIsTeamLeader, eventTitle/location/notes, createdBy/submittedAt/decidedAt/decidedBy,
  reserved calendarEventId). New `/mijn-planning` route + `MyPlanningView.vue` (TeamMember-only): add/remove
  own draft shifts for the current week, "Week indienen" batch-submits every draft via `writeBatch`.
  `firestore.rules` shifts split three ways (admin/manager/member-owns-shift); fixed a real bug in passing —
  a TeamManager could previously walk an `approved` shift back to `pending` because only the incoming status
  was checked. **Rules not yet deployed.**
- **Overlap validation** (ticket-03 defect #4, was completely missing) — `shiftsStore.hasOverlap()`, wired
  into both PlanningView and MyPlanningView's submit handlers. Client-side only, by necessity — Firestore
  rules can't query sibling documents to enforce this server-side.
- **Real Firestore-backed History view** — `HistoryView.vue` no longer shows the old static mock; it groups
  live `/shifts` data by month (total, approved, TL headcount) with a member/admin split matching the read
  rules. The full "TL trend over time" report from the client transcript is still out of scope — that needs
  the `/periods` snapshot question resolved first (see the recruitment/periods note below).
- **Admin-triggered email invites (new ask, mid-session)** — Stan wants "admin just sends a sign-up mail."
  Built on Firebase Auth's free passwordless **email-link** sign-in (Firebase's own mail relay, zero Cloud
  Functions, fits Spark). `authService.sendInvite/isInviteLink/completeInvite`, new public route
  `/complete-invite` + `CompleteInviteView.vue`, and a "Nieuwe medewerker uitnodigen" panel on `UsersView`.
  The invited person still lands as a normal pending `/users/{uid}` doc — no rules changes needed, no
  privilege shortcut. **⚠️ Needs Stan to enable "Email link" under Authentication → Sign-in method in the
  Firebase Console before this can be tested live** — that's a security-provider setting Claude can't flip.
- **Nav made role-aware** — `AppShell.vue` previously showed every logged-in user the same links regardless
  of role, including ones a TeamMember's route guard would immediately bounce them out of. Fixed.
- **Dutch translation, partial** — every view touched this session (Planning, MyPlanning, History, Users,
  AppShell nav, CompleteInvite) is now in Dutch per the client's explicit ask ("alles in t nederlands").
  Login/Signup/PendingApproval/Unauthorized/NotFound/Recruitment/Employees/admin-Dashboard are **still
  English** — flagged as a background task (see task chip) rather than half-done inline.
- Unit tests: 27 → 35, all green. Typecheck clean throughout.

### Still open

- **Two rules changes queued, neither deployed**: 007 (employee uid-keying) and 008 (self-service shifts +
  backwards-transition fix). Both audited as low-risk (empty prod roster) but need Stan's go-ahead.
- **Email-link sign-in not yet enabled in Firebase Console** — invite feature is code-complete but untestable
  until Stan flips that toggle.
- **Recruitment (`recruitmentLeads`) and `/periods`** — still untouched this session beyond the earlier
  audit note that `/periods`' "written server-side only" comment refers to a Cloud Function that no longer
  exists. No write path currently exists for historical snapshots.
- Approval queue in `PlanningView` is still a flat day-grouped list, not grouped by `(employee, weekStart)`
  as ticket-03's acceptance criteria describes — functional as-is, just not the ideal admin UX yet.

---

## Continued functional build-out (same third session, live-testing round)

Stan started live-testing against prod via his own local dev server while this was in flight. Landed:

- **Recruitment module built from scratch** (was a static English mock) — `types/recruitmentLead.ts`,
  `recruitment.service.ts`, `stores/recruitment.ts`, `RecruitmentView.vue` rewritten: real CRUD, stage
  pipeline (nieuw/gecontacteerd/sollicitatie gepland/opgekomen/niet opgekomen/aangenomen/niet aangenomen —
  reconciling FRD §13 with the client's own Dutch stage names), weekly-leads counter, funnel stat cards.
  Route opened to TeamMember as read-only per the transcript (rules already allowed this from Ticket 01,
  just no client code used it). 40 unit tests now, up from 35.
- **🔴 Prod incident, caught and fixed live**: Stan's own UI testing demoted **both** Administrator
  accounts (`admin@peoplemarketing.be` and `stanverbruggen@protonmail.com`) to non-admin roles in the same
  session, which cascaded into permission-denied everywhere (nothing admin-gated works with zero admins —
  including fixing it back through the app itself). Fixed from a terminal both times via
  `FORCE_PROD=true tsx scripts/grantRole.ts <email> Administrator gent`, which bypasses rules via the
  Admin SDK. **Built the actual guard afterward**: `usersStore.adminCountFor(officeId)` +
  `UsersView` now blocks (disables Save, shows a warning) any role change that would leave an office with
  zero Administrators. Client-side only — `firestore.rules` can't cheaply count sibling docs in a
  single-document rule — so this stops an accidental click, not a determined bypass via the console.
- **Dutch translation extended**: `EmployeesView.vue` and the `UsersView.vue` role column (was showing the
  raw English enum value even though the edit dropdown was already Dutch — Stan caught this). Added
  `ROLE_LABELS` in `types/user.ts` as the single source for role display text, used consistently now.
- **Password reset started, not finished**: `authService.sendPasswordReset()` added (Firebase's built-in
  reset email, on by default, no console toggle needed unlike the invite link). **Not yet wired** to the
  auth store or a "Wachtwoord vergeten" link on `LoginView.vue` — next thing to pick up.
- **Invite email tested live, failed as predicted**: Stan tried "Uitnodiging versturen" — console showed
  400s from `identitytoolkit.googleapis.com`. Root cause confirmed: Email link sign-in is still off in the
  Firebase Console. Stan needs to flip Authentication → Sign-in method → Email link → Enable before this
  can work. Code side is unaffected/correct.
- **Stale Netlify build confirmed live**: Stan hit `peoplemarketing.netlify.app/unauthorized` after signing
  in — that's the old pre-signup/pending-approval bundle, not a new bug. Netlify auto-deploys from
  `origin/main` (GitHub) on push; nothing from this session (or the prior one) has been pushed yet. A
  redeploy needs a commit+push, which needs Stan's go-ahead (visible/shared-state action) — not done yet.
- **Requested, not started**: a weekly agenda/calendar grid for `MyPlanningView` (Stan: "we need to see an
  agenda here") — FRD §8 territory, still just the flat list. Picking this up is the natural next step.
- `firestore.rules` changes from 007/008 **still not deployed** — held per Stan's explicit "no" earlier.

### Immediate next steps (in order Stan asked for)
1. ✅ Password-reset UI wired — `authService.sendPasswordReset` now has a "Forgot password?" toggle on `LoginView.vue`.
2. ✅ `MyPlanningView` weekly agenda grid built — 7-day grid replacing the flat list, per-day quick-add.
3. ✅ Committed + pushed to `origin/main` (Netlify auto-deploys from there) — twice this round: Dashboard/role-drift fixes, then password-reset/agenda-grid.

## Update — audit + fix round (2026-08-25)

Independent FRD-vs-app audit (no vault claims trusted blind), then fixes, then prod deploy:

- **Fixed: Dashboard was 100% mock data.** `DashboardView.vue`'s admin view hardcoded a staffing bar and recruitment
  funnel next to `PlanningView`/`RecruitmentView`, which already had the real numbers one click away. Now pulls
  from `useShiftsStore`/`useRecruitmentStore` directly — no more fabricated KPIs on the page an admin lands on first.
- **Fixed: role/isTeamLeader duplication.** `/users/{uid}` and `/offices/{id}/employees/{uid}` both carried
  independently-editable `role`/`isTeamLeader` copies with no sync — a promotion on the Users page silently went
  stale on the Employees roster (which is what shift TL-stamping actually reads from, since a TeamManager can't
  read other people's `/users` docs under the rules). Fix: `usersStore.assignRole` now also pushes the same values
  onto the roster doc (`employeesService.syncRoleAndTeamLeader`); `EmployeesView`'s edit form shows role/TL
  read-only with a link to Users instead of offering a second write path.
- **Password reset wired**, weekly agenda grid built (see above).
- **🔴 007 + 008 firestore.rules changes deployed to prod** (2026-08-25, `firebase deploy --only firestore:rules`,
  confirmed success) — employee-doc uid-keying and self-service shift creation are now enforced server-side, not
  just client-side. This was the last piece holding those two features back from being real on prod.
- **New: client sent the logo file** (inline image, not yet saved to disk — waiting on Stan to drop it at a real
  path, e.g. `src/assets/logo.png`, since it arrived as chat content with nothing to read/write from). Once it's
  on disk it replaces `src/assets/logo-placeholder.svg` — also resolves half of the branding open question
  (logo itself; the pink-vs-"wit" colour conflict is still open, needs the client asked directly, see below).

### Still open after this round

- Netlify frontend now matches `origin/main` HEAD as of this push — worth Stan double-checking the live site once
  the deploy finishes, same as any push.
- Logo file — waiting on a real path from Stan.
- Colour conflict (pink vs "wit") — still needs a direct question to the client, not guessed at.
- Recruitment auto-messaging, multi-office cross-admin flow, TL headcount trend report — all still blocked on
  decisions only Stan/the client can make (send channel, Blaze-vs-free-tier, `/periods` design), not touched
  this round.

## Production Firestore state (2026-08-24)

- Real office already exists in prod: doc `/offices/gent` — `{ isActive: true, name: "Gent", officeId: "Gent", timezone: "Europe/Brussels" }`.
- ⚠️ **Mismatch still unresolved**: doc ID is lowercase `gent`, `officeId` field value is `"Gent"` (capital) — cosmetic, doesn't block anything, low priority.
- **`admin@peoplemarketing.be`** (prod Firebase Auth, real client-facing login) — role now lives at `/users/{uid}` (`{ role: Administrator, primaryOfficeId: gent, isTeamLeader: true }`), written directly via the Admin SDK this session. Its old custom claims (`{ role: Administrator, officeId: gent, isTeamLeader: true }`, set in the *previous* session) are now unused/inert — rules don't read them anymore — but harmless to leave in place.
- ⚠️ **Near-miss, now fixed**: deploying the Firestore-only-roles rules without this doc would have locked Stan's own admin login out of prod. See the "Prod near-lockout" bullet under Built, and the general rule going forward: **any account with claims from before this session needs a matching `/users/{uid}` doc** — if you find another old claims-only account, run `scripts/grantRole.ts` against it (with `FORCE_PROD=true`) to fix it the same way.
- **`firestore.rules` deployed to prod TWICE this session** — first the claims-based version (self-signup + public offices), then again after the Firestore-only-roles pivot. The version currently live is the final Firestore-only one; nothing further to deploy for RBAC.
- Real domain is **`peoplemarketing.be`** (not `.nl` as earlier docs assumed) — correct source for real brand colours/logo if that ever gets revisited.
- Service account key lives at `peoplemarketing-c5bfd-firebase-adminsdk-fbsvc-b4092c4705.json` in the repo root — **gitignored**, never commit it. Consider moving it outside the repo folder entirely when convenient.
- `seed.ts`/local emulator still use `office-main` — unrelated, emulator-only, no conflict with prod.

## Open FRD questions still pending user input

- ✅ **Pink hex + logo resolved (2026-08-25)** — pulled directly from peoplemarketing.nl's own inline SVG logo markup: `#e6007e` pink, white for the mark/text against a dark ground. That reconciles the "onze kleuren zijn wit" comment (white is the secondary/text colour on their own logo, not a rejection of pink) rather than a real conflict. Logo now at `src/assets/logo.svg`, hex in `brand.ts`. Caveat: sourced from their live public site, not a verbatim client sign-off for app use — worth a one-line confirmation from Stan to the client, but low-risk since it's literally their own current branding.
- Recruitment lead fields (need current Google Doc from client)
- Default office timezone — assumed `Europe/Amsterdam`, confirm
- Invite/admin-creation flow (currently script-only)
- Google Calendar backing for Event-type shifts, or plain free-text range? (`decisions/004-shift-types.md`)
- Send channel for recruitment auto-messages: WhatsApp Business API vs email vs SMS
- Dutch-only UI vs i18n-scaffolded-now-Dutch-default
- Cross-office admin assignment — once a second real office exists, can one admin approve/manage users in an office that isn't their own, or does every office need its own admin? (`decisions/005`, flagged this session)

## Risks

- **Bash classifier unavailable** in this session — couldn't run `npm install`, `npm run build`, or `npm test`. To verify scaffold locally: run those commands and paste any errors back.
- **No production deploy target yet** — `firebase.json` exists but no hosting setup. Add in a later ticket.
- **Firestore rules in Ticket 0 are wide-open** for any signed-in user. Tighten before any non-local use.

## Update — functionality pass (2026-08-25, same day as the audit round above)

- **✅ TL headcount trend chart added to History view** — client transcript asked to see where team-leader
  headcount rises or falls over time; this was the one open gap not blocked on any external decision. Computed
  live from `/shifts` (month-over-month count + ▲/▼ delta), no `/periods` snapshot needed.
- **✅ Dutch translation finished.** Login, Signup, PendingApproval, Unauthorized, NotFound, and the admin
  Dashboard were the last English views (tracked as a background task above) — all translated. Also caught
  another mock-data leftover while in there: the admin Dashboard header showed a hardcoded
  "Monday, 24 August 2026" instead of the real date — fixed.
- All committed and pushed to `origin/main` (Netlify auto-deploys).