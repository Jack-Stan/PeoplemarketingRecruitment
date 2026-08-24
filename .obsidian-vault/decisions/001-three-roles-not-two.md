# Decision 001 — Three roles, not two

**Date:** 2026-08-24
**Status:** Accepted
**Deciders:** Stan + People Marketing (client)

## Context

FRD v0.1 §5 listed only two roles: **Administrator** and **Employee**. During discovery on 2026-08-24 Stan clarified with the client that:

- Big Boss needs a dedicated **Administrator** role (full access, final approver).
- A middle layer — **TeamManager** — exists in the org and needs to: draft shifts, submit shifts for approval, view their squad's planning.
- Most employees are **TeamMember** — read-only view of their own shifts.

Two roles would have forced TeamManager functionality into the Administrator role (over-privileged), or pushed it onto Employee (insufficient). Three roles model the actual org chart cleanly.

## Decision

Use **three** roles:

| Role | Constant | Capabilities (initial) |
|---|---|---|
| `Administrator` | `Roles.Administrator` | Full read/write across the office. Final approver. Manage employees, offices, recruitment. |
| `TeamManager` | `Roles.TeamManager` | Draft + submit shifts for their squad. View squad planning. Manage recruitment leads. |
| `TeamMember` | `Roles.TeamMember` | Read-only view of own shifts. View history. |

Custom claim shape:

```
{ role: 'Administrator' | 'TeamManager' | 'TeamMember', officeId: string, isTeamLeader: boolean }
```

## Consequences

- `firestore.rules` gains `isManager()` / `isMember()` helpers alongside `isAdmin()`.
- Router `meta.roles` per route must include all three roles where relevant (e.g. `/dashboard` accepts all three; `/employees` accepts Administrator + TeamManager).
- Future-proofs the data model: if the org adds another tier later (e.g. RegionalManager), the change is a new constant + rules update, not a refactor.

## References

- `src/types/user.ts` — `Role` enum
- `src/stores/auth.ts` — `hasRole(...)` helper
- `src/router/routes.ts` — `meta.roles` allowlists
- `firestore.rules` (Ticket 01)