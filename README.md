# People Marketing CRM

Recruitment CRM for People Marketing: employee and office administration, shift
planning and approval, a recruitment/lead funnel, a Leaflet-based canvassing
Locations map with coverage stats, and an audit log.

**Stack:** Vue 3 (`<script setup>`) + Vite + TypeScript, Pinia for state,
vue-router, Tailwind CSS. Backend is Firebase — Firestore for data, Firebase
Auth for identity — on the free **Spark** plan, so there are no Cloud
Functions: all authorization lives in `firestore.rules`. Hosted on Netlify.

## Prerequisites

- **Node 20** (see `.github/workflows/ci.yml` and `netlify.toml`).
- **JDK 17** for the Firestore emulator. Use 17 specifically — on Windows,
  JDK 21 makes the emulator fail to bind its loopback listener.
- Firebase CLI is bundled as a devDependency (`firebase-tools`); no global
  install needed.

## Setup

```bash
npm ci
cp .env.example .env.local     # PowerShell: Copy-Item .env.example .env.local
npm run emulators              # terminal 1 — auth :9099, firestore :8080, UI :4000
npm run dev                    # terminal 2
```

> **Read this before skipping `.env.local`.** Without it, `VITE_USE_EMULATORS`
> is unset and the app falls back to the hardcoded config in
> `src/config/firebase.ts` — i.e. it talks to the **production**
> `peoplemarketing-c5bfd` project. Local development writes to real customer
> data. Always create `.env.local` with `VITE_USE_EMULATORS=true`.

## Scripts

| Script                  | What it does                                                      |
| ----------------------- | ----------------------------------------------------------------- |
| `npm run dev`           | Vite dev server                                                    |
| `npm run build`         | `vue-tsc --noEmit` then a production build into `dist/`            |
| `npm run preview`       | Serve the built `dist/` locally                                    |
| `npm test`              | Unit tests (`tests/unit`, vitest + jsdom)                          |
| `npm run test:watch`    | Unit tests in watch mode                                           |
| `npm run test:coverage` | Unit tests with a v8 coverage report (text + `coverage/index.html`)|
| `npm run rules:test`    | Firestore rules suite in the emulator (`vitest.rules.config.ts`)   |
| `npm run lint`          | ESLint over `src/**` with `--fix`                                  |
| `npm run format`        | Prettier over `src/**`                                             |
| `npm run emulators`     | Start the Auth + Firestore emulators                               |
| `npm run seed`          | Seed the emulator with an office, an admin user and its employee   |
| `npm run grant-role`    | Grant a role to an existing emulator account                       |
| `npm run delete-user`   | Delete an emulator account                                         |

Unit and rules tests are deliberately split: `vite.config.ts` includes only
`tests/unit/**`, so a bare `vitest` never tries to reach the emulator. The
rules suite has its own config because a vitest CLI path argument filters
`include` rather than widening it.

## Roles

Roles are **not** custom claims — they live on the `/users/{uid}` Firestore
document (`role`, `primaryOfficeId`, `isTeamLeader`), because claims would
need a Cloud Function and therefore the Blaze plan. Every rule in
`firestore.rules` reads that doc with `get()`.

| Role            | Dutch label | Capability                                                        |
| --------------- | ----------- | ----------------------------------------------------------------- |
| `Administrator` | Beheerder   | Final approver, full CRUD, can read any user doc                   |
| `TeamManager`   | Teammanager | Drafts and submits shifts for their squad, locked to their office  |
| `TeamMember`    | Teamlid     | Read-only on their own shifts                                      |

- **`isTeamLeader`** is an orthogonal flag on a `TeamMember` (squad lead), not
  a role. It gates coverage stats on the Locations map (`isCoverageViewer`).
- **`functie`** (Trainee → Country manager, `src/types/user.ts`) is the
  admin-assigned career ladder — display only, no authorization weight.
- **Multi-office:** an Administrator is staff of *every* office and can switch
  the office they are managing via the AppShell switcher
  (`stores/officeContext.ts` / `composables/useActiveOffice.ts`). A
  TeamManager stays locked to `primaryOfficeId`.
- Self-signup creates a pending doc with `role` and `primaryOfficeId` null;
  only an admin write may set them.

## Seeding

With the emulators available, `npm run seed` creates office `office-main`
plus an Administrator account:

```
admin@peoplemarketing.nl / admin123
```

The script refuses to run unless `VITE_USE_EMULATORS=true` — it must never
touch production.

## Deployment

- **App:** Netlify auto-deploys `main` (`netlify.toml` — `npm run build` →
  `dist/`, SPA redirect, security headers, `NODE_VERSION=20`).
- **Firestore rules and indexes are NOT part of that deploy.** They ship
  manually and separately:

  ```bash
  npx firebase deploy --only firestore:rules
  npx firebase deploy --only firestore:indexes
  ```

  Run `npm run rules:test` first — a rules deploy is the one change that can
  silently open up production data.
