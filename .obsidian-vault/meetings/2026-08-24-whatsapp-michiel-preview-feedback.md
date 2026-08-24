# 2026-08-24 — WhatsApp thread with Michiel De Block (client, People Marketing)

## Source

Direct WhatsApp chat between Stan and **Michiel De Block** (People Marketing), Dutch/Flemish. Stan shared the live Netlify preview and asked for a read of the FRD + answers to §23 open questions. This note extracts what's new beyond the earlier voice-memo transcript (`meetings/2026-08-24-client-transcript-shifts-recruitment.md`).

## ⚠️ Domain correction

**Company domain is `peoplemarketing.be`, not `.nl`.** Client's real login is `admin@peoplemarketing.be`. Every earlier reference to `peoplemarketing.nl` (brand.ts comments, `.env.example` comments, `decisions/003-pink-placeholder-hex.md`) was based on a wrong guess — go re-check the actual live site at `peoplemarketing.be` for the real brand colours/logo, not `.nl`.

## Live preview already shared

- **URL:** https://peoplemarketing.netlify.app/ (matches `netlify.toml` already in repo — Ticket 0's Netlify deploy is live and Stan has been sharing it with the client directly).
- **Prod login Stan gave the client:** `admin@peoplemarketing.be` / `AdminPM` — **this account already exists in prod Firebase Auth** (confirmed via Firebase Console screenshot, UID `aCvwA0BeE7M...`) but has **no custom claims set** yet, hence the 403 on `/unauthorized` when Stan logged in himself today. Needs `role: Administrator, officeId: gent, isTeamLeader: true` — blocked on getting a service account key to run `setClaims.ts` against prod (Admin SDK has no local credentials to hit prod with).

## Client feedback on the preview (positive, with one clear UI direction)

- **"Da is al echt dik" / "wEL ECHT AL DIK" / "das exact wak ongeveer zoek"** — client is happy, says it's roughly exactly what he's after.
- **Shift display: stack vertically, not side-by-side.** Direct quote: *"shifts onder elkaar zien niet naast... op deze manier beke lijk notion"* (shifts should be seen stacked underneath each other, not next to each other — this way it looks like Notion). **This changes the Ticket 03 plan** — `PlanningBoardView.vue` was sketched as a weekly grid (rows = employees, cols = days); client wants a vertical, Notion-style list instead. Update the ticket before building the planning UI.
- Client explicitly reminded: don't forget to show Team Leader status on shifts ("vergeet nie teamleider enzo er in toe te voegen") — already covered by `isTeamLeader` on Employee and the badge styling used in `EmployeesView.vue`, just carry it into the shift views too.

## Google Calendar — no longer just an open question

Client asked again ("kan je daar geen google agenda in verwerken" — can't you work Google Calendar into that). **Stan already committed**: *"Ja was ik van plan"* (yes, I was planning to). This moves Google Calendar integration for Event-type shifts from "open question" to **planned** — update `decisions/004-shift-types.md` accordingly. Still fine to ship free-text Event shifts first and layer Calendar sync on top, but it's not optional/maybe anymore — Stan told the client yes.

## Recruitment auto-messaging — confirmed feasible, scope note

Client repeated the ask (invite / hired / rejected templated sends). Stan confirmed on the current setup this is buildable ("met de setup nu kan dat zeker") but explicitly scoped it as **future work, after the core app is solid** ("dat allemaal voor future tho eerst die app goe draaiend make"). Matches `tickets/ticket-05-recruitment-automation.md` sequencing — no change needed, just confirms the client agrees with "later."

## Commercial / hosting (context, not a build task)

- Stan quoted roughly **3-4 weeks** of dev time to the client, depending on feedback volume.
- Client offered to pay half upfront; Stan prefers bank transfer over cash.
- Client has **no domain** of their own ("heb stenen" — slang for "nothing/nada"). Current Netlify free-tier hosting costs nothing; if usage grows, Stan estimated **€10-25/month** hosting + **€8-15/year** domain, both expensable as a business cost for the client. No action needed yet — just context if the "cheap hosting" question comes up again.

## Action items

- [ ] Get a Firebase service account key from Stan (Console → Project Settings → Service Accounts) to run `setClaims.ts` against prod — currently blocked, no local ADC/gcloud on this machine.
- [ ] Set `admin@peoplemarketing.be` claims: `{ role: 'Administrator', officeId: 'gent', isTeamLeader: true }` once unblocked.
- [ ] Re-check real brand colours/logo at `peoplemarketing.be` (not `.nl`) — pink placeholder is "good enough for now" per Stan, but the domain used for reference was wrong.
- [ ] Update Ticket 03 shift UI from grid to vertical/Notion-style list before building `PlanningBoardView.vue`.
- [ ] Update `decisions/004-shift-types.md`: Google Calendar for Event shifts is now a committed future step, not an open question.
