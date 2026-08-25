# GDPR Data Inventory — CRM (People Marketing)

**Prepared:** 2026-08-25
**Prepared by:** automated code/documentation pass, on request from Stan
**Purpose:** factual ground truth only.

> **This is not a legal review or a compliance sign-off.** It does not assess lawful basis, retention
> periods, data-subject-rights process, or whether a Data Processing Agreement is needed with any
> processor (Firebase/Google included). It is a plain factual map of what personal data this app
> stores, where, and how it flows — produced so Stan (and, if he chooses, a lawyer, and the client)
> have accurate ground truth for that conversation instead of having to reverse-engineer it from the
> codebase themselves. Every claim below is backed by a code reference; nothing here is inferred from
> the FRD or vault docs alone without checking the actual source.

---

## 1. Data subjects in this system

- **Employees** — staff of People Marketing, roster entries under `/offices/{officeId}/employees/{uid}`.
- **App users / accounts** — anyone who has signed up or been invited, `/users/{uid}` (Administrators,
  TeamManagers, TeamMembers, and pending/unapproved signups). Every Employee is also a User, but not
  every User is (yet) an Employee — a pending signup has a `/users` doc with no roster entry.
- **Job applicants / recruitment leads** — people who applied or were referred for a job, never
  necessarily account holders, `/offices/{officeId}/recruitmentLeads/{leadId}`.
- **Firebase Authentication accounts** — email + password (or passwordless email-link) credentials,
  stored by Firebase Auth itself, separate from Firestore.

---

## 2. Collection-by-collection inventory

### `/users/{uid}` — app user accounts
Source: `src/types/user.ts` (`UserProfile`), `src/services/users.service.ts`.

| Field | Personal data? | Notes |
|---|---|---|
| `uid` | Yes (identifier) | Firebase Auth UID |
| `email` | **Yes** | |
| `displayName` | **Yes** | name, set at signup |
| `role` | No | app metadata (Administrator/TeamManager/TeamMember/null) |
| `primaryOfficeId` | No (indirect) | which office — arguably weak employment-context data |
| `desiredOfficeId` | No (indirect) | office applied to at signup |
| `isTeamLeader` | No | app metadata |
| `isActive` | No | app metadata |
| `createdAt`/`updatedAt` | No | timestamps |

- **Data subject:** any account holder (admin, manager, member, or pending signup).
- **Read:** own doc always; an Administrator can read any `/users` doc (needed to see pending signups) — `firestore.rules` lines 58-79.
- **Write:** a signed-in user may only *create* their own doc, and only with `role`/`primaryOfficeId` left null (self-signup, no privilege escalation possible). Only an Administrator can `update` (assign role/office/isTeamLeader) or `delete`.
- **Persistence:** **no delete mechanism exists in application code.** `firestore.rules` permits an Administrator to `delete` a `/users/{uid}` doc, but no service method or UI control calls it anywhere in `src/services/users.service.ts` or the views (confirmed via grep — no `deleteDoc` call against `users`, no delete button in `UsersView.vue`). In practice this means a user record persists indefinitely once created, and there is no in-app "remove me" or admin "delete this account" action.

### `/offices/{officeId}/employees/{employeeId}` — staff roster
Source: `src/types/employee.ts`, `src/services/employees.service.ts`. Doc ID is the account's Auth UID (`decisions/007`).

| Field | Personal data? | Notes |
|---|---|---|
| `firstName`, `lastName` | **Yes** | |
| `email` | **Yes** | |
| `phone` | **Yes** | nullable |
| `avatarUrl` | **Yes** (if set) | photo reference |
| `role`, `isTeamLeader` | No | app metadata (synced copy of `/users` fields, see below) |
| `weeklyContractHours`, `employmentType` | **Yes** | employment/contract data |
| `isActive` | No | app metadata |

- **Data subject:** employee.
- **Read:** admin/manager (any office they're staff of) see the full roster; a TeamMember sees only their own doc (`firestore.rules` lines 92-107).
- **Write:** create/update/delete are Administrator-only.
- **Persistence:** **soft-delete only.** `employeesService.setActive()` (`src/services/employees.service.ts` lines 78-84) explicitly flips `isActive` and is commented "Soft delete only — never hard-delete, history must be preserved (FRD §6)." No `deleteDoc` call exists for this collection anywhere in the codebase. Deactivating someone does not remove their name, email, phone, or contract-hours data — it remains fully readable by admin/manager indefinitely.

### `/offices/{officeId}/shifts/{shiftId}` — shift records
Source: `src/types/shift.ts`, `src/services/shifts.service.ts`.

| Field | Personal data? | Notes |
|---|---|---|
| `assignedEmployeeId` | Yes (identifier, links to a person) | |
| `employeeName` | **Yes** | denormalised at create time — see below |
| `employeeIsTeamLeader` | No (metadata, but tied to a named person) | intentionally a point-in-time snapshot, not live |
| `createdBy`, `decidedBy` | Yes (identifiers) | who drafted/decided the shift |
| `date`, `weekStart`, `type`, `startTime`, `endTime`, `status`, `rejectionReason`, `eventTitle`, `location`, `notes` | Mostly operational, but `notes`/`rejectionReason` are free text and could incidentally contain personal data | |
| `submittedAt`, `decidedAt`, `createdAt`, `updatedAt` | No | timestamps |

- **Data subject:** employee (the person the shift is assigned to), plus the admin/manager who acted on it (as an actor, via `createdBy`/`decidedBy`).
- **Read:** admin/manager (office-scoped) see all; a TeamMember sees only shifts where `assignedEmployeeId == own uid`.
- **Write:** create/update gated by role and shift status (see rules lines 110-147); a member may delete only their own still-`draft` shift.
- **Persistence:** **`shiftsService.remove()` exists (hard delete)** but is only reachable by the owning member for a `draft` shift before submission, or by an admin (rules allow admin delete unconditionally, line 143). Once a shift reaches `pending`/`approved`/`rejected`, there is no delete path in application code at all — shift history, including the employee's name (`employeeName`) and any free-text `notes`, persists indefinitely with no purge mechanism. Note: `employeeName` is deliberately denormalised onto every shift doc (comment in `src/types/shift.ts` lines 32-38) specifically so a TeamMember without roster read-access can still see who a shift belongs to — meaning a name is physically copied into every shift record ever created for that person.

### `/offices/{officeId}/recruitmentLeads/{leadId}` — job applicants / recruitment leads
Source: `src/types/recruitmentLead.ts`, `src/services/recruitment.service.ts`.

| Field | Personal data? | Notes |
|---|---|---|
| `name` | **Yes** | |
| `email` | **Yes** | nullable |
| `phone` | **Yes** | nullable |
| `source` | No | WhatsApp/Instagram/Website/etc. |
| `stage` | No | pipeline stage, incl. `rejected`/`no_show` |
| `notes` | **Potentially** | free text |
| `createdBy` | Yes (identifier) | which staff member entered the lead |
| `createdAtMs`/`createdAt`/`updatedAt` | No | timestamps |

- **Data subject:** job applicant (not necessarily an account holder in this system at all).
- **Read:** admin/manager (office-scoped) full access; TeamMember read-only (per client transcript — "regular users should be able to see the leads list").
- **Write:** create/update restricted to admin/manager (`isStaffOf`).
- **Persistence:** **no delete mechanism exists anywhere in the code.** `src/services/recruitment.service.ts` has no `remove`/`delete` method, and while `firestore.rules`' `allow write: if isStaffOf(officeId)` on this sub-collection technically covers delete too, no client code ever calls it. Practically: a rejected or no-show applicant's name, email, and phone remain in the system forever, with no purge path, once entered.

### `/offices/{officeId}` — office directory
Source: `src/types/office.ts`, `src/services/offices.service.ts`.

| Field | Personal data? |
|---|---|
| `name`, `timezone`, `isActive` | No |

- Not personal data. Publicly readable by design (`firestore.rules` line 87) so an unauthenticated visitor can pick an office at signup. No data subject concerns here, included for completeness.

### `/offices/{officeId}/auditLog/{entryId}` — audit trail
Source: `src/types/auditLog.ts`, `src/services/auditLog.service.ts`.

| Field | Personal data? | Notes |
|---|---|---|
| `actorUid` | Yes (identifier) | who performed the action |
| `actorEmail` | **Yes** | denormalised deliberately "so the audit trail stays readable even if the actor's account is later deleted" (comment in `src/types/auditLog.ts` line 29) |
| `targetLabel` | **Potentially** | free-text human-readable description, e.g. "Jan Peeters · 2026-08-25" — explicitly documented as containing a person's name |
| `action`, `details` | Mostly operational; `details` is free text | |
| `createdAtMs` | No | |

- **Data subject:** the staff member who performed a logged action, and often a second person named in `targetLabel` (e.g. whose role was changed, whose shift was approved).
- **Read/create:** staff only (`isStaffOf`); **update/delete denied to everyone, including admins**, by design — `firestore.rules` line 163: `allow update, delete: if false`.
- **Persistence:** **this is the one collection in the app that is explicitly, permanently undeletable by design** — not a gap, a deliberate architectural choice ("an audit log that can be edited after the fact isn't one," per the code comment). It contains personal names/emails with **no deletion path whatsoever**, not even for an Administrator through legitimate means (only a direct Admin-SDK/console operation outside the app could remove an entry).

### `/offices/{officeId}/periods/{periodId}` — historical snapshots
Source: `firestore.rules` lines 166-171 only — **no type file, no service file exists for this collection.**

- `allow write: if false` — the comment says "written server-side only (Cloud Function via Admin SDK)," but per `project-status.md`, that Cloud Function was ripped out entirely when the project moved to the free Spark plan and "no longer exists and never will." There is currently **no write path to this collection at all** — it is dead/unused, not a live source of personal data today. Flagged for completeness only.

### Firebase Authentication (separate from Firestore)
Source: `src/services/auth.service.ts`.

- Stores **email + password hash** (for password sign-in) and supports passwordless email-link sign-in and password-reset emails.
- This is data held by Firebase Auth (a Google-operated service), not in a Firestore document this app's rules govern. No in-app code calls Firebase Auth's user-deletion API (`deleteUser`) anywhere — confirmed via grep, no matches for `deleteUser` in `src/`.

---

## 3. Neutral observations relevant to a GDPR conversation

These are factual observations only — not recommendations, not a verdict on compliance.

1. **No hard-delete / "right to be forgotten" path exists for any data subject in this app.** Across every collection checked (`users`, `employees`, `shifts`, `recruitmentLeads`, `auditLog`), the only deletion capability found in application code is: (a) an employee's own still-`draft`, unsubmitted shift, and (b) an Administrator's unconditional shift delete. Everything else — user accounts, roster entries (soft-delete via `isActive` only), submitted/approved/rejected shifts, and every recruitment lead ever entered — has no delete path in the code, regardless of role. Firebase Auth accounts also have no in-app deletion call.

2. **Rejected/no-show recruitment leads are retained indefinitely with no purge mechanism.** `src/services/recruitment.service.ts` provides `subscribe`, `create`, and `update` only — no `delete`. A person who applies, is marked `rejected` or `no_show`, keeps their name/email/phone in the system forever unless someone manually intervenes outside the app (e.g. via the Firebase console or Admin SDK).

3. **The audit log is architecturally permanent by design**, including personal names/emails in `actorEmail` and `targetLabel` — `firestore.rules` denies update/delete to everyone, including Administrators, as a deliberate design choice (not an oversight), per the in-code comment.

4. **Employee names are denormalised (copied) onto every shift document** (`employeeName`, `employeeIsTeamLeader` fields), specifically so a TeamMember without roster-read access can still see whose shift is whose. This means a person's name is physically duplicated across potentially hundreds of shift records over time, each an independent copy that would need to be found and handled separately from the source roster entry.

5. **Firebase/Google is a third-party data processor for all data in this system** — both Firestore (all personal data listed above) and Firebase Authentication (credentials) are Google Cloud services. Noted plainly; no view is taken here on whether a Data Processing Agreement is in place or required.

6. **Free-text fields can incidentally carry personal data beyond their intended field.** `notes` (on both `Shift` and `RecruitmentLead`), `rejectionReason` (`Shift`), and `details`/`targetLabel` (`AuditLogEntry`) are unstructured strings staff can type anything into — a search for "everywhere a specific person's data appears" cannot rely on the structured fields alone.

7. **Soft-delete (`isActive: false`) on the employee roster does not reduce data exposure.** A deactivated employee's full record (name, email, phone, contract hours) remains fully visible to any admin/manager under the current `firestore.rules` — deactivation is a status flag, not an access restriction.

---

## 4. Open questions — for Stan and the client (and, if engaged, a lawyer) to answer

- How long should a rejected/no-show recruitment lead's personal data be retained before deletion, and who is responsible for actually deleting it given no in-app mechanism exists today?
- Does an employee (or a job applicant) have a way today to request their data be deleted or corrected, and if GDPR requires one, should it be an in-app self-service flow, an admin-triggered action, or a manual (Admin SDK/console) process run by Stan on request?
- Is the permanent, undeletable audit log (including names/emails) an acceptable design given data-subject erasure rights, or does it need a retention/anonymisation policy (e.g. auto-purge after N years, or storing a role instead of a name in `targetLabel`)?
- Does `peoplemarketing.be` currently have a privacy policy, and if so, does it already cover this app's data collection (employee HR data, applicant data, audit logging) — or does it need updating/creating?
- Has anyone assessed whether a Data Processing Agreement with Firebase/Google (as the underlying processor of all this data) is needed, and if so, has one been reviewed or signed?
- What is the lawful basis intended for each category of processing here (employment contract for employee data, legitimate interest or consent for recruitment leads, etc.) — this document does not attempt to answer that.
- Should the client be told explicitly that deactivating an employee does not remove or hide their personal data from other staff, in case that surprises them operationally?
