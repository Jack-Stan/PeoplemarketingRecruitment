# Decision 007 — Employee doc ID must equal the Auth uid

**Date:** 2026-08-24 (third session, data-model pass)
**Status:** ✅ Accepted (Stan, 2026-08-24) and implemented — option A. Rules change **not yet deployed to prod**.
**Severity:** 🔴 Latent prod bug, will bite the moment a TeamMember logs in

## The problem

Three places already assume `employeeId === auth.uid`:

1. `firestore.rules` → `/offices/{officeId}/shifts/{shiftId}`
   ```
   allow read: if ... || (isMember() && sameOffice(officeId)
     && resource.data.assignedEmployeeId == request.auth.uid);
   ```
2. `firestore.rules` → `/offices/{officeId}/employees/{employeeId}`
   ```
   allow read: if ... || (isMember() && ... && request.auth.uid == employeeId);
   ```
3. `src/views/DashboardView.vue:33`
   ```ts
   shiftsStore.subscribeMine(auth.officeId.value, auth.user.value.uid);
   ```

But `employeesService.create()` (`src/services/employees.service.ts:41`) uses **`addDoc`** — Firestore
generates a random 20-char ID that can never equal a 28-char Auth uid.

**Consequence:** every employee created through the Employees CRUD (i.e. all of them) is invisible to
the person it represents. A TeamMember's dashboard returns zero shifts, and they cannot read their own
employee doc. Not caught yet only because no real TeamMember has logged in on prod.

Same latent break in `PlanningView.vue`: shifts are drafted against `employee.employeeId` (random),
so `assignedEmployeeId` can never match a uid either.

## Options

**A. `setDoc(doc(col, uid))` — employee doc ID *is* the uid.**
Employees CRUD stops being "add a name to a roster" and becomes "promote an existing account to staff".
Requires the person to have signed up first (they have — that's what `/users/{uid}` + the Users page do).

**B. Keep random IDs, add `employee.uid` / `user.employeeId` link field.**
Rules would need `get()` on the employee doc to resolve the link on every shift read — an extra
billed read per document, and `get()` inside a list rule is evaluated per result. Expensive and slow.

**C. Do nothing, accept members can't see their own data.** Not viable — FRD §7 requires it.

## Recommendation — A

The `/users/{uid}` doc already is the account identity (decision 006). Making the employee doc share
that key means: zero join, zero extra reads in rules, `assignedEmployeeId` is trivially checkable, and
"who is this shift for" is answerable from the token alone.

Cost: the Employees page needs a picker of existing `/users` accounts instead of a free-text add form
— which is arguably the *correct* UX anyway, and closes the decision-005 point-3 open question
("admin has to do two separate steps for every new hire") from the other direction: one step, on the
Users page, "also add to roster".

Migration: prod has employee docs from `seed.ts` only (emulator office `office-main`), plus whatever
was created by hand in `/offices/gent/employees`. **Needs checking with the Admin SDK before any
change** — same discipline as the near-lockout catch in session 2.

## Prod audit before implementing (done)

`scripts/auditEmployeeIds.ts` (new, read-only, safe against prod) was run against
`peoplemarketing-c5bfd` with the Admin SDK before any code changed:

```
Auth accounts: 2
  aCvwA0BeE7MuMbh6tPj1Zzi5upq2  admin@peoplemarketing.be
  c6wBtN1Jq0U7gjUiU8jri8Z7qZN2  stanverbruggen@protonmail.com
Offices: 1
/offices/gent/employees — 0 doc(s)
/offices/gent/shifts   — 0 doc(s)
```

**Clean slate — zero orphaned docs, so no migration was needed.** Had there been any, the script
reports the uid each orphan *should* have been keyed by (matched on email). Keep it around: it's the
same pre-flight check that caught the near-lockout in session 2, and it's the only external signal
available while the emulator is out of action.

## What shipped

- `employeesService.create(officeId, uid, payload)` — `addDoc` → `setDoc(doc(col, uid))`, plus a
  `getDoc` existence pre-check so re-adding someone gives a readable error instead of silently
  overwriting their roster entry.
- `useEmployeesStore().create(officeId, uid, payload)` — signature follows.
- `firestore.rules` — the employees `allow write` was split. `create` now additionally requires the
  doc ID to `exists()` under `/users/{employeeId}` **and** that account's `primaryOfficeId` to equal
  this office. So the bug can't be reintroduced by any client, not just the one that used to call
  `addDoc`. `update`/`delete` are unchanged (`isAdmin() && sameOffice()`).
- `EmployeesView.vue` — the add form leads with an **account picker** (`eligibleAccounts`: approved
  into this office, not already on the roster) which prefills name/email/role/TL from `/users`;
  email is read-only in create mode since the account owns it. Empty state links to the Users page.
  `/users` is only subscribed when the viewer is an Administrator (a TeamManager would just eat a
  permission-denied).
- Tests: `employees.store.spec.ts` asserts the uid is forwarded, plus a failure-path spec (28/28 unit
  tests green, typecheck clean). Three new specs in `tests/rules/firestore.rules.spec.ts` cover
  random-ID create, pending-account create, and approved-account create — **written but unrunnable
  locally**, emulator still broken.

## Consequences if A is taken

- `employeesService.create(officeId, uid, payload)` — signature gains a `uid`, `addDoc` → `setDoc`.
- `EmployeeCreatePayload` no longer omits the ID; it's supplied by the caller.
- `firestore.rules` employee `create` should assert `employeeId` is a real, same-office `/users` doc.
- Anyone in `/offices/*/employees` without a matching Auth account becomes un-representable —
  if the client wants roster entries for people who never log in, that's a real conflict and needs
  Stan → client confirmation before this lands.

## References

- `decisions/005-users-employees-datamodel.md` point 3 (the deliberate `/users` vs `employees` seam)
- `decisions/006-firestore-roles-no-claims.md`
- `src/services/employees.service.ts`, `src/views/DashboardView.vue`, `firestore.rules`
