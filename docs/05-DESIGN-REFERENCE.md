# Basket Bos — Player Card Design Reference

**Source:** 10 NBA-style stat graphic references provided by owner (2026-07-05)
**Applies to:** F-CARD (shareable player card), post-game MVP card, leaderboard visuals — built in M6

---

## 1. Visual DNA extracted from references

### Typography
- **Numbers are the hero.** Stats rendered huge — condensed, extra-bold numerals (often taller than the player photo). Labels (PTS / REB / AST / FG%) tiny, uppercase, letter-spaced, placed under or beside the number.
- **Superscript decimals** — "20<sup>.1</sup> Points" style (Haliburton, Murray refs): integer huge, decimal small and raised.
- **Oversized name typography** that overlaps the player cutout (Mitchell ref: name runs behind/in front of the figure for depth).
- **Vertical side text** as editorial detail — small rotated captions along the edges (achievements, season, team motto).

### Player imagery
- Full-body **cutout** in dramatic action pose, breaking out of frames/panels for depth (layer order: bg → panel → stats → player → name fragments).
- **Duotone / monochrome treatments**: B&W grunge (Nets), halftone print texture (Westbrook), or team-color wash. Cheap to apply with CSS/canvas filters — perfect for auto-generated cards.
- Secondary smaller action shots of the same player add motion (Suns 1-of-1 ref).

### Color & texture
- One dominant color family per card + white/black. High contrast.
- Textures everywhere: paper grain, grunge scratches, halftone dots, soft gradients (orange Suns ref), faint city-map/court-diagram linework in background.
- Small print-style details: logos in corners, barcodes, coordinates, crop marks, "pronounced …" microcopy — these make it feel like a collectible poster.

### Layout patterns (reusable templates)
| Template | Description | Ref |
|---|---|---|
| **Stat rail** | Left column of stacked big stats + rules, hero right | Suns Ayton, Nets, Duke |
| **Bottom stat row** | Centered hero, 3 stats in a row at bottom | SGA, Murray |
| **Numbers-as-background** | Giant numerals behind/around the player | Dennis Smith |
| **Framed portrait** | Photo in a frame + stat column beside, poster footer with name | Westbrook |
| **Editorial chaos** | Overlapping type, panels, microcopy | Mitchell |

## 2. Application to Basket Bos

### Card spec
- **Ratio 4:5** (1080×1350) — optimal for IG feed + LINE chat preview; story variant 9:16 later.
- **Server-rendered PNG** (Next.js OG image pipeline / Satori) — player taps "แชร์การ์ด" → gets image instantly.
- **Fonts:** Thai-compatible display stack — e.g. *Anuphan / Noto Sans Thai* for labels + heavy condensed Latin numerals (numbers never need Thai glyphs).

### Rank-tier art direction (progression = bragging fuel)
| Tier | Treatment |
|---|---|
| **Rookie** | Clean light card, minimal, single accent |
| **Silver** | Duotone player, metallic gray, grain texture |
| **Gold** | Warm orange/gold gradient (Suns ref), shine sweep |
| **Holo/MVP** | Dark editorial layout (Mitchell ref), animated shine in-app, halftone + special badge |

### Card variants
1. **Season card** — OVR + PPG/RPG/APG + FG%, positions, height/weight, tier frame (stat-rail template)
2. **Post-game MVP card** — "MVP คืนนี้" + 3 big stats (framed-portrait template, Westbrook ref) → auto-push to LINE group
3. **Milestone card** — records/achievements ("แต้มสูงสุดของก๊วน", triple-double) (Suns 4th-player ref)

### Photo strategy
Phase 1: LINE avatar in duotone circle/panel. Phase 2: players upload 1 action photo (admin approves) → background removal API → true cutout hero cards. Phase 3: AI pipeline auto-extracts best action frame from game video.

## 3. Design principles checklist (for M6 build)

- [ ] Numbers ≥ 3× larger than any other text
- [ ] Max 3–4 stats per card — no data dumps
- [ ] One color family + texture layer minimum
- [ ] Player layer overlaps at least one other layer (depth)
- [ ] Tier instantly recognizable at thumbnail size in LINE chat
- [ ] Thai UI labels, English stat abbreviations (PTS/REB/AST are universal)
- [ ] Group logo + "BASKET BOS" watermark — every share is free marketing
