# Decision 005 — Self-signup, `/users` vs `/offices/*/employees`, and role assignment

**Date:** 2026-08-24
**Status:** Partially superseded — see `decisions/006-firestore-roles-no-claims.md`. Point 4 below (Cloud-Function-based role assignment) and every mention of custom claims are no longer accurate: Stan ruled out the Blaze plan, so role assignment is now a direct Firestore write and there is no Cloud Function in this project. Points 1–3 and 5 (the `/users` vs `/offices/*/employees` split, the pending-state design, the rules shape) still stand as written.
**Deciders:** Stan, this session (auth/rights/data-model focus, see `dev-plan.md` "Focused re-plan" note)

## Context

Ticket 01's scope addition asked for self-signup, an admin Users page, and a real Cloud Function for role assignment. That forces answers to three data-model questions that didn't exist before (only admin-created accounts via scripts existed):

1. What does a freshly self-signed-up, not-yet-approved user look like?
2. Where does an admin see/manage "who can log in and what can they do" vs "who is scheduled staff"?
3. Who's allowed to write custom claims, and from where?

## Decisions

**1. Custom claims stay the sole authorization source; `/users/{uid}` is a client-readable mirror, not a second source of truth.**
`role` / `officeId` / `isTeamLeader` on the ID token are what `firestore.rules` and the router guard actually check — unchanged from Ticket 01. `/users/{uid}` exists purely so the Users page can list and filter accounts without an Admin SDK call from the client (Firebase Auth users aren't listable client-side at all). The invariant: every Auth account has a matching `/users/{uid}` doc. Self-signup creates it directly; `seed.ts` and `scripts/setClaims.ts` were both updated to upsert it too, so admin-created accounts show up in the Users page exactly like self-registered ones.

**2. A self-signed-up user has `role: null` in Firestore and *no custom claims at all* until an admin acts — this is "pending", not "unauthorized".**
The client can never set custom claims (Admin SDK only), so a brand-new account simply has an empty claims object; `hydrate()` already reads a missing `role` claim as `null`. The router guard now treats `isLoggedIn && role === null` as a third state distinct from "not logged in" (`/login`) and "logged in, wrong role" (`/unauthorized`): it redirects to `/pending-approval`, a dedicated screen. See `src/router/index.ts`.

**3. `/offices/{officeId}/employees/{uid}` is NOT auto-created at signup or at role assignment — it stays a separate, admin-created record.**
`/users/{uid}` answers "can this person log in and what can they do"; the employee doc answers "are they scheduled staff, and what are their contract hours/employment type" — a strictly bigger, staffing-specific record that not every account needs (an Administrator may never need one). Keeping them decoupled avoids inventing sync logic between two collections for a case (admin also wants this person in the roster) the admin can already do in one click via the existing Employees CRUD. **Open question for later**: if this creates friction (admin has to do two separate steps for every new hire), consider a "also add to roster" checkbox on the Users assign-role dialog that calls `employeesService.create` — deliberately not built now, flagging it here instead of guessing.

**4. Role assignment is the Cloud Function's job, not a client Firestore write — and it's office-scoped to the assigning admin.**
`assignUserRole` (functions/src/index.ts) is a callable, admin-only Cloud Function: it sets custom claims via the Admin SDK *and* writes the `/users/{uid}` mirror in the same call, so the two never drift. It rejects any `officeId` other than the caller's own claim — same office-scoping pattern as `sameOffice()` throughout `firestore.rules`. This means the Users page doesn't need a multi-office picker: there's exactly one office an admin can assign into. Cross-office admin assignment (relevant once multi-office, FRD §18, actually ships) is explicitly out of scope here.

**5. `firestore.rules` changes**: `/users/{userId}` gets a scoped `create` rule allowing a signed-in user to create *only their own* doc, and only with `role` and `primaryOfficeId` both `null` — anything else (setting a role, writing someone else's doc) is denied client-side, on top of the Cloud Function being the only real write path afterward. `/offices/{officeId}` read was widened so any Administrator can read every office (previously scoped to their own claim only) — needed so the Users page can show an office's name without duplicating office data into the claim.

## Consequences

- Every future "list users" or "list offices" UI can keep relying on Firestore reads instead of a second Cloud Function — only claims-writes need the Admin SDK.
- The two-collection split (`/users` vs `/offices/*/employees`) is a deliberate seam, not an oversight — don't "fix" it by auto-creating employee docs without re-reading point 3 above.
- `assignUserRole` needs a real deploy (not just emulator) to verify end-to-end, same emulator-broken caveat as Ticket 01's rules — see `project-status.md` Risks.

## References

- `tickets/ticket-01-rbac.md` (scope addition)
- `functions/src/index.ts`
- `src/router/index.ts`, `src/stores/auth.ts`, `src/services/users.service.ts`
