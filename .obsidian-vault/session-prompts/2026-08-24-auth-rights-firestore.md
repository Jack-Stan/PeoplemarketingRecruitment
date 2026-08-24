# Session kickoff prompt — Auth, Rights & Firestore data model

Paste this into a new Claude Code session in `C:\RFT\Projects\CRM`:

---

Read the vault first: `.obsidian-vault/index.md`, `project-status.md`, `dev-plan.md`, and `tickets/ticket-01-rbac.md` (especially the "Scope addition" note near the top).

We're doing ONE thing this session, properly, before any more feature UI: **sign-in/sign-up, roles/rights, and the Firestore data model.** Nothing else — no Dashboard, no Recruitment, no more Planning UI polish. Stop and ask if you're about to touch anything outside this scope.

Concretely:

1. **Self-signup** — right now only admin-created accounts exist (`scripts/setClaims.ts`, emulator-only). Add a real signup flow: `SignupView.vue` + `authService.signUp()`. A freshly self-signed-up user has no role yet (`role: null` claim) — that's a distinct "authenticated but pending" state, not the same as `/unauthorized`. Decide and document how the router/guard/UI should treat that state (a "waiting for admin approval" screen, most likely).

2. **Admin Users page** — `UsersView.vue`, admin-only. Lists every Firebase Auth user (self-registered or admin-created) with their current claims, and lets the admin assign/change `role` / `officeId` / `isTeamLeader` inline. This needs the **first real Cloud Function** in this project — a callable, admin-only `assignUserRole` function — because setting custom claims can only be done with the Admin SDK, and it has to work from the deployed app itself, not just Stan's terminal via `setClaims.ts`.

3. **Firestore data model pass** — review `firestore.rules` and the collections actually in use (`offices`, `users`, `offices/{id}/employees`, `offices/{id}/shifts` — `recruitmentLeads`/`periods` exist in rules but have no data yet) and make sure it's coherent end to end now that self-signup exists: what does `/users/{uid}` need to hold vs. what only lives in claims, what happens to the `/offices/{id}/employees/{uid}` doc when someone self-signs-up (does an employee doc get created automatically, or does the admin create it separately when granting rights?).

4. Known landmines from the last session, already fixed but worth being aware of:
   - `src/stores/auth.ts` `signIn()` used to have a race — it navigated before claims hydrated, sending fresh logins to `/unauthorized`. Fixed by awaiting `hydrate()` inside `signIn()` — check this pattern gets followed for `signUp()` too.
   - `/offices/gent` doc ID is lowercase, but its `officeId` field value is `"Gent"` (capital) — still inconsistent, low priority, mentioned in `project-status.md`.
   - A Firebase service account key sits at `peoplemarketing-c5bfd-firebase-adminsdk-fbsvc-b4092c4705.json` in the repo root, already gitignored. You'll need it (or a Cloud Functions deploy identity) for anything server-side.
   - Local Firestore emulator is broken on this machine (JDK21/Windows loopback-selector bug) — rules changes get deployed straight to prod and verified there, there's no working local emulator loop yet. Flag this again if it's still broken; don't silently skip verification.

Typecheck (`npx vue-tsc --noEmit`) and run `npm test` before calling anything done. Update the vault (`tickets/ticket-01-rbac.md`, `project-status.md`) as you go, same as the conventions already in there.
