# Changelog

## `v5.3.0` — 2026-11-22 · 4-Stage Jump/Airspace Physics (Zero Mid-Air Walking `MO-17`, Zero Flight Occlusion `GE-20`) & Mandatory 3-Tier Hierarchical Contact Sheets (Đại/Trung/Tiểu Đoạn)
- **Pillar 1 — 4-Stage Jump/Takeoff/Landing Physics, Elevated Airspace Sorting & Lint CI (`side.tsx`, `Film.tsx`, `lint.mjs`):**
  - Added 4-stage `jumpPhase` (`0..1`) biomechanics in `PersonSide` (`side.tsx`): Takeoff crouch anticipation (`0..0.14`, feet grounded) → Rising ascent / apex tuck (`0.14..0.52`, stretch + arms driving UP) → Descending landing reach (`0.52..0.86`, legs reaching down) → Grounded landing squash absorb (`0.86..1.0`, feet flat + automatic `<DustPuff>` burst).
  - Upgraded `Film.tsx` to bind `arcH` strictly to the keyed `legs: 'jump'` window (`[w0, w1]`) with an unbreakable mid-air physics lock (`arcY > 4` cannot animate `walk`/`run` feet), and to split airborne `SUBJECTS` (`altitude > 20`) into a ground-plane `GroundShadow` plus an elevated airspace body (`+1200` depth) so flying creatures and straddling riders are never occluded by tabletop/ground `mid` props while still passing beneath overhead `layers.fg` ceiling elements.
  - Added `MO-17` (`lint.mjs shots`, total **140 lint rules**): bans `arcH > 0` stretched across a path `> 1.85 s` without a bounded `legs: [..., ['jump', t0], ['run'|'walk', t1]]` window (`<= 2.2 s`) and auto-queues an 8-frame `jump takeoff/apex/land` strip into `qa/strips_needed.json`.
  - Added `GE-20` (`lint.mjs shots`, total **140 lint rules**): checks Hero Subject / flying creature occlusion (`> 45%` ERROR, `> 25%` WARN + HOT) and auto-queues 8-frame `subject motion/occlusion` strips into `qa/strips_needed.json` for every flying/moving Hero Subject.
- **Pillar 2 — Mandatory 3-Tier Hierarchical Contact Sheets & Zero-Blind-Review Enforcement (`qa.mjs`, `blind_pack.mjs`, `sv_gate.py`):**
  - **Tier 1 — Đại đoạn (`qa/contact_p<N>.jpg`):** renders 4 frames per shot (`12%, 38%, 64%, 88%`) for shots `> 4.0 s` and 2 frames for fast `<= 4.0 s` Short shots.
  - **Tier 2 — Trung đoạn (`qa/contact_segments/seg_<NN>_<loc>.jpg`):** generates per-location / per-scene sequence contact sheets via `qa.mjs segments` and automatically during `qa.mjs pass`.
  - **Tier 3 — Tiểu đoạn (`qa/shots/<NN>.jpg` + `qa/strips/<name>.jpg`):** automatically renders 8-frame `4×2` action filmstrips (`qa/shots/<NN>.jpg`, also via `qa.mjs shotstrips` / `qa.mjs shot <i>`) alongside 8-frame action strips for every dynamic/long/HOT shot during `qa.mjs pass`.
  - Wired `shot_strip` into `qa/blind_review/slice_*.json` (covered by `blind_sha`) in `blind_pack.mjs`, and enforced `"shot_strip"` or `"strips"` in `looked` across both `qa.mjs review --batch` and `sv_gate.py` (zero blind review).
- **Pillar 3 — `v5.3.0` Docs, Skills & Manifest (`sv-02-long-form`, `sv-21-motion`, `sv-22-shots-camera`, `CONVENTIONS.md`, `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json`):**
  - Updated `sv-02-long-form`, `sv-21-motion`, `sv-22-shots-camera`, `CONVENTIONS.md`, `README.md` (with `v4.0 → v5.3` Measured RSI Evolution table), `CHANGELOG.md`, and `.claude-plugin/plugin.json` (`5.3.0`, **140 lint rules**).

## `v5.2.0` — 2026-11-22 · Multi-Waypoint Cinematic Camera (`ShotDef.camKeys`, `CA-08`), Zero-Leak Adaptive Chunk Delivery & Action-to-Foley Planner (`plan_audio.py`)
- **Pillar 1 — Multi-Waypoint Cinematic Camera Engine (`engine.ts`, `Film.tsx`, `entry.tsx`, `geom.mjs`):**
  - Added `ShotDef.camKeys` (`[cx, cy, zoom, at][]`) multi-waypoint camera choreography so rich 5–14 s shots can smoothly track, hold, pan, and push across beats inside one continuous take instead of a single linear `cam → cam2` slide.
  - Exported richer physical action metadata (`arcH`, `pushTarget`, `fx`, `extraEvents`) from `shotTable()` (`entry.tsx`) and evaluated `camKeys` accurately in `Film.tsx` and `geom.mjs`.
- **Pillar 2 — `CA-08` Camera Choreography Guard & Zero-Leak Adaptive Chunk Delivery (`lint.mjs`, `bundle_cache.mjs`, `deliver.mjs`, `sv_doctor.py`):**
  - Added `CA-08` (`lint.mjs shots`, total **138 lint rules**): validates `ShotDef.camKeys` waypoint tuples, strictly ascending timestamps, world bounds & `LA-03` zoom caps, and abrupt pan/zoom velocity jolts.
  - Added automatic stale `$TMPDIR` Remotion temp directory sweep in `bundle_cache.mjs` + `tmp_remotion_mb` monitoring in `sv_doctor.py`, and adaptive tight-disk macro-block chunk sizing in `deliver.mjs` to eliminate `ENOSPC` leaks on 10-minute 16:9 renders.
- **Pillar 3 — Action-to-Foley Audio Planner (`engine/scripts/plan_audio.py`), Benchmark Integration & `v5.2.0` Docs/Manifest:**
  - Added zero-dependency `engine/scripts/plan_audio.py`: reads `qa/shots.json` (plus optional `script.json` & `src/data/cues.json`) in `< 0.1 s` to derive contiguous ambience bed spans (`beds`), synchronized physical foley cues (`footsteps`, `jump_whoosh`, `land_thud`, `effort_scrape`, `impact_hit`, `whoosh_fast`, `tap_press`, `mech_trigger`, `wing_buzz`, `ui_pop`), and `mix.py`-compatible `suggested_accents` into `qa/audio_plan_suggested.json` (with safe opt-in `--write-audio-json` preserving any existing custom accents).
  - Updated `tools/benchmark_suite.py` (`v5.2.0`) to execute `plan_audio.py` in the isolated 16:9 Long-Form sandbox and report `foley_cues=<N>` in the scorecard.
  - Updated `sv-02-long-form`, `sv-22-shots-camera`, `sv-40-audio`, `sv-41-qa-delivery`, `CONVENTIONS.md`, `README.md`, `CHANGELOG.md`, and `.claude-plugin/plugin.json` (`5.2.0`, **138 lint rules**).

## `v5.1.0` — 2026-11-22 · Spatial Location Packs (24–30 Multi-Angle Redrawn Sets, `SE-17`, `location_<loc>_pack.jpg`) & Rich Multi-Action Long-Form Shots (`shots_long_16x9`, `MO-16`)
- **Pillar 1 — Spatial Location Packs (`sets/types.ts`, `plan_assets.py`, `design.mjs`, `lint.mjs`):**
  - Extended `SetDef` with `cameraDir?: 'front' | 'reverse' | 'left' | 'right' | 'top' | 'low' | 'detail'` and `landmarks?: string[]` (shared physical room fixtures drawn consistently across every redrawn camera angle of the same room).
  - Upgraded `SE-15` for `long_16x9`: keeps `>= 15` hard floor (ERROR), warns below `24` drawn sets (target **`24–30` drawn sets** = 5–6 primary locations × 3–5 redrawn camera angles each), and warns if `< 3` primary locations have `>= 3` redrawn angles.
  - Added `SE-17` (Spatial Location-Pack Continuity Guard): validates `cameraDir` enum and `landmarks` array format (ERROR), bans 3+ sets in one location duplicating identical `(angle, shotScale, cameraDir)` (ERROR), and warns when a 3+ set location declares zero overlapping `landmarks`.
  - Upgraded `engine/scripts/plan_assets.py` (`v5.1.0`): plans `24–30` drawn sets grouped into Spatial Location Packs with extracted `shared_landmarks`, `cameraDir`, `~65–110` rich choreographed Long-Form shots, and 4 G4 set workers keeping whole location packs together.
  - Upgraded `engine/scripts/design.mjs`: sorts `qa/design/overview_sets.jpg` by location and auto-tiles per-location multi-angle continuity strips **`qa/design/location_<loc>_pack.jpg`** for every location with `>= 2` rendered sets.
- **Pillar 2 — Rich Multi-Action Long-Form Shots (`standards/pacing.json`, `lint.mjs`, `sv_doctor.py`):**
  - Added `shots_long_16x9` to `standards/pacing.json` (`mean_s: [4.5, 9.5]`, `shots_per_min: [6.0, 14.0]`, `p10_s_min: 1.6`, `max_s: 14.0` → **`~65–110` rich dynamic shots** per 10-minute episode instead of 220 choppy static micro-cuts) while keeping 9:16 Shorts `shots` untouched.
  - Added `MO-16` (Long-Shot Choreography Density Guard on `long_16x9`): flags any shot `> 5.0 s` with `0` choreography events as ERROR (dead static hold), `< 2` events as WARN, and `> 8.5 s` with `< 3` events as WARN, counting motivated `cam2`, set `keys`, multi-waypoint `path`, `arcH`, `mount`, `pushTarget`, `reach`, keyed `p`/`e`/`view`/`face`/`legs`/`arms`, `fx`/`wind`, and animated `extras`.
  - Fixed `SZ-01` talking-actor height floor to be format-aware (`270 px` = 25% of 1080p height on `long_16x9`, keeping `480 px` = 25% of 1920p height on 9:16 Shorts), and added `primary_locations` / `locations_with_3plus_angles` / `location_pack_sheets` telemetry in `sv_doctor.py` (`check_g4`).
- **Pillar 3 — Benchmark Suite Integration, Skill Docs & `v5.1.0` Manifest/Changelog:**
  - Updated `tools/benchmark_suite.py` (`v5.1.0`) to extract `locations_with_3plus_angles` / `location_packs` from `plan_assets.py` blueprints and display `locs3+` in the dual-format scorecard.
  - Updated `sv-02-long-form`, `sv-20-design-system`, `sv-21-motion`, `sv-22-shots-camera`, `CONVENTIONS.md`, `README.md`, `CHANGELOG.md`, and `.claude-plugin/plugin.json` (`5.1.0`, **137 lint rules**).

## `v5.0.0` — 2026-11-22 · Studio 2D Animation Physics (`src/anim.ts`), 3-Layer Straddle Mounting, Contact-Locked Effort, Living Action FX, Animation Craft CI (`MO-13..15`) & "Pasted-Sticker Test" Blind Review
- **Pillar 1 — Studio 2D Animation Physics & Biomechanics Toolkit (`engine/src/anim.ts`, `engine.ts`, `subjects.ts`):**
  - Added pure-TS `src/anim.ts` providing 12-principles easing (`springSettle`, `anticipateEase`, `parabolicArc`), 4-phase foot-roll gait biomechanics (`footCycle` with `walk` 60% stance vs `run` 38% airborne flight phase + `gaitHipBob` delayed head counter-nod), organic tapered articulated limbs (`taperSegPath`, `TaperLimb` with merged silhouette outline, sleeve cuffs & joint creases), curved C-arc torso builder (`curvedTorsoPath`), secondary hair/cloth wind helper (`hairWindOffset`), grounding shadows (`GroundShadow`, `SeatShadow`), and procedural riso action FX (`DustPuff`, `SweatDrops`, `SpeedLines`, `ImpactBurst`, `DizzyStars`).
  - Extended `Actor` (`arcH`, `wind`, `pushTarget`, `fx`, `shadow`), `ExtraDef` (`altitude`, `shadow`), and `SubjectSeat` (`straddle`, `grip`, `wind`).
- **Pillar 2 — 4-View Rig Upgrades & 3-Layer Straddle Mount Composition (`chars.tsx`, `side.tsx`, `threeq.tsx`, `back.tsx`, `Film.tsx`):**
  - Upgraded character rigs with tapered articulated limbs, curved spine silhouettes, 4-phase foot-roll cycles, secondary hair wind drag, and `layer="far" | "near"` split rendering.
  - Upgraded `Film.tsx` with automatic altitude-responsive `GroundShadow`s, parabolic `arcH` jump arcs, contact-locked `pushTarget` IK, procedural `ActionFx` rendering, and 3-layer straddle mount sandwich (`layer="far"` behind creature → creature + `SeatShadow` → `layer="near"` hugging flank with hands IK-locked onto `SubjectSeat.grip`).
- **Pillar 3 — Animation Craft CI (`MO-13`, `MO-14`, `MO-15`) & "Pasted-Sticker Test" Blind Review (`engine/scripts/lint.mjs`, `engine/scripts/blind_pack.mjs`):**
  - `MO-13` (No Air-Pushing / Contact-Lock Guard): validates `pushTarget: [tx, ty]` format & real arm reach (`> 380 * H * s` ERROR, `> 280 * H * s * 1.15` WARN + HOT), and flags `long_16x9` `push` poses/legs lacking `pushTarget` or `reach` (WARN + HOT).
  - `MO-14` (Straddle Mount & Rider Cohesion Guard): validates every `Actor.mount` resolves to a valid `SubjectSeat` (ERROR), flags `>= 2` riders on a creature lacking `straddle: true` / `grip` (WARN + HOT), and rejects contradictory rider facing directions on the same creature (ERROR).
  - `MO-15` (Living Motion & Secondary Action Guard): validates `Actor.fx` keys against `dust | sweat | speed | impact | stars` (ERROR), warns on weightless `fall`/`trip` with zero `fx` and zero `shake` (WARN), and warns on `fly`/`hover` extras missing `altitude` (WARN).
  - Updated `MO-08` `lives` detection to recognize `arcH`, `mount`, `pushTarget`, `fx`, and `wind`, and excluded `anim.tsx` in `CH-10`.
  - `blind_pack.mjs`: added explicit **Pasted-Sticker Anti-Pattern Check** under `acting` and `contact` in both 16:9 (10-check) and 9:16 (8-check) `RUBRIC.md` templates.
- **Pillar 4 — Deep Studio 2D Animation Skills Rewrite & `v5.0.0` Docs:**
  - Rewrote `skills/sv-21-motion/SKILL.md` with full Studio 2D Animation Craft (`v5.0`) guide, DO vs DON'T table (`MO-13..15`), and expanded strip/defect checklists.
  - Updated `sv-20-design-system`, `sv-22-shots-camera`, `sv-02-long-form`, `CONVENTIONS.md`, `README.md`, and `.claude-plugin/plugin.json` (`5.0.0`); `validate_skills.py` reports **11 skills, 135 lint rules implemented, 0 errors, 0 warnings**.

## `v4.5.0` — 2026-11-22 · Deterministic G2→G4 Asset Blueprint (`plan_assets.py`), Glanceable Set Overview (`overview_sets.jpg`), Fast Long-Form QA Probes & Benchmark Suite v4.5 (`tools/benchmark_suite.py`)
- **Pillar 1 — G2→G4 Asset Blueprint Planner, Set Overview Contact Sheet & Fast Long-Form Probes (`plan_assets.py`, `design.mjs`, `qa.mjs`):**
  - `engine/scripts/plan_assets.py`: zero-dependency deterministic G2→G4 blueprint and parallel worker planner reading `script.json`, `brief.md`, and `beats.md` in `< 0.5 s` to emit `qa/asset_blueprint.json` + `qa/asset_blueprint.md` (planned cast roster, recurring multi-pose Hero Subjects with `+seats` flags, multi-angle/sub-scene `sets_matrix`, and conflict-free G4/G5 worker splits).
  - `engine/scripts/design.mjs`: automatically tiles all episode sets into a single glanceable G4 overview contact sheet (`qa/design/overview_sets.jpg`, `.jpg` to keep `sv_gate.py` `.png` evidence checks clean).
  - `engine/scripts/qa.mjs`: adapts per-shot carry probe density on heavy `16:9` episodes (`>= 80` shots: `4–8` probes @ `0.45 s` vs `6–16` @ `0.2 s`), keeping browser QA time well inside the 45-minute Long-Form SLA while preserving full HOT-shot crops.
- **Pillar 2 — Final Pinnacle Integration & Benchmark Suite v4.5 (`tools/benchmark_suite.py`, Skills & Docs):**
  - `tools/benchmark_suite.py`: integrates `scripts/plan_assets.py` checks (elapsed ms, required subject count, planned sub-scene count) across isolated 9:16 Short and 16:9 Long-Form sandboxes plus optional `--long-script [<dir>]` full-script blueprint benchmark and `--bench-render [N]` timed Remotion render hook.
  - Updated `sv-00-pipeline`, `sv-02-long-form`, `sv-20-design-system`, `CONVENTIONS.md`, `README.md` (with verified `v4.0 → v4.5` Measured RSI Evolution summary table), `CHANGELOG.md`, and `.claude-plugin/plugin.json` (`4.5.0`).

## `v4.4.0` — 2026-11-22 · Studio Atmospheric Mood & Depth (`ShotDef.mood`/`dof`), Static Riso Grain (`url(#grainPat)`), Macro-Block Delivery, `SH-19` Mood Lint & Unified Dual-Format Benchmark Suite (`tools/benchmark_suite.py`)
- **Pillar 1 — Studio Lighting, Depth Separation, Static Riso Grain & Macro-Block Render (`kit.tsx`, `engine.ts`, `Film.tsx`, `Sheets.tsx`, `deliver.mjs`):**
  - `engine.ts` & `Film.tsx`: added `ShotDef.mood` (`'default' | 'morning' | 'golden' | 'danger' | 'lab' | 'flashback' | 'dramatic'`) PAL-token atmospheric lighting grade overlay and `ShotDef.dof` subtle depth-separation haze between far (`d = 0.5`) and midground (`d = 1`) layers.
  - `kit.tsx` & `Film.tsx`: replaced per-frame SVG `<feTurbulence>` filter overhead with deterministic static riso paper grain `<pattern id="grainPat">` (`url(#grainPat)`).
  - `deliver.mjs`: upgraded chunked delivery to shot-aligned macro-blocks (`SV_CHUNK_FRAMES`, default `1050` frames ≈ 35 s, `SV_X264_PRESET=veryfast`, JPEG q=95 frame intermediates) to cut FFmpeg startup overhead on 10-minute 16:9 renders.
- **Pillar 2 — `SH-19` Mood Lint, Unified Dual-Format Benchmark CLI & `v4.4.0` Docs (`lint.mjs`, `tools/benchmark_suite.py`, Skills & Docs):**
  - `SH-19` (`lint.mjs shots` ERROR/WARN, warning waivable via `lint-ok: SH-19`): validates `ShotDef.mood` against `default|morning|golden|danger|lab|flashback|dramatic` (ERROR on unknown mood) and warns when `mood: 'danger'` is combined with `night > 0.7` (double dark overlay crushing visibility).
  - `tools/benchmark_suite.py`: read-only automated dual-format regression & speed benchmark CLI running `tools/validate_skills.py`, `node --check` + `py_compile` across `engine/scripts/`, isolated-sandbox 9:16 Short (`lint.mjs all`, `qa.mjs layout`, `voice.py --preflight`, `sv_doctor.py --stage all`) and 16:9 Long-Form (`lint.mjs shots`, `qa.mjs layout`, `qa.mjs place`, `sv_doctor.py --stage G5`) checks, plus optional `--render-frames N` and `--json` output.
  - Updated `sv-22-shots-camera`, `sv-02-long-form`, `CONVENTIONS.md`, `README.md`, and `.claude-plugin/plugin.json` (`4.4.0`); `validate_skills.py` reports **11 skills, 132 lint rules implemented, 0 errors, 0 warnings**.

## `v4.3.0` — 2026-11-22 · Dual-Standard 15-Min Short / 45-Min Long-Form SLA, Perceptual Plate Quality CI (`SE-16`), Camera Grammar CI (`CA-06..07`), Placement Solver (`qa.mjs place`) & Preflight Doctor (`sv_doctor.py`)
- **Pillar 1 — Perceptual Plate Quality, Preflight Doctor & Voice Sanity (`plate_check.py`, `sv_doctor.py`, `voice.py`):**
  - `plate_check.py`: measures perceptual 3×3 clutter peak (`clutter_max_3x3`), luminance contrast std (`contrast_std`), and left/right visual weight delta (`lr_balance_delta`) into `qa/design/plate_stats.json`.
  - `sv_doctor.py`: zero-cost stage preflight doctor (`python3 scripts/sv_doctor.py --stage G#`) catching missing files, broken config, and stale inputs before launching GPU or browser passes.
  - `voice.py`: adds `--preflight` zero-GPU text/tag/sentence sanity check before running VieNeu-TTS.
- **Pillar 2 — Zero-Rework Placement Solver, Enriched Blind Review & Single-Browser Chunk Delivery (`qa.mjs`, `blind_pack.mjs`, `deliver.mjs`):**
  - `qa.mjs place <setId>`: zero-browser coordinate & scale solver outputting `LA-01`/`LA-02`/caption-safe actor/prop floor slots before blocking `shotlist.ts`.
  - `blind_pack.mjs`: enriches `qa/blind_review/slice_*.json` with layout occupancy, scale/cutoff flags, and `shotScale` metadata for high-signal blind review.
  - `deliver.mjs`: faster cached chunked single-browser rendering for 10-minute 16:9 delivery within the 45-minute SLA.
- **Pillar 3 — Camera Grammar CI, Perceptual Plate Gate, Gate Integration & Dual-Standard SLA Docs (`lint.mjs`, `sv_gate.py`, Skills & Docs):**
  - `SE-16` (`lint.mjs design` ERROR/WARN, waivable via `lint-ok: SE-16`): enforces perceptual visual quality from `qa/design/plate_stats.json` (`clutter_max_3x3 > 22.0` ERROR / `> 16.5` WARN; `contrast_std < 18.0` ERROR / `< 22.0` WARN; `lr_balance_delta > 9.5` WARN), gracefully no-oping on legacy `plate_stats.json` files without `v4.3` fields.
  - `CA-06` (`lint.mjs shots` WARN + HOT, waivable via `lint-ok: CA-06`): 180-degree axis / eyeline continuity guard flagging consecutive same-location/same-set cuts where the exact same 2 on-screen non-`fg`/non-mounted dialogue actors swap horizontal screen order without a neutral `wide`/`high`/`ots`/establishing bridge shot.
  - `CA-07` (`lint.mjs shots` ERROR/WARN, waivable via `lint-ok: CA-07`): `long_16x9` shot-size progression & variety guard banning `> 65%` `establishing` set monotony (ERROR) and warning when `closeup + insert` share is `< 10%`.
  - `sv_gate.py`: integrates `scripts/sv_doctor.py --stage <G>` guidance in docstring & `status --brief` `next:` output, and double-verifies `qa/layout_report.json` has `overcrowded == 0` and `scale_errors == 0` in `checks("G5")`.
  - Updated `sv-00-pipeline` (Dual-Standard 15-min Short / 45-min Long-Form SLA table + `sv_doctor.py` workflow), `sv-02-long-form`, `sv-12-voice` (`voice.py --preflight`), `sv-22-shots-camera` (`qa.mjs place`, `CA-06`, `CA-07`, enriched `blind_pack.mjs`), `CONVENTIONS.md`, `README.md`, and `.claude-plugin/plugin.json` (`4.3.0`).

## `v4.2.0` — 2026-11-22 · Articulated Character Physics, Multi-Pose Hero Subjects, Botanical Kit & Mandatory Scale / 3×3 Layout / Anti-Fake-Zoom CI
- **Pillar A — Articulated 4-View Character Physics (`chars.tsx`, `side.tsx`, `back.tsx`, `threeq.tsx`):**
  - Added full articulated knee/elbow joint bending across all 4 views (`front`, `side`, `back`, `3q`) and expanded dynamic `legs`/`arms` action modes (`run`, `crouch`, `jump`, `fall`, `push`, `climb`, `cheer`).
- **Pillar B — Multi-Pose Hero Subjects, Botanical Kit & Drawn Sub-Scene Contract (`subjects.ts`, `episode/subjects.tsx`, `kit.tsx`, `engine.ts`, `sets/types.ts`):**
  - Added `SUBJECTS` registry (`SubjectDef` with `kind`, `relToActor`, `≥ 4` distinct `poses`, optional `exprs`, and `seats` mount anchors) + `Actor.mount` (`{target, slot}`) and `ExtraDef` animated `path`/`pose`/`expr`/`flip`/`tilt`/`z`/`fg`.
  - Added riso-ink Botanical Kit primitives (`Leaf`, `GrassTuft`, `GrassStrip`, `LeafCluster`, `Bush`, `TreeCanopy`, `Vine`) in `kit.tsx`.
  - Extended `SetDef` with `location`, `shotScale` (`establishing|medium|closeup|insert`), `actorScale` (`[minS, maxS]`), and `zones`.
- **Pillar C — Film, SubjectSheet, Design & Delivery Integration (`Film.tsx`, `Sheets.tsx`, `Root.tsx`, `entry.tsx`, `design.mjs`, `deliver.mjs`):**
  - Added live `SUBJECTS` rendering, animated extra paths, `Actor.mount` seat transforms with z-aware depth sorting in `Film.tsx`, `SubjectSheet` (`qa/design/subject_<id>.png`) + set-plate actor scale silhouettes in `Sheets.tsx`/`design.mjs`, and `SUBJECTS` export in `entry.tsx`.
- **Pillar D — Mandatory Scale, 3×3 Layout Grid, Z-Aware Occlusion, Anti-Fake-Zoom & Multi-Pose Subject CI (`geom.mjs`, `lint.mjs`, `qa.mjs`, `sv_gate.py`, Skills & Docs):**
  - `geom.mjs`: exported `measureSubjectBox` & `extraPos`; upgraded `shotGeometry` to resolve `SUBJECTS` + `WORLD_PROPS`, live `Actor.mount` coordinates & `depthY`, 3×3 spatial grid (`A1..C3`) + `24×16` union occupancy (`gridLayout`), actor/subject scale checks (`scaleIssues`), and hero creature frame-edge cut-offs (`creatureCutoffIssues`).
  - `PR-06` (`lint.mjs design` ERROR): validates every `SUBJECT` has `title`, `relToActor`, and `≥ 4` poses (`≥ 3` visually distinct SVG outputs).
  - `LA-01` (`lint.mjs design` & `shots` ERROR): enforces `actorScale`/`shotScale`/`location` on non-insert `long_16x9` sets, and verifies on-screen actor `s` vs `set.actorScale` and `SUBJECT` height vs `relToActor`.
  - `LA-02` (`lint.mjs shots` ERROR/WARN + HOT): enforces 3×3 spatial grid clutter budget (`≥ 4` clusters/cell or `> 78%` occupancy ERROR; `≥ 3` clusters or `> 65%` WARN), grouping `Actor.mount` riders with their mount as one cluster.
  - `LA-03` (`lint.mjs shots` ERROR): bans fake close-up camera zooms (`cam[2] > 1.35` or `cam2[2] > 1.45`) on `establishing`/`wide` sets; enhanced `SE-15` to require drawn `medium`/`closeup` sub-scenes (`≥ 3` locations with `≥ 2` drawn `shotScale` types).
  - `LA-04` (`lint.mjs shots` ERROR + HOT) & z-aware `GE-17`: fixes `GE-17` to compare `depthY` (`y + z`) and skip mounted riders; bans non-`fg` hero creatures awkwardly sliced `35%..95%` off frame edges.
  - `SH-18` (`lint.mjs shots` ERROR): requires recurring hero creatures/bosses/vehicles to be registered in `SUBJECTS` with `≥ 4` poses and varied across shots.
  - `qa.mjs`: added `node scripts/qa.mjs layout [i]` (zero-browser 1-line-per-shot table & detailed 3×3 breakdown) and upgraded `qa.mjs where <i>` with 3×3 Grid Occupancy Matrix, `LA-01` scale issues, and `LA-04` creature cutoff; `lint.mjs shots` writes `qa/layout_report.json`.
  - `sv_gate.py`: tracks `src/episode/subjects.tsx` and `src/subjects.ts` in G4 inputs and verifies `qa/design/subject_<id>.png` exists for every subject in `visual_spec.json`.

## `v4.1.0` — 2026-11-22 · Cinematic 16:9 Long-Form RSI: 4-View Rigs, True 16:9 QA, Anti-Slop/Severed-Limb CI & G2 Story Doctor (`docs/rsi-forensics-v4.0-2026-11-22.md`)
- **Pillar 1 — Fixed 16:9 QA/Tile/Crop Corruption (`tile.py`, `crops.py`, `qa.mjs`, `design.mjs`, `deliver.mjs`, `blind_pack.mjs`):**
  - Fixed `tile.py` hardcoded `9:16` cell height (`h = int(w * 1920 / 1080)`) → dynamic aspect ratio from actual image dimensions + `4×3` wide grids for `16:9` contact sheets, strips, and `final_check.jpg`.
  - Fixed `crops.py` hardcoded `1080×1920` crop clamping → dynamic `[W, H]` frame space so `16:9` HOT crops capture exact right/left pixels.
  - Fixed `design.mjs` `visual_spec.json` fallback `plateCam` for `16:9`.
  - Upgraded `blind_pack.mjs` & `qa.mjs review --batch` to **10 checks** on `long_16x9` (`+ framing` for severed/floating limbs & depth, `+ variety` for static-wall/prop fatigue) with `set_streak` & `prev_set` metadata.
- **Pillar 2 — Cinematic 4-View 2D Engine (`back.tsx`, `threeq.tsx`, `engine.ts`, `Film.tsx`, `sets/types.ts`, `Sheets.tsx`):**
  - Added full riso-ink **`PersonBack` (`view: 'back'`)** and **`Person3Q` (`view: '3q'`)** character rigs matching exact `Person` proportions (`0` raw hex colors, `324/324` SVG smoke renders clean).
  - Added foreground Over-The-Shoulder (`Actor.fg: true`) depth plane (`d = 1.2`), subtle Dutch camera roll (`ShotDef.tilt`), `SetDef.angle` (`wide|low|high|ots|reverse|closeup|pov`), and **Front + 3/4 + Back** turnarounds on `CastSheet`.
- **Pillar 3 — Anti-Slop, Anti-Repetition & Severed-Limb CI (`geom.mjs`, `lint.mjs`):**
  - `SE-15`: requires **`>= 15` distinct sets / angle plates** and **`>= 3` (target `>= 4`) distinct camera angle types** for `long_16x9` (WARN `< 4` sets for Shorts).
  - `CH-09`: format-aware cast richness — requires **`>= 8` (target `>= 10`) cast looks** for `long_16x9` (removes Short `> 4` principal warning on Long-Form).
  - `PR-05` & `GE-19` (**ERROR + HOT**): bans severed/floating giant body-part props (`Shoe|Foot|Leg|Hand|Arm|Paw|Finger`) whose top/side cut terminates inside the visible frame (`sy0 > 24 && sx0 > 24 && sx1 < W - 24`).
  - `SH-16`: bans unbroken same-set streaks `> 10` shots (WARN `> 7`) and single-set dominance `> 18%` (WARN `> 14%`) on `long_16x9`.
  - `SH-17`: enforces cinematic view diversity (`front <= 70%`, `back + 3q >= 15%`) and flags static `WORLD_PROP` copy-paste reuse `> 15` shots without variant diversity.
- **Pillar 4 — Long-Form Narrative Depth & G2 Adversarial Story Doctor (`script_lint.py`, `sv_gate.py`, `skills/sv-02-long-form/references/story-doctor-prompt.md`):**
  - `SC-29` (`long_16x9` ERROR): validates all 5 structured chapters (`Goal / Obstacle / Turn / Mini-Cliffhanger`) with balanced `10%–34%` segment spans.
  - `SC-30` (`long_16x9` ERROR): requires `>= 3` distinct `Plant` (`<= 55%`) → `Payoff` (`>= 60%`) knots.
  - `SC-31` (`long_16x9` ERROR/WARN): requires `>= 12` causal Spine links and warns on `> 15`-segment plot gaps.
  - `sv_gate.py`: enforces mandatory **G2 Adversarial Story Doctor** audit (`qa/story_doctor.json`, `score >= 80`, `verdict: "pass"`, `0` meandering stretches) and **10-check Blind Review** at G5 for `long_16x9`.

## `v4.0.0` — 2026-11-21 · 16:9 long-form skill (sv-02-long-form), native 1920×1080 engine & Drive-verified content ideation RSI
- **New Dedicated Long-Form Skill (`skills/sv-02-long-form/SKILL.md` + `references/ideation-system-prompt.md`):**
  - Complete standard for 10-minute (`8–12 min`, `2,200–3,600` words, `75–160` segments) 16:9 widescreen (`1920×1080`) animated story episodes reusing the exact same G1–G7 gates, `visual_spec.json`, `bundle_cache.mjs`, `deliver.mjs` per-shot chunk cache (`out/_chunks/`), `blind_pack.mjs` + `blind_sha`, and lean swarm orchestration.
  - Reusable **4-Agent Pitch → Cross-Critique → Blind Judge** System Prompt with 100-point blind scorecard, 5-chapter 10-minute pacing architecture, Inductive Hook (`0:00–0:25`), and open/series-capable ending guidelines.
- **Native 16:9 Widescreen Engine + 10-Min Budget (`standards/pacing.json`, `engine/src/format.ts`, `Root.tsx`, `Film.tsx`, `Sheets.tsx`, `geom.mjs`, `lint.mjs`, `qa.mjs`, `deliver.mjs`, `script_lint.py`, `sv_gate.py`):**
  - Opt-in `"format": "16:9"` and `"length": "long_16x9"` in `script.json` (`episode_long_16x9` in `standards/pacing.json`), 100% backward-compatible with `9:16` Shorts (`1080×1920`).
  - Dynamic `FRAME_W`/`FRAME_H`/`CAPTION_BAND` across Remotion compositions, `SetPlate` grids, geometry/lint checks (`CA-05`, `GE-*`, `OV-03`, `SZ-*`), `deliver.mjs` chunk cache key (`${W}x${H}`), and `sv_gate.py` G2/G3/G7 checks.
- **Short & Long Content DNA RSI from 23 Published Drive Hits (`skills/sv-01-series-bible`, `skills/sv-10-script`, `references/premise-ideation.md`, `sv-00-pipeline`, `README.md`):**
  - Codified the winning patterns across the 23 published `SCRIPT_YOUTUBE` episodes (*Bốn nghìn đôi cánh*, *Huy hiệu không bao giờ sai*, *Luôn với tới cậu*, *Chiếc bóng đen nhất*, *Điểm hồi sinh*, *Nhãn mặt cười*, *Trước khi trời sáng*, *Thị trấn trên đĩa*, *Người trực tàu*, *Nói gì thành nấy*, *Vảy ngọc rồng*): kids/school-age appeal, World-Sorting / Power-Tier contrasts (Group A vs B vs C), Survival/Impostor/Chase stakes, Relatable Relational Cores (best friends, family, siblings, grandparent), `s1–s2` Inductive Hook, zero-math clarity, and recurring hero **Nhím**.

## `v3.9.1` — 2026-11-21 · Default H.264 CRF 21 in `deliver.mjs` (~100–140 MB per 2m30s episode)

## `v3.9.0` — 2026-11-21 · Stage-1 visual_spec, PR-03/04, GE-16..18, MO-12, hash/cache & anti-bypass blind review (docs/rsi-loop-v3.9-2026-11-21.md)
- **Stage-1 Front-Loaded Visual Manifest & Design CI (`engine/scripts/design.mjs`, `engine/scripts/geom.mjs`, `engine/scripts/lint.mjs`):**
  - Auto-writes `qa/design/visual_spec.json` measuring cast, sets (`bounds`, `plateCam`), `WORLD_PROPS`, and `HAND_PROPS` (`gripDist`).
  - `PR-03` (ERROR): bans disembodied `*Head` creature props when a full-body prop with the same prefix exists.
  - `PR-04` (ERROR): verifies `HAND_PROPS` grip origin `(0, 0)` within `120 px` of prop bbox and max dim `<= 380 px`.
  - Fixed `design.mjs` `shared` hash to exclude `src/data/` so parallel `voice.py` runs never falsely invalidate G4 sheets.
- **Pre-Render Spatial, Occlusion & Continuity CI (`engine/scripts/geom.mjs`, `engine/scripts/lint.mjs`):**
  - `GE-16`: active overlay (`bubble`/`label`/`stamp`/`tag`) overlapping an on-screen actor's head (`> 20%` WARN+HOT, `> 55%` ERROR) OR overlapping a set sign (`> 15%` WARN+HOT).
  - `GE-17`: foreground `WORLD_PROP` covering `> 35%` of an on-screen actor's head (WARN+HOT).
  - `GE-18`: consecutive wide-shot cast continuity drop in the same set (WARN).
  - `MO-12`: floating `seatH > 40` on outdoor/street/rain sets without furniture prop or `seatH > 180` (WARN).
  - `validate_skills.py`: **`10 skills, 114 lint rules implemented, 0 errors, 0 warnings`**.
- **Hash & Cache Layer (`engine/scripts/bundle_cache.mjs`, `deliver.mjs`, `qa.mjs`, `voice.py`):**
  - `bundle_cache.mjs`: content-addressed Webpack bundle cache (`qa/.bundle_cache/<srcHash>/`, `< 0.1 s` cache hit, prunes to latest 2).
  - `deliver.mjs`: per-shot content-addressed chunk cache (`out/_chunks/<chunkKey>.mp4` + `ffmpeg concat -c:v copy`) and `concurrency = max(4, min(10, cpus - 2))` with `CRF 18, 1080×1920 @ 30fps, 48kHz AAC 256k` unchanged.
  - `voice.py`: auto-skips unchanged passing sentences by `sp_hash` on re-runs.
- **Anti-Bypass Blind Review & Lean Swarm (`engine/scripts/blind_pack.mjs`, `qa.mjs`, `sv_gate.py`, `skills/sv-00-pipeline`):**
  - `blind_pack.mjs` builds `qa/blind_review/{manifest.json, slice_1..3.json, RUBRIC.md}` grouped by contact page + HOT crops (`-70%` vision tokens, zero `shotlist.ts` code) with cryptographic `blind_sha` enforced by `qa.mjs review --batch` and `sv_gate.py check G5`.
- **Verified Live End-to-End Benchmarks (`Hydrogen Medium`, 0 bypass, full quality):**
  - First-pass blind-review OK rate jumped **`68.7%` (`v3.8.0`) → `90.0%` (Loop 1) → `96.7%` (`58/60`, Loop 2)**.
  - Full cold `G1 → out/final.mp4` wall time dropped **`86m 36s` (+`52m` V2) → `45m 24s`** (`bench-v39-loop2`, `141.43 s`, `60` shots, `0` lint err/warn, `4/4` video-audio ok).

## `v3.8.0` — 2026-11-20 · human-scale PropSheet, geometry/motion lint & single-bundle QA (docs/rsi-loop-2026-11-20.md)
- **RSI Evaluation & Forensic Benchmarks (`tools/rsi_eval.py`, `tools/trace_agy.py`):**
  - Generalized `trace_agy.py` (`--main`, `--prefix`, `--ids`, `--gates-log`) across the 23-worker `hh-*` + `hh2-*` run (`606.1m` wall / `328.3m` active, `128.13M` tokens, `894` media reads, `219` review writes).
  - Reproducible `rsi_eval.py` benchmark improved across 2 RSI cycles (Iter 0 `v3.7.0` -> Iter 1 -> Iter 2):
    - Historical Defect Catch (`D01..D10`): **1/10 (10%) -> 10/10 (100%)**.
    - Clean-episode FP: `sieu-nang-luc` **0 errors, 0 warnings** (`hot=8` unchanged); `huy-hieu` v2 **0 errors, 36 warnings** (`GE-10: 24`, `GE-11: 12`, down from `65` in Iter 1) and **`hot=16`** (down from `40` in Iter 1, `-60%` HOT bloat).
    - 3-shot fix QA cycle (`#28, #35, #43`): **`57.95s` (Iter 0) / `51.69s` (Iter 2 legacy) -> `29.15s` (`qa.mjs pass changed`)** (`-43.6%` vs legacy, `-49.7%` vs Iter 0).
    - Live cold-start stress test (`8` dense multi-vehicle shots): first-pass independent OK jumped **3× (`1/8` -> `3/8`)**, with `0` human-scale vehicle/door bugs and `0` standing-shoe caption false rejections.
- **Human-Scale PropSheet (`engine/src/design/Sheets.tsx`, `engine/src/Root.tsx`, `engine/scripts/design.mjs`):**
  - Renders every custom `WORLD_PROP` at `y = 0` beside `575 px` adult and `435 px` child scale silhouettes on a `100 px` grid with `W × H px · y=[minY..maxY]` labels (`qa/design/props_episode_p*.png` + `_v.jpg`; supports `--only props`).
- **Design, Geometry & Motion Lint Guards (`engine/scripts/geom.mjs`, `engine/scripts/lint.mjs`, `CONVENTIONS.md`):**
  - `PR-01`: Human-scale height guard for vehicles (`>= 480 px`), carts/karts/cars (`>= 180 px`), and floor-origin alignment (`|maxY| <= 60` on ground props).
  - `PR-02`: Prop internal text collision guard (opaque wheel/circle painted over `<text>`).
  - `SE-14`: Set `plateCam` diegetic sign edge-clipping guard.
  - `GE-10`, `GE-11`, `GE-15`: Shared `geom.mjs` world->screen geometry (`shotGeometry`) catching set & `WORLD_PROP` sign edge-clipping (`>= 45%` in-frame, `len >= 6`, `screenFontSize >= 17`), actor/overlay/prop occlusion over readable signs, and foreground `WORLD_PROP` frame-edge clipping.
  - `MO-10`, `MO-11`: Locked-`face` `path` x-reversal turnaround-squash guard (`ERROR`) and `side`-view reach-behind-facing / `arms:'raise'` walking guards (`WARN`).
- **Single-Bundle QA & Batch Review (`engine/scripts/qa.mjs`, `skills/**`):**
  - `qa.mjs where <i> [t] [--free WxH]`: zero-browser `1080×1920` layout & occlusion pre-flight table.
  - `qa.mjs pass [changed|all]`: single Remotion `bundle()` + `openBrowser()` running `contact -> strips -> cards -> crops -> carry.py`.
  - `qa.mjs review --batch <file.jsonl>`: strict schema-validated atomic batch review writer (`~4.4m` for 8 shots).
  - Auto-Python `.venv` resolution in `design.mjs`, `qa.mjs`, `deliver.mjs`; `deps.mjs` excludes `src/design/` from `engineHash` (`0/66` false stales on `Sheets.tsx` edits).
  - Updated `sv-00`, `sv-12` (`between_words_db <= -51.5 dB` G3 target), `sv-20` (Human-Scale table + `PropSheet`), `sv-21` (`MO-10..11`, vehicle/bed staging), and `sv-22` (Pre-Flight Zero-Bounce gate + standing-shoe caption clarification).

## `v3.7.0` — 2026-11-19 · dependency-scoped review carry + character-model guard (docs/perf-plan-2026-11-19.md)
- **Dependency-scoped shot hash (`deps.mjs`):** each shot's hash covers only what it draws (its set helpers, looks, props, reach coordinates, words). This closes v3.6 holes where a `sets.tsx` helper edit or a reach change never staled a shot. `test_deps.mjs` (in `engine/scripts/`, run inside a copy of an episode) injects changes and fails on any miss.
- **Review carry (`carry.py`):** a review is kept when the shot's picture did not change (card frames + probes every ~0.2 s) or it was only retimed; G5 re-verifies every carry. Measured: a prop edit leaves 10 of 66 shots to review instead of 66; a voice remake 5–17 instead of 57–66.
- **`qa.mjs adopt`:** move an episode reviewed under v3.6 to v3.7 without re-reviewing. The contact sheet marks ● the shots with no current review. `tile.py` / `design.mjs` keep the old file time when a re-render is the same picture; SE-13 uses the plate measure time.
- **Gates:** G3 measures `between_words_db` through the mix voice chain; gate dependency graph, 60 s pass cooldown, `watch --stall`; `tools/doctor.sh`; SC-28 is a NOTE only.
- **CH-10 — no character drawn by hand outside `<Person>`** (lint design): v3.6 dropped the per-shot "same look as the design sheets?" question, and three v3.6 episodes drew characters as props (a fading Bình with its own head, riders, a long arm). Any episode `.tsx` declaration that draws a head (skin + hair shapes) or a face with a body is an error. Effects are `<Person>` with opacity / clipPath / pose or a look variant. Only an animal, a food-bodied citizen or a printed photo may be waived (`// lint-ok: CH-10 <reason>`), and G4 then requires a `G4.review.md` line naming it and saying it was compared with the cast sheet. Checked on 11 episodes: 0 hits on the 8 made before v3.6; all 3 v3.6 episodes caught.
- **8th review check `model`:** every character is drawn by the cast rig and matches `qa/design/cast_episode_p*_v.jpg`. A review without it is listed by G5 with what to add (light migration, no re-render).
- `tools/trace_agy.py` measures where an agy run spent its time and tokens.
- **Not done yet:** a check against copying a line verbatim from the source translation.

## `v3.6.1` — 2026-11-18 · opt-in long episode (SC-27)
- **SC-27:** `script.json` `"length": "long"` switches the length budget to `episode_long` in `standards/pacing.json` (170–240 s voice, 860–1150 words, 34–52 segments) for an adapted story the user wants kept longer than 2–3 min. `script_lint.py` requires `brief.md ## Length override` with `user_quote: "…"` (the user's own words); `voice.py` reads the same band. Shot pacing is unchanged. Never edit `pacing.json` per episode.

## `v3.6.0` — 2026-11-17 · speed + per-shot review (perf plan, docs/perf-plan-2026-11-17.md)
- **No phone copy:** `deliver.mjs` makes only `out/final.mp4`; G7 drops the size check; `final_check.jpg`. Render concurrency adapts to the CPU count (4–8).
- **Fast QA renders:** `qa.mjs` and `design.mjs` share one browser and 4 workers (`SV_QA_WORKERS`), with QA frames at half size. On hắt-xì (70 shots): full contact 3 min → 33 s, a re-run with no change takes 5 s, 26 strips take 40 s, and a one-shot check takes 3 s.
- **Light QA images:** contact, strips, shot, cards and crops are JPEG at 100–400 KB. Design sheets get `_v.jpg` views and set plates a `_zoom.jpg` (3×3). Strips stay full frame, in 2 rows.
- **Incremental by content hash:**
  - Each shot has a hash in `qa/cache.json`; `contact` re-renders only changed shots, marks them ● and writes `qa/changed.json`.
  - `design.mjs --changed` and `--status`.
  - Gates G4 and G5 check freshness by hash (`qa.mjs status`, `design.mjs --status`), not by file time.
- **Visual fix ≠ remix:** `qa/timing.json` (cut times, keys, reaches, overlays) is the mix's dependency (G6 input, `deliver.mjs` check). Pose, prop, set or camera fixes no longer stale the mix.
- **Per-shot review:**
  - `qa.mjs cards` (3 frames, words, flags) and `qa.mjs crops <i>` (full-resolution head, hands, feet and overlap crops placed by `geom.mjs`).
  - `qa/review/NN.json` per shot with 7 checks; reviewer ≠ builder.
  - G5 requires a current review for every shot, crops for HOT shots, and a 10 % cross-check. This replaces the per-shot lines in `G5.review.md`.
- **Geometry lint:** GE-01 (body overlap), GE-04 (head cut by the frame, face in the caption band) and GE-07 (1.25–1.6× size jump) write `qa/hot.json`.
- **Roles:** sv-00 `references/roles.md` gives one-page briefs for the conductor, builders and reviewers. One render at a time per episode (`qa/.render.lock`).
- No reuse of sets or characters across episodes (house rule).
- **Not done yet:** pixel checks (PX-*), hand-to-target distance and foot-on-floor measures (these need reach targets and floor y in the shot table), G4 portrait cards.

## `v3.5.0` — 2026-11-17 · per-sentence 5.25 ups rhythm, bilingual `<en>`, ellipsis & emotion tags
- **Offline per-sentence fast rhythm (`standards/voice_standard.json` v2.0, `standards/pacing.json` v2.0, `engine/scripts/voice.py`, `sv-12`):**
  - Synthesizes sentence-by-sentence with VieNeu V3 Turbo `Hải Đăng` (`use_ref_codes=True`, `temperature=0.7`, `top_k=25`, `top_p=0.95`), trims internal pauses `> 0.32 s` down to `0.16 s`, and brings each sentence to `5.25` syllable-units/s with `pitch_ratio = 1.02` via built-in FFmpeg WSOLA (`asetrate + aresample + atempo`) — 100% offline, without uniform `1.25×` distortion and without external Edge-TTS or RubberBand dependencies.
  - Supports surgical per-segment and per-sentence fine-tuning (`wps`, `pause_after`, `tts_text`, `seed`, `sentences: [...]`), `--only s7.2` single-sentence regeneration, and `--reuse` instant rhythm rebuild from cached raw sentence WAVs.
  - Updates episode word/runtime window for `5.25` ups pacing (`620–860` words, `125–170 s`, `22–40` segments, `4.6–5.5` overall wps), leaving `sv-40`/`sv-42` mix & master (`-14 LUFS`, `theme.py`) untouched.
- **Standardized bilingual `<en>...</en>` (`voice.py`, `script_lint.py`, `sv-10`, `sv-12`):**
  - Supports top-level/per-segment `"english": [...]` lists in `script.json` and inline `<en>...</en>` spans for native English G2P in VieNeu V3 Turbo, counting English vowel-cluster syllables accurately for pacing, excluding `<en>` spans from `SC-10` Vietnamese dialect checks, and stripping markup cleanly from burned-in captions (`words.json`).
- **Ellipsis & emotion tags unbanned (`voice_standard.json`, `script_lint.py`, `Film.tsx`):**
  - Unbans `...` / `…` (`no_ellipsis: false`; `SC-16` now checks `<en>...</en>` tag balance) and enables VieNeu V3 Turbo's native inline emotion tags (`[cười]`, `[thở dài]`, `[hắng giọng]`, `[chuckle]`, `[sigh]`, `[clear throat]`) in `SC-17`, stripping tags from `words.json` captions and accounting for non-verbal cue duration in rhythm & ASR checks.

## `v3.4.1` — 2026-11-16 · scene-design rollback
- Removed **sv-23-scene-design** and `engine/scripts/scene_audit.py`.
  - Its caps (≤ 4–5 props per plane, plain floors, "delete props when busy", edge ≤ 0.075, ≤ 15 colours) produced sparse, block-built sets.
  - The user rejected them in favour of the dense v3.2.0 sets.
- G4/G5 in `sv_gate.py` and `sv-00` are back to the v3.2.0 set and layout checks.
- The cute face rig from v3.3.0 (`chars.tsx`, `side.tsx`, sv-20 `characters.md` §1b) stays.

## `v3.4.0` — 2026-11-16 · 5-Knot story engine + premise ideation (548-script survey)
Grounded in the 548-script / 28-channel World-Rule Shorts survey (`docs/world-rule-survey-2026-11-16.md`), keeping `standards/pacing.json` unchanged (`140–165 s`, `600–720` words at Hải Đăng `1.0×`):
- **Three archetypes & upgraded Premise Test (`sv-01-series-bible`):** Supports `Personal Rule-Trap` (default, 6.0× median views over external-monster templates), `Systemic Satire` (active moves only), and `Hybrid VN Trap`. Adds *Instant Cognitive Itch (`s1 ≤ 18w`)*, *Cannot-Turn-Off*, *Surface-Loophole Blocker*, *Weaponizable Flaw*, and *Banned Premise Traps* (no arbitrary wrist/step quotas, no generic moral-to-element clichés, no external monsters/magic-denial, no `"name = superpower"`).
- **New ideation guide (`sv-10-script/references/premise-ideation.md`):** Four Generative Lenses (perceptual/physical axiom inversion, strict object state law, binary split humanity, backwards personal glitch) plus Reverse-Design Protocol (designing the Lateral Rule-Hack and Double-Bind before `s1`).
- **3-Act / 10-Beat 5-Knot Engine (`sv-10-script` `SKILL.md` + `craft.md` + `exemplar.md`):** Enforces Act 1 `≤ 42%`, personal pivot by `s7` / `< 40%`, ticking Double-Bind, internal Lateral Rule-Hack from Act-1 `Plant`, Past-Reinterpreting `Turn`, and `≤ 12w` deadpan `Button`; updates rubric to 14 checks and marks *Thang máy* `s4–s20` / `s22–s24` as pre-v3.4 voice/rhythm-only reference.
- **Starter templates (`starter/`):** `brief.md` adds `## Archetype`, Generative Lens, Surface Blocker, and 5-Knot `## Spine`; `beats.md` adds `## Plant & Payoff`, `[sX]` spine citations, and 10-beat `## Segment map` labels; `G1.review.md` & `G2.review.md` aligned.
- **Automated script lint (`engine/scripts/script_lint.py`, `sv_gate.py`, `CONVENTIONS.md`):** Raises `SC-09` short-sentence (`≤ 5w`) floor to `≥ 6` (`< 10` warn), adds `SC-20..26` (middle protagonist agency, Act-1 `≤ 42%` ceiling, `Plant -> Payoff` mapping, `## Archetype` + urgency cues, `≤ 12w` non-moralizing/non-magic-denial endings, early personal pivot, `[sN]` Spine integrity), and requires `## Archetype` in `G1`.

## `v3.3.0` — 2026-11-16 · scene design process + cute faces
- New skill **sv-23-scene-design**. It adds:
  - a location bible (≤ 6 places, each with a purpose, a hero prop, a wall hue and a three-plane layout);
  - `scenes.json`, mapping every beat to a scene;
  - declared transitions;
  - a clutter budget.
- `engine/scripts/scene_audit.py`:
  - `plan` mode checks places, scenes and transitions, and reads wall hues from the rendered plates;
  - `shots` mode checks scene membership, establishing wides, jump cuts and overlay count;
  - it measures **edge density ≤ 0.075 and ≤ 15 colour masses** on every contact frame.
  - It writes `qa/scene_board.png` and `qa/clutter_board.png`.
- `sv_gate.py`: G4 and G5 now run the scene audit and require both boards as evidence. `scenes.json` is an input of both gates.
- Faces (sv-20 characters §1b), front and side rigs:
  - mochi face, big low eyes with highlights, short soft brows;
  - small mouth, no teeth (open mouth = cavity + tongue);
  - button nose in profile, bangs and face-framing locks.
- Proportions: head radius 86 → 100, hip 200 → 178, torso 225 → 196; head ≈ 1/2.6 of height.

## `v3.2.0` — 2026-11-16
User feedback on the "Nước mắt chia đất" draft:
- **State board (sv-20 sets §8, sv-22 grammar).** Numbers that change across the film go on one diagram
  insert whose blocks tween with the numbers; reuse it at the opening and at every change. The reference
  implementation is `examples/devices/state-board.tsx`. The user rejected a push into a static deed cabinet
  as the opening ("mở đầu visual tệ").
- **Prop tip to the face (sv-21 acting §10).** The IK target `taste` puts the hand under the chin so the
  spoon tip lands on the lips. With the hand at `mouth`, the spoon was going to the forehead.
- **Close-up pass for characters (sv-20 characters §4).**
  - Hair caps now reach −1.42 r, so the scalp no longer shows above the hair.
  - `lips` colours the mouth stroke itself instead of an ellipse drawn over the mouth, which covered the
    teeth in grin ("răng ghê"). Teeth are now a band clipped to the mouth path, so they stay inside the lips.
- **Visual rest (sv-20 tokens §8).** Grain is now static at alpha 0.14 (it flickered at 15 Hz), and the
  vignette is down to 0.18 ("nhìn mắc mệt").
- **Delivery (sv-41).** `deliver.mjs` changes:
  - It renders to `out/_render.mp4`, then muxes in the sound straight from `public/mix.wav`. Remotion's AAC
    priming had made the sound 43 ms late.
  - The phone copy is one encode at CRF 33 (the user: "1 bản thôi").
  - It checks free disk space before rendering, because ENOSPC killed a render at 44 %.
  - `SV_SKIP_RENDER=1` is for audio-only fixes.

## `v3.1.0` — 2026-11-16
- **Story spine, not a gag list (sv-10).** The user rejected "Giỗ chia đất": the middle was a list of gags
  ("khai thác này kia"), the narrator only watched, the twist came from outside the rule, and the ending was
  a pun ("cái kết nhảm"). Changes:
  - craft.md §2 now asks for a causal chain in the middle, not a catalogue of groups;
  - new §2b "Spine" tests: want, chain/delete-test, hidden logic, trap, ending, gags;
  - G2 rubric questions 11–13.
- `brief.md` gains `## Spine`: want, the rule's hidden logic, trap, how the ending re-reads the hook.
  Gate G1 requires it.
- `beats.md` gains `## Spine`. New lint SC-19 requires ≥ 4 "- vì thế …" / "- nhưng …" causal lines.

## `v3.0.0` — 2026-11-16
**Repository restructured: one kind of thing per top-level folder** (the user: the template under the skills
mixed engine code, standards, demo and reference content with no structure).
- New layout:
  - `skills/`: instructions only;
  - `standards/`: `voice_standard.json`, `pacing.json`, `mix_targets.json`;
  - `engine/`: `scripts/` tools + `src/` Remotion engine + project config;
  - `starter/`: blank episode files;
  - `examples/`: `thang-may/` reference episode and `demo/` engine demo;
  - `tools/`: `new_episode.sh`, `validate_skills.py`.
- `templates/episode-starter/` is gone. `new_episode.sh` moved from `skills/sv-00-pipeline/scripts/` to `tools/`.
- **Episode layout** (breaking for tools, not for finished episodes — each keeps its own copy):
  - episode code in `src/episode/` (`cast.ts`, `geo.ts`, `sets.tsx`, `shotlist.ts`);
  - generated timing in `src/data/` (`words.json`, `cues.json`, `events.json`);
  - house standards in `standards/`.
  - A `README.md` in every episode marks the three zones: written by the agent, read-only suite copy, generated.
- **New episodes start blank.** The 4-shot demo is opt-in: `new_episode.sh <dir> --demo`. `.suite.json`
  records the suite version.
- `validate_skills.py` checks the layout. It rejects unknown top-level folders, a file kind in the wrong
  folder (code in `skills/`, data in `engine/`), and a skill folder holding more than `SKILL.md` + `references/`.
- Verified:
  - a `--demo` episode gives identical lint output and pixel-identical renders to the v2.2.0 layout;
  - a blank episode type-checks and runs;
  - con-so-dam-ma voice + mix in the new layout give identical words.json and audio QA (22/22).

## `v2.2.0` — 2026-11-16
- **Voice standard (`scripts/voice_standard.json`, sv-12 rewritten):** Hải Đăng preset only (no cloning), native 1.0× speed, temperature 0.8 / top_k 25 / top_p 0.95, **one take per line** with a fixed seed. Every line is measured against the calibrated Hải Đăng profile (word accuracy, rate, pitch, timbre, holes) and regenerated with the next seed only if it fails (max 3). Episode checks cover pitch spread, rate and timbre consistency, and retry share. Text rules: numbers in words, no "…", no emotion tags. The settings come from a temperature × top_k sweep; the user approved the result ("bản E"). Expressive tricks were rejected: punctuation shaping, cloning, and pitch/gain edits.
- **Pacing standard (`scripts/pacing.json`):** calibrated on the three approved episodes.
  - Voice: 140–165 s, 600–720 spoken words, 4.1–4.6 words/s overall, pauses 2–8 %.
  - Structure: 22–34 segments.
  - Shots: 2.0–3.0 s mean, 20–28 per minute.
  - Enforced by `script_lint.py` SC-04/05/15–18, gate G3, and new lint rules PC-01..03.
- **Voice chain v2 (`mix_targets.json` 1.1, sv-42):** denoise first, EQ for the codec (−3 dB @ 220 Hz, +2.5 dB @ 3.5 kHz, LPF 15 kHz), 2:1 compression, then an expander that cuts the codec's reverb tail between words. The old 3:1 chain lifted noise and tails about 10 dB. New check `voice.between_words_db` ≤ −50 (quietest quarter of the frames between words, vs speech: raw take −44, chain v2 −60). Last stage: voice peak limit at speech RMS + 15 dB, so the master limiter stays light (7.8 → 1.8 dB on con-so-dam-ma); G6 refuses a voice peak limit > 10 dB.
- **Fix:** `script_lint.py` rewrote `qa/script_lint.json` on every run, so `sv_gate.py pass G2` always found the evidence newer than the review and could never pass. It now writes only when the result changes.
- **Gates:** G3 rejects old reports, failed or stale lines, off-standard engine settings, and changed standards. G2, G3 and G5 go stale when the standards change.

## `v2.1.0` — 2026-11-15
- **Series theme music** (`scripts/theme.py`): one theme for every episode, chosen by the user. It is "Pizzicato tò mò" v2: D minor, 118 BPM, kalimba, music box and a soft "tưng tưng" bass. It is stored as code and generated to each episode's length; the melody starts at 0 s and resolves after the last word.
- **New skill `sv-42-mix-master`:** a fixed house chain and a measured standard in `scripts/mix_targets.json`.
  - Voice: EQ, de-ess, compression and per-segment levelling.
  - Music: voice-band carve, side-chain duck and auto-ride.
  - SFX: levelled against the voice.
  - Master: glue, −14 LUFS and a 4× true-peak limiter.
- **`audio_qa.py`:** 21 checks on the mix, plus waveform, loudness, voice-minus-music and spectrum plots (`qa/mix/*.png`). A `--video` mode checks the audio inside the delivered mp4s: AAC drift, true peak, A/V length and sync.
- **Gates:** G6 enforces every check, the theme and limiter effort, and goes stale when the standard changes. G7 enforces the video audio checks.
- **Music level:** now 15–18 dB under the voice (was 20–24); the user found 22 dB too quiet.

## `v2.0.0` — 2026-11-15
- **Replaced the v1 suite.** The v1 suite was generic, English-only, and full of counters. v2 is nine skills built from the proven process of the reference episode *Thang máy ăn bí mật*.
- **New template `templates/episode-starter/`:**
  - the generalized engine;
  - the exemplar cast, sets and shotlist;
  - a demo shotlist;
  - one-command evidence renderers: design sheets, contact sheets, motion strips, single frames;
  - delivery with a phone copy of 30 MB or less.
- **Design system (sv-20):**
  - Fixed tokens: palette roles, line weights, halftone and glow, typography, world coordinates.
  - Characters: a procedure with trait and silhouette rules, plus cast and expression sheets.
  - Sets: six-pass building with detail budgets calibrated on the exemplar, a human-scale fixture table, and a collision checklist.
- **Lint (`lint.mjs`):**
  - 60+ rules across characters, tokens, sets, shots, anchors, overlays, camera, size, motion and coverage.
  - SE-13 measures emptiness on the rendered plate.
  - MO-09 checks that the actor stands at the right distance and depth for a reach.
  - SZ-02 catches actors cut by the frame edge.
  - KY-01 requires a strip for every animated set key.
- **Script lint** calibrated on the reference script: rhythm SD, short punch lines, northern wording, beats map.
- **Voice report:** per-segment similarity and pace, with the voice locked to Hải Đăng.
- **Generic mix (`audio.json`):**
  - ambience beds and automatic foley;
  - music at 80 BPM or less, placed 20–24 dB under the voice;
  - a mix report with hashes.
- **Gates G1–G7 (`sv_gate.py`):**
  - input hashes, with stale detection;
  - evidence and remark checks;
  - user approval quotes;
  - order enforcement.
- Removed `templates/stage-starter`, the 40-genre and 50-camera catalogs, and SHA lockfiles per checklist.
