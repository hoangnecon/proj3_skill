---
name: sv-21-motion
description: Animate characters in a story-video episode with readable, physically believable motion — profile walks with planted feet and speed by character, reach-and-press with anticipation, sitting down, piggyback, turning, talking, expression and pose keys anchored to narration words — and verify every action with frame strips. Use whenever you write or change actors in src/episode/shotlist.ts (path, reach, legs, arms, ride, talk, e, p), when a walk or gesture looks wrong, and as the motion half of gate G5.
---

# sv-21 · Motion and acting

Motion is judged frame by frame. The user rejected an episode because "bước chân đi này kia vẫn chưa
ổn, chưa rõ ràng và chi tiết" — walks must show planted feet in profile, actions must show their
mechanics (anticipation → contact → the world reacting). This skill is how to get there and how to prove it.

## Read first
- `references/actor-api.md` — every Actor field and its exact behaviour (speeds, reach geometry, seat heights).
- `references/acting.md` — recipes: walk-in + press, climb + sit, confession, argument, reveal, queue,
  piggyback, turn, enter/exit, and the per-shot acting checklist.

## Workflow (inside the G5 loop of sv-22)
1. Block each shot from `beats.md`: who is the subject, what physical action carries the line, which word
   it lands on. Write the actor with anchors, coordinates from `src/episode/geo.ts`.
2. `node scripts/lint.mjs shots` — fix every MO-*, SZ-*, SH-* error. It also writes
   `qa/strips_needed.json`: one strip for every walk, reach, sit/stand, ride and animated set key.
3. `node scripts/qa.mjs strips` → `qa/strips/<name>.png` (6–10 frames with timestamps).
4. Look at EVERY strip with the checklist below. Fix, re-render that strip
   (`node scripts/qa.mjs strips <name>`), look again.
5. In `gates/G5.review.md`, one line per strip saying what you verified.

## Strip checklist (what "correct" looks like)
| Strip | Must see |
|---|---|
| walk | profile view; legs alternate; the stance foot stays on the same floor spot across 2–3 frames (compare with a floor seam); body bobs; arms swing opposite to legs; speed matches the character; no moonwalk (feet sliding backwards) |
| reach | a settle frame, an anticipation frame (hand pulls back), the hand ON the target in ≥ 2 frames, the target reacting (light/door) right after contact, the arm returning |
| sit/stand | path ends at the seat, hip lowers over ~0.45 s, knees bend forward, feet stay planted, a seat is under the hip |
| ride | rider attached to the carrier's back in every frame, carrier leaning forward, legs walking |
| set key | the change (door sliding, number changing) is visible and starts on the word |

## Rules
- Walking = side view, always. Front view is for standing, talking, gesturing.
- No action without anticipation; no touch without the world reacting.
- Speeds come from the character (actor-api.md table), not from "whatever fits the time": if the line is
  too short for the walk, start the walk earlier (previous shot) or cut to the arrival.
- Talkers are big enough to read (≥ 480 px tall on screen, lint SZ-01). Listeners react on the punch word.
- Every shot changes something (lint MO-08 warns on frozen shots).
- Never close G5 on strips you did not open. The gate checks that every strip in
  `qa/strips_needed.json` exists, is newer than the shotlist, and is named in the review with a remark.

## Fixes for common defects
| Defect in the strip | Fix |
|---|---|
| Feet slide / moonwalk | the path is faster than vNom × 2.4 or a waypoint time is tiny; give the segment more time |
| Walk reads as floating | `y` of the path not on the floor of the set; read the grid plate for the floor y |
| Hand stops short of the button | stand closer (MO-05 tells the distance); check `geo.ts` coordinates against the grid plate |
| Reach looks like touching the face | standing under/next to the target (MO-09): stand 120–180 px to the side, at the fixture's `fy` |
| Hand touches air in front of the wall | actor `y` far from the fixture's `fy` (MO-09 depth): walk to the wall line |
| Button at knee height, arm points down | the fixture is not at human scale: fix the set (sets.md §3b), not the actor |
| Arm swings up mid-step | reach while walking (MO-06): arrive earlier |
| Sitting in mid-air | seat x/y does not match the hip (x − 10, seatH); place the stool under it |
| Character pops between views | key `view` with ≥ 0.25 s before the move starts |
| Expression changes off-beat | anchor `e` keys to the word, not to seconds |
