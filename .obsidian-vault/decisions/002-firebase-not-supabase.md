# Decision 002 — Firebase, not Supabase

**Date:** 2026-08-24
**Status:** Accepted
**Decider:** Stan

## Context

FRD v0.1 §20 proposed **Vue 3 + Supabase + PostgreSQL + Node.js** as the stack. On 2026-08-24 Stan opted to use **Firebase** instead. The user already has a live Firebase project (`peoplemarketing-c5bfd`) with the standard Firebase web app config baked into `.env.example` and `src/config/firebase.ts`.

## Decision

Use **Firebase**:

- **Firebase Auth** — email/password, custom claims for RBAC
- **Cloud Firestore** — document store (denormalised; no SQL joins)
- **Firebase Storage** — file uploads (CVs, attachments later)
- **Firebase Emulator Suite** — local dev (Auth + Firestore emulators)

## Why not Supabase

- Stan already has the Firebase project created and credentials issued; swapping mid-build is wasted work.
- Document model suits this domain — shift approvals, recruitment pipeline, period snapshots are inherently document-shaped. No complex relational joins needed.
- Custom claims give RBAC at the auth layer (cheap, sync) instead of a separate `user_roles` table.

## Trade-offs accepted

- **No SQL aggregations** — derived stats (e.g. monthly shift counts) live in computed views or, for heavy work, a Cloud Function.
- **Denormalisation required** — `officeId` repeated on every doc, careful with writes.
- **Vendor lock-in** — accepted; Firebase is the long-term platform per FRD §3.5.

## References

- `src/config/firebase.ts`
- `src/services/firebase.ts`
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`
- `.env.example`
- `scripts/seed.ts`