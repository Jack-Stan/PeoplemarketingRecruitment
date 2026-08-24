# Decision 003 — Pink placeholder hex

**Date:** 2026-08-24
**Status:** Provisional
**Owner:** Stan (to confirm with client)

## Context

Brand colours per FRD §1 are **pink / black / white**. We need an exact pink hex for the Tailwind config, the brand tokens file, and the seed data.

On 2026-08-24 the WebFetch tool couldn't extract the exact hex from `https://peoplemarketing.nl` (Google stripped the stylesheet from the response). The pink used in the marketing site appears to be a "magenta-pink" tone — common candidates are `#EC4899`, `#FF3D8A`, `#E91E63`, `#DB2777`.

## Decision

Until the client confirms the exact hex, use **`#EC4899`** (Tailwind's `pink-500`) as a placeholder. The brand tokens file has the value clearly commented as `// PLACEHOLDER — confirm with client` so it can't ship by accident.

Secondary tints are derived:

```
primary.pink     = '#EC4899'   // placeholder
primary.pinkAlt  = '#FF3D8A'   // placeholder (slightly hotter)
primary.pinkSoft = '#FCE7F3'   // placeholder (light tint)
```

## How to confirm

1. Open `https://peoplemarketing.nl` in Chrome.
2. Right-click the **Solliciteer nu!** CTA → **Inspect** → **Computed** tab → `background-color`.
3. Copy the hex.
4. Update `src/assets/brand.ts` — three lines.
5. No other code change needed — `tailwind.config.ts` reads from `brand.ts`.

## References

- `src/assets/brand.ts`
- `tailwind.config.ts`