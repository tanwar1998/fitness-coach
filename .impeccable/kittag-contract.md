# KIT-TAG restyle contract (development reference)

Replacing the incumbent "AI slop" UI with the KIT-TAG world. Restyle ONLY: never
change copy meaning, routes, functionality, types, props, or logic.

## World in one line
Every screen reads like an athletic garment tag: raw stock ground, heavy ink
structure, violet fabric plates for the active/primary thing, lime RESERVED for
live states only (typing, pending, loading, live). Plan changes are re-issue
stamps. No purple gradient washes, no glow cards, no pill badges, no nested
cards, no glass, no hero-metric template.

## Replacement map (apply mechanically)
- `rounded-2xl`/`rounded-3xl`/`rounded-xl` cards → `rounded-sm` (or none) with
  `border border-foreground/25` (was `border-border`, which now renders as
  `#c6bfa7`-ish — still fine) + optional `bg-card`.
- `rounded-full` buttons/pills → `rounded-sm`. Small status DOTS may stay round.
- `bg-primary/10 text-primary` icon chips → bordered square: `border border-primary/40 bg-primary/10 text-primary`.
- Primary buttons/dividers: `bg-primary text-primary-foreground` (no shadow glow).
- `bg-muted/50` list rows → `bg-muted` no radius or `border-b border-foreground/15`.
- `border-border` → `border-foreground/15` or `border-foreground/25`.
- `text-muted-foreground` stays (it's now warm ink). Add `serial`/`stamp` sparingly for labels/ids.
- Section headings: keep `font-display` (now Archivo black). Uppercase for UI stamps.
- Remove `shadow-sm`/`shadow-lg`/`shadow-primary/25` glow shadows; keep a flat `shadow-sm` only on solid plates.

## Allowed utilities
`seam`, `perforation`, `plate-stock`, `plate-violet`, `plate-ink`, `plate-spec`,
`stamp`, `serial`, `rule-spec`, `animate-tag-drop`, `animate-stamp-in`, `animate-pulse-live`.

## Prohibitions (craft floor)
Gradient text, glass/blur decoration, border-left callouts, hard offset shadows,
sparklines/rings standing in for content, emoji icons, section numerals that
aren't functional, kicker/eyebrow above headings (heading carries its own
weight), nested cards, zero-offset colored halos. Dark/light both stay.

## Verification
After edits: `npx tsc --noEmit` and `npm run lint`. Do not change test files.