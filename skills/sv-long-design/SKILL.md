---
name: sv-long-design
description: Long 16:9 track Gate G4 widescreen visual design — 8-10+ cast (CH-09, canonical Nhím CH-11), 24-30 Spatial Location Pack plates across 4-6 locations (cameraDir, shared landmarks, 3/4 high-angle SE-18, botanical silhouette variety SE-19, scaleMode normal|tiny and stateless plates SE-20, SE-15..20), living quadruped/hero SUBJECTS (PR-06, PR-08..09, firstSeg/appearSegs/poseSegs, scaleWithTinyActor, partialOf), and user approval. Use ONLY when .episode.json has track "long".
---

# sv-long-design · Long 16:9 Spatial Location Packs & Hero Subjects (G4)

## 1. Track Lock & Shared Craft Base
- **Active only for:** `.episode.json` `"track": "long"` (`16:9`, `1920×1080`). Requires `G1` PASS.
- Inherits house riso-ink tokens, rig API, and set/prop rules from `sv-short-design/references/{tokens,characters,sets,atmospheric-plates,props-overlays}.md`, expanded to full 16:9 widescreen cinema scale.

## 2. Long 16:9 Design Standards (All CI-Checked)
1. **Cast (`src/episode/cast.ts`, `CH-09`):**
   - Minimum **`8` cast members** (recommended `≥ 10`: principals, supports, and populated background extras) with unique silhouettes (`CH-06..08`) and canonical `NHIM_LOOK` (`CH-11`).
2. **Spatial Location Packs (`src/episode/sets.tsx`, `SE-15..SE-20`):**
   - Build **`24–30` widescreen plates** grouped into `4–6` parent `location` packs. Every location pack MUST provide multiple drawn angles (`cameraDir`: `front`, `reverse`, `left`, `right`, `top`, `low`, `detail`) and true drawn `shotScale` (`establishing`, `medium`, `closeup`, `insert`) — never fake close-ups by over-zooming wide plates!
   - **Shared `landmarks`** (`SE-15`): declare consistent room/outdoor anchor IDs across every angle in a location pack.
   - **Perspective & Botany (`SE-18`, `SE-19`):** Use true 3/4 elevated perspective on indoor/outdoor floors and varied organic botanical silhouettes (zero clone-stamped identical shapes).
   - **Scale Mode & Stateless Plates (`SE-20`, `SH-22`):** Explicitly tag every set with `scaleMode: 'normal' | 'tiny'` matching the story unit's scale, declare `zones: { bgY, mgY: [minY, maxY], fgY }` and `actorScale: [minS, maxS]`, and keep every plate `stateless: true` (zero transient plot props/shadows baked into the background). Sets may optionally use `rasterPlate: true` (`atmospheric-plates.md`) with 16:9 widescreen dimensions while keeping all `SE-13`/`SE-15..20` locks and crisp 2D Risograph cast untouched.
3. **Living Hero Subjects (`src/episode/subjects.tsx`, `PR-06`, `PR-08..09`, `SH-23`, `LA-03`):**
   - Register every recurring creature, vehicle, or machine in `SUBJECTS` with `>= 4` genuinely distinct poses (`PR-06`) and continuous `opts.t`/`opts.phase` animation on creatures (`PR-08`, `PR-09`).
   - Add **temporal guards** (`firstSeg`, `appearSegs`, `poseSegs`) so story-gated creatures or transformed states cannot bleed into earlier segments (`SH-23`).
   - Add **`scaleWithTinyActor: [minR, maxR]`** on giant creatures and dedicated **`partialOf`** subjects (`...Paw`, `...Head`) ONLY for `closeup`/`insert` plates (`LA-03`, `PR-10`).
   - Declare `seats` with `straddle: true` and `grip: [gx, gy]` on rideable mounts (`MO-14`).

## 3. Mandatory Execution & User Approval Steps (Gate G4)
1. Init Executor log (`--stage G4`), run `python scripts/sv_cli.py doctor --stage G4 --json`.
2. Run `python scripts/sv_cli.py ci design --json` (`0` errors) and render all sheets via `node scripts/design.mjs`.
3. Close Executor log (`log complete --verdict pass`) and pass `python scripts/sv_cli.py ci log --stage G4 --role executor --json`.
4. Independent Reviewer (`reviewer_id != exec-design`) opens `qa/design/*_v.jpg`, `qa/design/location_*_pack.jpg`, and `qa/design/subject_*_v.jpg`, logs `--action inspect_visual --target <sheet_path>`, and passes `ci log --stage G4 --role reviewer`.
5. Orchestrator opens the design sheets via `read_file` (`hooks/sv_guard.py H6`), gets explicit user approval, writes `gates/G4.review.md` naming every non-exemplar `qa/design/*.png` (`>= 4` words each) + `approval: user` + verbatim `user_quote`, logs `cross_check` + `user_approval`, closes Orchestrator log, and runs `sv_cli.py gate check G4` → `sv_cli.py gate pass G4 --actor <coord_id>`.
