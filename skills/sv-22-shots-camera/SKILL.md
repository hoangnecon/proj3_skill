---
name: sv-22-shots-camera
description: Break a narrated story-video episode into word-anchored shots — shot sizes, motivated camera moves, set keys, overlays, dual cut pacing (~2.2 s for 9:16 Shorts via shots vs 4.5–9.5 s rich choreographed shots for 16:9 Long-Form via shots_long_16x9 and MO-16) — write src/episode/shotlist.ts, lint it, render contact sheets and motion strips, review every shot and pass gate G5. Use whenever you write, edit, re-time or review the shotlist of an episode, when a shot "looks wrong", when the voice was re-recorded (anchors move), or when the user asks for a cut, a camera move or an overlay change.
---

# sv-22 · Shots and camera (gate G5)

The narration is the clock. Every shot starts on a word (`at: 's4@bấm'`), every action lands on a word,
and cut rhythm follows the episode's pacing band in `standards/pacing.json`:
- **9:16 Shorts (`shots`):** `2.0–3.0 s` mean (`20–28 shots/min`, `p10 ≥ 1.2 s`, `max 6.5 s`, ~1 shot per `2.2 s` — the reference episode *Thang máy* has 67 shots in 153 s).
- **16:9 Long-Form (`shots_long_16x9`):** `4.5–9.5 s` mean (`6.0–14.0 shots/min`, `p10 ≥ 1.6 s`, `max 14.0 s` → **~65–110 rich choreographed shots** for a 10-minute episode instead of 220 choppy static micro-cuts), guarded by **`MO-16`** so every take `> 5.0 s` packs real multi-action animation (`≥ 2` choreography events; `≥ 3` for `> 8.5 s`).
An agent that puts a dead static frame per sentence has failed this skill.

## Read first
1. `references/shot-grammar.md` — benchmarks, shot sizes, camera moves, composition, scene templates.
2. `references/shotlist-api.md` — anchors, every ShotDef field, overlays, waivers.
3. sv-21 `references/actor-api.md` and `acting.md` — for everything actors do.
4. `src/exemplar/shotlist.thang-may.ts.txt` — the reference shotlist (v1 field names, see the migration table).

## Inputs → outputs
- In: G4 passed (cast, sets, geo), `beats.md` segment map, `src/data/words.json` (from G3).
- Out: `src/episode/shotlist.ts`, `qa/contact_p*.jpg`, `qa/strips/*.jpg`, `qa/cards/NN.jpg`, `qa/review/NN.json`,
  `qa/shots.json`, `gates/G5.review.md`.

## Workflow
1. **Shot plan on paper first.** For each segment, list the words that need a picture (new person, place,
   object, action, twist, punch). Write them as a comment block at the top of each segment's section in
   shotlist.ts: `// s4: Tháng(tag, wide) · Hạnh(label, medium) · thú(bubble, push) · bấm(close, reach) · năm(insert)`.
   Target count: **narration seconds ÷ 2.2** for 9:16 Shorts (`shots`), or **~65–110 rich choreographed shots** (`4.5–9.5 s` mean, `6.0–14.0 shots/min`) for 16:9 Long-Form (`shots_long_16x9`, each shot `> 5.0 s` containing `≥ 2` and `> 8.5 s` containing `≥ 3` choreography events per `MO-16`).
2. **Write shots (with `qa.mjs place` zero-rework solver)** segment by segment. Before blocking actors/props on a set, run `node scripts/qa.mjs place <setId>` to print collision-free, `LA-01`-scaled, caption-safe floor slots and recommended camera bounds directly from the set geometry. Size from the grammar table, cam numbers from `qa.mjs place` + the set's grid plate (`qa/design/set_<id>_grid.png`), actors from sv-21 recipes, keys on words.
3. **Pre-Flight Zero-Bounce Gate (BEFORE any render!):** run `node scripts/lint.mjs shots` until **0 errors** (including `MO-10` turnaround squash, `MO-13` invalid/impossible `pushTarget`, `MO-14` missing `SubjectSeat` or contradictory rider facing on mounted creatures, `MO-15` unknown `Actor.fx` keys, `MO-16` Long-Form `> 5.0 s` dead static holds with `0` choreography events, `GE-16` overlay covering > 55% of an actor's head, `LA-01` set `actorScale` & `SUBJECT` `relToActor` scale ratios, `LA-02` 3×3 grid overcrowding `>= 4` clusters or `> 78%` union occupancy, `LA-03` fake close-up camera zoom `> 1.35×`/`1.45×` on `establishing`/`wide` sets, `LA-04` non-`fg` hero creature sliced `> 35%` off frame edge, `CA-07` `long_16x9` shot-size progression banning `> 65%` `establishing` wide-shot monotony, `SH-18` recurring hero creatures lacking `SUBJECTS` multi-pose registration, and `SH-19` `ShotDef.mood` enum validation across `default|morning|golden|danger|lab|flashback|dramatic`). Then resolve every geometry/camera/layout/motion warning — `CA-06` (180° axis / eyeline flip where the same 2 on-screen actors swap left/right screen order across consecutive same-location cuts without a neutral `wide`/`high`/`ots` bridge shot, marks HOT), `CA-07` (`closeup + insert < 10%` on `long_16x9`), `LA-02` (crowded cell `>= 3` clusters or `> 65%` occupancy), `SH-19` (`mood: 'danger'` stacked with `night > 0.7` crushing visibility), `GE-10` (sign edge-clip), `GE-11` (actor/overlay/prop over sign), `GE-15` (prop edge-clip), `GE-16` (overlay `bubble`/`label`/`stamp`/`tag` covering > 20% of an actor's head), `GE-17` (z-aware foreground world prop/creature covering > 35% of an actor's head; mounted riders on `Actor.mount` are excluded), `GE-18` (consecutive wide-shot `cam[2] <= 1.15` cast continuity drop with 0 actors between populated shots on the same set), `MO-11` (reach behind facing / `arms:'raise'` walk), `MO-13` (`push` without `pushTarget`/`reach`, marks HOT on `long_16x9`), `MO-14` (2+ riders on a creature lacking `straddle: true` / `grip`, marks HOT), `MO-15` (fall/trip with zero `fx`/`shake`, or `fly`/`hover` extra missing `altitude`), `MO-16` (`long_16x9` shot `> 5.0 s` with `< 2` choreography events or `> 8.5 s` with `< 3` events), `GE-01`, `GE-04`, `GE-07` — using `node scripts/qa.mjs layout` (compact 1-line-per-shot 3×3 grid, occupancy%, scale & cutoff table across ALL shots in ~1 s, zero browser!) and `node scripts/qa.mjs where <i>` (exact frame boxes, 3×3 Grid Occupancy Matrix `A1..C3`, `LA-01`/`LA-04` flags, `CAPTION` head/hand/hero-prop clearance, and `--free WxH` open regions) before rendering a single frame. `lint.mjs shots` also writes `qa/layout_report.json` (verified clean by `sv_gate.py check G5`).
   - **Studio 2D animation & contact physics (`v5.0.0`, `src/anim.ts`):** Grounded actors and `SUBJECTS` automatically cast altitude-responsive `GroundShadow`s; use `Actor.arcH` for parabolic jump arcs, `Actor.pushTarget: [tx, ty]` to IK-lock pushing hands (`MO-13`), `Actor.wind` + `Actor.fx` (`'dust' | 'sweat' | 'speed' | 'impact' | 'stars'`, `MO-15`) for secondary motion & impact weight, `ExtraDef.altitude` (`160..280`) for flying/hovering shadows (`MO-15`), and `SubjectSeat.straddle` / `grip` / `wind` for 3-layer creature mounting (`MO-14`).
   - **Atmospheric lighting & depth (`v4.4.0`):** Use `ShotDef.mood` (`'default' | 'morning' | 'golden' | 'danger' | 'lab' | 'flashback' | 'dramatic'`, validated by `SH-19`) for lightweight PAL-token atmospheric color grading and `ShotDef.dof: true` for subtle far-layer (`d = 0.5`) depth-separation haze behind midground actors. The engine paints static riso paper grain (`url(#grainPat)`) instead of per-frame `<feTurbulence>`, and `deliver.mjs` renders shot-aligned macro-blocks (`SV_CHUNK_FRAMES`, default `1050` frames ≈ 35 s) for fast G7 delivery.
   - **Staging pitfall checklist:** verify `flip: true` points `pointL`/`pointR` toward the subject (not off-screen); never reach behind `face` or walk with `arms: 'raise'` (`MO-11`); never air-push without `pushTarget`/`reach` (`MO-13`); never paste flat or opposite-facing riders on a creature (`MO-14`); always set `altitude` on `fly`/`hover` extras and `fx`/`shake` on falls (`MO-15`); animate vehicle `x` (or set `keys`) whenever narration says a vehicle moves/rolls out; keep 2-actor screen left/right order consistent across dialogue cuts or insert a neutral `wide`/`high`/`ots` bridge shot (`CA-06`); avoid stacking `mood: 'danger'` with `night > 0.7` (`SH-19`).
4. **Single-Bundle QA Pass (`qa.mjs pass`):** run `node scripts/qa.mjs pass changed` (or `node scripts/qa.mjs pass all` only if forcing a full re-render). Under ONE Remotion bundle and ONE browser session, it renders incremental `contact_p*.jpg`, stale `strips/*.jpg`, `cards/*.jpg`, and `crops/*.jpg` for every HOT shot with `crops_ok === false`, runs `carry.py`, and calls `scripts/blind_pack.mjs` to emit `qa/blind_review/{manifest.json, slice_1.json, slice_2.json, slice_3.json, RUBRIC.md}` with per-shot `blind_sha` tokens, enriched layout metrics (3×3 occupancy, scale/cutoff flags, `shotScale`, `set_streak`), and the **Pasted-Sticker Anti-Pattern Check** under `acting` and `contact`.
5. **Inspect Contact & Strips:** open EVERY `qa/contact_p*.jpg` (light JPEGs, ~300 KB; changed shots carry a ●) and every `qa/strips/*.jpg` (full frames, 2 rows, sv-21 checklist). Look at rhythm, continuity, human-scale proportions, and design sheets.
6. **Per-shot blind review (3-way slices + `blind_sha` anti-bypass protocol)** — `references/review-cards.md`. Three independent REVIEWERS who did not build the shots each take one slice (`qa/blind_review/slice_1.json`, `slice_2.json`, `slice_3.json`) plus `qa/blind_review/RUBRIC.md`. Reviewers judge ONLY from the rendered images (`card`, `crop`, `contact_page`, `strips`) and `narration` in their slice — never `shotlist.ts` or coordinates — check all 8 items (including Human-Scale & Staging), and write batches via `node scripts/qa.mjs review --batch <batch.jsonl>` including each shot's `"blind_sha"` verbatim. Both `qa.mjs review` and `sv_gate.py pass G5` reject any review missing or mismatching `blind_sha` against `qa/blind_review/manifest.json`.
   **After any later change** (a fix, a helper edit, a re-made voice): run `node scripts/qa.mjs pass changed` BEFORE briefing reviewers. It re-bundles once, updates only changed cards/crops/strips, runs `scripts/carry.py` (keeping pixel-identical and valid retimed reviews), and prints the exact `qa/carry.json` re-review list.
   **Episode reviewed under v3.6** (every hash changes once on upgrade): FIRST `node scripts/qa.mjs adopt`, THEN `node scripts/qa.mjs pass all`.
7. **Fix loop** (only the shots marked `fix`): change → `node scripts/lint.mjs shots` + `node scripts/qa.mjs where <i>` → `node scripts/qa.mjs pass changed` (or `qa.mjs shot <i>` for a quick 1-shot check, then `pass changed` before handing to reviewers). At most 3 tries per shot, then escalate (re-stage the shot or ask the user). A full `pass all` at most twice per episode.
8. **Review file** `gates/G5.review.md`: a line per contact page and per strip (≥ 4 words of what you saw),
   waivers justified, plus the cross-check: the conductor re-opens ≥ 10 % of the cards at random (all HOT
   ones included) and names them.
9. **Gate**: `python3 scripts/sv_gate.py pass G5`. It reads every `qa/review/NN.json`: present, made for the
   shot's CURRENT hash (or carried to it — the gate re-checks every carry from the snapshots), reviewer ≠
   builder, all checks ok, crops opened for HOT shots. (G5 needs no user
   approval; showing the user a contact page is still a good idea on the first episode of a series.)

## Rules
- Cut on words, never on seconds. Numbers are only for offsets inside a shot.
- First shot in every set is an establishing frame (k ≤ 1.2).
- Camera moves need a reason (push = tension, pull = reveal, follow = walk, tilt = height, drift = hold).
- The world never shows its edge (CA-05) and the caption band stays clear (OV-03).
- Every shot has life: a move, an expression change, a gesture, a key, or a moving set element.
- If the voice changes (G3 re-run), anchors move: re-run lint and contact; G5 goes stale automatically.
- A visual-only fix (pose, prop, set detail, camera) does not change `qa/timing.json`, so the mix (G6) stays
  valid; only a fix that moves cut times or keys sends you back to the mix.
- Open the light JPEGs (`*.jpg`, `_v.jpg`), never the multi-MB PNG masters, unless you zoom into one spot.
- Do not touch cast or set code in this phase; if a design is wrong, go back to sv-20 (G4 re-opens).

## Failure → fix
| You see | Do |
|---|---|
| Lint AN-01 word not found | the aligner split or spelled it differently; check words.json for that segment |
| Shot too short (SH-14) | merge into the neighbour or move the anchor one word later |
| Pacing off (`PC-01..03`, `standards/pacing.json`: 9:16 Shorts `shots` = `2.0–3.0 s` mean, `20–28 shots/min`, `p10 ≥ 1.2 s`, `max 6.5 s`; 16:9 Long-Form `shots_long_16x9` = `4.5–9.5 s` mean, `6.0–14.0 shots/min`, `p10 ≥ 1.6 s`, `max 14.0 s`) | for Shorts: split long holds or merge flash cuts to land near `2.2–2.8 s`; for Long-Form: merge choppy static micro-cuts into `65–110` rich multi-action takes (cut on location/angle/beat turns, keep takes `> 5.0 s` alive per `MO-16`) |
| Same frame twice in a row | change size ≥ 1.3× or change subject; or drop one shot |
| Empty-looking frame | wrong cam centre (check the grid plate) or the set lacks detail there (back to sv-20) |
| Actor cut by the frame edge during an action (SZ-02) | move cam/cam2 toward the actor or block the action nearer the centre |
| Character tiny while talking (SZ-01) | push to medium (k 1.3–1.8) or scale s up to 1.1 |
| World edge visible (CA-05) | reduce the move or the zoom-out; or extend the set and its `bounds` in sv-20 |
| 180° axis flip (`CA-06`) | preserve left/right screen order of the 2 actors across same-location cuts, or insert a neutral `wide`/`high`/`ots` bridge shot |
| Wide-shot monotony / few close-ups (`CA-07`) | keep `establishing` sets `<= 65%` of `long_16x9` shots and add `>= 10%` drawn `closeup`/`insert` sub-scene plates for emotional beats |
| Action happens between words | anchor the reach/key to the word: `'s6@bấm+0.05'` |
| Contact sheet reads but the story does not | you missed a beat: re-read beats.md, add the insert/reaction shot |
| Scale mismatch (`LA-01`) | match actor `s` to the set's `actorScale [minS, maxS]` and Hero Subject scale to `relToActor [minR, maxR]`; inspect via `node scripts/qa.mjs layout <i>` |
| Cluttered frame (`LA-02`) | spread subjects across distinct 3×3 grid cells (`A1..C3`), attach riders with `Actor.mount` (counted as one cluster), or split dense beats into 2 shots (`< 4` clusters/cell, `<= 78%` occupancy) |
| Fake close-up zoom (`LA-03`) | never zoom an `establishing`/`wide` set past `1.35×` (`cam2 > 1.45×`); cut to a dedicated `medium` or `closeup` sub-scene plate (`SetDef.shotScale`) |
| Awkwardly sliced hero creature (`LA-04`) | re-frame creature inside the canvas (`<= 35%` edge clip), switch to a dedicated closeup pose, or mark `fg: true` if intentional foreground framing |
| Static creature reuse (`SH-18`) | register recurring creatures/bosses/vehicles in `src/episode/subjects.tsx` (`SUBJECTS`) with `>= 4` poses (`PR-06`) and vary `pose` across shots |
| Invalid or over-dark mood (`SH-19`) | use one of `default\|morning\|golden\|danger\|lab\|flashback\|dramatic` on `ShotDef.mood`; keep `night <= 0.7` when using `mood: 'danger'` |
| Air-pushing / unreachable push (`MO-13`) | supply `pushTarget: [tx, ty]` (or `reach`) within real arm reach (`<= 280 * H * s * 1.15`) whenever using `p: 'push'` or `legs: 'push'` |
| Flat or opposing mounted riders (`MO-14`) | add `straddle: true`, `grip: [gx, gy]`, and `wind` on `SubjectSeat`, verify seat exists, and match all riders' `face` to travel direction |
| Weightless fall / flying creature without shadow (`MO-15`) | validate `fx` keys (`dust\|sweat\|speed\|impact\|stars`), add `fx: ['impact', 'stars']` or `['dust']` on falls/trips, and set `altitude: 160..280` on `fly`/`hover` extras |
| Dead or sparse Long-Form shot (`MO-16`) | on `long_16x9`, every shot `> 5.0 s` needs `>= 1` (ERROR if `0`) and target `>= 2` choreography events (`>= 3` for `> 8.5 s`): layer motivated `cam2`, set `keys`, `path`/`arcH`/`mount`/`pushTarget`/`reach`, keyed `p`/`e`/`view`/`face`/`legs`/`arms`, `fx`/`wind`, or animated `extras` |

## Read next
`references/review-cards.md` — cards, crops, the review file and its 8 checks, GE rules, the cross-check.
