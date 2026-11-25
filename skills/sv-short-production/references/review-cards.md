# Per-shot review: cards, crops, review files

The contact sheet shows the whole film at a glance, but small shots hide their faults there: a hand that
misses the bell, a foot floating over the floor, two bodies merging, a face under the caption. The per-shot
review makes someone look at **each** shot on its own and answer fixed questions. Asking the reviewer to name
a shot ("look at #23") reliably finds these faults.

## The loop
1. **Pre-flight zero-bounce gate**: `node scripts/lint.mjs shots` (0 errors, resolve `GE-10`/`GE-11`/`GE-15`/`MO-10` with `node scripts/qa.mjs where <i>`). It writes `qa/hot.json` (GE warning, reach, or set key).
2. `node scripts/qa.mjs pass changed` (one Remotion bundle for `contact`, stale `strips`, `cards`, HOT `crops`, plus `carry.py`!). Each card (`qa/cards/NN.jpg`, ~100 KB) holds 3 frames (15 / 50 / 85 %), spoken words, shot hash, and HOT flags; each HOT crop (`qa/crops/NN.jpg`) gives 1:1+ crops of head, hands, feet, and overlaps.
3. A reviewer opens each card in `qa/carry.json` → `review` (plus `qa/crops/NN.jpg` for HOT shots), checks `context_window.prev_shot`/`next_shot`, answers all 9 checks (11 for Long 16:9), and submits in one command via `python scripts/sv_cli.py review submit --batch <batch.jsonl>` (validates hash, `blind_sha`, `reviewer != builder`, all checks, `note >= 6` words, and HOT `"crops"`).
4. Shots marked `fix` go back to the executor (`qa.mjs pass changed`), then the reviewer re-reviews only those cards.

## The review file (`qa/review/07.json`)
```json
{
  "shot": 7,
  "hash": "e3f5166dfa60",
  "blind_sha": "a1b2c3d4e5f6",
  "builder": "exec-shots",
  "reviewer": "rev-1",
  "looked": ["contact", "card", "crops"],
  "verdict": "ok",
  "checks": {
    "acting":     "ok — Nhím flinches on 'hắt', eyes shut, shoulders up",
    "contact":    "ok — barber's hand on the horn in crop 2, feet planted",
    "overlap":    "ok — Bảo in front, the two outlines separate",
    "set":        "ok — price board readable, mirror and chair present",
    "text":       "ok — no typo, sign readable at this zoom",
    "caption":    "ok — faces above the band",
    "beat":       "ok — the cut lands on 'giũa', the shot shows the horn",
    "model":      "ok — Nhím and the barber match cast_episode_p1, drawn by the rig",
    "continuity": "ok — distance and prop state follow shot 06 cleanly; ground objects sit on floor"
  },
  "note": "horn filing reads in two frames; barber reach lands, mirror reflects"
}
```
- `hash` and `blind_sha` are copied verbatim from `qa/blind_review/slice_*.json` (or `unit_*.json`). If the shot changes after the review, its hash changes and the gate asks for a new review.
- A check that fails reads `"fix — <what is wrong, where, what to change>"`, and `verdict` is `"fix"`.
- `note` is at least 6 words about what you actually saw. Do not write "looks good".
- `looked` must include `"crops"` for a HOT shot, and `"shot_strip"`/`"strips"` whenever motion strips exist.

## The 9 core checks (+ `framing`, `variety` on Long 16:9)
| check | question |
|---|---|
| acting | Does the pose and expression say the beat? Does someone react? Is it the right person? |
| contact | Is the hand ON the target (not near it)? Are feet ON the floor, not sliding or floating? Is the prop held in the hand? Are seated/mounted characters physically inside/on their seat? |
| overlap | Are two actors or props merged into one blob? Is the layer order wrong? Is a face covered? |
| set | Is it the right set, at v1 density? Is the hero object readable? Is no world edge visible? Are objects human-scale proportional? |
| text | Is every sign or overlay spelled right and readable at this zoom? Is no text cut off at frame edges or occluded? |
| caption | Faces, hands, badges, and hero props must stay clear of the caption band; lower legs/shoes passing behind bottom captions are normal. |
| beat | Does the picture show what the words say at that moment? Does the cut land on the word? |
| model | Open `qa/design/cast_episode_p*_v.jpg` and `qa/design/props_episode_p*_v.jpg` next to the card. Is every character the cast rig, on model? |
| continuity | Compare against `context_window.prev_shot` and `next_shot`: do physical distances, chronological before/after order vs spoken narration, persistent operators on moving vehicles/props, floor grounding (`GE-21`), and absence of disembodied wide-shot limbs (`PR-10`) hold cleanly? |

## Geometry & Placement CI Rules (lint, from the shot table, no render)
| rule | measures | typical fix |
|---|---|---|
| GE-01 | two actors' bodies overlap > 25 % of the smaller one | spread x, change layer order (y), or stage intentionally |
| GE-04 | > ¼ of a head is outside the frame, or a face sits in the caption band | move cam cy/k, or move the actor's y |
| GE-07 | same actor, same set, consecutive cut, size ratio 1.25–1.6× | make it a real punch (≥ 1.6×) or a match (≤ 1.1×) |
| GE-10 | set or `WORLD_PROP` sign partially clipped across frame edge | shift `cam` `cx` or adjust zoom `k` using `qa.mjs where <i>` |
| GE-11 | actor, overlay, or `WORLD_PROP` covers > 20–25 % of a readable set/prop sign | shift actor/prop `x` or move overlay into `--free WxH` region |
| GE-15 | close-up/foreground `WORLD_PROP` clipped > 15 % off frame edge | nudge prop `x` or camera `cx` inward using `qa.mjs where <i>` |
| GE-21 | ground-bound `SUBJECT` (`vehicle`/`creature`/`machine`) anchored > 90 px above set floor plane without airborne pose/altitude | anchor `y` and `path` waypoints onto the set floor lane (`zones.mgY`) or declare `airborne`/`altitude` |
| PR-10 | partial-body asset (`partialOf` or limb/hand/foot key) placed in wide/medium set alongside full `<Person>` actor | move to dedicated `closeup`/`insert` plate or animate the `<Person>`'s own arm/hand |

The boxes are estimates: camera shake and path easing are ignored. A GE warning means "look at the crops",
not "this is wrong". Waive it (`// lint-ok: GE-01 hug on purpose`) only after looking.

## Cross-check (against rubber-stamping)
The conductor re-opens at least 10 % of the cards at random, plus every HOT one, and names them in
`gates/G5.review.md`. If a re-opened card shows a fault the reviewer passed, that reviewer's whole batch is
reviewed again.
