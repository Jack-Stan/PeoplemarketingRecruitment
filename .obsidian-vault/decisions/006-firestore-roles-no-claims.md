# Decision 006 — Drop custom claims + the Cloud Function; roles live only in Firestore

**Date:** 2026-08-24 (same session as decisions/005, a few hours later)
**Status:** Implemented
**Deciders:** Stan — explicit, unprompted: "im not gonna upgrade to blaze at all. we gonna keep it free ay"
**Supersedes:** decisions/005 point 4 ("Role assignment is the Cloud Function's job") and every claims-related mechanism in decisions/001/Ticket 01. Points 1–3 and 5 of decisions/005 (the `/users` vs `/offices/*/employees` split, the pending-state design, the rules shape) are unaffected — only *how role is stored and checked* changed.

## Context

`assignUserRole` (the callable Cloud Function from decisions/005) deployed fine in theory but failed for real: `firebase deploy --only functions` errors out because Cloud Functions requires the Blaze (pay-as-you-go) plan, and `peoplemarketing-c5bfd` is on the free Spark plan. Stan was asked to upgrade and declined outright, permanently — not "not right now," but "keep it free." See `[[project_spark_plan_no_blaze]]` memory.

That leaves custom claims dead in the water: they can **only** ever be set via the Admin SDK, which means either a Cloud Function (needs Blaze) or Stan running a script from his own terminal by hand every single time someone needs a role (what `scripts/setClaims.ts` did, and the exact "terminal-only onboarding" pain point that started this whole scope addition in the first place).

## Decision

**Role/officeId/isTeamLeader move entirely into `/users/{uid}` in Firestore. Custom claims are no longer used anywhere in this app.**

`firestore.rules` no longer reads `request.auth.token.*`. Every helper (`isAdmin()`, `isManager()`, `isMember()`, `sameOffice()`) now reads the caller's own `/users/{request.auth.uid}` doc via `get()`:

```
function myProfile() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}
function isAdmin() {
  return isSignedIn() && myProfile().role == 'Administrator';
}
```

`get()` does not re-run security rules (it's a direct data fetch), so this can't recurse into the `/users/{userId}` match block. Every collection under `/offices/{officeId}` (`employees`, `shifts`, `recruitmentLeads`, `periods`) needed **zero changes** — they only ever called the helpers, never touched claims directly.

Role assignment (`UsersView.vue` → `usersService.assignRole()`) is now a plain `updateDoc` on `/users/{uid}`, gated by a rule identical in spirit to before, just checked against the *incoming* write instead of existing state (needed because a pending user's existing `primaryOfficeId` is `null`):

```
allow update: if isAdmin()
  && sameOffice(request.resource.data.primaryOfficeId)
  && request.resource.data.role in ['Administrator', 'TeamManager', 'TeamMember'];
```

`assignUserRole` (the Cloud Function) and the whole `functions/` directory were deleted — dead code, since it will never deploy on Spark. `scripts/setClaims.ts` was rewritten as `scripts/grantRole.ts`: same terminal-side bootstrap purpose (granting the very first Administrator, since the Users page needs an admin to already exist), but now just a Firestore write, no `setCustomUserClaims` call.

The auth store's `hydrate()` changed from a one-time `getIdTokenResult()` read to `usersService.getOnce()` (immediate value, awaited before post-auth navigation, same race-avoidance as before) followed by `usersService.subscribeOwn()` — a **live** `onSnapshot` on the caller's own `/users/{uid}` doc. This is a genuine improvement over claims: a role assigned by an admin now applies to the affected user's session immediately, no "sign out and back in to refresh your ID token" caveat (that caveat is gone from every doc that mentioned it).

## Consequences

- **Extra Firestore reads**: every rule check that used to be a free ID-token claim read is now a real `get()` against Firestore, which counts toward the (generous) Spark daily quota and adds minor latency. At this app's scale (one client, a handful of offices, dozens of users) this is a non-issue — flagging it here only so nobody's surprised revisiting this at 10x the scale.
- **No more Cloud Functions, ever, on this project** unless Stan reverses the Blaze decision — see `[[project_spark_plan_no_blaze]]`. Ticket 05 (recruitment auto-messaging) was already going to need a Cloud Function to hold a third-party API secret; that's now a real open blocker, not just a "nice to have server-side," and needs Stan's explicit sign-off if/when it comes up.
- `AppUser`/`UserProfile` types are unchanged — this was purely a mechanism swap under the same data shape.
- Every existing rules test that authenticated with `testEnv.authenticatedContext(uid, { role, officeId, isTeamLeader })` (custom claims) had to be rewritten to instead seed a `/users/{uid}` Firestore doc before acting, since claims are now ignored entirely by the rules.

## References

- `decisions/005-users-employees-datamodel.md` (partially superseded — see header)
- `firestore.rules`
- `src/stores/auth.ts`, `src/services/users.service.ts`
- `scripts/grantRole.ts` (was `scripts/setClaims.ts`)
- `[[project_spark_plan_no_blaze]]` (Claude memory)
