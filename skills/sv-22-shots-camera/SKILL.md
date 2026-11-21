---
name: sv-22-shots-camera
description: Break a narrated story-video episode into word-anchored shots — shot sizes, motivated camera moves, set keys, overlays, cut rhythm of about one shot per 2.2 s — write src/episode/shotlist.ts, lint it, render contact sheets and motion strips, review every shot and pass gate G5. Use whenever you write, edit, re-time or review the shotlist of an episode, when a shot "looks wrong", when the voice was re-recorded (anchors move), or when the user asks for a cut, a camera move or an overlay change.
---

# sv-22 · Shots and camera (gate G5)

The narration is the clock. Every shot starts on a word (`at: 's4@bấm'`), every action lands on a word,
and the picture changes about every 2.2 s. The reference episode has 67 shots in 153 s, and that density
is why it holds attention. An agent that puts one wide frame per sentence has failed this skill.

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
   Target count: narration seconds ÷ 2.2.
2. **Write shots** segment by segment. Size from the grammar table, cam numbers from the set's grid plate
   (`qa/design/set_<id>_grid.png`), actors from sv-21 recipes, keys on words.
3. **Pre-Flight Zero-Bounce Gate (BEFORE any render!):** run `node scripts/lint.mjs shots` until **0 errors** (including `MO-10` turnaround squash, `GE-16` overlay covering > 55% of an actor's head, `LA-01` set `actorScale` & `SUBJECT` `relToActor` scale ratios, `LA-02` 3×3 grid overcrowding `>= 4` clusters or `> 78%` union occupancy, `LA-03` fake close-up camera zoom `> 1.35×`/`1.45×` on `establishing`/`wide` sets, `LA-04` non-`fg` hero creature sliced `> 35%` off frame edge, and `SH-18` recurring hero creatures lacking `SUBJECTS` multi-pose registration). Then resolve every geometry/layout/motion warning — `LA-02` (crowded cell `>= 3` clusters or `> 65%` occupancy), `GE-10` (sign edge-clip), `GE-11` (actor/overlay/prop over sign), `GE-15` (prop edge-clip), `GE-16` (overlay `bubble`/`label`/`stamp`/`tag` covering > 20% of an actor's head), `GE-17` (z-aware foreground world prop/creature covering > 35% of an actor's head; mounted riders on `Actor.mount` are excluded), `GE-18` (consecutive wide-shot `cam[2] <= 1.15` cast continuity drop with 0 actors between populated shots on the same set), `MO-11` (reach behind facing / `arms:'raise'` walk), `GE-01`, `GE-04`, `GE-07` — using `node scripts/qa.mjs layout` (compact 1-line-per-shot 3×3 grid, occupancy%, scale & cutoff table across ALL shots in ~1 s, zero browser!) and `node scripts/qa.mjs where <i>` (exact frame boxes, 3×3 Grid Occupancy Matrix `A1..C3`, `LA-01`/`LA-04` flags, `CAPTION` head/hand/hero-prop clearance, and `--free WxH` open regions) before rendering a single frame. `lint.mjs shots` also writes `qa/layout_report.json`.
   - **Staging pitfall checklist:** verify `flip: true` points `pointL`/`pointR` toward the subject (not off-screen); never reach behind `face` or walk with `arms: 'raise'` (`MO-11`); animate vehicle `x` (or set `keys`) whenever narration says a vehicle moves/rolls out.
4. **Single-Bundle QA Pass (`qa.mjs pass`):** run `node scripts/qa.mjs pass changed` (or `node scripts/qa.mjs pass all` only if forcing a full re-render). Under ONE Remotion bundle and ONE browser session, it renders incremental `contact_p*.jpg`, stale `strips/*.jpg`, `cards/*.jpg`, and `crops/*.jpg` for every HOT shot with `crops_ok === false`, runs `carry.py`, and calls `scripts/blind_pack.mjs` to emit `qa/blind_review/{manifest.json, slice_1.json, slice_2.json, slice_3.json, RUBRIC.md}` with per-shot `blind_sha` tokens.
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
| Pacing off (PC-01 mean shot 2.0–3.0 s, PC-02 20–28 shots/min, PC-03 p10 ≥ 1.2 s and no hold > 6.5 s; `standards/pacing.json`) | too slow: split long holds on a word that changes the picture; too fast: merge flash cuts. The approved episodes cut every 2.2–2.8 s |
| Same frame twice in a row | change size ≥ 1.3× or change subject; or drop one shot |
| Empty-looking frame | wrong cam centre (check the grid plate) or the set lacks detail there (back to sv-20) |
| Actor cut by the frame edge during an action (SZ-02) | move cam/cam2 toward the actor or block the action nearer the centre |
| Character tiny while talking (SZ-01) | push to medium (k 1.3–1.8) or scale s up to 1.1 |
| World edge visible (CA-05) | reduce the move or the zoom-out; or extend the set and its `bounds` in sv-20 |
| Action happens between words | anchor the reach/key to the word: `'s6@bấm+0.05'` |
| Contact sheet reads but the story does not | you missed a beat: re-read beats.md, add the insert/reaction shot |
| Scale mismatch (`LA-01`) | match actor `s` to the set's `actorScale [minS, maxS]` and Hero Subject scale to `relToActor [minR, maxR]`; inspect via `node scripts/qa.mjs layout <i>` |
| Cluttered frame (`LA-02`) | spread subjects across distinct 3×3 grid cells (`A1..C3`), attach riders with `Actor.mount` (counted as one cluster), or split dense beats into 2 shots (`< 4` clusters/cell, `<= 78%` occupancy) |
| Fake close-up zoom (`LA-03`) | never zoom an `establishing`/`wide` set past `1.35×` (`cam2 > 1.45×`); cut to a dedicated `medium` or `closeup` sub-scene plate (`SetDef.shotScale`) |
| Awkwardly sliced hero creature (`LA-04`) | re-frame creature inside the canvas (`<= 35%` edge clip), switch to a dedicated closeup pose, or mark `fg: true` if intentional foreground framing |
| Static creature reuse (`SH-18`) | register recurring creatures/bosses/vehicles in `src/episode/subjects.tsx` (`SUBJECTS`) with `>= 4` poses (`PR-06`) and vary `pose` across shots |

## Read next
`references/review-cards.md` — cards, crops, the review file and its 8 checks, GE rules, the cross-check.
