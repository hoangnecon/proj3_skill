---
name: sv-20-design-system
description: Design the cast and the sets of a story-video episode in the house "riso ink" style before any shot is written — exact colour tokens, line weights, halftone and glow rules, typography, character sheet procedure with trait rules, six-pass set building at exemplar detail density, props and overlays. Use whenever you create or change a character look, a location/set, a prop, an overlay, or anything visual in an episode project (src/episode/cast.ts, src/episode/sets.tsx, src/episode/geo.ts, src/props.tsx), and for gate G4.
---

# sv-20 · Design system — cast + sets (gate G4)

You are designing the world the story happens in. The bar is set by the exemplar cast and sets that ship
with every episode (`src/exemplar/`, from the suite's `examples/thang-may/`), rendered into `qa/design/*ex*`. Your episode must look like it
belongs in the same series and carry the same density of detail. Agents that skip this phase produce
"a few boxes and stick figures"; the lint and the gate exist to stop that.

## Read first (in this order)
1. `references/tokens.md` — palette, line weights, halftone, glow, type, world coordinates. Mandatory.
2. `references/characters.md` — when designing or changing anyone on screen.
3. `references/sets.md` — when building or changing a location. Contains the code for the six passes.
4. `references/props-overlays.md` — when a shot needs an object in hand / on the floor, or a screen graphic.

## Inputs → outputs
- In: `brief.md` (Characters, Locations), `beats.md` (segment map: who is where), `script.json`, G2/G3 passed (run `python3 scripts/plan_assets.py` for the G2→G4 asset blueprint).
- Out: `src/episode/cast.ts` (CAST + CAST_ROLES), `src/episode/sets.tsx` (EPISODE_SETS), `src/episode/subjects.tsx` (multi-pose Hero `SUBJECTS`), `src/episode/geo.ts` (touch
  points), new props in `src/props.tsx` if needed, evidence in `qa/design/` (including `overview_sets.jpg`), `gates/G4.review.md`.

## Workflow

1. **See the bar & generate the asset blueprint.** `node scripts/design.mjs --exemplar` then open `qa/design/cast_exemplar_p1.png`,
   `expr_ex_baHanh.png`, `set_ex-lobby.png`, `set_ex-corridor.png`. Spend real attention here: count the
   objects on the lobby plate, notice the small print, the halftone, the glows. Run `python3 scripts/plan_assets.py`
   before splitting G4 work to derive the deterministic G2→G4 asset blueprint (required cast looks, multi-pose Hero Subjects, and multi-angle / drawn sub-scene set targets).
2. **Cast.** Follow characters.md §3: list everyone from the segment map → card (`vi`) → silhouette →
   colours → story trait → register → `node scripts/design.mjs` → look at `cast_episode_p*.png` and every
   `expr_<key>.png` (open the light `_v.jpg` views; sets also get `set_<id>_zoom.jpg`, 3×3 full-resolution
   ninths to judge detail and text) → fix → `node scripts/design.mjs --changed` (re-renders only what changed) → repeat. Run `node scripts/lint.mjs design` until CH-* errors are gone.
3. **Sets & Drawn Sub-Scenes.** For each location: location card → object list (≥ 15, sets.md §9) → blocking sketch with
   touch points in `geo.ts` → six passes, rendering `node scripts/design.mjs --only set:<id>` after each
   pass → compare with the exemplar plate of the same kind → `bounds` → register. For natural/outdoor environments, use the Botanical Kit in `kit.tsx` (`Leaf`, `GrassTuft`, `GrassStrip`, `LeafCluster`, `Bush`, `TreeCanopy`, `Vine`) rather than flat geometric blobs. In `long_16x9` episodes, every non-insert set MUST declare `actorScale: [minS, maxS]`, `shotScale: 'establishing' | 'medium' | 'closeup' | 'insert'`, and `location` (`LA-01`), and at least 3 locations should include `≥ 2` drawn `shotScale` plates (`SE-15`, never fake close-ups via camera zoom).
3b. **Hero Subjects (`src/episode/subjects.tsx`).** Every recurring hero creature, boss, vehicle, or rideable machine MUST be registered in `SUBJECTS` (`PR-06`) with `title`, `kind`, `relToActor: [minR, maxR]`, optional `seats` for `Actor.mount`, and **`≥ 4` distinct poses** (at least 3 producing distinct SVG markup/bounds; no copy-paste static stickers). For rideable creatures (`kind: 'creature'`), author `SubjectSeat` with `straddle: true`, subject-local IK `grip: [gx, gy]` anchors (collar, antenna base, or front rider's shoulder), and `wind` (e.g. `1.2..1.5` in `fly` / `0.8` in `hover`) so `Film.tsx` renders the 3-layer straddle sandwich with `SeatShadow` and trailing hair (`MO-14`).
4. **Lint.** `node scripts/lint.mjs design` must print 0 errors (checks `CH-01..10`, `SE-01..16`, `PR-01..06`, `LA-01`, `TK-01..03`). It prints the density line per set
   (`set kitchen: 118 shapes · 14 colours · 6 texts · halftone 4 · glow 3 · mid 2`). Do not weaken a
   threshold; add detail.
5. **Render all evidence.** `node scripts/design.mjs` (writes cast pages, expression sheets for every
   principal and support, `props_episode_p*.png` + `_v.jpg` human-scale prop sheets, `subject_<id>.png` + `_v.jpg` multi-pose Hero Subject sheets, set plates + grids with scale silhouettes, `qa/design/overview_sets.jpg` single-sheet overview of all episode sets for fast palette/angle consistency checks, and auto-generates `qa/design/visual_spec.json` with `cast`, `sets`, `subjects`, `world_props`, and `hand_props` specs).
6. **Review.** Fill `gates/G4.review.md`: one line per evidence image — including `qa/design/overview_sets.jpg`, `props_episode_p*_v.jpg`, every `subject_<id>_v.jpg` (verify `≥ 4` distinct poses and `relToActor` human-scale proportions), and every `set_<id>_v.jpg` / `_grid_v.jpg` — with what you actually saw (≥ 4
   words) and the rubric answers (characters.md §8, sets.md §11).
7. **Show the user** the cast sheet and the set plates (send the PNGs) and get their OK. Put their words
   in `user_quote`. If they asked you to carry on without checking, use `approval: delegated` and quote that.
8. **Gate.** `python3 scripts/sv_gate.py pass G4`.

## Rules that are never negotiable
- Only PAL tokens in episode code; one font (Be Vietnam Pro via `Txt`); ink `#1f2f6e` outlines, never black.
- Shading = halftone dots only. Light = glow under a visible source only. No gradients on surfaces.
- Every set: six passes, ≥ 60 shapes, ≥ 8 colours, ≥ 2 Vietnamese texts with one gag, ≥ 2 halftone, ≥ 1
  glow, `bounds` covering every camera, and at least one subtle motion from `o.t` (lint SE-12 warns; waive only for inserts/flat cards).
- Every principal: ≥ 3 traits, unique silhouette, an expression sheet that you looked at.
- Exemplar looks (`ex_*`) and sets (`ex-*`) are references, never cast in episode shots.
- State changes (door open, light off) are set options driven by `keys`, never a duplicate set.
- If you change a look or set after G4 passed, the gate goes STALE: re-render, re-review, re-pass.

## Common failure → fix
| You see | Do |
|---|---|
| Plate looks empty at the shot's zoom | add clutter pass 5 in that area; check the contact sheet crop, not just the plate |
| Two characters read the same at thumbnail size | change hat or hair AND `w`/`h`; then colour |
| Character disappears against the wall | change `topC` (not the wall) unless the wall is wrong for the place |
| Text unreadable | ≥ 22 px world for any text that matters, frame it at zoom ≥ 1.2 when narrated |
| Floor looks like a flat rectangle | perspective lines + seams + contact shadows (sets.md pass 6) |
| Lint SE-06 shapes too low | you are missing passes 4–5; compare object list with sets.md §9 |
| Lint SE-14 sign clipped on plate | widen `plateCam` / shift `plateCam` `cx` or move the sign inside the plate frame |
| Lint PR-01 / PR-02 prop scale or text overlap | scale vehicle/cart to human-scale table (sets.md §3b), move opaque wheel/shape clear of `<text>`, verify in `props_episode_p*_v.jpg` |
| Lint PR-03 disembodied `*Head` prop | a `*Head` prop exists alongside its full-body `WORLD_PROPS` entry — remove the disembodied head and use full-body multi-pose props instead |
| Lint PR-04 `HAND_PROPS` grip or size | keep grip origin `(0,0)` within `<= 120 px` of the prop (`gripDist <= 120`) and max dimension `<= 380 px` |
| Lint PR-06 Hero Subject poses/spec | register in `src/episode/subjects.tsx` with `title`, `relToActor: [minR, maxR]`, and `>= 4` poses (at least 3 visually distinct SVG outputs); render `qa/design/subject_<id>.png` |
| Lint LA-01 missing set scale/sub-scene metadata | declare `actorScale: [minS, maxS]`, `shotScale` (`establishing|medium|closeup|insert`), and `location` on every non-insert `long_16x9` set |
