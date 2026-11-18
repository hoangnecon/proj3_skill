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
3. **Lint**: `node scripts/lint.mjs shots` until 0 errors. Read every warning; fix it or waive it with a
   reason (`// lint-ok: RULE reason`). The geometry rules (GE-01 overlap, GE-04 head cut / face in the
   caption band, GE-07 size jump) measure the frame from the shot table and mark shots HOT in `qa/hot.json`
   (reaches and set keys are HOT too).
4. **Contact sheets**: `node scripts/qa.mjs contact` → open EVERY `qa/contact_p*.jpg` (light JPEGs, ~300 KB).
   Only shots whose hash changed are re-rendered; they carry a ● and are listed in `qa/changed.json`.
   Look at the whole film once: rhythm, continuity, look against the design sheets.
5. **Strips**: `node scripts/qa.mjs strips` → open every `qa/strips/*.jpg` (full frames, 2 rows) and apply
   the sv-21 checklist.
6. **Per-shot review (cards)** — `references/review-cards.md`. `node scripts/qa.mjs cards changed` (or `all`
   the first time) → one card per shot. A REVIEWER who did not build the shots opens each card, and for every
   HOT shot also `node scripts/qa.mjs crops <i>` (full-resolution head / hands / feet / overlap crops), then
   writes `qa/review/NN.json` answering the 7 checks. Reviewers run in parallel batches of ~10 shots.
   **After any later change** (a fix, a helper edit, a re-made voice): `node scripts/qa.mjs cards changed`,
   then `python3 scripts/carry.py` BEFORE briefing reviewers. It keeps the reviews of shots whose picture did
   not change (≤ 20 pixels differ on each card frame) and of shots that were only retimed (same definition,
   same words, start ±0.3 s, length ±10 %; HOT shots also need the same picture at their reach / key moments —
   run `crops <i>` when it asks). Only `qa/carry.json` → `review` goes back to reviewers. The shot hash
   (`scripts/deps.mjs`) covers only what the shot draws, so an edit to one prop or set stales only its shots.
   **Episode reviewed under v3.6** (every hash changes once on upgrade): FIRST `node scripts/qa.mjs adopt`
   (snapshots the card frames each review saw — only for shots unchanged since their review), THEN
   `cards all` and `carry.py`: reviews whose card frames are the same picture are kept (`adopt`).
7. **Fix loop** (only the shots marked `fix`): change → `node scripts/lint.mjs shots` → `node scripts/qa.mjs
   shot <i>` (and `crops <i>` if HOT) → look → the reviewer re-reviews that card. At most 3 tries per shot,
   then escalate (re-stage the shot or ask the user). Re-run `contact` (incremental) at the end; a full
   `--all` contact pass at most twice per episode.
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

## Read next
`references/review-cards.md` — cards, crops, the review file and its 7 checks, GE rules, the cross-check.
