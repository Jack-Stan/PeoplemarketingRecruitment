# Ticket 02 — Employee CRUD

**Status:** 🟡 Core built — `employees.service.ts`, Pinia store (6 unit tests, all passing), `EmployeesView.vue` wired to live data with add/edit form + soft-disable. Typecheck clean, login screen verified in browser. **Not yet verified end-to-end**: no working local emulator (see Ticket 01) and no `.env.local` with real credentials in this session, so the authenticated Employees page itself hasn't been clicked through live — only inspected via code review + unit tests. Separate detail views (`EmployeeDetailView.vue`, dedicated edit route) not built — the list view's inline modal covers create/edit for now, split out later if the client wants a dedicated profile page.
**Goal:** Admin can list, create, edit, and (soft-)disable employees. Team managers can view their squad.

## Scope

1. **`employees.service.ts`** — `list(officeId)`, `get(officeId, employeeId)`, `create(officeId, payload)`, `update(officeId, employeeId, patch)`, `setActive(officeId, employeeId, isActive)`.
2. **`employees.ts` Pinia store** — reactive collection via Firestore `onSnapshot`.
3. **Views + components**
   - `views/employees/EmployeeListView.vue` — table with name, role, TL flag, status, last active
   - `views/employees/EmployeeDetailView.vue` — profile view + edit
   - `views/employees/EmployeeEditView.vue` — admin-only edit form
   - `components/employees/{EmployeeTable, EmployeeForm, EmployeeStatusToggle}.vue`
4. **Validation** — `utils/validators.ts` for email format, name length, role enum check.
5. **Soft delete** — never `delete()`; toggle `isActive`.
6. **Rules** — admins write, all same-office readers, employees read themselves (already in Ticket 01).

## Acceptance

- Admin can create an employee in the emulator
- Newly-created employee appears in list immediately (live subscription)
- Soft-disabling hides from active list, preserved in history
- TeamMember cannot reach `/employees` (router guard kicks in)
- 3+ store unit tests + 1+ rule spec

## FRD coverage

§6 (Employee Management) in full, partial §4 (planning employee roster visibility).

## Open questions to surface to client

- Required fields: first/last name, email, phone? Confirm — FRD §6.1 marks these as "may include".
- Does the client want an "invite user" flow (sends email + sets initial password), or is admin-managed onboarding OK?
- Does `weeklyContractHours` exist in current Google Sheets, or is this new data we're introducing?