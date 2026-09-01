# 2026-09-01 — Full app review + Briggs & Walker gap analysis

**Source:** Stan asked for an app review and reminded that the client wants "the same app as haggs".
"Haggs" resolved to **Briggs & Walker** — [[2026-08-25-client-callback-new-asks]] item 7
(briggsandwalker.com/agency-field-marketing, "client wants a knock-off/inspired version").

**Scope reviewed:** full codebase + the uncommitted working tree (crm-d6 session's `functie`-field +
dashboard-greeting work — confirmed by that session as done, vue-tsc clean, 40/40 tests green, rules
emulator-unverified). Review by an independent Explore agent; findings below verified against file:line refs.

---

## A) Working-tree (functie/greeting) findings — review before crm-d6 commits

| # | Sev | Finding |
|---|-----|---------|
| A1 | 🔴 HIGH | `validFunctie()` (`firestore.rules:111-115`) gates **every** admin `/users` update, not just functie changes. If the rules list ever drifts from `FUNCTIES` (`src/types/user.ts:42-51`), all admin updates (setActive, setPhone, assignRole) die with permission-denied. Scope it to "functie actually changed": `request.resource.data.get('functie', null) != resource.data.get('functie', null)`. |
| A2 | 🔴 HIGH (pre-existing, worsened) | Role modal silently **moves users between offices**: `UserRoleEditModal.vue:53-59` passes the admin's *active switcher office* as `primaryOfficeId`; `users.service.ts:91-97` writes it unconditionally. UsersView lists all offices, so editing a Gent user while switched to Antwerp relocates them — and now also rewrites their functie. The last-admin guard (`UserRoleEditModal.vue:43-48`) counts admins in the wrong office for cross-office edits, so it's a no-op there. |
| A3 | 🟡 MED | `functie` never syncs to the office roster (`employees.service.ts:96-106`), so TeamManagers can never see it — the roster mirror exists precisely because managers can't read others' `/users` docs. |
| A4 | 🟡 MED | Greeting uses functie as a person's name when `displayName` is null ("Goedemorgen, Manager"); admin branch shows functie twice (`DashboardView.vue:31,154,156`). Greeting computed isn't reactive to time (stale overnight). |
| A5 | 🟢 LOW | Member eyebrow "Jouw shifts" replaced by functie (`DashboardView.vue:119`) — context for the shifts block lost. |
| A6 | 🟢 LOW | Functie-only change is audit-logged as `role_assigned`; no `functie_assigned` action exists (`types/auditLog.ts:6-16`). |
| A7 | 🟢 LOW | Functie missing from UsersView table/sort/filter and Settings → Mijn gegevens. |
| A8 | 🟢 LOW | `assignRole` defaults `functie = null` and writes unconditionally — future callers silently wipe it. Make it required. |
| A9 | ✅ | `recruitment.store.spec.ts` diff (origin unknown) is a correct fake-timers flakiness fix. Keep it. |

## B) Security findings (whole app)

| # | Sev | Finding |
|---|-----|---------|
| B1 | 🔴 HIGH | Two rules tests assert the **opposite** of the deployed rules (cross-office employee reads, cross-office approval — `tests/rules/firestore.rules.spec.ts:191-196, 284-304`) and never run: `npm test` excludes `tests/rules`, emulator is dead on this box. No test proves cross-office isolation for non-admins anymore. |
| B2 | 🟡 MED | Self-signup can forge `email`, `emailVerified: true`, and **`isTeamLeader: true`** (`firestore.rules:74-80` constrains only role/office/functie/desiredOfficeId). The role modal initialises from the forged flag, so an admin approving with defaults grants Teamleider — which is the `isCoverageViewer` gate. Fix: pin email/emailVerified to token, force `isTeamLeader == false` on create. |
| B3 | 🟡 MED | Audit entries forgeable: `firestore.rules:213` has no `actorUid == request.auth.uid` check and no schema validation — a TeamManager can append rows attributed to the admin. |
| B4 | 🟡 MED | Full candidate PII (name/email/phone/notes) readable by every TeamMember in the office (`firestore.rules:202`). GDPR-relevant for a high-churn canvassing workforce — needs a decision record at minimum, ideally split contact details out of member reads. |
| B5 | 🟢 LOW | Admin can never revoke a role back to pending (`firestore.rules:115`), and any admin update to a still-`null`-role user is denied — which is why phone-edit on pending users fails with "Er ging iets mis" (`UserDetailView.vue:147-153`). |
| B6 | 🟢 LOW | No schema validation on shifts/locations/availability (e.g. `date: '9999-01-01'`, `timesVisited: 9999`). |
| B7 | ℹ️ | Admin SDK key correctly gitignored, no secrets tracked. `.token-savior-cache.json` (60 KB) is tracked — tooling noise. |

## C) Quality / bugs

| # | Sev | Finding |
|---|-----|---------|
| C1 | 🔴 HIGH | `availability.mark()` not idempotent despite its docstring: second mark on same day is an **update**, and rules say `update: false` (`availability.service.ts:40-50`, `firestore.rules:196`) → permission-denied on double-click/two tabs. |
| C2 | 🔴 HIGH | **No `limit()` on any subscription** — /users, /shifts all-time, /recruitmentLeads, /auditLog (desc, unbounded), /locations, /availability. On Spark's 50k reads/day this is a real quota risk as history grows; auditLog is the most urgent (add `limit(200)` + paging). `firestore.indexes.json` empty. |
| C3 | 🟡 MED | `assignRole` reports failure after the role write already committed if the best-effort roster sync throws (`stores/users.ts:66-72`) — stale mirror + no audit entry + misleading error. Sync should be `.catch()`ed, not part of the success path. |
| C4 | 🟡 MED | `qualityStats.attendanceRate` counts CV-stage rejections as "attended" (`stores/recruitment.ts:64-75`) — inflated attendance, deflated no-show. |
| C5 | 🟡 MED | Dashboard funnel drops `contacted`/`no_show`/`rejected` from bars **and** denominator (`DashboardView.vue:86-95`) — percentages don't describe the funnel. |
| C6 | 🟡 MED | Rejected shifts are a dead end for members: can't edit, resubmit, or delete (`firestore.rules:174-185`) — wrong for the "employees plan themselves in" model ([[008-self-service-shift-signup]]). |
| C7 | 🟢 LOW | Audit writes silently dropped for office-less users (path `offices//auditLog`, swallowed) — pending-user deletions leave no trace (`useUserActions.ts:49,78`). |
| C8 | 🟢 LOW | `new Date(iso)` UTC parse in dashboard weekday labels vs the app's local-parse convention (`DashboardView.vue:79` vs `utils/date.ts`). |
| C9-C10 | 🟢 LOW | Misleading rules-test comments ("approve/reject path" tests delete); stale Ticket-0 route comments. |

## D) Gap analysis vs Briggs & Walker (the "same app as haggs" ask)

Briggs & Walker's platform (fetched 2026-09-01): Field App (mobile, location guidance, messaging),
Location Manager (campaign planning, team allocation, heat maps, address-based canvassing), Campaign
Manager (training, performance, client reporting), digital forms + payments + contract signing, live
leaderboards/achievements, multi-campaign dashboards, GDPR + ISO 27001.

Where our CRM stands against that, biggest gaps first:

1. **No results/sales entity at all** — nothing records what a canvasser achieved on a shift. This is
   the single biggest gap: without "resultaten per shift" there can be no leaderboards, conversion
   metrics, or client reporting. Everything Briggs sells sits on top of this.
2. **No notifications of any kind** — no shift-approved/rejected signal, no pending-approval nudge,
   no stale-lead chaser. Feasible on Spark via an in-app inbox collection + badge counts (no Cloud
   Functions needed).
3. **No leaderboard / per-person analytics** — no shifts-worked, visits-per-shift, hires-per-recruiter.
   The new `recruitedBy` ask (callback item 3) and the just-added `functie` ladder both point here;
   neither is used analytically yet.
4. **No mobile/field story** — `vite-plugin-pwa` is a devDependency but never wired into
   `vite.config.ts`. A PWA is the realistic Spark-plan answer to Briggs' Field App.
5. **Planning is one-shift-at-a-time** — no templates, recurring shifts, copy-week, capacity/demand
   model, or availability→planning bridge ("plan everyone who marked Saturday").
6. **Recruitment pipeline is shallow** — no interview date/time/interviewer, no stage timestamps
   (time-to-hire uncomputable), no hired-lead → invite conversion, no duplicate detection, no
   campaign/UTM on sources.
7. **No exports / date-range pickers / cross-office comparison** — client reporting is Briggs' whole
   Campaign Manager pitch.
8. Training modules, digital contracts, payment processing — Briggs features that are likely **out of
   scope** for this client's budget/Spark constraints; park unless the client names them.

**Realistic "Briggs-inspired" roadmap on Spark:** shift-results entity → per-person dashboards +
leaderboard → in-app notifications → PWA wrapper → planning templates + availability bridge. All
client-side + Firestore, no Blaze needed.

## Test coverage gaps

- Rules: nothing for `selfProfileUpdateOnly`, functie validation, availability, locations, auditLog
  immutability, recruitmentLeads; the two existing cross-office tests are inverted (B1); `ctxFor`
  doesn't seed `emailVerified`/`functie`.
- Unit: no specs for users store (just changed!), availability, locations, auditLog, officeContext,
  composables, validators, date utils; no component test for `UserRoleEditModal` incl. the last-admin
  guard that's already caused two near-lockouts.
- `npm test` excludes `tests/rules`; `test:e2e` script exists but no e2e dir/config.

---

## Recommended order

1. **Before crm-d6 commits:** fix A1 (rules gate), A2 (office reassignment — at least freeze
   `primaryOfficeId` to the target's current office), A3 (roster sync).
2. **Security batch (one rules deploy):** B2 signup hardening, B3 audit actorUid, B5 role-revoke,
   A1 — bundle into a single reviewed `firestore.rules` change.
3. **Quota/bug batch:** C1, C2 (auditLog limit first), C3, C6.
4. **Briggs roadmap:** start with the shift-results entity (D1) — it unblocks D3/D7 and is what the
   client is actually buying when they say "same app as Briggs".
