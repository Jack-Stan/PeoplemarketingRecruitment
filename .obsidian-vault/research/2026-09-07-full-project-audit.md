# 2026-09-07 — Full project audit (security · code · tests/tooling · docs/GDPR)

**Source:** Stan asked for a full audit. Four parallel read-only passes over the whole repo plus
direct runs of typecheck, lint, unit tests, prod build, `npm audit`, and an attempted rules-test run.
Follows on from [[2026-09-01-app-review-and-briggs-gap]]; items B1/B2/B3/B5/C2 from that review are
implemented in the **uncommitted working tree** (`firestore.rules`, `auditLog.service.ts`, rules spec)
but not committed, not deployed, and not test-verified.

## Verification signals actually observed

| Check | Result |
|---|---|
| `vue-tsc --noEmit` | exit 0, clean |
| `vitest run tests/unit` | 40 pass / 0 fail (5 spec files) |
| `vite build` | OK, 14.6 s; main chunk 575 kB (151 kB gz), LocationsView 234 kB |
| `eslint src/**` | **exit 2 — no ESLint config file exists.** `npm run lint` has never worked |
| `prettier --check` | no config; 66 files would be reformatted to defaults by `npm run format` |
| `npm audit` | 40 vulns (4 critical, 13 high, 23 moderate); `--omit=dev`: 11 (2 high = postcss + undici) |
| `npm run rules:test` | **emulator crashes** (`Unable to establish loopback connection`, JDK 21 + Windows, already logged in project-status) — and `emulators:exec` still exits 0 with zero tests run |
| service-account key | on disk in repo root, gitignored, **never committed** (`git log --all` clean) |
| `.mcp.json` | `--dir C:/RFT/Projects/CRM` — directory does not exist (project moved to `Personal/`). Firebase MCP timed out this session |

---

## Top 10 — do these first (value ÷ effort)

1. **Commit + deploy the pending rules hardening** (B2/B3/B5, `limit(200)`). Rules tests can't run on this box; verify with a 6-check prod smoke test as on 2026-09-01, or fix JDK (17) first.
2. **Rules ignore `isActive`** — a deactivated admin/manager keeps full Firestore access. Add `isActiveUser()` into `isAdmin/isManager/isMember/isCoverageViewer`. Also disable the Auth account via Admin SDK on deactivate.
3. **Move the Admin SDK key out of the repo folder** (`%USERPROFILE%\.secrets\`), set `GOOGLE_APPLICATION_CREDENTIALS`, rotate the key (id leaked in filename).
4. **Scripts' emulator guard fails open** — `seed/grantRole/deleteUser` check `VITE_USE_EMULATORS ?? 'true'`; run via bare `tsx` with ADC creds they hit prod. Gate on `FIRESTORE_EMULATOR_HOST` + `FIREBASE_AUTH_EMULATOR_HOST` instead.
5. **Fix or delete lint/format tooling** — add `eslint.config.js` + `.prettierrc` (single quotes, ~120 width, tailwind plugin) or remove the 4 dead plugins and 2 scripts. Half-installed is worst.
6. **Patch cheap CVEs**: `postcss` → 8.5.x (HIGH, in prod graph), `vitest`/`@vitest/coverage-v8` → ≥3.2.6 (CRITICAL), `vite` → latest 5.4.x.
7. **Fix `.mcp.json` path** to `C:/RFT/Projects/Personal/CRM`; pin `firebase-tools@13.x`.
8. **Unbounded office-wide subscriptions** (`shifts`, `recruitmentLeads`, `availability`, `/users`) — add date-window `where` / `limit`. `weekStart` already exists for this. Spark 50k reads/day is the ceiling.
9. **`hydrate()` race** in `stores/auth.ts:291-337` — `signIn()` and `onAuthStateChanged` both hydrate; second `subscribeOwn` overwrites the first `Unsubscribe` → leaked listener per sign-in.
10. **GDPR erasure/retention: nothing exists.** No purge, anonymise, retention, consent or export path anywhere in `src/`. Highest business risk for a Belgian recruitment tool — see §GDPR.

---

## 1. Security

### High
- **H1 `isActive` client-only** — see Top 10 #2. `users.service.ts:100-108` comment claims it's a gate; it isn't.
- **H2 Admin key in working tree** — Top 10 #3.
- **H3 Script guards fail open into prod** — Top 10 #4. `seed.ts` should have no `FORCE_PROD` escape at all.
- **H4 Audit trail is best-effort, not evidence.** Client-written, fire-and-forget after the action, swallowed on failure (`stores/auditLog.ts:43-49`). Even with the `actorUid` pin, `actorEmail`, `targetLabel`, `details`, `officeId` field and `createdAtMs` are free text (a `createdAtMs: 0` entry is buried past the 200-row window). Rules can't couple an action to its log entry. Fix now: pin `actorEmail == token.email`, `officeId == path`, `createdAtMs` within ±5 min of `request.time`, `createdAt == request.time`, `keys().hasOnly([...])`, order by server `createdAt`. Real fix: Cloud Functions `onWrite` trigger (free tier covers this volume) or rename the feature "Activiteitenlog (best-effort)" in UI/FRD.

### Medium
- **M1 Every TeamMember reads full candidate PII** (`firestore.rules:214-217`) incl. `notes`, `email`, `phone`. Also `allow write: isStaffOf` covers delete with zero field validation (`stage` not enum-checked, `createdBy` not pinned). Split contact fields to a staff-only subdoc or give members aggregates only. Was B4 on 2026-09-01, still open.
- **M2 No retention/erasure** — see §4 GDPR.
- **M3 Deleted user can resurrect as pending.** `deleteUser` removes the doc only; the surviving Auth session satisfies self-create. Soft-delete (`isActive:false` + `deletedAt`) or a `deletedUsers/{uid}` tombstone checked in the create rule.
- **M4 Shift attribution unvalidated** — `createdBy`, `decidedBy`, `employeeIsTeamLeader`, `date` shape all free. A member can create a shift with `employeeIsTeamLeader: true` and inflate the TL headcount bar. Mirror the `availability` rule pattern (rules:207) on shifts.
- **M5 `timesVisited` bumpable without a visit doc** (`onlyVisitCounterChanged`). Compute coverage from `visits` count aggregation instead.
- **M6 No HTTP security headers on Netlify** — no CSP, `X-Frame-Options`, `Referrer-Policy`. One-click admin actions are clickjackable. Add a `[[headers]]` block.
- **M7 No App Check, no API-key referrer restriction.** Rules are the only defence; every gap above is scriptable. reCAPTCHA v3 App Check is free on Spark.

### Low
- L1 self-writes on `/users` allow arbitrary keys, don't pin `uid == docId` or `isActive == true` on create.
- L2 zero timestamp validation anywhere in rules.
- L3 "last administrator" guard is client-only; `validRole()` legitimises self-demotion of the last admin (lockout → recovery needs H2's key).
- L4 remember-me 7-day expiry is a localStorage flag, not a session control — never describe it as security.
- L5 login `redirect` query unvalidated (safe today only because vue-router prefixes origin).
- L6 invitee email travels in the invite URL (`?email=`) → Netlify logs, history, Referer to tile host.
- L7 password minimum is Firebase default 6 chars — enable Password Policy in console.
- L8 public `/offices` read exposes inactive offices; justification (signup picker) is gone if `/signup` is removed.
- I4 Firestore region not visible in repo — confirm `europe-west1` in console (Chapter V transfer issue if `nam5`).

### Verdict on the uncommitted rules diff
B2, B3, B5 are correct tightenings on static review. B3 is incomplete (H4). Not executed by tests this session.

---

## 2. Code quality & architecture

### High
- **H1 `hydrate()` race** — Top 10 #9.
- **H2 `employeeName` stamped from Auth `displayName`**, which `stores/auth.ts:56-61` itself documents as null for invite-completed accounts (`MyPlanningView.vue:41,149`, `LocationsView.vue:299` uses `email ?? 'Onbekend'`). Permanent bad data in the point-in-time snapshot. Use `auth.displayName.value || email`; better, one `authStore.actorLabel`.
- **H3 Unbounded subscriptions** — Top 10 #8. Also makes "Totaal shifts" a lifetime count.
- **H4 Invite completion can strand an account.** `completeInvite` sets the password (irreversible) then `createProfile(desiredOfficeId)`; if `?office=` is missing the new rule denies the write and nothing retries. User is stuck on `/pending-approval` with no doc. Validate `office` in `CompleteInviteView.canSubmit`, or self-heal in `hydrate` when `getOnce` returns null.

### Medium
- M1 store/service boundary bypassed in 5 places (`SettingsView`, `SignupView`, `AppShell`, `CompleteInviteView`, `useOfficeNames`). Add `stores/offices.ts`; expose live profile from `authStore`.
- M2 unhandled promise rejections in `onMounted` (`SettingsView.vue:31-39` leaves `isLoading` true forever; `auth.signOut`/`refreshEmailVerified` uncaught). Add an `unhandledrejection` → `ui.push` net in `main.ts`.
- M3 audit-log payload built by hand in 8 call sites. One `auditLogStore.record(officeId, action, label, details?)`.
- M4 `as T` snapshot cast ×13. One `mapDoc<T>` or `withConverter` per collection with defaults.
- M5 try/catch → `friendlyError` → `return false` ×25; `ui.push(ok ? … : …)` ×14. Extract `run()`/`notifyResult()`.
- M6 residual `new Date('yyyy-MM-dd')` UTC parsing at `PlanningView.vue:435,454`, `DashboardView.vue:79`. Works in BE by luck. Add `parseLocalISODate` + a TZ-parametrised Vitest — this bug class has hit twice with zero tests.
- M7 `useAuth()` spreads the reactive store (`useAuth.ts:15`) — `appUser` frozen at first call.
- M8 router treats "profile fetch failed" as "pending approval" (`auth.ts:317-319` swallows). Add `profileLoadFailed` → retry screen.
- M9 English strings in a Dutch UI: all of `utils/errors.ts`, ~9 route titles, "Operations/Workspace", raw `officeId` slug shown as "Kantoor · gent" in three headers.
- M10 accessibility: no `role="dialog"`/focus trap/Esc on any of 7 modals; clickable `<tr>`; icon buttons without names; placeholder-only inputs. One `BaseModal.vue` fixes most of it and removes 7 copies of overlay markup.
- M11 rules ↔ TS lists maintained by hand (`FUNCTIES`, `AuditAction`, roles). Add a Vitest that regexes the arrays out of `firestore.rules` and asserts equality.
- M12 `/users` full-collection realtime read for three consumers incl. `UserDetailView` (needs one doc) and `EmployeesView` (needs a dropdown).

### Low
- Dead code: `allRoles`, `isValidRole`, `hasRoleName`, `_constants`, `offices.service.get()`, `types/index.ts` barrel; unused fields `availability.weekStart` (written, never queried), `calendarEventId`, `office.timezone` (multi-office app, timezone never read), `employee.avatarUrl`; unused deps `date-fns`, `vite-plugin-pwa`.
- `weekStartFor` (date logic) lives in `types/shift.ts` → move to `utils/date.ts`.
- `statusLabels`/`statusClasses`/week-grid duplicated between PlanningView and MyPlanningView.
- `greeting`/`today` computed with no reactive dep — never updates overnight.
- `env.d.ts` missing `VITE_APP_URL`.

### What's good
Listener lifecycle discipline is solid (every view unsubscribes); write actions uniformly return `Promise<boolean>` + `store.error`; services are genuinely thin; denormalisation choices are explicit and commented; authorization lives in rules with the client only mirroring for UX. Right split, consistently applied.

---

## 3. Tests, tooling, dependencies

### Coverage gaps (unit)
| Untested entirely | Why it matters |
|---|---|
| `composables/useUserActions.ts` | last-admin guard, self-delete block — lockout regressions |
| `stores/users.ts` | `assignRole` double write (users + roster) partial-failure |
| `stores/availability|locations|auditLog|officeContext|ui|confirm` | — |
| `composables/useActiveOffice.ts` | the multi-office scoping seam |
| `utils/date.ts toLocalISODate` | fixed a real prod bug, zero regression test |
| all 10 `services/*.ts` | globally mocked in `tests/setup.ts`; never executed |
| all 17 views, 4 components | `@vue/test-utils` installed, never imported |

9 of 40 tests are `toHaveBeenCalledWith` echoes of the store body. Router guard covers 4 of 13 routes (`/mijn-planning` member-only and `/audit` admin-only not asserted).

### Rules test gaps
Zero tests for: `selfProfileUpdateOnly()` (the privilege-escalation surface), `validFunctie()`, the shifts `update` matrix (manager un-approve, member reassign, member create as approved), `availability`, `recruitmentLeads`, `locations`/`onlyVisitCounterChanged`, `visits`, `isCoverageViewer`. No test ever constructs a TeamMember with `isTeamLeader: true`. ~15 tests in the existing harness closes the worst of it.

### Tooling
- **No CI.** Nothing runs tests/lint/typecheck on push; Netlify only builds. Rules deploy is manual → app/rules drift. GitHub Actions: `npm ci` → `vue-tsc` → unit → `emulators:exec` rules → build → `firebase deploy --only firestore:rules`.
- **ESLint config missing; Prettier config missing** — Top 10 #5.
- `test:e2e` script exists with no Playwright config or spec. `vite-plugin-pwa` in devDeps, not wired. `@vitest/coverage-v8` not wired. All dead weight.
- `vite.config.ts` `test.include` picks up `tests/rules` → bare `vitest` fails without emulator. Narrow to `tests/unit`.
- `@types/node` used by two tsconfigs but not a direct devDep.
- `rules:test` masks emulator death with exit 0.
- Netlify: no `NODE_VERSION` pin, no headers.
- `firestore.indexes.json` empty is **correct today** (all queries single-field or equality-only) — but nothing will catch the first composite need before a prod `failed-precondition`.

### Dependencies
Everything pinned `~`; every major is a manual bump. Order: `postcss` patch, `vitest` ≥3.2.6, `vite` 5.4.x (now) → `firebase@12` (kills prod `undici` chain + 9 moderates) → `vite@6/7` → `eslint@9+` flat config with the lint fix → `pinia@3`/`vue-router@5` → Tailwind 4 last (config rewrite, no test net). Remove `date-fns`, `vite-plugin-pwa`, `@playwright/test`.

---

## 4. Docs & GDPR

### GDPR
- **G1 Two PII collections missing from [[gdpr-data-inventory]]**: `availability` (employeeId/Name/date) and `locations/*/visits` (employeeId/Name/visitedAt/notes = per-employee movement tracking, readable by every TL-flagged member). Employee monitoring is a distinct processing purpose in BE. Inventory also predates `users.phone/emailVerified/functie`.
- **G2 No erasure/retention mechanism for anyone.** Rejected applicants persist forever. "Delete user" leaves Auth account, roster doc, shifts, availability, visits, audit rows. Client callback item 10 ("keep data after delete") conflicts — resolve as **anonymise, don't hard-delete**: overwrite name/email/phone/notes with `[verwijderd]`, keep aggregates. Decide retention (leads 6–12 mo post-`rejected`; employees N yrs post-deactivation).
- **G3 Immutable audit log holds `actorEmail` + names in `targetLabel`** with `update, delete: if false` → erasure impossible. Store uids, resolve names at display time.
- G4 = Security M1. G5 no consent/notice tracking on leads (`consentSource`, `noticeGivenAt`). G6 no right-of-access export → `scripts/exportSubject.ts` (Admin SDK, cheap). G7 prod Firebase config is the **default fallback** in `config/firebase.ts` — a bare `npm run dev` with no `.env.local` writes to live client PII (has happened, per project-status). Fail loudly instead. G8 processor list omits Netlify and the Leaflet tile provider.

### Doc/code drift
- `project-status.md` header says "Updated 2026-08-24"; TL;DR contradicted by its own later sections; sections out of date order; Risks list three resolved items.
- Location Manager, availability, `functie`, Auth-link fix (commits `4eafdac`, `553ac5c`, Location Manager series) **absent from the vault** entirely. `isCoverageViewer` authz decision exists only as a rules comment → needs `decisions/009`.
- Tickets 02/03/04 say Planned; all shipped. 06 partial. 05 still says Cloud Function (banned by 006).
- `links-to-FRD.md` under-reports ~8 shipped sections; §11/§17 point at `/periods` which has no write path.
- `decisions/002` still claims custom-claims RBAC (superseded by 006, no banner). 003/004 statuses stale.
- `session-prompts/2026-08-25-admin-user-creation` says client wants `/signup` removed — route, `signUp()`, and self-create rule all still live, outcome unrecorded.
- `gdpr-data-inventory` says no user delete exists; `usersService.deleteUser` does.
- `index.md`: wrong path (`C:\RFT\Projects\CRM`), folder map missing `session-prompts/`, tickets 04–06, `dev-plan.md`, `gdpr-data-inventory.md`; status one-liner two weeks stale.

### Onboarding
README is 2 lines with the wrong project name. Missing: prereqs (Node 20, JDK 17 for emulator), `.env.local` mandatory, `emulators` + `seed` (admin@peoplemarketing.nl/admin123, `office-main`), role model + `grant-role`, `rules:test`, deploy checklist (Netlify auto, rules manual, console toggles). `.token-savior-cache.json` (60 KB) and `.obsidian/workspace.json` tracked → gitignore.

### Vault hygiene
Only 2 real wikilinks in the whole vault; `[[project_spark_plan_no_blaze]]` ×3 in `decisions/006` is a Claude memory, not a note → broken. Orphans: tickets 00/02/06, `pink-hex-investigation`, both 08-24/08-25 session-prompts, `gdpr-data-inventory`. Suggest splitting `project-status.md` into current-state + `changelog.md`.

---

## Carried forward from 2026-09-01 (still open)
B4 lead PII to members · B6 no schema validation on shifts/locations/availability · B7 token-savior cache tracked · C1 `availability.mark()` re-mark denied by `update: false` · C3–C10 · A4–A8 polish · Briggs gap D1–D8 · client callback items 1, 2, 4–10.

## Not verified this session
Rules tests (emulator loopback failure, machine-level). `npm audit fix` not attempted. Firestore region not checked. No files modified except this note and `index.md`.
