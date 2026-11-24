---
name: sv-22-shots-camera
description: Break a narrated story-video episode into word-anchored shots (v5.6) — shot sizes, motivated camera moves, camKeys (CA-08), anime transitions ShotDef.tr (cut, flash, wipe, whipL, whipR, iris), set keys, overlays, dual cut pacing (~2.2 s for 9:16 Shorts vs 2.8–6.2 s multi-scale cinematic shots for 16:9 Long-Form across sequential Episodic Units U1..Uk, SH-20 shot-scale alternation, SH-21 multi-location progression, SH-22 normal-vs-tiny set scaleMode lock, SH-23 temporal creature/state bleed guard, LA-03 cross-angle creature scale lock and partialOf close-ups, PR-09 anti-statue creatures, MO-16..18, GE-11, GE-20) — write src/episode/shotlist.ts, render unit/3-Tier Contact Sheets and motion_energy.json, blind-review, lock each unit via sv_gate.py pass-unit, and pass gate G5. Use when writing, editing, retiming, or reviewing shotlist.ts.
---

# sv-22 · Shots and camera (gate G5, `v5.6.0`)

The narration is the clock. Every shot starts on a word (`at: 's4@bấm'`), every action lands on a word,
and cut rhythm follows `standards/pacing.json`:
- **9:16 Shorts (`shots`, `v5.9.0`):** `2.3–3.8 s` mean (`16–26 shots/min`, `p10 ≥ 1.3 s`, `max 7.0 s`, ~`40–58` shots per 2.25-min Short, aligned with our 41-folder `SCRIPT_YOUTUBE` median `50 shots` / `2.98 s/shot` + `2–4` deliberate silent visual hold beats `0.5–1.2 s` at hooks, twists, and buttons).
- **16:9 Long-Form (`shots_long_16x9`, `v5.6.0`):** `2.8–6.2 s` mean (`9.5–21.0 shots/min`, `p10 ≥ 1.3 s`, `max 9.5 s`, `SH-15` warns `> 8.0 s`), **built and gate-locked sequentially Unit-by-Unit (`U1 → U2 → … → Uk`, ~20–32 shots per unit, `SC-37`)** — alternating **`1.8–3.2 s` reaction close-ups, POV inserts & OTS cuts** with **`4.0–6.2 s` dynamic tracking/action shots** (`SH-20`, `SH-21`, `SH-22`, `SH-23`, `LA-03`, `PR-09`, `MO-16..18`).
An agent that batch-dumps 160 unverified shots at once, camps in dollhouse-wide shots, shrinks a giant creature in close-ups, or leaks normal/tiny sets or creatures out of story order has failed this skill.

## Read first
1. `references/shot-grammar.md` — benchmarks, shot sizes, camera moves, composition, scene templates.
2. `references/shotlist-api.md` — anchors, every ShotDef field, overlays, waivers.
3. sv-21 `references/actor-api.md` and `acting.md` — for everything actors and creatures do.
4. `src/exemplar/shotlist.thang-may.ts.txt` — the reference shotlist (v1 field names, see migration table).

## Inputs → outputs
- In: G4 passed (cast, sets, subjects, geo), `beats.md` segment map, `script.json` (`units` on `long_16x9`), `src/data/words.json` (from G3).
- Out: `src/episode/shotlist.ts`, unit contact sheets `qa/units/U<k>_contact.jpg` + `qa/blind_review/unit_U<k>.json` + `gates/G5.U<k>.review.md` (`long_16x9`), `qa/contact_p*.jpg` (Tier 1 Đại đoạn), `qa/contact_segments/seg_*.jpg` (Tier 2 Trung đoạn), `qa/shots/NN.jpg` + `qa/strips/*.jpg` (Tier 3 Tiểu đoạn 8-frame `Δ=%` filmstrips), `qa/motion_energy.json`, `qa/cards/NN.jpg`, `qa/review/NN.json`, `qa/shots.json`, `gates/G5.review.md`.

## Workflow
1. **Shot plan on paper (Unit-by-Unit on `long_16x9`).** On 9:16 Shorts, plan the full 2–3 min episode (`narration seconds ÷ 2.2`). On `long_16x9`, **NEVER batch-author all units at once**: work **strictly one Episodic Unit `Uk` (`[unit.seg_start .. unit.seg_end]`, ~20–32 shots) at a time**, locking `sv_gate.py pass-unit U1` before writing `U2`! Comment each segment's visual beats (`// s4: Tháng(tag, wide) · Hạnh(label, medium) · bấm(close, reach)`), alternating `3.8–6.0 s` establishing/medium action takes (`MO-16`) with `1.8–3.2 s` drawn `closeup`/`pov`/`insert`/`fg` OTS cuts every 2–3 wide shots (`SH-20`).
2. **Write shots (with `qa.mjs place` zero-rework solver)** segment by segment inside the active unit. Run `node scripts/qa.mjs place <setId>` to obtain collision-free, `LA-01`-scaled, caption-safe floor slots and camera bounds directly from set geometry.
3. **Pre-Flight Zero-Bounce Gate (BEFORE any render!):** run `node scripts/lint.mjs shots` until **0 errors** across all rules:
   - **Scale-Mode & Temporal Continuity (`v5.6.0` — `SH-22`, `SH-23`, `SE-20`):**
     - **`SH-22` (Scale-Mode Continuity & Set Bleed Guard):** Cross-checks segment/unit `scale_mode` (`'normal' | 'tiny' | 'mixed'` in `script.json["units"]`) against `SetDef.scaleMode` (`'normal' | 'tiny'`, `SE-20`). Staging a pre/post-shrink `'normal'` segment on a `'tiny'` miniature set OR staging shrunken kids during a `'tiny'` segment on a `'normal'` set is a hard **ERROR + HOT**!
     - **`SH-23` (Temporal Story-Order & Stateful Pose Bleed Guard):** Enforces `SubjectDef.firstSeg`, `appearSegs`, and `poseSegs` windows. Placing a creature before its `firstSeg` reveal, outside its `appearSegs` scene windows, or in a stateful pose outside `poseSegs` (e.g. sticky tape still stuck on a paw after removal) is a hard **ERROR + HOT**!
   - **Cross-Angle Creature Scale Lock & Anti-Fake-Zoom (`v5.6.0` — `LA-03`, `LA-01..02`, `LA-04`, `PR-05`, `GE-19`):**
     - **`LA-03`** enforces THREE rules: (1) bans fake close-up zoom `> 1.35×` (`cam2 > 1.45×`) on `establishing`/`wide` sets, (2) enforces per-shot `SubjectDef.scaleWithTinyActor: [minR, maxR]` px height ratio against grounded tiny actors, and (3) **bans `> 1.85×` max/min creature-to-actor scale spread across shots on `scaleMode: 'tiny'` sets**! For tight close-ups on giant creatures, **NEVER** shrink the full-body creature — place a dedicated `partialOf` subject (`giantCatPaw` / `giantCatHead`, bleeding cleanly off the frame edge per `PR-05`/`GE-19`).
     - Keep `LA-01` (`actorScale`/`relToActor`), `LA-02` (3×3 grid `< 4` clusters/cell, `<= 78%` occupancy), and `LA-04` (`<= 35%` non-`fg` creature edge clip) at 0 errors.
   - **Living Creature, Jump, Airspace & Camera Choreography (`PR-09`, `SH-18..21`, `CA-06..08`, `MO-10..18`, `GE-10`, `GE-11`, `GE-15..20`, `SE-18`):**
     - **`PR-09`** errors + marks HOT when any `kind: 'creature'` `SUBJECT` stands in `1` static pose at `1` spot for `> 2.2 s` without a moving `path` or `>= 2` distinct keyed `pose`/`expr` beats (*"đứng như trời trồng"*).
     - **`SH-20`** bans `>= 4` consecutive wide/medium stage shots (`zoom <= 1.16`, WARN `>= 3`); **`SH-21`** bans `> 16` unbroken single-location shots (WARN `> 11`, bridge with `ShotDef.tr: 'whipL'|'whipR'|'iris'`); **`CA-08`** validates `ShotDef.camKeys` (`[cx, cy, zoom, at][]`); **`MO-16`** requires `>= 1` (target `>= 2`) choreography events on shots `> 5.0 s`; **`MO-17`** binds `arcH > 0` to bounded `<= 2.2 s` `legs: 'jump'` windows; **`MO-18`** bans `> 1.8 s` frozen creature attacks (ERROR) and `> 3.4 s` static actors (WARN + HOT); **`GE-20`** guards `+1200` flying airspace (`> 45%` ERROR, `> 25%` WARN + HOT); **Parallax-Aware `GE-11`** allows 1-sample moving pass-through over wall signs while warning on persistent `>= 2/3` occlusion; **`SE-18`** warns on `cameraDir: 'top'` + `side`/`front` actors; **`CA-06`** warns on unbridged 180° 2-actor axis flips; **`SH-19`** validates `ShotDef.mood` (`default|morning|golden|danger|lab|flashback|dramatic`, warn `danger` + `night > 0.7`).
   - Run `node scripts/qa.mjs layout [--unit U<k>]` and `node scripts/qa.mjs where <i>` before rendering a single frame.
4. **Unit-Scoped (`--unit U<k>`) or Full-Episode 3-Tier QA Render (`qa.mjs pass`):**
   - **On `long_16x9` during Unit `Uk`:** run **`node scripts/qa.mjs pass --unit Uk`** (~20–30 s, one shared browser, zero `$TMPDIR` bloat, progressive `SHOTS` authoring supported!). It renders **4-frame/shot `qa/units/Uk_contact.jpg`**, 8-frame `qa/shots/<NN>.jpg` (`Δ=%` pixel motion delta in `qa/motion_energy.json`), overlapping `qa/strips/*.jpg`, `qa/cards/NN.jpg`, HOT `qa/crops/NN.jpg`, runs `carry.py`, and invokes **`node scripts/blind_pack.mjs --unit Uk`** → `qa/blind_review/unit_Uk.json` + updated `qa/blind_review/manifest.json`.
   - **On 9:16 Shorts (and once at final `G5` consolidation after all `G5.U1..G5.Uk` are locked):** run `node scripts/qa.mjs pass changed` (renders Tier 1 `qa/contact_p<N>.jpg`, Tier 2 `qa/contact_segments/seg_<NN>_<loc>.jpg`, Tier 3 `qa/shots/<NN>.jpg` + `qa/strips/*.jpg`, cards, HOT crops, `carry.py`, and `slice_1..3.json`).
5. **Inspect Contact Sheets & `qa/motion_energy.json`:** open `qa/units/Uk_contact.jpg` (or `qa/contact_p*.jpg` + `qa/contact_segments/seg_*.jpg`) and EVERY Tier-3 `qa/shots/NN.jpg` (`Δ=%`, zero `frozen_streak >= 2`) + `qa/strips/*.jpg`.
6. **Blind Review & Fix Loop (`qa.mjs review --batch`)** — `references/review-cards.md`. Independent reviewers (`reviewer != builder`) inspect ONLY rendered images (`unit_contact`/`contact_page`, `shot_strip`, `strips`, HOT `crop`, `card`) and `narration` in `qa/blind_review/unit_Uk.json` (or `slice_1..3.json`) + `RUBRIC.md` (8 checks on 9:16; 10 checks `+ framing`, `+ variety` on `long_16x9`), submitting via `node scripts/qa.mjs review --batch <batch.jsonl>` with verbatim `blind_sha` and mandatory `"shot_strip"`/`"strips"` (and `"crops"` on HOT shots) in `looked`. Fix any `fix` shots → `lint.mjs shots` → `qa.mjs pass --unit Uk` (or `pass changed`).
7. **Sequential Unit Lock (`sv_gate.py pass-unit Uk`) → Final Gate `G5`:**
   - **On `long_16x9`:** write `gates/G5.Uk.review.md` (`verdict: pass`, no `TODO`, ≥ 4-word remark on `Uk_contact.jpg`, `mtime >= qa/units/Uk_contact.jpg`) and run **`python3 scripts/sv_gate.py pass-unit Uk`** (`check-unit Uk` to dry-run). `sv_gate.py` enforces **Strict Sequential Order** (`U2` fails unless `G5.U1` already passed in `gates/log.jsonl`!), segment coverage `[seg_start..seg_end]`, `0` lint errors on `Uk`, valid reviews on all shots in `Uk`, and a `30 s` cooldown before advancing to `U(k+1)`.
   - **Final `G5`:** fill `gates/G5.review.md` (remark on every contact page & strip + ≥ 10% random/HOT cross-check) and run `python3 scripts/sv_gate.py pass G5` (verifies every `G5.U1..G5.Uk` pass record when `units` is declared + all shot hashes, `blind_sha`, and `looked`).

## Rules
- Cut on words, never on seconds. Numbers are only for offsets inside a shot.
- First shot in every set is an establishing frame (`k ≤ 1.2`, unless a Location Pack's `closeup`/`pov` sub-plate after its location is established, `CA-04`).
- Camera moves need a reason; world never shows its edge (`CA-05`); caption band stays clear (`OV-03`).
- If G3 voice changes, anchors move: re-run lint and QA; G5 goes stale automatically. Visual-only fixes preserve `qa/timing.json` so G6 stays valid.
- Open light JPEGs (`*.jpg`, `_v.jpg`); do not edit cast/sets/subjects in G5 (return to sv-20 / G4 if needed).

## Failure → fix
| You see | Do |
|---|---|
| Lint AN-01 / AN-02 anchor error | check `words.json` spelling or add `#1` / `#2` disambiguator |
| Shot too short (`SH-14`) or pacing off (`PC-01..03`, `SH-15`) | merge `< 0.45 s` flash cuts; target `2.0–3.0 s` mean on Shorts or `2.8–6.2 s` multi-scale cuts (`<= 8.0 s`, max `9.5 s`) on `long_16x9` |
| Dollhouse wide streak (`SH-20`) or single-location stall (`SH-21`) | cut every 2–3 wide shots to a Location Pack's drawn `closeup`/`pov`/`insert` plate or `fg: true` OTS (`SH-20`); cross-cut Location Packs (`<= 11` streak) with `tr: 'whipL'\|'whipR'\|'iris'` (`SH-21`) |
| Lint `SH-22` normal vs tiny set bleed | match `SetDef.scaleMode` (`'normal' \| 'tiny'`) to the unit/segment `scale_mode` — never put normal-scale beats on miniature plates or shrunken kids on normal plates |
| Lint `SH-23` premature creature / state bleed | remove out-of-order `SUBJECT` or stateful pose (`firstSeg`, `appearSegs`, `poseSegs`), e.g. no cat before its reveal segment and no sticky tape pose after removal |
| Lint `LA-03` fake zoom or inconsistent creature scale | never zoom `establishing`/`wide` plates `> 1.35×`; keep creature height inside `scaleWithTinyActor` (`<= 1.85×` cross-angle spread across `tiny` sets) and use `partialOf` (`giantCatPaw` / `giantCatHead`) for tight close-ups |
| Lint `PR-09` frozen creature statue / `MO-18` freeze | give every `kind: 'creature'` `SUBJECT` in shots `> 2.2 s` a moving `path` or `>= 2` distinct keyed `pose`/`expr` beats (`PR-09`); lunge/recover attacks in `<= 1.8 s` and add actor beats every `<= 3.4 s` (`MO-18`) |
| Lint `LA-01` / `LA-02` / `LA-04` / `GE-19` | match `actorScale`/`relToActor` (`LA-01`), spread clusters `< 4`/cell (`LA-02`), keep non-`fg` creatures `<= 35%` clipped (`LA-04`), and bleed giant partial limbs off frame edge (`sy0 <= 24`, `GE-19`) |
| Lint `CA-06..08` / `SE-18` / `SH-19` | preserve 2-actor L/R axis or bridge with `wide`/`high`/`ots` (`CA-06`); keep `establishing <= 65%` (`CA-07`); keep `camKeys` monotonic & bounded (`CA-08`); use 3/4 `angle: 'high'` (`SE-18`); keep `night <= 0.7` with `mood: 'danger'` (`SH-19`) |
| Lint `MO-13..17` / `GE-11` / `GE-20` | lock pushes with `pushTarget` (`MO-13`); use `straddle: true` + `grip` + matching `face` (`MO-14`); set `altitude: 160..280` on flyers (`MO-15`, `GE-20`); pack `>= 2` events on `> 5.0 s` shots (`MO-16`); bound `arcH > 0` inside `<= 2.2 s` `legs: 'jump'` (`MO-17`); clear stationary actors off wall signs (`GE-11`) |
| `sv_gate.py check-unit` / `pass-unit` or `G5` fails | complete and lock units strictly in order `U1 → U2 → … → Uk` (`qa.mjs pass --unit Uk` → `qa.mjs review --batch` with `blind_sha` & `shot_strip`/`crops` in `looked` → `gates/G5.Uk.review.md` → `sv_gate.py pass-unit Uk`) |

## Read next
`references/review-cards.md` — cards, crops, the review file and its checks, GE rules, the cross-check.
