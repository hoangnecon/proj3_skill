---
name: sv-02-long-form
description: Complete cinematic production standard (v5.1) for 10-minute (8–12 min, 2,200–3,600 words, 75–160 segments) 16:9 widescreen (1920×1080) Vietnamese animated story videos under a 45-minute parallel SLA — opt-in flags, 5-chapter Story Doctor (SC-29..31), G2-to-G4 blueprint (plan_assets.py), Spatial Location Packs (24–30 drawn multi-angle sets across 5–6 locations with cameraDir and shared landmarks, SE-15..17, overview_sets.jpg, location_pack strips, CH-09), 65–110 rich choreographed shots (shots_long_16x9, MO-16), studio 2D animation physics (anim.ts, straddle mounts, arcH, pushTarget, ActionFx, MO-13..15), multi-pose Hero Subjects (PR-06, SH-18), mood/dof (SH-19), camera/layout CI (CA-06..07, LA-01..04, GE-19, SH-16..19), qa.mjs place, sv_doctor.py, macro-block render, benchmark_suite.py, and 10-check true-16:9 Blind Review. Use whenever creating, scripting, designing, blocking, rendering, or delivering a 10-minute 16:9 episode.
---

# sv-02 · Long-Form 16:9 Cinematic Production Standard (`v5.1.0`)

This skill extends the core `sv-00`–`sv-42` suite to **true cinematic 10-minute (`8–12 min`) 16:9 widescreen (`1920×1080`)** animated story videos for the `Nhím Là Lốp` audience, targeting a **45-minute cold `G1 → out/final.mp4` SLA**.

**Hard lesson from `v4.0.0` (`docs/rsi-forensics-v4.0-2026-11-22.md`) – `v5.1.0`:** A 10-minute 16:9 movie is **NEVER** a 2.5-minute Short stretched 4× across flat walls, noisy spike patterns, fake zoomed establishing plates, choppy static micro-cuts, axis-flipping cuts, pasted-sticker characters, or static creature cutouts. `v5.1.0` enforces genuine long-form story density, automated **G2→G4 Spatial Location Pack blueprinting (`scripts/plan_assets.py`)**, **24–30 drawn sets (`>= 15` hard floor, 5–6 primary locations × 3–5 redrawn camera angles each sharing `landmarks` & `cameraDir`)** reviewed on **`qa/design/overview_sets.jpg`** (sorted by location) AND per-location **`qa/design/location_<loc>_pack.jpg`** and verified by perceptual visual quality & continuity CI (`SE-15`, `SE-16`, `SE-17`), **≥ 10 cast looks**, **65–110 rich multi-action choreographed shots (`shots_long_16x9` in `standards/pacing.json`: `4.5–9.5 s` mean, `6.0–14.0 shots/min`, guarded by `MO-16`)**, **studio 2D animation physics (`src/anim.ts`: 4-phase foot-roll walks/runs, tapered limbs, curved torsos, grounded altitude shadows, parabolic `arcH` jumps, 3-layer `straddle: true` + `grip` creature mounting with `SeatShadow`, contact-locked `pushTarget`, `wind` hair drag, and riso `ActionFx` guarded by `MO-13..15`)**, **multi-pose Hero Subjects (`PR-06`, `SH-18`)**, **studio mood lighting & depth separation (`ShotDef.mood`, `ShotDef.dof`, `SH-19`, static `url(#grainPat)`)**, **camera grammar & layout CI (`CA-06`, `CA-07`, `LA-01..04`)**, **zero-rework placement solving (`qa.mjs place`)**, **fast Long-Form QA probe density (`qa.mjs`)**, **`sv_doctor.py` preflight**, **shot-aligned macro-block chunk rendering (`deliver.mjs`)**, **automated dual-format regression (`tools/benchmark_suite.py`)**, and a **10-check true-16:9 Blind Review with Pasted-Sticker Anti-Pattern enforcement**.

## Read first
1. `references/ideation-system-prompt.md` — reusable **4-Agent Pitch → Cross-Critique → Blind Reviewer** system prompt, `Nhím Là Lốp` Winning DNA, Mandatory Inductive Hook (`Hook Quy Nạp`), and **100-Point Blind Judge Scorecard** for **G1**.
2. `references/story-doctor-prompt.md` — mandatory **G2 Adversarial Story Doctor** audit (`qa/story_doctor.json`, score ≥ 80, zero meandering stretches) required before passing G2.
3. `sv-00-pipeline/SKILL.md` — gate dependencies (`G1 → G2 → G3; G1 → G4; G3+G4 → G5; G3+G5 → G6; G5+G6 → G7`), render lock (`qa/.render.lock`), and house rules.

---

## 1. Opt-In & Long-Form Production Budgets (`G1`–`G5`)

A long-form 16:9 episode is an **explicit opt-in** (never the default 2–3 min Short):
- **`script.json`**: Set both `"format": "16:9"` and `"length": "long_16x9"` at the top level.
- **`brief.md`**: Include `## Length override` with `user_quote: "<exact user instruction>"` (`SC-27`; never edit `standards/pacing.json` per episode).

| Metric | 16:9 Long-Form Standard (`v5.1.0`) | Machine Guard |
|---|---|---|
| Runtime | **8–12 min** (`480–720 s`, target ~`600 s`) | `SC-05`, `voice.py` (`episode_long_16x9`) |
| Spoken words | **2,200–3,600 words** (~440–720 words/chapter) | `SC-05` |
| Segments | **75–160 segments** (~15–32 segments/chapter) | `SC-04` |
| Causal plot turns | **≥ 12 causal Spine links**, max 15-seg gap, 5 structured Chapters (`Goal/Obstacle/Turn/Cliffhanger`), **≥ 3 Plants → Payoffs** | `SC-29`, `SC-30`, `SC-31` |
| G2 Story Audit & Blueprint | Independent Adversarial Story Doctor (`score ≥ 80`, `0` meandering stretches) + **`scripts/plan_assets.py`** G2→G4 Spatial Location Pack blueprint | `sv_gate.py check G2` (`qa/story_doctor.json`), `plan_assets.py` |
| Cast | **≥ 10 distinct cast looks** (ERROR `< 8`, WARN `< 10`), rendered in Front + 3/4 + Back turnarounds | `CH-09`, `Sheets.tsx` |
| Sets / Drawn Sub-Scenes | **Target 24–30 drawn sets** (`≥ 15` hard floor ERROR, WARN `< 24`), **5–6 primary locations × 3–5 redrawn camera angles each** (WARN if `< 3` locations have `≥ 3` angles) with `actorScale`, `shotScale`, `location`, `cameraDir`, and shared `landmarks` (no duplicate `(angle, shotScale, cameraDir)`), verified on `qa/design/overview_sets.jpg` AND per-location **`qa/design/location_<loc>_pack.jpg`**, + perceptual clutter (`≤ 22%`), contrast (`≥ 18`), and L/R balance (`≤ 9.5`) | `SE-15`, `SE-16`, `SE-17`, `LA-01`, `design.mjs` |
| Hero Subjects | Recurring creatures/bosses/vehicles registered in `SUBJECTS` with `relToActor` & **`≥ 4` distinct poses** (`qa/design/subject_<id>.png`); poses varied across shots | `PR-06`, `SH-18`, `sv_gate.py check G4` |
| Shots & Pacing | **65–110 rich choreographed shots** (`shots_long_16x9` in `standards/pacing.json`: `4.5–9.5 s` mean, `6.0–14.0 shots/min`, `p10 ≥ 1.6 s`, `max 14.0 s`), guarded by **`MO-16`** (`≥ 2` choreography events per shot `> 5.0 s`, `≥ 3` for `> 8.5 s`, `0` events `> 5.0 s` = ERROR) | `PC-01..03`, `MO-16` |
| Camera Grammar & Variety | No unbridged 180° left/right axis flips between consecutive 2-actor cuts (`CA-06`); `establishing` sets **`≤ 65%`** of shots (ERROR), `closeup + insert` **`≥ 10%`** (WARN) (`CA-07`) | `CA-06`, `CA-07` |
| Scale, 3×3 Grid & Anti-Zoom | Actor/Subject scale ratios enforced (`LA-01`); 3×3 grid `< 4` clusters/cell & `≤ 78%` occupancy (`LA-02`); no fake close-up zoom `> 1.35×` (`cam2 > 1.45×`) on establishing/wide sets (`LA-03`); no awkward `> 35%` creature edge cut-offs (`LA-04`) | `LA-01`, `LA-02`, `LA-03`, `LA-04`, `qa.mjs place`, `qa.mjs layout` |
| Set-Fatigue Ceiling | Max **`≤ 10` consecutive shots** on the same set (WARN `> 7`), max **`≤ 18%`** single-set share (WARN `> 14%`) | `SH-16` |
| Cinematic View Mix | **`front ≤ 70%`** (WARN `> 60%`), **`back + 3q ≥ 15%`** (WARN `< 25%`), avoid static prop copy-paste `> 15` shots | `SH-17` |
| Limb Continuity | Giant partial-body props (`Shoe|Foot|Leg|Hand|Arm|Paw`) MUST bleed off frame top/side (`sy0 ≤ 24`); NEVER float severed mid-frame! | `PR-05`, `GE-19` |
| Atmospheric Mood & Depth | Optional `ShotDef.mood` (`default\|morning\|golden\|danger\|lab\|flashback\|dramatic`) + `ShotDef.dof: true` far-layer haze + static riso grain (`url(#grainPat)`); avoid `mood: 'danger'` + `night > 0.7` double dark crush | `SH-19` |
| Studio 2D Animation & Contact | `src/anim.ts` grounding shadows, parabolic `arcH` jumps, contact-locked `pushTarget` (`MO-13`), 3-layer `straddle: true`/`grip`/`wind` creature mounts with cohesive rider facing (`MO-14`), valid `ActionFx` (`dust\|sweat\|speed\|impact\|stars`), fall impact weight & flying `altitude: 160..280` (`MO-15`), plus multi-action choreography density on shots `> 5.0 s` / `> 8.5 s` (`MO-16`) | `MO-13`, `MO-14`, `MO-15`, `MO-16` |

---

## 2. 5-Chapter Narrative Depth & Anti-Meandering Rules (`G1` / `G2`)

Stretching a 3-minute premise thin across 10 minutes creates circular, aimless filler. Every chapter in `beats.md` MUST be structured explicitly with `### Chapter 1`..`### Chapter 5` (or `### Hồi 1`..`### Hồi 5`), each containing:
- **`Goal:`** (what the hero actively tries to achieve in THIS chapter)
- **`Obstacle:`** (the escalating rule twist, rival move, or environment threat)
- **`Turn:`** (the concrete reversal or discovery that changes the game)
- **`Mini-Cliffhanger:`** (for Ch 1–4; Ch 5 has **`Ending:`** — open/series-capable, `SC-24` zero preachy moral)
- **`[sA-sB]`** segment span (`10%–34%` of total segments per chapter, `SC-29`).

Required narrative rhythm:
1. **Inductive Hook (`0:00–0:25`, `s1–s5`):** Drop straight into crisis/chase/impostor danger at `0:00`, then induce the rule and slam the Surface-Loophole Blocker.
2. **Escalating Rule Exploration (Ch 1–4):** Every chapter must exploit a **NEW consequence, tier, faction conflict, or physical edge case** of the core premise — never repeat the same chase beat in different words! Maintain `≥ 12` causal `- vì thế / - nhưng [sA-sB]` Spine links (`SC-31`) and `≥ 3` distinct `Plant: s<N>` → `Payoff: s<M>` pairs (`SC-30`).
3. **Mandatory G2 Adversarial Story Doctor (`references/story-doctor-prompt.md`):** Dispatch a fresh independent agent to score `script.json` + `beats.md` and write `qa/story_doctor.json`. Revise until `verdict == "pass"`, `score >= 80`, and `meandering_stretches == []` before synthesizing G3 voice.

---

## 3. Cinematic 16:9 Visual Architecture (`G4` / `G5`)

### 3.1 Spatial Location Packs (`24–30` Drawn Sets, `SE-15` & `SE-17`)
Never trap a 10-minute movie inside 5 flat frontal walls or fake zoom-crops (`LA-03`). Organize every episode into **5–6 primary locations**, redrawing the **SAME physical space** from **3–5 distinct camera angles** per location (**target `24–30` drawn sets**, hard floor `≥ 15` ERROR, WARN `< 24`, WARN if `< 3` primary locations have `≥ 3` redrawn angles — `SE-15`). Every set in a Spatial Location Pack declares `location`, `shotScale`, `angle`, **`cameraDir`** (`'front' | 'reverse' | 'left' | 'right' | 'top' | 'low' | 'detail'`), and shared **`landmarks: string[]`** (physical room fixtures — e.g. chalkboard, wall clock, window bay, shelf, bulletin board — drawn consistently across every redrawn angle of that room so cutting between plates feels like moving a real camera inside one 3D space!):
- **Establishing Wide (`angle: 'wide'`, `cameraDir: 'front'`):** Full 16:9 spatial geography (`bounds: [-320, -160, 2240, 1240]`, `plateCam: [960, 540, 1]`) establishing every shared landmark.
- **Low-Angle / Worm's-Eye (`angle: 'low'`, `cameraDir: 'low'`):** Camera near the floor looking UP (horizon low, towering furniture/giants/ceiling looming overhead — essential for scale awe!).
- **High-Angle / Bird's-Eye (`angle: 'high'`, `cameraDir: 'top'`):** Elevated vantage looking DOWN across a room, yard, or tabletop canyon.
- **Side / Over-The-Shoulder / Reverse (`angle: 'ots'` or `'reverse'`, `cameraDir: 'left' | 'right' | 'reverse'`):** True redrawn counter-angle looking back toward the doorway, window, or opposing faction with matching room landmarks so conversations and chases cut cinematically instead of flat stage theater!
- **Close-Up / Insert / POV (`angle: 'closeup'` or `'pov'`, `cameraDir: 'detail'`):** Dedicated tight-angle environments for key devices, maps, screens, traps, or dramatic reveals — never a blurry `> 1.35×` zoom on the wide plate (`LA-03`).
- **Continuity Guard (`SE-17`) & Location Strips:** `SE-17` validates `cameraDir` enum and `landmarks` array format (ERROR), bans 3+ sets in one location duplicating identical `(angle, shotScale, cameraDir)` (ERROR), and warns when a 3+ set location declares zero overlapping `landmarks`. Always inspect every auto-tiled **`qa/design/location_<loc>_pack.jpg`** alongside location-sorted `qa/design/overview_sets.jpg` at G4!

### 3.2 4-View Character Rigs & OTS Foreground Layer (`engine/src/back.tsx`, `threeq.tsx`, `Film.tsx`)
Use all 4 engine views (`Actor.view`: `'front' | 'side' | 'back' | '3q'`) plus foreground OTS framing (`Actor.fg: true`) and subtle Dutch camera tilt (`ShotDef.tilt`):
- **`view: 'back'` (`PersonBack`):** Full character seen from behind — ideal for **3rd-person OTS shots** (`fg: true`, `s: 1.5..2.0`, `x: 360` looking toward a boss/rival at `x: 1320`) and characters walking/gazing INTO the depth of the set!
- **`view: '3q'` (`Person3Q`):** Angled 3/4 perspective (`face: 1 | -1`) for natural diagonal two-shots and group confrontations across the `1920 px` width!
- **`view: 'side'` (`PersonSide`):** Planted-foot profile walks, climbs, sits, and reaches (`sv-21`).
- **`view: 'front'` (`Person`):** Direct reactions and comedic deadpan beats — capped at **`≤ 70%`** of actor placements (`SH-17`).
- **G4 Turnaround Verification:** `CastSheet` automatically renders **Front + 3/4 + Back** for every character look; inspect every angle before passing G4.

### 3.3 Giant Body-Part Continuity, Layout Grid & Multi-Pose Subjects (`PR-05..06`, `GE-19`, `LA-01..04`, `SH-18`)
- Any giant partial body part (`thayHaiShoe`, giant leg, giant hand, giant cat paw) MUST be designed tall/wide enough (`≥ 720 px`, `PR-05`) and positioned so its severed top/side edge **exits cleanly past the frame boundary (`sy0 ≤ 24` or `sx0 ≤ 24` / `sx1 ≥ 1896`)** — NEVER floating amputated mid-air inside the frame (`GE-19` hard ERROR + HOT)!
- Every recurring hero creature/boss/vehicle MUST be registered in `src/episode/subjects.tsx` (`PR-06`, `SH-18`, `≥ 4` distinct poses, verified on `qa/design/subject_<id>.png`) and ridden via `Actor.mount` rather than floating manually over props.
- Run `node scripts/qa.mjs place <setId>` before blocking shots to obtain guaranteed `LA-01`/`LA-02`/caption-safe floor coordinates on the first try, then run `node scripts/qa.mjs layout` before any render to verify 3×3 grid balance (`LA-02`), actor/subject scale ratios (`LA-01`), zero fake close-up zooms on establishing sets (`LA-03`), zero awkward hero creature frame-edge cut-offs (`LA-04`), and camera grammar continuity (`CA-06`, `CA-07`).
- Keep caption band `y = 880..1000` clear of heads, hands, hero props, and signs (`OV-03`, `GE-04`, `GE-11`).
- Keep `PR-01..06`, `CH-01..10`, `TK-01..03`, `SE-01..17`, `CA-01..07`, `SH-01..19`, `LA-01..04`, `MO-01..16`, `GE-01`, `GE-04`, `GE-07`, `GE-10`, `GE-11`, `GE-15..19` at 0 errors.

---

## 4. True-16:9 QA, 10-Check Blind Review & Macro-Block Delivery (`G5`–`G7`)

1. **True-16:9 Contact Sheets, Crops & Fast Long-Form Probe Density (`tile.py`, `crops.py`, `qa.mjs`):**
   - `tile.py` preserves exact `16:9` aspect ratio (`4×3` wide grid per 12-shot contact page, zero vertical squashing).
   - `crops.py` scales and clamps crops in true `1920×1080` coordinates so HOT crops inspect the exact right/left pixels.
   - `qa.mjs` adapts per-shot probe density for heavy `16:9` episodes (`>= 80` shots: `4–8` probes @ `0.45 s` instead of `6–16` @ `0.2 s`) so `qa.mjs pass changed` keeps browser probe overhead well inside the 45-minute SLA while preserving full HOT-shot fidelity.
2. **10-Check Anti-Bypass Blind Review (`blind_pack.mjs`, `qa.mjs`, `sv_gate.py`):**
   - `blind_pack.mjs` attaches `format`, `set_streak`, and `prev_set` to every slice entry and emits a 10-check `RUBRIC.md`: the 8 base checks (`acting`, `contact`, `overlap`, `set`, `text`, `caption`, `beat`, `model` — with explicit **Pasted-Sticker Anti-Pattern Checks** under `acting` and `contact` flagging missing shadows, air-pushing, flat pasted riders, or rigid brick limbs) **PLUS** **`framing`** (severed/floating limbs, 16:9 depth/angle believability) and **`variety`** (no copy-paste static wall/prop repetition across consecutive shots).
   - Independent reviewers submit via `node scripts/qa.mjs review --batch <file.jsonl>` with verbatim `blind_sha`; `sv_gate.py check G5` enforces all 10 checks (`ok`) and `blind_sha`.
3. **Macro-Block Chunked Delivery & Regression Suite (`G7`, `tools/benchmark_suite.py`):**
   - Run `SV_CHUNK_RENDER=1 node scripts/deliver.mjs` (`bundle_cache.mjs` + shot-aligned macro-blocks via `SV_CHUNK_FRAMES` default `1050` frames ≈ 35 s + static `url(#grainPat)` + JPEG q=95 intermediates + `SV_X264_PRESET=veryfast` + 4×3 true-16:9 `qa/final_check.jpg` + `qa/video_audio.json`), pass G7, and send `out/final.mp4`.
   - Verify dual-format suite health and timing regressions anytime via `python3 tools/benchmark_suite.py` (with optional `--long-script` blueprint check and `--bench-render` timing hook).

---

## 5. 45-Minute Long-Form Execution Budget & Lean Swarm Orchestration (`24–30` Sets, `≥ 10` Cast, `65–110` Rich Choreographed Shots)

- **Preflight every stage (`scripts/sv_doctor.py --stage <G>`):** Catch missing artifacts, broken tokens, or stale hashes in `< 2 s` before launching TTS, Remotion, or reviewers.
- **Conductor (main session):** Owns `sv_doctor.py`, `sv_gate.py`, `plan_assets.py` handoff, user approvals, `qa/.render.lock` (one render at a time), and `qa/state.json`.
- **G1–G3 (`~10 min` overlapping G4):** Brief (`3–4 min`) → Script + G2 Adversarial Story Doctor (`5–6 min`, `qa/story_doctor.json`) → `python3 scripts/plan_assets.py` G2→G4 Spatial Location Pack blueprint (`24–30` sets + `shared_landmarks` + `65–110` shot budget) → `voice.py --preflight` zero-GPU sanity check → G3 voice (`6–8 min` in parallel with G4).
- **G4 Builders (`8–10 min`, 5 parallel):** Partitioned directly from the `plan_assets.py` blueprint: 1 `cast (10+ looks) + props + subjects` builder ∥ **4 `sets` builders** keeping **whole Spatial Location Packs together** (1–2 primary locations = 6–8 redrawn multi-angle sets each → **24–30 sets** passing `SE-15`, `SE-16`, and `SE-17` on the first render; inspect all sets at a glance on `qa/design/overview_sets.jpg` AND per-location continuity on every `qa/design/location_<loc>_pack.jpg`).
- **G5 Builders + Blind QA (`12–15 min`, 4 parallel chapter workers):** **4 chapter workers** producing **~18–25 richly choreographed shots each** (`65–110` total shots under `shots_long_16x9`, each `> 5.0 s` shot packing `≥ 2` and `> 8.5 s` packing `≥ 3` motion/camera choreography events per `MO-16`), using `node scripts/qa.mjs place <setId>` for first-try clean `LA-01..04` / `CA-06..07` / `SH-16..19` / `MO-13..16` blocking (plus atmospheric `mood`/`dof` passes) and `qa.mjs pass changed`, followed by 3-way parallel blind reviewers on enriched `slice_1..3.json` (`+ framing`, `+ variety`). Run G6 mix (`~2 min`) concurrently once `qa/timing.json` is stable.
- **G7 Macro-Block Single-Browser Render (`6–8 min`):** Run `SV_CHUNK_RENDER=1 node scripts/deliver.mjs` (cached single-browser shot-aligned macro-blocks in `out/_chunks/` with static `url(#grainPat)` + `qa/final_check.jpg` + `qa/video_audio.json`).
