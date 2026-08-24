# Pink hex investigation

**Date:** 2026-08-24
**Owner:** Stan

## What we know

- The brand reads as **pink / black / white** on `https://peoplemarketing.nl`.
- The hero hashtag `#deallerleukste studentenbaan` and the `Solliciteer nu!` CTA both appear in a magenta-pink tone.
- WebFetch couldn't pull the stylesheet from Google (likely a server-side render or anti-bot rule).

## What we need

- **The exact hex** of the primary pink used on the CTAs (and ideally the secondary text accents).

## How Stan gets it

1. Open `https://peoplemarketing.nl` in Chrome.
2. `Right-click` the **Solliciteer nu!** button → **Inspect**.
3. **Computed** tab → look for `background-color`. Copy the `#RRGGBB` value.
4. (Optional) Also check the **hero text** colour and any hover state.

## Likely candidates (educated guess, not confirmed)

| Hex | Source guess |
|---|---|
| `#EC4899` | Tailwind `pink-500` — current placeholder |
| `#FF3D8A` | Close "hot pink" |
| `#E91E63` | Material Design pink |
| `#DB2777` | Tailwind `pink-600` |

## Update path once confirmed

Once you have the hex, only **one file** needs editing:

```ts
// src/assets/brand.ts
export const brand = {
  primary: {
    pink: '<NEW_HEX_HERE>',
    pinkAlt: '<NEW_HEX_ALT_HERE>',
    pinkSoft: '<NEW_HEX_SOFT_HERE>',
  },
  ...
};
```

Tailwind config (`tailwind.config.ts`) reads `brand.primary.pink` directly, so utilities like `bg-primary-pink` pick up the change with no other file edits.

## Reference

- `decisions/003-pink-placeholder-hex.md`
- `src/assets/brand.ts`
- `tailwind.config.ts`