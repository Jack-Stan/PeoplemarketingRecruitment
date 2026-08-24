# Ticket 01 — Auth hardening + RBAC plumbing

**Status:** 📋 Next
**Goal:** Move from "any signed-in user can do anything" to a real RBAC model with rules, claim bootstrapping, and guard enforcement.

## Scope

1. **Bootstrap helper** — `scripts/setClaims.ts` to assign `{ role, officeId, isTeamLeader }` to a user via Admin SDK. Used by both `seed.ts` and ad-hoc ops.
2. **Tighten `firestore.rules`** — implement the full RBAC skeleton from the plan:
   - `isAdmin() / isManager() / isMember()` helpers
   - Office-scoping via `sameOffice(oid)`
   - `shifts`: admins draft + approve; managers draft + submit-for-approval; members read-only their own
   - `recruitmentLeads`: admins + managers read/write; members no access
   - `periods`: read-only from client (writes via Cloud Function later)
3. **Router guard** — already has `meta.roles` enforcement (added externally — verify). Add:
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