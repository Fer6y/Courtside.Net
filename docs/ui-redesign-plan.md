# Courtside UI Redesign — "The Programme"

**Goal:** Keep the luxury-tennis + sports-analytics identity, but shed the
"AI-built dark dashboard" feel. The new reference points are printed objects:
a programme you'd read at a tennis event, a menu at a good restaurant, a
draw sheet pinned outside a show court. Slightly stylized, but subtle.

---

## 1. Why the current UI reads as "AI-built"

These are the patterns every AI-generated dark app shares — and Courtside
currently has all of them:

1. **Card soup** — every piece of content sits in the same rounded box
   (`border-white/5 bg-white/[0.02]`). Programmes and menus don't box
   content; they separate it with rules, whitespace, and type hierarchy.
2. **Terminal headings** — mono uppercase + tracking-widest for every
   heading makes the app feel like a dev dashboard, not a publication.
3. **Pure-neutral charcoal** (#0e1116) — the default "dark mode" of every
   AI tool. Print luxury is never colorless.
4. **Saturated tech accents** — neon green (#22d68a) and bright amber
   (#f5c518) as decoration everywhere. Luxury restrains its accent colors.
5. **Emoji as iconography** (🔥😲👎🎾) — instantly app-like, never print.
6. **Pill badges everywhere** — rounded-full chips are SaaS DNA.
7. **Uniform rhythm** — same padding, same radius, same card size, no
   moments of drama or asymmetry.

The fix is not "more decoration" — it's swapping the *layout language* from
dashboard to publication.

---

## 2. The new design language

### Typography (the biggest lever)

Add a **third typeface: a display serif** — this single change does most of
the "programme" work.

| Role | Face | Usage |
|------|------|-------|
| Display serif | **Fraunces** (Google Fonts, variable) | Page titles, player names, match-ups, section heads, pull-quotes. Italic for "v.", "d.", editorial flavor |
| Mono (kept) | IBM Plex Mono | Scores, ratings, dates, stats, eyebrow labels — the analytics DNA stays |
| Body (kept) | DM Sans | Reviews, comments, UI labels, body text |

New rules:
- Player names are **always serif** — they're the marquee names on the bill.
- Mono moves from "all headings" to **eyebrow labels only**: 10–11px,
  letterspaced 0.2em, uppercase — like "GENTLEMEN'S SINGLES · FINAL" on a
  programme page.
- Big numbers (ratings, scores) stay mono — that's the analytics half of
  the brand.
- Fraunces alternates: Playfair Display (more classical menu), Cormorant
  (lighter, more delicate). Fraunces recommended — luxury but contemporary.

### Color

Keep the dark app, warm it up:

| Token | Current | Proposed | Why |
|-------|---------|----------|-----|
| `--color-background` | #0e1116 (neutral) | **#101311** (hint of green-black) | "Lawn at night" instead of "VS Code" |
| display text | #e8eaed (cool gray) | **#ece5d8 cream** for serif display only | Ink on cream programme paper, inverted |
| `--color-gold` (new) | — | **#c9a96a** (old gold) | Replaces bright amber #f5c518 in Grand Slam styling, dividers, ornaments. Trophy gold, not taxi yellow |
| `--color-primary` | #22d68a | unchanged | Wins/actions keep the brand green — used *less often* |
| hairlines (new) | — | rgba(236,229,216,0.10–0.16) | Cream-tinted rules instead of white borders |

Surface badge colors (Hard/Clay/Grass) stay — they're already meaningful.
Clay accent leans terracotta (#b8593a) in programme contexts.

### Layout primitives (replace the card)

1. **Hairline rules** — single 1px cream rules between content; a
   **double rule** (two rules, 3px apart) under page titles only.
2. **Centered section dividers** — `———  EYEBROW LABEL  ———` (rule,
   label, rule). Used in the mockup; replaces card headers.
3. **Dot leaders** — menu-style `Match quality ......... 9.6` for stat
   rows. Signature move; use for community ratings, player stat blocks,
   profile stats.
4. **The "order of play" row** — list items become typeset lines:
   serif "Winner *d.* Loser" left, mono metadata right, hairline below.
   No hover cards, no boxes. Used for match lists and match history.
5. **Centered formal lockups** — match heroes center-aligned like a
   programme bill: eyebrow / names with italic "v." / score between two
   short gold rules / venue line.
6. **Cards survive only as interactive objects** — review cards, forms,
   the radar block. Everything ambient sits directly on the page.

### Ornament (subtle, typographic only)

- Short gold rules flanking scores (see mockup)
- Footer colophon on key pages: `— COURTSIDE · No. 24 —` (issue number =
  player rank, match round number, or page-appropriate detail)
- Grand Slam pages get a **cover band**: a tinted header strip in the
  slam's color (Wimbledon green/purple, RG terracotta, AO blue, USO navy)
  with gold eyebrow — replaces the current gold glow box
- Replace emoji reactions 🔥😲👎 with small line icons or typographic
  marks in the same cream/gold palette (keep the animation)

### Motion

No change to philosophy — 150–200ms, functional. Springy popups stay.

---

## 3. Page-by-page treatment

| Page | Treatment |
|------|-----------|
| **Match detail** *(flagship — do first)* | Programme spread: slam cover band, centered bill lockup, dot-leader community ratings ("Notes from the gallery"), reviews as letterpress cards with serif reviewer names |
| **Match list** | "Order of play" — typeset rows with hairlines, tour/year filter chips restyled as small-caps text links with underlines instead of pills |
| **Player profile** | Name in large serif + country + rank as eyebrow; radar keeps mono axis labels; trophy case becomes "Honours"; match history = order-of-play rows |
| **Players list** | Draw-sheet feel: ranked typeset rows, serif names, dot leaders to win % when stat-sorted |
| **Home** | Programme cover: centered masthead "COURTSIDE" eyebrow + serif tagline, stats bar as a single typeset line with gold dividers, community reviews as order-of-play rows |
| **H2H / Compare** | "The Rivalry" — two serif names with italic "v.", records in dot leaders, radar overlay unchanged |
| **Feed** | Lighter touch: section dividers + typeset rows replace card stacks |
| **Profile** | Name in serif, stats as dot leaders, achievements as "Honours" with gold tiers |

---

## 4. Implementation phases (one commit each)

1. **Foundation** — load Fraunces in layout.tsx, add tokens
   (`--color-gold`, cream, hairline values, `--font-serif`), add shared
   CSS utilities (`.eyebrow`, `.rule`, `.rule-divider`, `.dot-leader`,
   `.bill-name`). Nothing visible changes yet.
2. **Match detail page** — the flagship programme spread + slam cover bands.
3. **Match list** — order-of-play rows + filter restyle.
4. **Player profile + players list.**
5. **Home page** — programme cover hero.
6. **H2H, feed, profile** — apply the established primitives.
7. **Sweep** — replace remaining emoji/pills, retire unused card styles,
   update CLAUDE.md conventions (the "never mix fonts" rule becomes a
   three-role rule).

Each phase ships independently — the app never looks broken in between,
old and new styles coexist per-page.

---

## 5. Open decisions

1. **Background**: hint-of-green #101311 vs keeping neutral #0e1116.
   (Mockup uses the green-black.)
2. **Serif face**: Fraunces (recommended) vs Playfair Display vs Cormorant.
3. **How far with cream**: serif display only (recommended) vs all text
   warmed up.
4. **Reaction icons**: thin line icons vs typographic marks (※ † ⁂) vs
   keeping emoji.
