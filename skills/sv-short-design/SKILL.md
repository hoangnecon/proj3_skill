---
name: sv-short-design
description: Short 9:16 track Gate G4 visual design system — mandatory Pre-G4 art_direction.json blueprint (AD-01..AD-08, H3 lock), riso-ink PAL tokens, character turnarounds (cast.ts, canonical Nhím CH-11), connected multi-angle set plates (sets.tsx, geo.ts), anti-cramming plate split, multi-pose Hero Subjects (subjects.tsx, PR-06, PR-08..10), 8-axis Reviewer design scoring (LG-13), and user visual approval. Use ONLY when .episode.json has track "short".
---

# sv-short-design · Short 9:16 Cast, Sets & Hero Subjects (G4)

## 1. Track Lock & References
- **Active only for:** `.episode.json` `"track": "short"` (`9:16`, `1080×1920`). Requires `G1` PASS (`hooks/sv_guard.py H3` blocks design edits before `G1` AND blocks `src/episode/*` or `plates/*` edits until `art_direction.json` passes `ci art-direction`).
- **Craft references:**
  - `references/art-direction.md` (**MANDATORY PRE-G4**: `art_direction.json` blueprint, `AD-01..AD-08`, 4-layer depth architecture, universal horizon/perspective & edge-transition locks, anti-cramming split `<= 5–6` plates/worker, 8-axis `sv_cli.py design score` & `LG-13` hard reject gate)
  - `references/tokens.md` (riso-ink `PAL` tokens, line weights, halftone, glow, Be Vietnam Pro typography — zero raw `#hex` `TK-02`, zero literal `fontFamily` `TK-03`)
  - `references/characters.md` (`cast.ts`, `CAST_ROLES`, silhouettes `CH-06..08`, canonical `NHIM_LOOK` `CH-11`, no hand-drawn characters outside `<Person>` `CH-10`)
  - `references/sets.md` (`sets.tsx`, `geo.ts`, 6-pass set building, `bounds` `SE-11`, `zones.mgY` floor lanes, `actorScale`, `location` packs + sub-scene angles, `stateless` plates)
  - `references/atmospheric-plates.md` (opt-in `SetDef.rasterPlate: true` pre-baked `rough.js + PixiJS v8` atmospheric plates/loops, `KawaseBlurFilter 0.8..1.4` on far layers, untouched 2D Risograph cast lock, strict story-motivated FX restraint, `plates/pack_*.mjs` split)
  - `references/props-overlays.md` (`props.tsx`, `subjects.tsx` `SUBJECTS` registry `PR-06`, `PR-08..10`)

## 2. Design Requirements (Short 9:16)
1. **Pre-G4 Art Direction Lock (`art_direction.json`, `AD-01..AD-06`):**
   - Author `art_direction.json` first (zero `TODO`s, `>= 3` connected sub-scenes per core location, `horizon_and_perspective` & `terrain_and_edge_transitions` locks, `>= 12` `mandatory_objects` for establishing/medium or `>= 8` for closeup/insert, explicit `anti_spoiler_guards`, and all 8 `reviewer_rubric` axes with `min_total >= 82`, `min_dim >= 7`).
   - Run `python scripts/sv_cli.py ci art-direction --json` until exit `0` — `hooks/sv_guard.py H3` unlocks `src/episode/*` and `plates/*` ONLY when `qa/art_direction_lint.json` passes and matches the current disk SHA.
2. **Cast (`src/episode/cast.ts`):**
   - Every principal (`≥ 3` traits) and support (`≥ 2` traits) has a distinct silhouette (`CH-06`, `CH-07`).
   - Add background extra looks whenever scenes take place in populated spaces (classrooms, streets, markets) so rooms never look eerily empty.
   - Use `NHIM_LOOK` from `src/chars.tsx` whenever Nhím appears (`CH-11`).
3. **Connected Multi-Angle Sets (`src/episode/sets.tsx`, `src/episode/geo.ts`, `AD-07..AD-08`):**
   - Match `EPISODE_SETS` 1-to-1 with `art_direction.json` `location_matrix` (`AD-08`), expanding each core location into `>= 3` connected sub-scenes (`establishing`, `medium`, `closeup`/`insert`) sharing consistent `location` + `landmarks`.
   - Declare exact `bounds`, `actorScale`, and `zones: { bgY, mgY: [minY, maxY], fgY }` on every grounded set so `GE-21` and `LA-01` lock floor contact and actor scale accurately.
   - Keep plates stateless (`SE-20`): never bake transient plot states or moving vehicles into static background plates.
   - Optional atmospheric backdrops (`rasterPlate: true`, `references/atmospheric-plates.md`): keep characters 100% crisp 2D Risograph SVG on top, obey single-mode weather FX restraint (`0` or `1` mode), and **MUST split work into `<= 5–6` plates per worker (`plates/pack_*.mjs`) whenever `rasterPlate` count `>= 6`** to prevent rushed copy-paste backdrops (`AD-07`).
4. **Hero Subjects (`src/episode/subjects.tsx`):**
   - Register every recurring vehicle, creature, machine, or hero prop in `SUBJECTS` with `kind`, `relToActor`, `>= 4` distinct `poses` (`PR-06`), living `t`/`phase` animation on creatures (`PR-08`), and explicit `partialOf` ONLY for dedicated `closeup`/`insert` limb plates (never placed alongside full `<Person>` actors in wide shots — `PR-10`).
   - Set `airborne: true` ONLY on inherently flying vehicles/machines; ground-bound vehicles/creatures must sit on the floor lane (`GE-21`).

## 3. Mandatory Execution, 8-Axis Scoring & User Approval Steps (Gate G4)
1. **Init Executor Log, Lock Art Direction & Preflight:**
   ```bash
   python scripts/sv_cli.py log init --role executor --actor exec-design --stage G4 --task "Build Short 9:16 art direction, cast, sets, and subjects" --json
   python scripts/sv_cli.py ci art-direction --json
   python scripts/sv_cli.py doctor --stage G4 --json
   ```
2. **Build Assets, Run Design CI (`0` errors) & Render Design Sheets:**
   ```bash
   python scripts/sv_cli.py ci design --json
   node scripts/design.mjs
   ```
   Close Executor log (`log complete --verdict pass`) and pass `python scripts/sv_cli.py ci log --stage G4 --role executor --json` (verifies `LG-01..LG-13`, including matching `art_direction.json` SHA).
3. **Independent Reviewer 8-Axis Visual Scoring (`LG-13`) & Orchestrator Audit:**
   - Reviewer (`reviewer_id != exec-design`) opens rendered `qa/design/*_v.jpg` sheets via `read_file` (`H6`), logs `--action inspect_visual --target <sheet_path>`, writes a draft score JSON across all 8 axes, and submits:
     ```bash
     python scripts/sv_cli.py design score --input qa/design/scores_draft.json --actor <reviewer_id> --run <rev_run_id> --json
     ```
   - **Hard Reject Gate (`LG-13`):** Every set MUST score `total >= 82` AND every single axis `>= 7` (`verdict: "pass"` in `qa/design/g4_scores.json`). Any lower score rejects Gate G4 (`verdict: "fix"`) until fixed and re-scored. Pass `ci log --stage G4 --role reviewer`.
   - Orchestrator opens the same `qa/design/*_v.jpg` sheets via `read_file` (`hooks/sv_guard.py H6`), presents the cast/set/subject sheets to the user, and waits for explicit approval.
4. **Write `gates/G4.review.md` & Pass Gate G4:**
   Name every `qa/design/*.png` evidence file with `>= 4` words, include `approval: user` + verbatim `user_quote`, close Orchestrator log, and run:
   ```bash
   python scripts/sv_cli.py gate check G4 --json
   python scripts/sv_cli.py gate pass G4 --actor <coord_id> --json
   ```
