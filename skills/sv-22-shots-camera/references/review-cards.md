# Per-shot review: cards, crops, review files

The contact sheet shows the whole film at a glance, but small shots hide their faults there: a hand that
misses the bell, a foot floating over the floor, two bodies merging, a face under the caption. The per-shot
review makes someone look at **each** shot on its own and answer fixed questions. Asking the reviewer to name
a shot ("look at #23") reliably finds these faults.

## The loop
1. `node scripts/lint.mjs shots` writes `qa/hot.json`. A shot is HOT when it has a GE warning (overlap, head
   cut, face in the caption band, size jump), a reach or a set key.
2. `node scripts/qa.mjs cards changed` (`all` the first time) writes `qa/cards/NN.jpg`. Each card is about
   100 KB and holds 3 frames (15 / 50 / 85 %), the words spoken over the shot, the shot hash and its HOT flags.
3. For every HOT shot, run `node scripts/qa.mjs crops <i>`, which writes `qa/crops/NN.jpg`. It renders at full
   resolution at mid-shot, at each reach contact and at the first key. You get crops of each actor's head,
   hands and feet, plus every overlap between two actors, at 1:1 or larger. The small frame on the left of
   each row shows where every crop was taken.
4. A reviewer writes `qa/review/NN.json` for each card, in parallel batches of about 10 shots per reviewer.
5. Shots marked `fix` go back to the builder (sv-22 fix loop). The reviewer then re-reviews only those cards.

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
    "beat":    "ok — the cut lands on 'giũa', the shot shows the horn"
  },
  "note": "horn filing reads in two frames; barber reach lands, mirror reflects"
}
```
- `hash` is copied from the card title. If the shot changes after the review, its hash changes and the gate
  asks for a new review.
- A check that fails reads `"fix — <what is wrong, where, what to change>"`, and `verdict` is `"fix"`.
- `note` is at least 6 words about what you actually saw. Do not write "looks good".
- `looked` must include `"crops"` for a HOT shot, and the crops must be current (`qa.mjs status`).

## The 7 checks
| check | question |
|---|---|
| acting | Does the pose and expression say the beat? Does someone react? Is it the right person? |
| contact | Is the hand ON the target (not near it)? Are feet ON the floor, not sliding or floating? Is the prop held in the hand? |
| overlap | Are two actors or props merged into one blob? Is the layer order wrong? Is a face covered? |
| set | Is it the right set, at v1 density? Is the hero object readable? Is no world edge visible? |
| text | Is every sign or overlay spelled right and readable at this zoom? Is no text cut off? |
| caption | Are faces, hands and the hero object clear of the caption band (y ≈ 1570–1710)? |
| beat | Does the picture show what the words say at that moment? Does the cut land on the word? |

## Geometry rules (lint, from the shot table, no render)
| rule | measures | typical fix |
|---|---|---|
| GE-01 | two actors' bodies overlap > 25 % of the smaller one | spread x, change the layer order (y), or stage one behind on purpose and say so |
| GE-04 | > ¼ of a head is outside the frame, or a face sits in the caption band | move cam cy/k, or move the actor's y |
| GE-07 | same actor, same set, consecutive cut, size ratio 1.25–1.6× | make it a real punch (≥ 1.6×) or a match (≤ 1.1×) |

The boxes are estimates: camera shake and path easing are ignored. A GE warning means "look at the crops",
not "this is wrong". Waive it (`// lint-ok: GE-01 hug on purpose`) only after looking.

## Cross-check (against rubber-stamping)
The conductor re-opens at least 10 % of the cards at random, plus every HOT one, and names them in
`gates/G5.review.md`. If a re-opened card shows a fault the reviewer passed, that reviewer's whole batch is
reviewed again.
