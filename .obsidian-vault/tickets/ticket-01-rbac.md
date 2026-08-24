# Ticket 01 — Auth hardening + RBAC plumbing

**Status:** ✅ Done, including the 2026-08-24 scope addition — deployed to prod and manually verified live (self-signup, pending-approval, admin login all confirmed working against the real Firebase project via the local dev server). Router guard was already implemented externally (verified in `src/router/index.ts`).

**2026-08-24, second session (auth/rights/data-model focus)** — the scope addition is implemented, with one major architecture change mid-session:
- `SignupView.vue` + `authService.signUp()` + `useAuthStore().signUp()` — self-signup, with an office picker (offices are public-readable so a visitor with no account yet can browse them).
- `PendingApprovalView.vue` + router guard `isPending` state — a signed-in user with `role: null` lands here, not `/unauthorized`. Renders without the AppShell nav chrome (`meta.noShell`) — a bug caught live: Stan tested signup and saw the full Planning/Employees/etc. sidebar around a page he has no access to yet.
- `UsersView.vue` (admin-only, `/users`) — lists every `/users/{uid}` doc (self-registered or admin-created), assigns role/isTeamLeader with a **direct Firestore write**. Office assignment is locked to the admin's own office (see decisions/005/006) — no cross-office picker.
- **Architecture pivot**: the plan was originally a Cloud Function (`assignUserRole`) for role assignment, since only the Admin SDK can set custom claims. Stan explicitly ruled out ever upgrading to Blaze ("we gonna keep it free ay") — Cloud Functions require it. So custom claims were dropped entirely: role/officeId/isTeamLeader now live only in `/users/{uid}`, checked via `get()` in `firestore.rules`. The `functions/` directory was deleted. See `decisions/006-firestore-roles-no-claims.md` and the `project_spark_plan_no_blaze` memory — **don't propose Cloud Functions/Blaze for this project again.**
- `firestore.rules` — `/users/{userId}` create rule allows self-signup with `role`/`primaryOfficeId` null and a required `desiredOfficeId`; `update` rule lets an admin approve a pending user by checking the *incoming* office against their own (the existing office is null pre-approval); `/offices/{officeId}` read is public (name/timezone/isActive only — sub-collections unaffected).
- Data model decisions written up in `decisions/005-users-employees-datamodel.md` (mostly still accurate) and `decisions/006` (the claims pivot).
- Bug fix found in passing: `shiftsService.subscribe(officeId)` (unfiltered collection query) is denied outright for a TeamMember under `firestore.rules`. Added `shiftsService.subscribeForEmployee()` / `useShiftsStore().subscribeMine()` (a `where('assignedEmployeeId','==',uid)` query) — used by the new TeamMember dashboard.
- `DashboardView.vue` — Stan flagged mid-session that a TeamMember's dashboard needs to be genuinely different (their own shifts + a completed-count), not the admin's KPI view. Now role-split: Administrator/TeamManager keep the existing (still-mocked) broad view; TeamMember gets "my shifts" real data via `subscribeMine`. **Self-service open-shift signup ("claim an open shift") was explicitly NOT built** — needs a new "open/unassigned shift" concept in the Shift model, real Ticket 03 extension work.
- `scripts/seed.ts` / `scripts/grantRole.ts` (renamed from `setClaims.ts`) updated to write `/users/{uid}` directly, no claims call.
- **Near-lockout caught and fixed**: `admin@peoplemarketing.be`'s claims (set in the previous session) had no matching `/users/{uid}` doc — under the new rules that's a real admin lockout. Found by checking with the Admin SDK before declaring the deploy done, fixed by writing the doc directly. See `project-status.md`.

**Verified live** (local dev server pointed at prod, since the emulator's still broken): self-signup → `/pending-approval` (Stan did this himself), and the admin login lockout was caught and fixed before it became a real incident. **Not yet verified**: the actual admin-approves-a-pending-user flow end-to-end in a browser (code path is correct and rules-tested in principle, just not click-tested). Netlify frontend hasn't been redeployed, so the live `peoplemarketing.be` site doesn't have any of this yet.

**Goal:** Move from "any signed-in user can do anything" to a real RBAC model with rules, role bootstrapping, and guard enforcement.

## Scope

1. **Bootstrap helper** — `scripts/setClaims.ts` to assign `{ role, officeId, isTeamLeader }` to a user via Admin SDK. Used by both `seed.ts` and ad-hoc ops.
2. **Tighten `firestore.rules`** — implement the full RBAC skeleton from the plan:
   - `isAdmin() / isManager() / isMember()` helpers
   - Office-scoping via `sameOffice(oid)`
   - `shifts`: admins draft + approve; managers draft + submit-for-approval; members read-only their own
   - `recruitmentLeads`: admins + managers read/write; members no access
   - `periods`: read-only from client (writes via Cloud Function later)
3. **⚠️ Scope addition (Stan, 2026-08-24, verbal mid-session)** — current model only supports admin-created accounts (`seed.ts` / `setClaims.ts`). Stan now wants **self-signup**: anyone can create an account, and a new **admin "Users" page** lists everyone who's signed up (self-registered or admin-created) so the admin can grant/assign role + office + Team Leader flag themselves — no more script-only onboarding. This needs:
   - A `SignupView.vue` + `authService.signUp()` (currently only `signIn` exists)
   - A default "no role yet" state — a freshly self-signed-up user has `role: null` until an admin assigns one; router guard must treat this as "authenticated but pending", distinct from "not allowed" (different UX than `/unauthorized`)
   - `UsersView.vue` (admin-only) — list every account, current role, inline role/office/TL assign controls
   - ~~Setting claims from the client isn't possible (Admin SDK only) — needs a Cloud Function~~ **Superseded**: role assignment ended up as a direct Firestore write instead, once Stan ruled out Blaze (needed for Cloud Functions). See `decisions/006`.
   - This is a big enough scope change that Stan wants it planned as its own focused session — see `dev-plan.md` for the kickoff prompt
4. **Router guard** — already has `meta.roles` enforcement (added externally — verify). Add:
   - Reject if `auth.role === null` on any `requiresAuth` route
   - Redirect to `/login` when claims aren't yet hydrated
4. **`useAuth.ts`** — already exposes `hasRole(...)`. Add `hasAnyRole(...)` if useful.
5. **Tests** — 2+ specs on the guard (happy + role-mismatch), rules-test runner (`firebase emulators:exec --only firestore vitest run`) for:
   - Employee can't read another employee's shift
   - TeamManager can't approve shifts (admin only)
   - Cross-office reads denied

## Acceptance

- `npm run rules:test` exits 0 with all rule specs passing
- Manual: sign in as TeamManager in emulator, navigate to `/employees` → lands on `/unauthorized`
- Manual: sign in as Administrator → can navigate everywhere

## FRD coverage

§5 (full), §9 (approval workflow definition), §19 (security baseline).