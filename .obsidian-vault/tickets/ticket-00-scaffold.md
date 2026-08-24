# Ticket 00 — Scaffold

**Status:** ✅ Shipped (with caveats — see `project-status.md`)
**Goal:** Get `npm run dev` + `npm run emulators` + login screen working end-to-end.

## Files shipped

- `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, `README.md`
- `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.scripts.json`, `index.html`, `src/env.d.ts`
- `src/main.ts`, `src/App.vue`
- `src/assets/{brand.ts, tailwind.css, logo-placeholder.svg}`
- `tailwind.config.ts`, `postcss.config.js`
- `firebase.json`, `firestore.rules` (minimal), `firestore.indexes.json`
- `src/config/firebase.ts`, `src/services/{firebase.ts, auth.service.ts}`
- `src/types/{user.ts, index.ts}`
- `src/stores/{auth.ts, ui.ts}`
- `src/composables/useAuth.ts`
- `src/utils/errors.ts`
- `src/router/{index.ts, routes.ts}`
- `src/views/{auth/LoginView.vue, DashboardView.vue, NotFoundView.vue, UnauthorizedView.vue}`
- `src/components/ui/{BaseButton.vue, BaseInput.vue, BaseToast.vue}`
- `tests/{setup.ts, unit/auth.store.spec.ts}`
- `scripts/seed.ts`

## Acceptance

- `npm install` clean
- `firebase emulators:start --only auth,firestore` boots
- `npm run dev` serves Vue app on `http://localhost:5173`
- `npm run build` passes type-check (`vue-tsc --noEmit && vite build`)
- Login screen renders with brand pink/black/white
- Sign-in against emulator works → redirect to `/dashboard`
- Failed login shows toast
- Logout → back to `/login`
- `npm test` → all 5 specs pass

## Caveats (filed under `project-status.md`)

- Several files were externally modified between writes — Stan to confirm source.
- Bash classifier timed out mid-session; `npm install`/`build`/`test` couldn't be run by Claude Code in this session. Stan to run locally and paste errors if any.