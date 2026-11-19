# Per-shot review: cards, crops, review files

The contact sheet shows the whole film at a glance, but small shots hide their faults there: a hand that
misses the bell, a foot floating over the floor, two bodies merging, a face under the caption. The per-shot
review makes someone look at **each** shot on its own and answer fixed questions. Asking the reviewer to name
a shot ("look at #23") reliably finds these faults.

## The loop
1. **Pre-flight zero-bounce gate**: `node scripts/lint.mjs shots` (0 errors, resolve `GE-10`/`GE-11`/`GE-15`/`MO-10` with `node scripts/qa.mjs where <i>`). It writes `qa/hot.json` (GE warning, reach, or set key).
2. `node scripts/qa.mjs pass changed` (one Remotion bundle for `contact`, stale `strips`, `cards`, HOT `crops`, plus `carry.py`!). Each card (`qa/cards/NN.jpg`, ~100 KB) holds 3 frames (15 / 50 / 85 %), spoken words, shot hash, and HOT flags; each HOT crop (`qa/crops/NN.jpg`) gives 1:1+ crops of head, hands, feet, and overlaps.
3. A reviewer opens each card in `qa/carry.json` → `review` (plus `qa/crops/NN.jpg` for HOT shots), answers the 8 checks, and writes the batch in one command via `node scripts/qa.mjs review --batch <batch.jsonl>` (validates hash, `reviewer != builder`, all 8 checks, `note >= 6` words, and HOT `"crops"`).
4. Shots marked `fix` go back to the builder (`sv-22` fix loop → `qa.mjs pass changed`), then the reviewer re-reviews only those cards.

## The review file (`qa/review/07.json`)
```json
{
  "shot": 7,
  "hash": "e3f5166dfa60",
  "builder": "builder-1",
  "reviewer": "reviewer-2",
  "looked": ["card", "crops"],
  "verdict": "ok",
  "checks": {
    "acting":  "ok — Nhím flinches on 'hắt', eyes shut, shoulders up",
    "contact": "ok — barber's hand on the horn in crop 2, feet planted",
    "overlap": "ok — Bảo in front, the two outlines separate",
    "set":     "ok — price board readable, mirror and chair present",
    "text":    "ok — no typo, sign readable at this zoom",
    "caption": "ok — faces above the band",
    "beat":    "ok — the cut lands on 'giũa', the shot shows the horn",
    "model":   "ok — Nhím and the barber match cast_episode_p1 (hair, glasses, apron), drawn by the rig"
  },
  "note": "horn filing reads in two frames; barber reach lands, mirror reflects"
}
```
- `hash` is copied from the card title. If the shot changes after the review, its hash changes and the gate
  asks for a new review.
- A check that fails reads `"fix — <what is wrong, where, what to change>"`, and `verdict` is `"fix"`.
- `note` is at least 6 words about what you actually saw. Do not write "looks good".
- `looked` must include `"crops"` for a HOT shot, and the crops must be current (`qa.mjs status`).

## The 8 checks
| check | question |
|---|---|
| acting | Does the pose and expression say the beat? Does someone react? Is it the right person? |
| contact | Is the hand ON the target (not near it)? Are feet ON the floor, not sliding or floating? Is the prop held in the hand? **Staging:** when narration puts characters inside a vehicle (`goKart`, `fireTruckCab`) or tucked in bed (`o.sleeping`), are they visibly seated/tucked inside (foreground cowl/blanket in front of legs), never hovering outside? |
| overlap | Are two actors or props merged into one blob? Is the layer order wrong? Is a face covered? |
| set | Is it the right set, at v1 density? Is the hero object readable? Is no world edge visible? **Human-Scale:** are vehicles, doors, beds, and carts proportional to `575 px` adults and `435 px` children, with zero clipped close-up `WORLD_PROPS`? |
| text | Is every sign or overlay spelled right and readable at this zoom? Is no text cut off at frame edges or occluded by an actor/overlay? |
| caption | Faces, hands, badges, and hero props must stay clear of `y = 1570–1710`; lower legs/shoes of full-body standing actors passing behind the bottom caption are NORMAL and NOT a `fix`. |
| beat | Does the picture show what the words say at that moment? Does the cut land on the word? |
| model | Open the cast sheet (`qa/design/cast_episode_p*_v.jpg`) and prop sheet (`qa/design/props_episode_p*_v.jpg`) next to the card. Is every character the cast rig, on model — same face, hair, outfit, proportions, and scale vs props/vehicles? A person drawn as a prop (own head, own face, stiff body, wrong hair) is a `fix`, even for a fade / ghost / sleep effect: those are `<Person>` with opacity, clipPath or a pose. |

## Geometry rules (lint, from the shot table, no render)
| rule | measures | typical fix |
|---|---|---|
| GE-01 | two actors' bodies overlap > 25 % of the smaller one | spread x, change the layer order (y), or stage one behind on purpose and say so |
| GE-04 | > ¼ of a head is outside the frame, or a face sits in the caption band | move cam cy/k, or move the actor's y |
| GE-07 | same actor, same set, consecutive cut, size ratio 1.25–1.6× | make it a real punch (≥ 1.6×) or a match (≤ 1.1×) |
| GE-10 | set or `WORLD_PROP` sign partially clipped across frame edge | shift `cam` `cx` or adjust zoom `k` using `qa.mjs where <i>` |
| GE-11 | actor, overlay, or `WORLD_PROP` covers > 20–25 % of a readable set/prop sign | shift actor/prop `x` or move overlay into `--free WxH` region |
| GE-15 | close-up/foreground `WORLD_PROP` clipped > 15 % off frame edge | nudge prop `x` or camera `cx` inward using `qa.mjs where <i>` |

The boxes are estimates: camera shake and path easing are ignored. A GE warning means "look at the crops",
not "this is wrong". Waive it (`// lint-ok: GE-01 hug on purpose`) only after looking.

## Cross-check (against rubber-stamping)
The conductor re-opens at least 10 % of the cards at random, plus every HOT one, and names them in
`gates/G5.review.md`. If a re-opened card shows a fault the reviewer passed, that reviewer's whole batch is
reviewed again.
