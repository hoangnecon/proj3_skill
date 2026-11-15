# Sets — building locations at exemplar density

A set is one function per location in `src/sets/episode.tsx` that returns layers for a frame. The bar
is the exemplar sets in `src/exemplar/sets.tsx` (rendered to `qa/design/set_ex-*.png`). A set that is
"a wall, a door rectangle and a floor" is rejected by the lint and by the reviewer.

## Contents
1. Detail budget (numbers)
2. Procedure
3. The six passes of the back layer (with code)
4. Choosing the view: box vs elevation
5. Mid layer, fg layer, far layer
6. State: options and keys
7. Life: something always moves
8. Inserts (full-frame close-ups)
9. Object bank for Vietnamese everyday locations
10. Anti-patterns
11. G4 review checklist (sets part)

## 1. Detail budget

Measured by `node scripts/lint.mjs design` (it renders each set to static SVG and counts).

| Set | shapes | colours | texts | halftone | glow | mid items |
|---|---|---|---|---|---|---|
| ex-lobby | 112 | 18 | 11 | 4 | 5 | 2 |
| ex-corridor | 168 | 19 | 8 | 8 | 7 | — |
| ex-building | 179 | 12 | 20 | 5 | 1 | — |
| ex-machine | 61 | 10 | 7 | 2 | 0 | 2 |
| ex-car | 59 | 11 | 21 | 4 | 1 | 0 |
| ex-stairs | 43 | 7 | 3 | 2 | 1 | — |
| ex-hall | 33 | 11 | 8 | 2 | 0 | 1 |

Minimum for an episode set (lint errors below these): **60 shapes, 8 colours, 2 texts, 2 halftone uses,
1 glow**, and `bounds`. Inserts: 15 shapes, 1 text. Aim for the lobby/corridor level (100+ shapes) for
any set that holds more than 3 shots — the camera will push in and every crop must still be rich.

## 2. Procedure

1. **Location card** (in `brief.md` → Locations): what place, whose, what era/class, what time of day,
   which story actions happen here, and the one written gag the place carries.
2. **Object list**: write 15+ concrete objects that belong there (use §9), split into: fixtures the story
   touches, furniture, signage/text, clutter & wear, light sources.
3. **Blocking sketch in world coordinates**: where actors stand (`y`), where they walk (from/to x), where
   hands touch (button, door handle, counter). Put every touch point in `src/geo.ts` as an exported
   constant/function (`export const STALL_COUNTER = {x: 620, y: 1430}`) — shots import it, never retype it.
4. **Build in six passes** (§3), rendering after each pass:
   `node scripts/design.mjs --only set:<id>` → look at `qa/design/set_<id>.png` and `_grid.png`.
5. **Compare** your plate side by side with `set_ex-lobby.png`: is yours as dense, as textured, as lit,
   with as much readable text? If not, add another pass of clutter.
6. **Register** `{title, bed, render, bounds, plateCam?, plateOpts?}` in `EPISODE_SETS`.
7. **Lint**: `node scripts/lint.mjs design` prints shapes/colours/texts/halftone/glow per set.

## 3. The six passes of the back layer

Order matters (later paints over earlier). Coordinates below are the lobby's (interior, k = 1 at
[540, 1150]); keep the same conventions so actors (ground ≈ 1560–1800) fit.

**Pass 1 — ceiling + light source with glow**
```tsx
<rect x={-400} y={-400} width={1880} height={1040} fill={PAL.trim} />
{[-120, 300, 720, 1140].map((x, i) => (
  <g key={i}>
    <S d={Rr(x, 420, 260, 40, 14)} f="white" sw={4} />                         {/* tube */}
    <rect x={x - 40} y={460} width={340} height={260} fill="url(#glowY)" opacity={0.5} />  {/* its light */}
  </g>
))}
```
**Pass 2 — wall: base colour + dot texture + dado band + structural lines (w 6)**
```tsx
<rect x={-400} y={640} width={1880} height={920} fill={PAL.wallD} />
<rect x={-400} y={640} width={1880} height={920} fill="url(#dots)" opacity={0.1} />
<rect x={-400} y={1330} width={1880} height={230} fill={PAL.wallB} />          {/* dado, different colour */}
<L d="M-400 1330H1480" w={6} /><L d="M-400 640H1480" w={6} />
```
**Pass 3 — signage and diegetic text (≥ 2 texts, ≥ 1 is a gag)**
```tsx
<S d={Rr(40, 690, 320, 110, 14)} f="navy" />
<Txt x={200} y={765} s={64} c="yellow" w={900} ls={4}>TOÀ B5</Txt>
<S d={R(30, 860, 280, 330)} f="wood" /><S d={R(46, 876, 248, 298)} f="paper" sw={3} />
<Txt x={170} y={928} s={34} c="red" w={900}>NỘI QUY</Txt>
{Array.from({length: 9}).map((_, i) => <L key={i} d={`M66 ${960 + i * 22}h${190 - (i % 3) * 40}`} w={4} o={0.4} />)}
<Txt x={170} y={1166} s={18} c="ink" w={700}>(27 điều · 4 trang)</Txt>        {/* the gag is in the small print */}
```
Text lines you do not need to read are drawn as `L` scribbles at opacity 0.4 with varying length — never
lorem ipsum, never English. Handwritten notices sit rotated 3–6° with a strip of tape (`yellow` 0.85).

**Pass 4 — functional fixtures the story touches** (door, button panel, counter, window, TV). Their
coordinates come from `geo.ts`. Each fixture has a frame (darker token), a body, and 2–4 inner details
(buttons, handle, label, reflection lines in `white` 0.6).

**Pass 5 — clutter and wear (≥ 6 items)**: mailboxes, potted plant (alternate `plant`/`plantDark`
leaves on a `pot`), fire extinguisher, calendar, shoe rack, wall clock, cables, a stain or patched
crack, a sticker, a bin. Mix sizes: 1 big, 2–3 medium, several small. At least one item is slightly
rotated or imperfect (lived-in, not catalogue).

**Pass 6 — floor**: base (`floor`/`floorDark`/`concreteDark`), perspective lines toward the centre,
horizontal seams getting further apart toward the viewer, and the ground line (w 6) where it meets the wall.
```tsx
<rect x={-400} y={1560} width={1880} height={700} fill={PAL.floor} />
{Array.from({length: 15}).map((_, i) => <L key={i} d={`M${540 + (i - 7) * 90} 1560L${540 + (i - 7) * 330} 2300`} w={3} o={0.35} />)}
{[1640, 1760, 1930, 2150].map((y) => <L key={y} d={`M-400 ${y}H1480`} w={3} o={0.35} />)}
<L d="M-400 1560H1480" w={6} />
```
Furniture standing on the floor gets a contact shadow: `<Sh d={E(x, footY, w/2, 12)} o={0.3}/>`.

## 3b. Human scale (fixtures people touch)

The rig is 610 px tall at s = 1 (hip 200, shoulder 410, head top 610). Draw fixtures in those units from
the floor line `fy` under them, or actors will look like toys or giants — and reaches will miss.

| Fixture | Height above its floor line |
|---|---|
| Wall button, light switch, ticket button, doorbell | 380–460 (button centre) |
| Door | 640–700 tall, 300–360 wide (single), handle at 330 |
| Counter / desk top | 210–300 |
| Table top | 180–220; chair / stool seat 110–125 (= `seatH`) |
| Window sill | 260–320; top 600–700 |
| Notice board centre | 450–560 (eye level 520) |
| Lift call panel | 400–460; lift car buttons 330–520 |
| Ceiling | ≥ 900 above the floor line |

Export every touch point with its floor line: `export const TICKET_BTN = {x: 1010, y: 990, fy: 1400};`
and draw the fixture from the same numbers (`height = fy - y + …`). Floor objects stand ON `fy` with a contact
shadow `<Sh d={E(x, fy, w/2, 12)} o={0.3}/>`.

## 4. Choosing the view

| View | When | Geometry |
|---|---|---|
| **Box** (one-point) | confined rooms where people face camera and talk (lift car, office, kitchen) | back wall rectangle in the middle, side walls as trapezoids to the frame edges, floor trapezoid, side walls shaded with dots 0.12–0.18 (darker side = further from light) |
| **Elevation** (side-on) | anything people WALK across: corridors, streets, stairs, market rows | flat wall, repeated modules (doors, stalls) every 400–420 px, floor band below, wide bounds (x to 3000+) so the camera can track |
| **Section / map** | building cross-section, neighbourhood map, floor plan | ruled grid of units, labels on everything, used with tags/pins and zoom moves |

## 5. Mid, fg and far layers

- **mid**: anything actors pass in front of or behind — counters, desks, doors that close over people in a
  lift, tables. `{y: frontEdgeY, key, node}`. An actor whose `y` is larger is drawn in front.
- **fg** (depth 1.3): thin foreground framing (a plant leaf, a door jamb, a hanging lamp) or whole-frame
  state overlays (lights out, flicker). Never put content the story needs here; it slides with parallax.
- **far** (depth 0.5): sky, skyline, distant hills behind windows or outdoors. It moves half as fast.

## 6. State: options and keys

Everything that changes during the story is a set option read from `o` — never a new set:
`door` (0..1 number → tweens), `lit` (number[] → switches), `call` (boolean), `disp` (string),
`dark`/`flicker` (0..1), `count` (number). Document each option in a comment at the top of the set.
Shots drive them: `o: {disp: '9'}` (static) or `keys: {door: [[0, 0], [1, 's5@mở', 0.7]]}` (animated).
Give the plate a representative state with `plateOpts` (e.g. door half open, one button lit).

## 7. Life: something always moves

Every set has at least one subtle time-based motion from `o.t` so held shots never look frozen: LED arrow
pulse `0.6 + 0.4·|sin(4t)|`, flickering tube, ceiling fan rotation, steam/incense via `Smoke`, a cat tail,
leaves swaying 2–3°, a clock second hand, rain streaks. Keep amplitude small; it is life, not action.
Lint SE-13 measures the RENDERED plate: 180-px cells with almost no edges are empty; more than 8 empty
cells in the middle rows is an error. Detail drawn outside the plate frame does not count.
Lint SE-12 renders the plate at t = 1 and t = 2.37 and warns when nothing differs. (Several exemplar
sets only move when an option is on — arrow, flicker — that was the v1 bar; new sets do better.)

## 8. Inserts

`insert: true` sets are full-frame close-ups: a document, a phone screen, an open palm with writing, a
receipt, a ledger page, a TV screen. No floor, no actors. They carry the reveal text the narration says
(the minutes that say "do thang máy", the price list). Density: paper texture (dots 0.08), 2+ text
sizes, a stamp/signature/doodle, a hand or object edge entering frame for scale. Use `keys` to write
lines in progressively or stamp at a word.

## 9. Object bank — Vietnamese everyday locations

Pick from these (and add your own) — every set needs fixtures + furniture + text + clutter + light.

| Location | Objects |
|---|---|
| Apartment lobby | lift doors + LED, call buttons, mailbox grid, NỘI QUY board, handwritten notice, guard desk + BẢO VỆ card, plant, tube lights, tiled floor, CCTV camera |
| Corridor (chung cư) | numbered doors in different colours, door mats, shoe racks, wall lamps with glow, painted floor number, pipes on ceiling, bins, fire hose box |
| Kitchen | gas stove + blue flame glow, rice cooker, hanging ladles, chopstick holder, fish sauce bottles, calendar, tiled backsplash, fridge with magnets, plastic stools, bulb |
| Living room | ancestor altar + incense smoke, framed portrait, wall clock, TV on cabinet, sofa with cushions, tea set on low table, calendar, ceiling fan, window with bars |
| Ward / office | flag + emblem plate, long table with cloth, name cards, microphones, water bottles, banner with slogan, filing cabinet, stamp + ink pad, fluorescent tubes |
| Street / alley | shop signs with phone numbers, electric pole with cable tangle, motorbikes, plastic stools, tarp awning, house numbers, "CẤM ĐỖ XE" sign, potted plants, street lamp |
| Market | stalls with tarps, price boards (chalk), scales, baskets of produce, hanging bulbs, plastic bags, stools, umbrellas, crates |
| Café | low plastic stools, small tables, glass cups with ice, menu board, fan, string lights, motorbikes outside, sugarcane press |
| Classroom | blackboard + chalk text, flag, teacher's desk, rows of desks, schedule board, fan, windows, posters with slogans |
| Hospital / clinic | numbered queue screen, benches, NO SMOKING sign, poster, drip stand, reception window, plants, clock |

Signage language is Vietnamese. Phone numbers, prices, opening hours and rules are great places for gags
("bảo hành 1 lần dùng", "(27 điều · 4 trang)", "THANG MÁY NÓI THẬT MỚI CHẠY!").

## 10. Anti-patterns (reject on sight)

- A few flat rectangles with no inner detail, no texture, no text — "boxes".
- Gradients on surfaces, drop shadows, black outlines, hairlines, raw hex colours.
- Floating objects (no ground line, no contact shadow), wrong perspective (floor lines not converging).
- Empty walls at the framing actually used by shots (check the contact sheet, not only the plate).
- Text that is unreadable at the shot's zoom, English text, placeholder text.
- Every object the same size and colour; more than 3 saturated accents fighting.
- No light source; light without a source; a glow with nothing under it.
- New set for a state change (door open/closed) instead of an option.
- Detail placed OFF the plate frame to pass the shape count (lint SE-13 measures the rendered plate).
- One element covering another's text (a calendar over the gag notice), text spilling past its plate,
  furniture hanging on the wall instead of standing on the floor.

## 11. G4 review checklist (sets part)

For each `set_<id>.png` and `set_<id>_grid.png`, write one line in `gates/G4.review.md`:
- Count the six passes: ceiling/light, wall+texture+dado, text+gag, fixtures, clutter (≥ 6), floor.
- Is it as dense as the exemplar plate of the same kind? Name what you added after comparing.
- Grid: do the touch points in `geo.ts` sit on the fixtures? Does `bounds` cover every planned camera?
- Which element moves over time (§7)?
- Collision pass — look for each, name it in the review as checked:
  1. no element covers another element's text (gags must be fully readable);
  2. every text fits inside its plate with ≥ 12 px margin (estimate width ≈ chars × size × 0.6);
  3. furniture and floor objects stand on the floor with a contact shadow (bottom edge at y ≥ the
     wall/floor line), wall objects hang on the wall (not overlapping the dado line halfway);
  4. no two fixtures intersect unless one is clearly in front (mid layer / overlap by design);
  5. the plate's visible middle has no bare wall (SE-13 ≤ 8 empty cells, aim ≤ 3).
