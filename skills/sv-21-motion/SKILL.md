---
name: sv-21-motion
description: Animate characters in a story-video episode with studio 2D craft (v5.0) — 4-phase foot-roll walks/runs, tapered articulated limbs, curved spine silhouettes, grounded altitude shadows, parabolic jump arcs (arcH), 3-layer straddle mounts with IK grip anchors (MO-14), contact-locked pushing (pushTarget, MO-13), wind-blown secondary motion, and procedural riso action FX (dust/sweat/speed/impact/stars, MO-15) anchored to narration words — and verify every action with frame strips. Use whenever writing or editing actors/extras in src/episode/shotlist.ts or src/episode/subjects.tsx, fixing pasted-sticker or stiff motion, and for the motion half of gate G5.
---

# sv-21 · Motion and Studio 2D Animation Craft (`v5.0`)

Motion is judged frame by frame against the **"Pasted-Sticker Test"**. The user rejected episodes where *"bước chân đi này kia vẫn chưa ổn, chưa rõ ràng và chi tiết"* or where characters felt *"ghép vào cho có"* (floating without contact shadows, hands pushing empty air, riders pasted flat on top of a creature shell, or brick-stiff limbs with zero secondary life). Every character on screen must carry **weight, contact, squash-and-stretch, curved spine energy, and secondary motion** driven by `src/anim.ts` and verified by frame strips (`MO-01..MO-15`).

## Read first
- `references/actor-api.md` — every Actor field and its exact behaviour (speeds, reach geometry, seat heights).
- `references/acting.md` — recipes: walk-in + press, climb + sit, confession, argument, reveal, queue,
  piggyback, turn, enter/exit, and the per-shot acting checklist.

## Workflow (inside the G5 loop of sv-22)
1. Block each shot from `beats.md`: who is the subject, what physical action carries the line, which word
   it lands on. Write the actor with anchors, coordinates from `src/episode/geo.ts`, and `v5.0` contact/physics fields (`arcH`, `pushTarget`, `wind`, `fx`, `altitude`, `SubjectSeat.straddle`/`grip`).
2. `node scripts/lint.mjs shots` — fix every `MO-01..MO-15`, `SZ-01..02`, `SH-*` error and resolve HOT warnings (`MO-13`, `MO-14`, `MO-15`). It also writes `qa/strips_needed.json`: one strip for every walk, reach, sit/stand, ride and animated set key.
3. `node scripts/qa.mjs strips` → `qa/strips/<name>.jpg` (6–10 full frames with timestamps, 2 rows, light JPEG).
4. Look at EVERY strip with the checklist below. Fix, re-render that strip
   (`node scripts/qa.mjs strips <name>`), look again.
5. In `gates/G5.review.md`, one line per strip saying what you verified.

---

## Studio 2D Animation Craft (`v5.0` · `src/anim.ts`)

Never treat a 2D character as a static cutout slid from `(x0, y0)` to `(x1, y1)`. Build every shot around five physical pillars powered by `src/anim.ts`:

### 1. Weight & Grounding (`GroundShadow`, `ExtraDef.altitude`, `Actor.arcH`)
- **Automatic Contact Shadows:** Every grounded non-`fg` actor and `SUBJECT` casts an altitude-responsive `GroundShadow` (`PAL.ink` core + soft penumbra) directly onto the floor plane (disable only for intentional ghosts/holograms via `shadow: false`).
- **Flying / Hovering Subjects (`ExtraDef.altitude`, `MO-15`):** Whenever a creature or vehicle uses `pose: 'fly'` or `pose: 'hover'`, declare `altitude: 160..280` (px above the floor). Its `y` remains the visual airborne height while `GroundShadow` automatically projects onto `y + altitude`, shrinking and softening with height so the audience feels real altitude above the floor/table (`MO-15` warns if `fly`/`hover` omits `altitude`).
- **True Parabolic Jump Arcs (`Actor.arcH`):** Never float a jumping character statically in mid-air or linearly slide them diagonally. Set `arcH: 90..220` alongside `path` or `legs: 'jump'` — `parabolicArc` lifts the actor smoothly along a gravity curve while keeping their `GroundShadow` locked to the floor below and shrinking at the apex.

### 2. 4-Phase Gait Biomechanics (`walk` vs `run`, `footCycle`, `gaitHipBob`)
- `src/anim.ts` drives profile/3Q locomotion with a true **4-phase foot-roll cycle**:
  1. **Heel-Strike** (`toeRot < 0`, toe angled up on contact),
  2. **Down Squash** (hip dips, knee absorbs weight, head lags 0.14 cycle behind),
  3. **Toe-Off Push** (`toeRot > 0`, heel lifts while pushing backward against the floor),
  4. **Passing High Knee** (foot arcs cleanly forward — `walk` keeps 60% stance grounded; `run` drops to 38% stance for a true **double-airborne flight phase** with 62 px swing lift!).
- **Sprint Polish:** Pair `legs: 'run', arms: 'run'` with `fx: ['dust']` (or `['dust', 'speed']` on panic sprints) and `wind: 0.6..1.0` so footstrikes kick up riso dust puffs and hair trails behind the sprint.

### 3. True Straddle Mounting (`SubjectSeat.straddle`, `grip`, `SeatShadow`, `wind`, `MO-14`)
- Never paste riders flat on one side of a creature or vehicle (`LA-02` clutter + pasted-sticker fail). Give the Hero Subject a stable `id` (e.g. `{id: 'ladybug', k: 'ladybug', pose: 'fly', altitude: 220, path: [...]}`) and attach each rider via `mount: {target: 'ladybug', slot: 0}`.
- **Author `SubjectSeat` with 3-Layer Straddle Physics in `src/episode/subjects.tsx`:**
  ```ts
  seats: {
    fly: [
      {dx: 38, dy: -82, view: '3q', face: 1, pose: 'ride', straddle: true, grip: [92, -64], wind: 1.4, angle: 6},
      {dx: -44, dy: -74, view: '3q', face: 1, pose: 'ride', straddle: true, grip: [28, -96], wind: 1.4, angle: 4},
    ],
  }
  ```
- When `straddle: true` is set, `Film.tsx` renders a true **3-layer straddle sandwich**:
  1. Rider's `layer="far"` (far leg + far arm) **BEHIND** the creature's shell/body,
  2. The creature **PLUS** a curved `SeatShadow` painted directly onto the shell under each rider's hips,
  3. Rider's `layer="near"` (torso + near leg hugging the near flank + near arm IK-locked onto `grip: [gx, gy]` — collar, antenna base, or front rider's shoulders) **IN FRONT** with `hairWindOffset` trailing in the airstream (`wind`)!
- **`MO-14` Enforcement:** Every `mount` must resolve to an existing `SubjectSeat` (ERROR if missing). On any `creature` with `>= 2` riders, all riders MUST face the same travel direction (ERROR on contradictory `face: -1` vs `face: 1`), and seats MUST define `straddle: true` or `grip` (WARN + HOT if neither is set).

### 4. Contact-Locked Physical Effort (`Actor.pushTarget`, `fx: ['sweat']`, `MO-13`)
- **Zero Air-Pushing (`MO-13`):** Never place an actor in `p: 'push'` or `legs: 'push'` waving hands at empty space! Always supply `pushTarget: [tx, ty]` (the exact world coordinate of the lever, door edge, rock, or wall surface from `src/episode/geo.ts`, or a timed `reach`) so both hands IK-lock directly onto the physical surface.
- Keep `pushTarget` within real arm reach (`<= 280 * H * s * 1.15`; `MO-13` emits WARN + HOT beyond comfortable reach and hard ERROR `> 380 * H * s`). Pair heavy pushes with forward `lean: 12..18`, `fx: ['sweat']`, and a set `keys` reaction so the object visibly yields or strains.

### 5. Living Secondary Motion & Impact FX (`springSettle`, `curvedTorsoPath`, `TaperLimb`, `hairWindOffset`, `ActionFx`, `MO-15`)
- **Engine Automatic Craft:** Across rigs, `springSettle` gives pose transitions organic overshoot-and-settle, `curvedTorsoPath` bends torsos into forward C-arcs (`run`/`ride`/`push`/`crouch`) or reverse arches (`fall`/`cheer`/`shock`), `TaperLimb` replaces flat sticks with seamless tapered arms/legs with joint creases and sleeve cuffs, and `hairWindOffset` trails hair/cowlicks smoothly from `Actor.wind` and travel velocity.
- **Procedural Riso Action FX (`Actor.fx`):** Attach any combination of the 5 validated `ActionFx` keys (`'dust' | 'sweat' | 'speed' | 'impact' | 'stars'`, validated by `MO-15`):
  - `'dust'` — 3-puff footstrike / landing cloud (`run`, `jump` landing, `fall`, skid stops).
  - `'sweat'` — animated strain beads (`push`, heavy `carry`, panic `crouch`, tight climb).
  - `'speed'` — kinetic trailing streaks (sprints, dives, high-speed creature flight).
  - `'impact'` — radial starburst burst (collisions, trips, slams).
  - `'stars'` — orbiting dizzy stars around the head (bonks, hard falls, dazed beats).
- **Fall/Trip Weight (`MO-15`):** Any actor using `p: 'fall'`, `p: 'trip'`, or `legs: 'fall'` with zero `fx` and zero shot `shake` triggers `WARN [MO-15]` — add `fx: ['impact', 'stars']` or `fx: ['dust']` (and optional `shake: 6..12`) so hits feel physical!

### DO vs DON'T (`MO-13`, `MO-14`, `MO-15`)
| Beat | DON'T (Pasted-Sticker Fail) | DO (Studio 2D Craft `v5.0`) | Guard |
|---|---|---|---|
| Pushing a door / crate / lever | `{p: 'push', x: 500, y: 840}` with hands pushing empty air | `{p: 'push', x: 500, y: 840, pushTarget: [640, 560], lean: 14, fx: ['sweat']}` + `keys` door reaction | `MO-13` |
| Two riders on a flying creature | Flat `seats: {fly: [{dx: 20, dy: -70}, {dx: -40, dy: -70}]}` or opposing `face: 1` / `face: -1` | `straddle: true`, real `grip: [gx, gy]`, `wind: 1.4`, same `face` facing travel direction + `altitude: 220` on creature | `MO-14`, `MO-15` |
| Flying / hovering creature | `{k: 'ladybug', pose: 'fly', x: 900, y: 420}` floating with no ground reference | `{k: 'ladybug', pose: 'fly', x: 900, y: 420, altitude: 240}` so `GroundShadow` projects on the floor below | `MO-15` |
| Jump across a gap | Static `p: 'jump'` mid-air or linear diagonal slide | `path: [[x0, y0, t0], [x1, y1, t1]], legs: 'jump', arcH: 150, fx: ['dust']` (shadow stays grounded) | `MO-15` |
| Trip / bonk / hard fall | `{p: 'fall'}` with no FX and `shake: 0` (weightless sticker) | `{p: 'fall', fx: ['impact', 'stars']}` or `{legs: 'fall', fx: ['dust']}` + `shake: 8` | `MO-15` |

---

## Strip checklist (what "correct" looks like)
| Strip | Must see |
|---|---|
| walk / run | profile or 3/4 view; 4-phase heel-strike → down squash → toe-off → high knee; stance foot planted on the same floor spot across 2–3 frames; `GroundShadow` beneath feet; hip bob + delayed head nod; arms swing opposite legs; `fx: ['dust']` on sprints; zero moonwalk |
| reach / push | settle frame, anticipation, hand physically ON the target / `pushTarget` in ≥ 2 frames (zero air-pushing, `MO-13`), world reacting (`keys`), arm returning |
| sit/stand | path ends at the seat, hip lowers over ~0.45 s, knees bend forward, feet stay planted, a seat is under the hip |
| ride / mount | piggyback rider attached to carrier's back; `Actor.mount` riders straddling with `layer="far"` behind shell, `SeatShadow` under hips, hands on `grip`, wind-blown hair, all riders facing travel direction (`MO-14`) |
| jump / fall | `arcH` body arcs smoothly while `GroundShadow` stays on floor; landings/falls pop with `fx: ['dust']` or `['impact', 'stars']` (`MO-15`) |
| set key | the change (door sliding, number changing) is visible and starts on the word |

## Core Rules (`MO-01..MO-15`)
- Walking = side view, always (`MO-04`). Front view is for standing, talking, gesturing.
- No action without anticipation; no touch without the world reacting.
- Speeds come from the character (`actor-api.md` table, `MO-02`/`MO-03`), not from "whatever fits the time": if the line is too short for the walk, start earlier or cut to the arrival. Waypoints must be monotonic in time (`MO-01`).
- Reach geometry: arrive `>= 0.3 s` before reaching (`MO-06`), stand within arm range (`MO-05`), and stand 120–180 px beside the target at its `fy` floor line (`MO-09`). Piggyback `ride` target must be in the shot (`MO-07`).
- Talkers are big enough to read (≥ 480 px tall on screen, lint `SZ-01`); acting bodies stay inside the frame during reaches (`SZ-02`). Listeners react on the punch word.
- Every shot changes something (`MO-08` warns on frozen shots — recognizes `cam2`, `keys`, `over`, `path`, `reach`, `talk`, `hop`, `shake`, `pant`, `ride`, `mount`, `arcH`, `pushTarget`, `fx`, `wind`, or keyed poses/expressions).
- **Never reverse `path` `dx` when `face` is locked (`MO-10`)**: `Film.tsx` triggers horizontal turnaround squash (`sx = 0.12`) whenever `dx` flips sign. Use monotonic `dx` or `dx = 0`.
- **Articulated Action Physics:** Side, 3/4, front, and back rigs support full articulated joint bends (`legs` / `arms`: `run`, `crouch`, `jump`, `fall`, `push`, `climb`, `cheer`, `walk`, `sit`, `carried`, `ride`). Match `legs` and `arms` to the physical beat.
- **Z-Aware Depth Sorting (`Actor.z`, `ExtraDef.z`):** Use explicit `z` nudges when an actor and prop share a floor plane (`depthY = y + z`); `GE-17` compares `depthY` rather than raw `y`, and `Actor.mount` riders group with their mount as one `LA-02` cluster.
- **First-pass motion pitfalls:**
  - `flip: true` mirrors `pointL` / `pointR` — verify pointing direction points TOWARD the subject, never off-screen.
  - Never reach across the opposite side of `face` (`MO-11`: `(rc.x - x) * dir < -15`, arm slices across own face) or walk in `side` view with `arms: 'raise'` (`MO-11`: use `arms: 'swing'` or `arms: 'hold'`).
  - Never leave a floating sit (`MO-12`): keep `seatH <= 180` everywhere, and avoid `seatH > 40` on `outdoor`/`street`/`rain` sets unless `extras` includes a `bench`, `stool`, `chair`, or `desk` prop.
  - Never air-push (`MO-13`), paste flat/contradictory riders on a creature (`MO-14`), use unknown `fx`, leave falls weightless, or fly a creature without `altitude` (`MO-15`).
  - When narration describes a vehicle moving/rolling out, animate the prop's `x` or use set `keys` — never leave a vehicle stationary on a motion beat.
- Never close G5 on strips you did not open. For hands, feet, shadows, and contact, open measurement crops (`node scripts/qa.mjs crops <i>`).

## First-pass staging recipes (vehicles, beds, roofs)
- **Seating inside vehicles (`goKart`, `fireTruckCab`):** place the vehicle `WORLD_PROP` in `extras` with `prop.y > actor.y` so its foreground cowl/dashboard renders in front of the driver's legs (e.g. `goKart` at `{x, y: KART_Y}` and driver at `{x: KART_X - 16, y: KART_Y - 2, view: 'side', legs: 'sit', seatH: 104, arms: 'hold', lean: 8}`; `fireTruckCab` at `{x: 640, y: 1660}` and front-view seated crew at `{y: 1515, p: 'sit'}`).
- **Sleeping tucked under bed blankets (`o.sleeping`):** split the blanket into a separate `mid` layer item at `y = bedBot + 45` when `o.sleeping` is true, keep the bed frame at `y = bedBot - 20`, and place the sleeping actor between them (`y ≈ bedBot`, `view: 'side'`, `legs: 'sit'`, `seatH` matched to mattress). Never walk actors through the bed or leave shoes hovering over the rail.
- **Riding on a bus roof rack:** place `schoolBus` at `y = busY` and seat the rider on top with `y = busY + roofRackSurfaceY` (e.g. `busY - 635`), `p: 'sit'`, centered over the rack rails.

## Fixes for common defects
| Defect in the strip / card | Fix |
|---|---|
| Feet slide / moonwalk | path is faster than `vNom × 2.4` or a waypoint dt is tiny (`MO-02`); give the segment more time |
| Walk reads as floating | `y` of path not on set floor (read grid plate), or `shadow: false` accidentally set |
| Hand stops short of button / pushes empty air (`MO-05`, `MO-13`) | stand closer and lock hands with `pushTarget: [tx, ty]` or `reach` using exact `geo.ts` coordinates |
| Reach looks like touching the face / air (`MO-09`) | stand 120–180 px to the side of target, at the fixture's `fy` floor line |
| Arm swings up mid-step (`MO-06`) | reach while walking: arrive ≥ 0.3 s before reaching |
| Riders look pasted flat on creature shell (`MO-14`) | add `straddle: true`, `grip: [gx, gy]`, and `wind: 1.2..1.5` to `SubjectSeat`, and match rider `face` to travel direction |
| Flying creature floats disconnected (`MO-15`) | set `altitude: 160..280` on the flying/hovering `ExtraDef` so `GroundShadow` projects below |
| Jump or fall looks stiff / weightless (`MO-15`) | add `arcH: 100..200` on jumps and `fx: ['impact', 'stars']` or `fx: ['dust']` + `shake` on falls/trips |
| Sitting in mid-air (`MO-12`) | match hip to seat (`seatH <= 180`; if `> 40` on `outdoor`/`street`/`rain`, add `bench`/`stool`/`chair`/`desk`) |
| Character squashes thin (`sx = 0.12`) mid-path (`MO-10`) | `path` `dx` reversed while `face` is locked: make `dx` monotonic or `0` |
| Character pops between views | key `view` ≥ 0.25 s before the move starts |
| Expression changes off-beat | anchor `e` keys to the word, not to seconds |
