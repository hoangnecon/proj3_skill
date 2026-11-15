# Design tokens — "riso ink" style

Every value here exists in `src/kit.tsx`. Episode code (`src/cast.ts`, `src/sets/episode.tsx`, `src/geo.ts`,
`src/shotlist.ts`) may only use these tokens. `scripts/lint.mjs` fails on a raw `#hex` (rule TK-02) or a
literal `fontFamily` (TK-03) in those files. If a colour is truly missing, add a named token to `PAL` in
`kit.tsx` with a comment saying what it is for, then use the name.

## Contents
1. Look of the style in one paragraph
2. Colour palette (PAL) and the role of each token
3. Line weights
4. Texture: halftone dots
5. Light: glow
6. Typography
7. Frame, world coordinates and layers
8. Screen-level finishing (grain, vignette, captions)
9. Drawing helpers

## 1. The style in one paragraph

Flat, warm riso-print colour fields, every shape outlined in one dark-navy ink (`#1f2f6e`, never black),
shading done ONLY with rotated halftone dots (never gradients on surfaces), light done ONLY with a soft
radial glow under the source, rounded joins everywhere, big heads (head radius 86 on a 610 px body),
lots of small readable Vietnamese text inside the world (signs, notices, labels) that carries jokes.
Saturated accents (red, yellow, teal) are small; walls are pale and warm so characters read in front.

## 2. Colour palette

Use the token name, not the hex. Grouped by role:

| Role | Tokens | Use |
|---|---|---|
| Ink | `ink` `navy` `dark` `grille` `wire` (all `#1f2f6e`) | outlines, text on light, LED housings, night grade |
| Paper | `paper` `trim` `tank` `lane` (`#fff6df`), `white` (`#fffaf0`) | notices, ceilings, trim, highlights |
| Walls (pale, large areas) | `wallA` yellow `#ffe08a`, `wallB` mint `#7fd1c3`, `wallC` pink `#ff8fa8`, `wallD` peach `#ffcf9e` | one base wall colour per set + a different dado band |
| Floors | `floor` `#f6c98a`, `floorDark` `#e0a964`, `ground` `#ffe9b0` | interior floors, outdoor ground |
| Cool neutrals | `concrete` `#cfd6e6`, `concreteDark` `#8e9bbf`, `steel` `#c3cde3`, `steelDark` `#7f8fb3`, `asphalt` `#5a6a96`, `asphaltDark` `#3f4d7a` | stairwells, basements, metal fixtures, roads |
| Glass | `glass` `#4a8fc9`, `glassLit` `#ffd65c`, `mirror` `#d6eef0` | windows (lit at night = `glassLit`), mirrors |
| Accents (small areas) | `red` `#ff4d5e`, `redDark` `#c22f52`, `yellow` `#ffd65c`, `gold` `#ffc23d`, `goldDark` `#d9892b`, `orange` `#ff8f5f`, `pink` `#ff8fa8`, `teal` `#2fae8f`, `blue` `#4a8fc9`, `green` `#7ccf6a` | clothes, signs, buttons, props |
| Wood | `wood` `#c4573a`, `woodDark` `#8a3434` | furniture, doors, notice-board frames |
| Plants | `plant` `#2fae8f`, `plantDark` `#1f6f73`, `pot` `#ff8f5f` | potted plants — alternate the two greens leaf by leaf |
| Skin & hair | `skin` `#ffb59a`, `skinShade` `#ff7f8a`, `blush` `#ff5f8a`, `hair` `#1f2f6e`, `hairGrey` `#9aa6c9` | characters only |
| Signals | `led` `#ff3b3b`, `lit` `#fff3a8`, `stamp` `#ff4d5e` | LED digits, lit buttons/lamps, rubber stamps |
| Shade | `shade` `#2b4f9e` | colour of the halftone dots (via patterns, not as a fill) |
| Ghost | `ghost` `#bfeee6`, `ghostDeep` `#7fd1c3` | supernatural characters/glows only |

Contrast rules (checked in the G4 review):
- A character's `topC` must differ from the wall behind them (reviewer checks the cast sheet against the plates).
- Text on a light surface is `ink`; text on `navy`/`ink` plates is `yellow` or `white`; warning text is `red`.
- At most 3 accent colours in one set's back layer besides wall/floor/wood; the rest of the colour count
  comes from neutrals and paper.

## 3. Line weights (px in world units at zoom 1)

| Weight | Where |
|---|---|
| 6 | structural lines: wall/ceiling junction, dado top line, ground line where floor meets wall |
| 5 (`LINE`, default of `S`) | every filled shape outline: furniture, doors, signs, people |
| 4 | small items: frames inside frames, buttons, cards, chair legs, wall plates |
| 3 | tiny items and inner detail: mailbox slots, tile seams, paper on paper |
| 3–4 at opacity 0.35–0.4 | floor perspective lines, tile grids, text-line scribbles on notices |
| 8–12 | thick poles, handrails, cables (as `L` with token colour, not ink) |

Never use a hairline (< 3). Never outline in black. Joins and caps are always round (the helpers do it).

## 4. Texture — halftone dots

Patterns from `<Defs/>`, all rotated 30°:

| Pattern | Dot | Use | Opacity |
|---|---|---|---|
| `url(#dots)` | 2.7 px `shade` on 11 px grid | walls (whole surface) | 0.08–0.12 |
| | | shade side of furniture / under counters | 0.2–0.3 |
| | | cast shadow on floor under big furniture | 0.25–0.35 |
| `url(#dotsR)` | `redDark` | red surfaces (cloth, red counters) | 0.35–0.45 |
| `url(#dotsW)` | `white` | sheen on dark surfaces, steam, light on glass | 0.3–0.5 |
| `url(#dotsBig)` | 5 px `shade` on 22 px grid | large distant masses (building sides, sky haze) | 0.15–0.25 |

Use `<Sh d={path} o={0.85} dots="dots"/>` for a shaded region, or `<rect … fill="url(#dots)" opacity={0.1}/>`
over a whole wall. A set needs at least 2 halftone uses (lint SE-09): the wall texture and one shade.

## 5. Light — glow

`url(#glowY)` (warm, `#fff2b8` → transparent) under every light source: ceiling tubes, lamps, lit screens,
windows at night, a lit button (r ≈ 44). `url(#glowG)` only for the supernatural. Opacity 0.4–0.6 for
ambient fixtures, up to 0.9 for a story-relevant light (the button that just lit). Every non-insert set
has at least one glow (lint SE-10). A glow is a `rect` or `circle` filled with the gradient, placed in
the back layer right after the fixture it belongs to.

## 6. Typography

One family: **Be Vietnam Pro** (`FONT`), weights 600 / 800 / 900, Vietnamese subset. Always through
`<Txt>` (world text) or the caption/overlay components. Sizes in world px at zoom 1:

| Use | Size | Weight | Colour |
|---|---|---|---|
| Building / room name plate | 56–72 | 900, `ls` 2–4 | `yellow` on `navy` plate |
| Sign heading (NỘI QUY, THANG MÁY) | 26–36 | 900 | `red` or `ink` on `paper` |
| Sign body | 22–26 | 800 | `ink` |
| Small print, the gag line ((27 điều · 4 trang)) | 16–20 | 700 | `ink` |
| Labels on furniture (BẢO VỆ) | 30–40 | 900 | `ink` on `paper` card |
| LED digits | 0.6 × housing height | 900 | `led` on `#14183a` screen (exemplar) — use `ink` in episodes |
| Overlay title card | 110–140 | 900 | see overlays |
| Captions | 66 | 900 | white, 16 px `ink` stroke, active word `yellow` |

Text must be readable on the contact sheet at 300 px wide: anything that carries a joke is ≥ 22 px world
and is framed at zoom ≥ 1.2 when the narration points at it.

## 7. Frame, world and layers

- Video 1080 × 1920, 30 fps. Camera `[cx, cy, k]` shows the world rect `cx ± 540/k`, `cy ± 960/k`.
- World units = screen px at `k = 1`. Interior convention: ceiling above y≈640, wall 640–1560,
  floor from 1560 down; actors stand around y 1560–1800 (`GROUND = 1700` in `src/geo.ts`).
- A set paints its back layer edge-to-edge over `bounds` (declared in `SetDef`); every camera of every shot
  must stay inside it (lint CA-05). Paint generously: typical interior bounds `[-400, -400, 1480, 2300]`;
  a set that pans or zooms out to `k = 0.6` needs ~`[-400, -200, 2900, 2300]`.
- Layers returned by a set: `far` (depth 0.5, parallax sky/city), `back` (depth 1, walls/floor/fixtures),
  `mid` (depth 1, items depth-sorted with actors by their front `y`), `fg` (depth 1.3, thin framing only).
- Depth sort: an actor with `y` greater than an item's `y` is drawn in front of it.

## 8. Screen finishing (applied by Film.tsx — do not re-implement)

Grain (`#grain` turbulence, multiply, reseeded every 2 frames), vignette (`#vig`, navy 0.35 at the edge),
optional night grade (`shot.night` 0..1), captions at y 1640, chunks ≤ 26 characters, active word yellow.
Keep the caption band y 1480–1760 free of overlays (lint OV-03) and of important set text at the
framing used while narration plays.

## 9. Drawing helpers (kit.tsx)

| Helper | Signature | Notes |
|---|---|---|
| `S` | `<S d={path} f="token" sw={5} o nl lc tr/>` | filled shape + ink outline. `nl` = no outline (glows, inner fills) |
| `L` | `<L d={path} w={5} c="ink" o/>` | stroke only, round caps |
| `Sh` | `<Sh d={path} o={0.85} dots="dots"/>` | halftone shade region |
| `Txt` | `<Txt x y s c w a r o stroke sw ls>…</Txt>` | world text; `a` = anchor, `r` = rotation |
| `R` / `Rr` / `E` | `R(x,y,w,h)`, `Rr(x,y,w,h,r)`, `E(cx,cy,rx,ry)` | path strings |
| `col` | `col('teal')` | token → hex, for the rare raw SVG attribute |
| `Smoke` | `<Smoke x y t h w o ph/>` | rising wisp (incense, steam, cigarette) |
