---
name: sv-22-shots-camera
description: Break a narrated story-video episode into word-anchored shots — shot sizes, motivated camera moves, set keys, overlays, cut rhythm of about one shot per 2.2 s — write src/shotlist.ts, lint it, render contact sheets and motion strips, review every shot and pass gate G5. Use whenever you write, edit, re-time or review the shotlist of an episode, when a shot "looks wrong", when the voice was re-recorded (anchors move), or when the user asks for a cut, a camera move or an overlay change.
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
- In: G4 passed (cast, sets, geo), `beats.md` segment map, `src/words.json` (from G3).
- Out: `src/shotlist.ts`, `qa/contact_p*.png`, `qa/strips/*.png`, `qa/shots.json`, `gates/G5.review.md`.

## Workflow
1. **Shot plan on paper first.** For each segment, list the words that need a picture (new person, place,
   object, action, twist, punch). Write them as a comment block at the top of each segment's section in
   shotlist.ts: `// s4: Tháng(tag, wide) · Hạnh(label, medium) · thú(bubble, push) · bấm(close, reach) · năm(insert)`.
   Target count: narration seconds ÷ 2.2.
2. **Write shots** segment by segment. Size from the grammar table, cam numbers from the set's grid plate
   (`qa/design/set_<id>_grid.png`), actors from sv-21 recipes, keys on words.
3. **Lint**: `node scripts/lint.mjs shots` until 0 errors. Read every warning; fix it or waive it with a
   reason (`// lint-ok: RULE reason`).
4. **Contact sheets**: `node scripts/qa.mjs contact` → open EVERY `qa/contact_p*.png`. Each shot shows
   two frames (25 % and 75 %). Per shot ask: subject clear? framing intended? nothing cut by the frame
   edge? captions band clear? world edge not visible? same look as the design sheets?
5. **Strips**: `node scripts/qa.mjs strips` → open every `qa/strips/*.png` and apply the sv-21 checklist.
6. **Fix loop**: change, re-lint, re-render only what changed (`node scripts/qa.mjs shot <i>` for one shot,
   `strips <name>` for one strip), look again. Repeat until a full contact pass finds nothing.
7. **Review file** `gates/G5.review.md`: a verdict line for EVERY shot (`#12: medium on Hạnh, bubble reads,
   reach lands on "năm"`), a line per contact page and per strip, waivers justified.
8. **Gate**: `python3 scripts/sv_gate.py pass G5`. (G5 needs no user approval; showing the user a contact
   page is still a good idea on the first episode of a series.)

## Rules
- Cut on words, never on seconds. Numbers are only for offsets inside a shot.
- First shot in every set is an establishing frame (k ≤ 1.2).
- Camera moves need a reason (push = tension, pull = reveal, follow = walk, tilt = height, drift = hold).
- The world never shows its edge (CA-05) and the caption band stays clear (OV-03).
- Every shot has life: a move, an expression change, a gesture, a key, or a moving set element.
- If the voice changes (G3 re-run), anchors move: re-run lint and contact; G5 goes stale automatically.
- Do not touch cast or set code in this phase; if a design is wrong, go back to sv-20 (G4 re-opens).

## Failure → fix
| You see | Do |
|---|---|
| Lint AN-01 word not found | the aligner split or spelled it differently; check words.json for that segment |
| Shot too short (SH-14) | merge into the neighbour or move the anchor one word later |
| Pacing off (PC-01 mean shot 2.0–3.0 s, PC-02 20–28 shots/min, PC-03 p10 ≥ 1.2 s and no hold > 6.5 s; `scripts/pacing.json`) | too slow: split long holds on a word that changes the picture; too fast: merge flash cuts. The approved episodes cut every 2.2–2.8 s |
| Same frame twice in a row | change size ≥ 1.3× or change subject; or drop one shot |
| Empty-looking frame | wrong cam centre (check the grid plate) or the set lacks detail there (back to sv-20) |
| Actor cut by the frame edge during an action (SZ-02) | move cam/cam2 toward the actor or block the action nearer the centre |
| Character tiny while talking (SZ-01) | push to medium (k 1.3–1.8) or scale s up to 1.1 |
| World edge visible (CA-05) | reduce the move or the zoom-out; or extend the set and its `bounds` in sv-20 |
| Action happens between words | anchor the reach/key to the word: `'s6@bấm+0.05'` |
| Contact sheet reads but the story does not | you missed a beat: re-read beats.md, add the insert/reaction shot |
