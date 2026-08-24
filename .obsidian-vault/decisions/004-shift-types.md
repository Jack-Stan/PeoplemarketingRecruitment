# Decision 004 — Three fixed shift types (D2D / Straat / Event)

**Date:** 2026-08-24
**Status:** Proposed (pending Ticket 03 implementation)
**Deciders:** Client (Michiel De Block), via transcript — see `meetings/2026-08-24-client-transcript-shifts-recruitment.md`

## Context

FRD §7/§8 describe shift creation generically. Client transcript specifies three concrete shift types with fixed hours for two of them:

| Type | Start | End | Editable? |
|---|---|---|---|
| D2D | 11:00 | 19:00 | No — fixed |
| Straat | 09:30 | 17:00 | No — fixed |
| Event | — | — | Yes — free text per shift |

## Decision

Model shift type as an enum (`D2D` / `Straat` / `Event`) on the shift document. D2D and Straat auto-fill `startTime`/`endTime` from a constant and lock the fields in the UI; Event leaves them editable.

**Update 2026-08-24 (WhatsApp thread, see `meetings/2026-08-24-whatsapp-michiel-preview-feedback.md`):** client asked again about Google Calendar backing Event shifts, and Stan explicitly told him yes ("Ja was ik van plan"). **This is now a committed future step, not a maybe.** Sequencing unchanged — ship Event as free-text first, layer Calendar sync on after, but it's on the roadmap for real now, not "revisit if asked."

## Consequences

- Shift creation form needs a type selector that conditionally locks/unlocks time fields.
- Staffing overview bar (client's "40 shifts, 5 TL, 7 non-TL" view) should be able to filter/group by shift type later — not required for MVP but keep the schema shape (`type` as its own field, not baked into a label) so it's cheap to add.
- Google Calendar integration for Event shifts is planned post-free-text — Stan has committed to the client, factor it into estimation/roadmap even though it's not in the Ticket 03 MVP build.

## References

- `meetings/2026-08-24-client-transcript-shifts-recruitment.md`
- `meetings/2026-08-24-whatsapp-michiel-preview-feedback.md`
- Ticket 03 (Shift creation)
