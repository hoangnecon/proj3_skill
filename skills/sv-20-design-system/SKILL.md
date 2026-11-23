---
name: sv-20-design-system
description: Design the cast, sets, and Hero Subjects of a story-video episode in the house "riso ink" style before any shot is written (v5.6) — colour tokens, line weights, halftone and glow rules, typography, character turnarounds, six-pass set building, Spatial Location Packs (cameraDir, shared landmarks, 3/4 elevated high-angle perspective via SE-18, dedicated closeup/POV plates, botanical silhouette variety via SE-19, SetDef.scaleMode normal or tiny and stateless background plates via SE-20, SE-15..20), living quadruped Hero Subjects (SubjectRenderOpts, temporal guards firstSeg/appearSegs/poseSegs via SH-23, anatomical scaleWithTinyActor and partialOf close-up subjects via LA-03, PR-06, PR-08..09), props and overlays. Use whenever creating or editing src/episode/cast.ts, src/episode/sets.tsx, src/episode/subjects.tsx, src/episode/geo.ts, or src/props.tsx for gate G4.
---

# sv-20 · Design system — cast + sets (gate G4, `v5.7.0`)

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
  points), new props in `src/props.tsx` if needed, evidence in `qa/design/` (including `overview_sets.jpg` and per-location `location_<loc>_pack.jpg`), `gates/G4.review.md`.

## Workflow

1. **See the bar & generate the asset blueprint.** `node scripts/design.mjs --exemplar` then open `qa/design/cast_exemplar_p1.png`,
   `expr_ex_baHanh.png`, `set_ex-lobby.png`, `set_ex-corridor.png`. Spend real attention here: count the
   objects on the lobby plate, notice the small print, the halftone, the glows. Run `python3 scripts/plan_assets.py`
   before splitting G4 work to derive the deterministic G2→G4 asset blueprint (required cast looks, multi-pose Hero Subjects, and multi-angle / drawn sub-scene set targets).
2. **Cast.** Follow characters.md §3: list everyone from the segment map → card (`vi`) → silhouette →
   colours → story trait → register → `node scripts/design.mjs` → look at `cast_episode_p*.png` and every
   `expr_<key>.png` (open the light `_v.jpg` views; sets also get `set_<id>_zoom.jpg`, 3×3 full-resolution
   ninths to judge detail and text) → fix → `node scripts/design.mjs --changed` (re-renders only what changed) → repeat. Run `node scripts/lint.mjs design` until CH-* errors are gone.
3. **Sets, `scaleMode`, Stateless Plates, 3/4 Perspective & Spatial Location Packs (`SE-15..20`).** For each location: location card → object list (≥ 15, sets.md §9) → blocking sketch with
   touch points in `geo.ts` → six passes, rendering `node scripts/design.mjs --only set:<id>` after each
   pass → compare with the exemplar plate of the same kind → `bounds` → register. For natural/outdoor environments, use the Botanical Kit in `kit.tsx` (`Leaf`, `GrassTuft`, `GrassStrip`, `LeafCluster`, `Bush`, `TreeCanopy`, `Vine`) rather than flat geometric blobs. In `long_16x9` episodes, organize sets into **Spatial Location Packs** (**target 24–30 drawn sets** = 5–6 primary locations × 5 redrawn camera angles each; hard floor `≥ 15` ERROR, WARN `< 24`, WARN if `< 3` primary locations have `≥ 3` redrawn angles — `SE-15`). Every non-insert set MUST declare `actorScale: [minS, maxS]`, `shotScale: 'establishing' | 'medium' | 'closeup' | 'insert'`, `location` (`LA-01`), **`SetDef.cameraDir`** (`'front' | 'reverse' | 'left' | 'right' | 'top' | 'low' | 'detail'`), and shared **`SetDef.landmarks: string[]`** (`SE-17`):
   - **World Scale Mode & Stateless Background Plates (`SetDef.scaleMode`, `SetDef.stateless`, `SE-20`, `SH-22`):** In any size-shift / miniature adventure, declare **`scaleMode: 'normal' | 'tiny'`** on every non-insert stage plate (`SE-20` errors on invalid values and warns if any set omits `scaleMode`; `SH-22` blocks normal-scale segments on `'tiny'` plates and shrunken-kid `'tiny'` segments on `'normal'` plates). Sets MUST be **100% stateless (`stateless: true`)**: **NEVER bake cat shadows, sticky tape traps, dropped glasses, or climax pencil-levers into static background plates!** Transient plot items belong in `ShotDef.extras` (`WORLD_PROPS` / `SUBJECTS`) or `ShotDef.keys`-driven `SetOpts` (defaulting to absent on the base plate).
   - **3/4 Elevated High-Angle Perspective (`SE-18`):** Draw `angle: 'high'` sets in **35–45° 3/4 elevated perspective** (`cameraDir: 'front' | 'right' | 'left'`) with visible wall, desk, and furniture vertical height — **never** draw flat 90° board-game floorplans (`cameraDir: 'top'`) when staging horizon-rig `side`/`front` actors.
   - **Dedicated `closeup` / `pov` Plate per Location Pack (`SH-20`, `CA-07`):** Include **at least 1 dedicated drawn `closeup` or `pov` reaction & insert plate** (`shotScale: 'closeup'`, `actorScale: [0.95, 1.25]`, `cameraDir: 'detail'`) in EVERY primary Location Pack (`plan_assets.py`) so G5 builders cut in every 2–3 wide shots (`SH-20`) without wide-plate zooms (`LA-03`).
   - **Botanical & Prop Silhouette Variety (`SE-19` Anti-Clone-Stamp Guard):** Never repeat `>= 9` verbatim identical curved SVG `<path>` silhouettes across a set (`SE-19`); vary plant species (clover, daisy, curved grass blades, ferns, pebbles), curve geometry, scale, and rotation angle.
3b. **Hero Subjects, True Quadruped Anatomy, Temporal Guards & Partial Close-Up Subjects (`src/episode/subjects.tsx`, `PR-06`, `PR-08..09`, `SH-23`, `LA-03`).** Every recurring hero creature, boss, vehicle, or rideable machine MUST be registered in `SUBJECTS` (`PR-06`) with `title`, `kind`, `relToActor: [minR, maxR]`, optional `seats` for `Actor.mount`, and **`≥ 4` distinct poses** (`SubjectDef.render(pose, opts)` receives `SubjectRenderOpts`: `{ t, expr, flip, c, phase, speed, moving, altitude }`).
   - **Living Locomotion & True Quadruped Feline Anatomy (`PR-08`, `PR-09`):** `kind: 'creature'` subjects MUST animate legs, wings, antennae, tail, or breathing across `opts.t` / `opts.phase` (`PR-08`: `0` animated poses = ERROR, `< 50%` = WARN; `PR-09` bans `> 2.2 s` frozen single-pose creature statues in shots). For quadrupeds (cats, dogs, beasts), draw **true horizontal quadruped anatomy** across EVERY pose — elongated ribcage/pelvis spine, angled shoulder/haunch joints, articulated paws with toe pads, and dynamic S-curve tail. **STRICTLY BAN** upright "bowling-pin snowman" `idle` blobs (stacked circles with no body length) and stiff "4-vertical-pipe" `startled` stick legs!
   - **Temporal Story-Window Guards (`firstSeg`, `appearSegs`, `poseSegs` → `SH-23`):** Declare `firstSeg?: 's64'` (earliest segment the subject may appear), `appearSegs?: [['s64', 's102'], ['s134', 's139']]` (allowed scene windows), and `poseSegs?: { trapped: [['s82', 's96']] }` (stateful pose windows, e.g. sticky tape on paw before removal) so `SH-23` rejects premature creature or state bleed at shot lint time.
   - **Anatomical Scale Lock & Partial Close-Up Subjects (`scaleWithTinyActor`, `partialOf` → `LA-03`, `PR-05`, `GE-19`):** On giant creatures confronting miniature heroes, declare `scaleWithTinyActor: [minR, maxR]` (e.g. `[2.8, 5.2]` subject-to-tiny-actor px height ratio) AND register dedicated partial-anatomy close-up subjects (`giantCatPaw`, `giantCatHead` with **`partialOf: 'giantCat'`** and `≥ 720 px` bleed geometry per `PR-05`/`GE-19`). Never shrink a full-body giant cat down to `1.2×` actor height to fit a close-up (`LA-03` errors on `scaleWithTinyActor` violations and `> 1.85×` cross-angle creature scale spread on `tiny` sets)!
   - **3-Layer Straddle Seats (`MO-14`):** For rideable creatures, define `SubjectSeat` with `straddle: true`, IK `grip: [gx, gy]`, and `wind` so `Film.tsx` locks riders with `SeatShadow` and `computeSubjectKinematics`.
4. **Lint.** `node scripts/lint.mjs design` must print 0 errors (checks `CH-01..10`, `SE-01..20`, `PR-01..06`, `PR-08`, `LA-01`, `TK-01..03`). Do not weaken a threshold; add detail.
5. **Render all evidence.** `node scripts/design.mjs` (writes cast Front/3Q/Back sheets, expression sheets, `props_episode_p*.png` + `_v.jpg`, `subject_<id>.png` + `_v.jpg`, set plates + grids with scale silhouettes, `qa/design/overview_sets.jpg`, per-location **`qa/design/location_<loc>_pack.jpg`**, and `qa/design/visual_spec.json`).
6. **Review.** Fill `gates/G4.review.md`: one line per evidence image — including `qa/design/overview_sets.jpg`, every `qa/design/location_<loc>_pack.jpg` (verify shared `landmarks`, `scaleMode`, stateless plates with zero baked plot props/shadows, and 3D room continuity), `props_episode_p*_v.jpg`, every `subject_<id>_v.jpg` (verify `≥ 4` distinct quadruped/living poses, `scaleWithTinyActor`, and `partialOf` close-ups), and every `set_<id>_v.jpg` / `_grid_v.jpg` — with ≥ 4 words of what you saw.
7. **Show the user** the cast sheet and the set plates (send the PNGs) and get their OK (`user_quote` or `approval: delegated`).
8. **Gate.** `python3 scripts/sv_gate.py pass G4`.

## Rules that are never negotiable
- Only PAL tokens in episode code; one font (Be Vietnam Pro via `Txt`); ink `#1f2f6e` outlines, never black.
- Shading = halftone dots only. Light = glow under a visible source only. No gradients on surfaces.
- Every set: six passes, ≥ 60 shapes, ≥ 8 colours, ≥ 2 Vietnamese texts with one gag, ≥ 2 halftone, ≥ 1
  glow, `bounds` covering every camera, `scaleMode` when world scale shifts (`SE-20`), **stateless base plate** (never bake transient plot props, cat shadows, sticky tape, dropped glasses, or climax levers into static set art!), and subtle `o.t` life (`SE-12`).
- Every principal: ≥ 3 traits, unique silhouette, an expression sheet that you looked at.
- **Canonical New Nhím (`NHIM_LOOK`, enforced by `CH-11`):** Whenever Nhím is in `CAST` (`nhim`, `nhim*`), import `NHIM_LOOK` from `../chars` (`hair: 'spikyUp'` swept-up spiky tufts with no bangs + `hat: 'capBack'`, `hatC: 'red'` backwards red snapback cap — supported natively across all 4 rigs: `Person`, `Person3Q`, `PersonSide`, `PersonBack`). Waive only with `// lint-ok: CH-11 <reason>` when plot explicitly requires a bare head or costume hat.
- Exemplar looks (`ex_*`) and sets (`ex-*`) are references, never cast in episode shots.
- State changes (door open, light off) are set options driven by `keys` (defaulting off on the base plate), never baked static art or duplicate sets.
- Dynamic display text (`Txt` on screens, clocks, signs): NEVER reuse a large numeric-timer `fontSize` (e.g., `s={66}` for `"00:01"`) for a longer dynamic status label (e.g., `"ĐÃ MỞ KHÓA"`) inside the same panel — derive `fontSize` from the actually rendered string (`renderedText.length <= 6 ? 66 : 30`) so status text never overflows its frame.
- If you change a look, subject, or set after G4 passed, the gate goes STALE: re-render, re-review, re-pass.

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
| Lint PR-03 disembodied `*Head` prop | remove disembodied `WORLD_PROPS` head duplicates; for giant creature close-ups register a `SUBJECTS` entry with `partialOf: '<parentKey>'` (`giantCatHead` / `giantCatPaw`) |
| Lint PR-04 `HAND_PROPS` grip or size | keep grip origin `(0,0)` within `<= 120 px` (`gripDist <= 120`) and max dimension `<= 380 px` |
| Lint PR-06 / PR-08 / PR-09 Hero Subject anatomy or motion | register in `subjects.tsx` with `>= 4` true quadruped/articulated poses (ban bowling-pin `idle` & 4-pipe `startled`), animate across `opts.t`/`opts.phase` (`PR-08`), and choreograph path/pose beats in shots `> 2.2 s` (`PR-09`) |
| Lint LA-01 / LA-03 scale metadata or creature shrinking | declare `actorScale`, `shotScale`, `location` (`LA-01`), plus `scaleWithTinyActor` and `partialOf` (`giantCatPaw` / `giantCatHead`) so giant creatures never shrink in close-ups (`LA-03`) |
| Lint SE-15 / SE-17..19 Location Pack / perspective / silhouettes | build `24–30` sets (`>= 1` `closeup`/`pov` per pack), declare `cameraDir` & shared `landmarks`, use 35–45° 3/4 `angle: 'high'` (`SE-18`), and vary botanical `<path>` silhouettes (`< 9` repeats, `SE-19`) |
| Lint SE-20 / SH-22 / SH-23 scaleMode or state bleed | declare `scaleMode: 'normal' \| 'tiny'` & keep plates `stateless: true` (zero baked cat shadows/tape/glasses/levers, `SE-20`, `SH-22`), and set `firstSeg` / `appearSegs` / `poseSegs` on `SUBJECTS` (`SH-23`) |
