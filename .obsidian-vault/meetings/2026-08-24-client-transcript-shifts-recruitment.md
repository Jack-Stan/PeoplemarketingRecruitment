# 2026-08-24 — Client transcript (Michiel De Block, messy VM + WhatsApp)

## Source

Voice memo transcription (Dutch/Flemish, auto-transcribed — rough) + WhatsApp follow-ups from **Michiel De Block** (client, People Marketing). Raw text supplied by Stan. This note extracts the signal.

## Planning tool — new detail

- **Weekly cycle**: employees plan shifts up to and including Sunday, monthly.
- **Approval flow** confirmed: employee submits → admin approves/rejects. Matches `draft → pending → approved/rejected` already in `links-to-FRD.md` §9.
- **Staffing overview bar**: admin wants a single view like *"40 shifts, 5 team leaders, 7 non-team-leaders"* — a daily/period bar, not just a list. New requirement beyond FRD §10 — should be a literal stacked/segmented bar, not just numbers.
- **Three shift types** (new — not in FRD as written):
  | Type | Hours |
  |---|---|
  | **D2D** | 11:00–19:00 |
  | **Straat** (street) | 09:30–17:00 |
  | **Event** | custom — admin/employee must be able to type arbitrary start/end per event |
  - Client asked whether **Google Calendar** could back the Event type. Flagged as open question — see below.
- **History**: admin wants to look back over past periods to see trends — e.g. *"where am I losing team leaders, where am I gaining them, where do I have more."* Confirms FRD §11 (Historical Planning) but clarifies the point is **team-leader headcount trend over time**, not just raw snapshots.

## Recruitment — new detail

- Current process is a **Google Docs form** — client explicitly called it unprofessional and wants it fully replaced, embedded in the same app/site as the planning tool (not a separate product).
- **TeamMember-level access**: regular users should be able to see the leads list and plan themselves in; **Administrator** sees leads + all pipeline stages + numbers.
- **Pipeline stages** confirmed from transcript: aangenomen (hired) / niet aangenomen (rejected) / op sollicitatie gekomen (attended interview) / niet op sollicitatie gekomen (no-show) — matches FRD §13 almost exactly.
- **Weekly leads bar**: "zoveel leads deze week" (how many leads this week) — same bar-chart pattern as staffing overview, second instance of the same UI primitive.
- **Quality reporting**: wants a report derived from the above stages — matches FRD §15.
- **Automation ask (new, not in FRD)**: buttons to auto-send templated messages —
  - Solicitation invite message
  - "Je bent aangenomen" (you're hired) message
  - "Je bent niet aangenomen" (you're not hired) message
  - Channel not fully specified — transcript mentions WhatsApp for lead intake but doesn't confirm send channel for these three. **Open question**: WhatsApp Business API, email, or SMS?
- **Language**: client explicitly wants **all copy in Dutch** ("ik zou wel alles in t nederlands zetten"). Applies app-wide, not just recruitment.

## Branding

- Colours: client says "onze kleuren zijn wit" (our colours are white) — **conflicts** with `decisions/003-pink-placeholder-hex.md` which used pink `#EC4899` as placeholder based on peoplemarketing.nl. Needs reconciling — possible client meant white is a secondary/neutral colour, not that pink is wrong. **Do not resolve silently — ask Stan.**
- Logo: client says it's simple ("trekt op niets" — doesn't amount to much) and will send the file directly.
- Client wants Stan to send a WhatsApp-style ask for: exact colours, logo file, desired feature tweaks — i.e. Stan owns client comms, not an in-app form.

## Scope / commercial framing

- Client explicitly asked for a **dev-team research pass first** (cost estimate, feasibility) before committing — matches the "not fully finished, just an idea" framing. This transcript itself IS that early-idea pass, not a spec to build against literally.
- Client wants something usable **long-term** ("voor de rest van mijn carrière") and eventually **multi-office** — confirms FRD §18 (Multi-Office, Phase 2, designed-in but not exposed).
- **Hosting cost** is an open concern — client wants it kept cheap. No numbers given.
- Client offered to send a small online demo/video by Tuesday if feasible — **not a hard commitment from our side**, just client's own aspiration; don't plan around it.

## Tooling note (not app scope)

- Michiel forwarded `https://firebase.google.com/docs/ai-assistance/mcp-server` for Stan's own dev tooling — already covered in `research/mcp-recommendations.md` §1. No action needed beyond what's there.

## New open questions (add to project-status.md)

- [ ] Google Calendar backing for Event-type shifts — feasible, or just a free-text start/end field?
- [ ] Send channel for recruitment auto-messages (WhatsApp Business API vs email vs SMS) — WhatsApp Business API has cost + approval lead time, flag to Stan before assuming it.
- [ ] Colour conflict: "wit" (white) vs placeholder pink — confirm with client before Ticket touching branding.
- [ ] Confirm Dutch-only UI vs Dutch-default-with-i18n-later (affects whether to wire i18n scaffolding now or hardcode NL strings).

## Decisions to add

- Shift types D2D / Straat / Event with fixed hours for the first two — see `decisions/004-shift-types.md`.
