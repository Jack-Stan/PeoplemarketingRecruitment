# Ticket 05 — Recruitment auto-messaging (Cloud Function)

**Status:** 📋 Planned — needs an open question resolved first
**Goal:** One-click templated messages from the lead detail view: solicitation invite, "je bent aangenomen", "je bent niet aangenomen" (transcript, Michiel De Block WhatsApp 2026-08-24).

## Why this is the one ticket that needs a real backend

Every other feature in this app is a direct Firestore read/write from the client, gated by `firestore.rules` — no server needed. This one is different: sending a WhatsApp/email message means holding an API secret (WhatsApp Business API token, or an email provider key) that must never reach the browser bundle. That has to run server-side — a Firebase **Cloud Function**, the first one in this project.

## Scope (once channel is confirmed)

1. **`functions/src/sendRecruitmentMessage.ts`** — callable Cloud Function, takes `{ leadId, template: 'invite' | 'hired' | 'rejected' }`, looks up the lead + template text (Dutch, per transcript), sends via the confirmed channel, writes a `messagesSent` audit subdoc on the lead.
2. **Client side** — `recruitment.service.ts` gets `sendMessage(leadId, template)` calling the Cloud Function via `httpsCallable`.
3. **UI** — three buttons on `LeadDetailView.vue`, disabled once already sent for that template (avoid double-send), confirmation toast.
4. **Templates** — stored as Dutch strings in `functions/src/templates.ts` to start; move to Firestore-editable config later if the client wants to tweak wording without a redeploy.

## Blocking open question

**Send channel not confirmed in transcript.** WhatsApp Business API requires Meta Business verification + per-message cost + template pre-approval (days of lead time) — not something to assume. Email is same-day feasible with an existing provider (SendGrid/Resend). **Ask Stan to confirm with the client before starting this ticket** — see `meetings/2026-08-24-client-transcript-shifts-recruitment.md`.

## FRD coverage

Not explicitly in FRD v0.1 (§22 lists "Automated email notifications" under *Future Features*, i.e. post-MVP) — client transcript pulls it forward. Flag to Stan that this may be a scope/cost conversation with the client, not just a build task.
