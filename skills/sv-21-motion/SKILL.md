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
3. `node scripts/qa.mjs strips` → `qa/strips/<name>.jpg` (6–10 full frames with timestamps, 2 rows, light JPEG).
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
- **Never reverse `path` `dx` when `face` is locked (`MO-10`)**: `Film.tsx` triggers horizontal turnaround squash (`sx = 0.12`) whenever `dx` flips sign. Use monotonic `dx` (all steps `>= 0` or all `<= 0`) or a pure vertical slip (`dx = 0`) instead of `x` back-and-forth jitter.
- **Articulated Action Physics (`v4.2`):** Side, 3/4, front, and back rigs support full articulated joint bends (`legs` / `arms` modes: `run`, `crouch`, `jump`, `fall`, `push`, `climb`, `cheer` in addition to `walk`/`sit`/`carried`/`ride`). Match `legs` and `arms` to the physical beat (e.g., `legs: 'run', arms: 'run'` for sprints, `legs: 'crouch', arms: 'crouch'` when ducking under a threat, `legs: 'climb', arms: 'climb'` on ledges/ropes).
- **Mounting & Riding Hero Subjects (`Actor.mount`):** Never paste floating actors manually over a moving creature/vehicle (`LA-02` clutter collision + depth pop). Instead give the Hero Subject extra a stable `id` (e.g. `{id: 'ladybug', k: 'ladybug', pose: 'fly', path: [...]}`) and attach each rider via `mount: {target: 'ladybug', slot: 0}`. `Film.tsx` and `geom.mjs` resolve live seat `(dx, dy)` across `flip`/`tilt`/`path`, compute z-aware `depthY` (`zOffset` keeps riders cleanly on top with zero `GE-17` false positives), and group mount + riders as one `LA-02` layout cluster.
- **Z-Aware Depth Sorting (`Actor.z`, `ExtraDef.z`):** Use explicit `z` nudges when an actor and prop share a floor plane (`depthY = y + z`); `GE-17` compares `depthY` rather than raw `y`.
- **First-pass motion pitfalls**:
  - `flip: true` mirrors `pointL` / `pointR` — verify pointing direction points TOWARD the subject, never off-screen.
  - Never reach across the opposite side of `face` (`MO-11`: `(rc.x - x) * dir < -15`, arm slices across own face) or walk in `side` view with `arms: 'raise'` (`MO-11`: arm crosses helmet/face — use `arms: 'swing'` or `arms: 'hold'`).
  - Never leave a floating sit (`MO-12`): keep `seatH <= 180` everywhere, and avoid `seatH > 40` on `outdoor`/`street`/`rain` sets unless `extras` includes a `bench`, `stool`, `chair`, or `desk` prop.
  - When narration describes a vehicle moving/rolling out, animate the prop's `x` or use a set `keys` motion — never leave a vehicle stationary on a motion beat.
- Never close G5 on strips you did not open. The gate checks that every strip in
  `qa/strips_needed.json` exists, matches the current shot (content hash), and is named in the review with a remark.
- For hands, feet and contact, open the measurement crops (`node scripts/qa.mjs crops <i>`): the strip shows the
  move, the crops show whether the hand is really ON the target and the foot really ON the floor.

## First-pass staging recipes (vehicles, beds, roofs)
- **Seating inside vehicles (`goKart`, `fireTruckCab`):** place the vehicle `WORLD_PROP` in `extras` with `prop.y > actor.y` so its foreground cowl/dashboard renders in front of the driver's legs (e.g. `goKart` at `{x, y: KART_Y}` and driver at `{x: KART_X - 16, y: KART_Y - 2, view: 'side', legs: 'sit', seatH: 104, arms: 'hold', lean: 8}`; `fireTruckCab` at `{x: 640, y: 1660}` and front-view seated crew at `{y: 1515, p: 'sit'}`).
- **Sleeping tucked under bed blankets (`o.sleeping`):** split the blanket into a separate `mid` layer item at `y = bedBot + 45` when `o.sleeping` is true, keep the bed frame at `y = bedBot - 20`, and place the sleeping actor between them (`y ≈ bedBot`, `view: 'side'`, `legs: 'sit'`, `seatH` matched to mattress). Never walk actors through the bed or leave shoes hovering over the rail.
- **Riding on a bus roof rack:** place `schoolBus` at `y = busY` and seat the rider on top with `y = busY + roofRackSurfaceY` (e.g. `busY - 635`), `p: 'sit'`, centered over the rack rails.

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
| Sitting in mid-air (`MO-12`) | seat x/y does not match the hip (x − 10, seatH); keep `seatH <= 180` and on `outdoor`/`street`/`rain` sets with `seatH > 40`, place a `bench`/`stool`/`chair`/`desk` prop in `extras` |
| Character squashes thin (`sx = 0.12`) mid-path | `path` `dx` reversed while `face` is locked (`MO-10`): make `dx` monotonic or `0` |
| Character pops between views | key `view` with ≥ 0.25 s before the move starts |
| Expression changes off-beat | anchor `e` keys to the word, not to seconds |
