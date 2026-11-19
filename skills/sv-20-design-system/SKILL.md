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
- In: `brief.md` (Characters, Locations), `beats.md` (segment map: who is where), G3 passed.
- Out: `src/episode/cast.ts` (CAST + CAST_ROLES), `src/episode/sets.tsx` (EPISODE_SETS), `src/episode/geo.ts` (touch
  points), new props in `src/props.tsx` if needed, evidence in `qa/design/`, `gates/G4.review.md`.

## Workflow

1. **See the bar.** `node scripts/design.mjs --exemplar` then open `qa/design/cast_exemplar_p1.png`,
   `expr_ex_baHanh.png`, `set_ex-lobby.png`, `set_ex-corridor.png`. Spend real attention here: count the
   objects on the lobby plate, notice the small print, the halftone, the glows.
2. **Cast.** Follow characters.md §3: list everyone from the segment map → card (`vi`) → silhouette →
   colours → story trait → register → `node scripts/design.mjs` → look at `cast_episode_p*.png` and every
   `expr_<key>.png` (open the light `_v.jpg` views; sets also get `set_<id>_zoom.jpg`, 3×3 full-resolution
   ninths to judge detail and text) → fix → `node scripts/design.mjs --changed` (re-renders only what changed) → repeat. Run `node scripts/lint.mjs design` until CH-* errors are gone.
3. **Sets.** For each location: location card → object list (≥ 15, sets.md §9) → blocking sketch with
   touch points in `geo.ts` → six passes, rendering `node scripts/design.mjs --only set:<id>` after each
   pass → compare with the exemplar plate of the same kind → `bounds` → register.
4. **Lint.** `node scripts/lint.mjs design` must print 0 errors (checks `CH-*`, `SE-01..14`, `PR-01..02`, `TK-*`). It prints the density line per set
   (`set kitchen: 118 shapes · 14 colours · 6 texts · halftone 4 · glow 3 · mid 2`). Do not weaken a
   threshold; add detail.
5. **Render all evidence.** `node scripts/design.mjs` (writes cast pages, expression sheets for every
   principal and support, `props_episode_p*.png` + `_v.jpg` human-scale prop sheets, and set plates + grids).
6. **Review.** Fill `gates/G4.review.md`: one line per evidence image — including `props_episode_p*_v.jpg` (mandatory check that vehicles/furniture match the `575 px` adult / `435 px` child ruler and zero text is occluded) and every `set_<id>_v.jpg` / `_grid_v.jpg` — with what you actually saw (≥ 4
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
