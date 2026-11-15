# Actor API (src/engine.ts `Actor`) — exact behaviour

Times (`TT`) are either seconds from the shot start (number) or a word anchor (`'s5@mở'`, see
sv-22 shotlist-api). Prefer anchors: the action lands on the word the viewer hears.

## Placement
| Field | Meaning |
|---|---|
| `id` | stable per character across shots (`baTu` → `bt`). Used for ride and strip names |
| `look` | key in `CAST` |
| `x`, `y` | standing point in world px; `y` is the floor contact AND the depth-sort key. Ignored when `path` is set |
| `s` | scale. Principals 0.9–1.15, background 0.7–0.9 (and smaller `y`) |
| `flip` | front view mirrored (faces left) |
| `z` | depth-sort nudge when two things share a `y` |
| `op`, `enter`, `exit` | opacity; fade in/out over 0.3 s from that time. Use for ghosts/memories only — people WALK in and out |

## Front view (default when no path)
| Field | Meaning |
|---|---|
| `p` | pose name or keys `[['idle', 0], ['pointR', 's4@kia']]`; poses blend over 0.22 s |
| `e` | expression or keys |
| `talk` | `[[startAnchor, endAnchor], …]` mouth flaps between start of the first word and END of the last |
| `gaze` | −1..1 pupils left/right |
| `prop` | HAND_PROPS key |
| `hop` | px bounce amplitude (joy 10–18, anger 6–10) |
| `shake` | px tremble (fear/cold 3–5) |

## Side view (default when `path` or `ride` is set; force with `view`)
| Field | Meaning |
|---|---|
| `path` | `[[x, y, arriveAt], …]` waypoints. First entry = start position and the time walking starts |
| `view` | `'front' \| 'side'` or keys; switching squeezes the body through 0 over 0.24 s |
| `face` | `1 \| -1` or keys; default = travel direction. Turning squeezes over 0.22 s |
| `slope` | ground slope dy/dx for stairs/ramps (negative = up to the right) — feet follow it |
| `legs` | `'walk' \| 'sit' \| 'carried'` or keys. walk→sit lowers the hip from 200·h to `seatH` over 0.45 s; sit→walk stands up |
| `seatH` | hip height when seated in rig units: low stool 90–100, chair 110–125, bench 120 |
| `arms` | `swing` (default walking) `down` `hold` `phone` `cane` `carry` `ride` `shh` `raise` `pocket`, or keys |
| `reach` | `[{at, x, y, hold?, hand?}]` touch a world point (see below) |
| `ride` | id of the actor carrying this one piggyback; rider's legs/arms are set automatically |
| `lean` | degrees forward (+). Tired 6–10, hurry 8–12, proud −4 |
| `look2` | head tilt, + = look up (at a sign, at the floor number) |
| `tip` | tiptoe: short steps, 55 % speed, lean 8 |
| `pant` | out of breath: chest heave + breath puffs |
| `prop` | SIDE_PROPS key |

## Walking (planted feet)
- Nominal speed `vNom = 230 · s` px/s. Cadence is fixed; when slower than vNom the steps shorten, so the
  stance foot never slides. Faster than vNom adds extra stride (reads as hurrying).
- Each path segment moves with a trapezoid speed profile (accelerate, cruise, decelerate), so the speed you
  get is `distance / (arrive − start)` during cruise. Choose arrival times from the speed you want:

| Who | px/s (at s = 1) | Example: 600 px takes |
|---|---|---|
| Normal adult | 200–260 | 2.3–3.0 s |
| Elderly / tired | 120–170 | 3.5–5 s |
| Hurry | 300–400 | 1.5–2 s |
| Creeping / tiptoe | 100–140 + `tip` | 4–6 s |

Lint MO-02 warns > 560 px/s (running), MO-03 < 60 px/s (creeping that looks like sliding).
- Walking is ALWAYS side view (lint MO-04 errors on front-view travel).
- Start walking from outside the frame or from a clear standstill; end with ≥ 0.3 s settle before acting.

## Reach (pressing a button, touching a door, handing over money)
Timeline for `{at, hold}`: from `at−0.5` the hand pulls back slightly (anticipation) → from `at−0.32`
it extends to the target (ease-out) arriving exactly at `at` → holds `hold` s with a small press dip →
returns over 0.4 s. Rules:
- The target must be within ≈ 225 · h · s of the shoulder (lint MO-05). Shoulder ≈ (x, y − 410·h·s).
- Stand 120–180 px (· s) to the SIDE of the target, never right under it (lint MO-09 warns < 100: the arm
  cannot extend and the gesture reads as touching the face — the user caught exactly this once).
- Stand at the fixture's depth: every touch point in geo.ts carries `fy`, the floor line under the fixture
  (`{x, y, fy}`); the actor's `y` must be within fy … fy + 120 (MO-09 error beyond 200·s). Standing far in
  front of a wall button makes the hand touch air.
- The fixture must be at human scale (sv-20 sets.md §Human scale): a button 380–460 px above `fy`.
- The actor must be fully inside the frame at the reach (lint SZ-02).
- Finish walking ≥ 0.3 s before `at` (lint MO-06).
- The world must answer the touch: key the set option (button lights, door slides) at `at + 0.05` and the
  mix adds a click automatically.
- Front view reach uses the right hand by default (`hand: 'l'` for left); side view uses the near hand.

## Sitting
`legs: [['walk', 0], ['sit', 's3@ngồi']]` with the path arriving at the seat ~0.1–0.3 s before the sit
key. Put a seat under the hip (hip is 10 px behind x): a WORLD_PROPS `stool` via `extras`, or a set
bench at that x. Arms to `down`/`hold` at the same key. Standing up: key `walk` again before moving.

## Piggyback
Carrier: path + `arms: 'carry'` + `lean` 12 (automatic). Rider: `ride: '<carrierId>'`, any `e`. Both in
the same shot; lint MO-07 checks the carrier exists. A ride always gets a motion strip.
