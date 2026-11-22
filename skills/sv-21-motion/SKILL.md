---
name: sv-21-motion
description: Animate characters in a story-video episode with studio 2D craft (v5.3) — 4-phase foot-roll walks/runs, tapered articulated limbs, curved spine silhouettes, grounded altitude shadows, 4-stage jumpPhase takeoff/apex/landing physics with bounded arcH windows and zero mid-air walking (MO-17), elevated airspace sorting preventing flying-creature occlusion (GE-20), 3-layer straddle mounts with IK grip anchors (MO-14), contact-locked pushing (pushTarget, MO-13), wind-blown secondary motion, procedural riso action FX (dust/sweat/speed/impact/stars, MO-15), and Long-Form multi-action choreography density (MO-16) anchored to narration words — and verify every action with 8-frame strips. Use whenever writing or editing actors/extras in src/episode/shotlist.ts or src/episode/subjects.tsx, fixing pasted-sticker or stiff motion, and for the motion half of gate G5.
---

# sv-21 · Motion and Studio 2D Animation Craft (`v5.3`)

Motion is judged frame by frame against the **"Pasted-Sticker Test"**. The user rejected episodes where *"bước chân đi này kia vẫn chưa ổn, chưa rõ ràng và chi tiết"* or where characters felt *"ghép vào cho có"* (floating without contact shadows, mid-air walking on jump arcs, flying creatures clipping behind tabletop props, hands pushing empty air, riders pasted flat on top of a creature shell, or brick-stiff limbs with zero secondary life). Every character on screen must carry **weight, contact, squash-and-stretch, curved spine energy, true 4-stage jump/airspace physics, and secondary motion** driven by `src/anim.ts`, `side.tsx`, and `Film.tsx` and verified by 8-frame strips (`MO-01..MO-17`, `GE-20`).

## Read first
- `references/actor-api.md` — every Actor field and its exact behaviour (speeds, reach geometry, seat heights).
- `references/acting.md` — recipes: walk-in + press, climb + sit, confession, argument, reveal, queue,
  piggyback, turn, enter/exit, and the per-shot acting checklist.

## Workflow (inside the G5 loop of sv-22)
1. Block each shot from `beats.md`: who is the subject, what physical action carries the line, which word
   it lands on. Write the actor with anchors, coordinates from `src/episode/geo.ts`, and `v5.3` contact/physics fields (`arcH`, bounded `legs: 'jump'` windows, `pushTarget`, `wind`, `fx`, `altitude`, `SubjectSeat.straddle`/`grip`).
2. `node scripts/lint.mjs shots` — fix every `MO-01..MO-17`, `GE-20`, `SZ-01..02`, `SH-*` error and resolve HOT warnings (`MO-13`, `MO-14`, `MO-15`, `MO-16`, `MO-17`, `GE-20`). It also writes `qa/strips_needed.json`: one 8-frame strip for every walk, reach, sit/stand, ride, jump takeoff/apex/land (`MO-17`), flying/moving Hero Subject (`GE-20`), and animated set key.
3. `node scripts/qa.mjs strips` → `qa/strips/<name>.jpg` (8 full frames with timestamps, 2 rows, light JPEG; also run automatically with Tier-3 `qa/shots/<NN>.jpg` filmstrips inside `qa.mjs pass`).
4. Look at EVERY strip with the checklist below. Fix, re-render that strip
   (`node scripts/qa.mjs strips <name>`), look again.
5. In `gates/G5.review.md`, one line per strip saying what you verified.

---

## Studio 2D Animation Craft (`v5.3` · `src/anim.ts`, `side.tsx`, `Film.tsx`)

Never treat a 2D character as a static cutout slid from `(x0, y0)` to `(x1, y1)`. Build every shot around six physical pillars powered by `src/anim.ts`, `side.tsx`, and `Film.tsx`:

### 1. Weight, Grounding, 4-Stage Jump Physics & Elevated Airspace (`GroundShadow`, `jumpPhase`, `MO-17`, `GE-20`)
- **Automatic Contact Shadows:** Every grounded non-`fg` actor and `SUBJECT` casts an altitude-responsive `GroundShadow` (`PAL.ink` core + soft penumbra) directly onto the floor plane (disable only for intentional ghosts/holograms via `shadow: false`).
- **4-Stage Jump / Takeoff / Landing Physics & Zero Mid-Air Walking (`side.tsx`, `Film.tsx`, `MO-17`):**
  - Never stretch `arcH > 0` across a long walk/run path or animate `walk`/`run` feet while airborne! `PersonSide` drives `jumpPhase` (`0..1`) through four distinct physical stages:
    1. **Takeoff crouch anticipation (`0..0.14`):** feet firmly planted on the floor, knees bent deep to load spring energy,
    2. **Rising ascent / apex tuck (`0.14..0.52`):** vertical body stretch with arms driving **UP** and knees tucking cleanly at apex,
    3. **Descending landing reach (`0.52..0.86`):** legs extending downward toward the landing point,
    4. **Grounded landing squash absorb (`0.86..1.0`):** feet flat on the floor absorbing impact + automatic `<DustPuff>` burst.
  - `Film.tsx` binds `arcH` strictly to the keyed `legs: 'jump'` time window (`[w0, w1]`) and enforces an **unbreakable mid-air physics lock** (`arcY > 4` cannot animate `walk`/`run` feet!).
  - **`MO-17` Enforcement:** Bans `arcH > 0` stretched across a path `> 1.85 s` without a bounded `legs: [..., ['jump', t0], ['run'|'walk', t1]]` window (`<= 2.2 s`) and automatically queues an 8-frame `jump takeoff/apex/land` strip into `qa/strips_needed.json`.
- **Flying / Hovering Subjects & Elevated Airspace Sorting (`ExtraDef.altitude`, `MO-15`, `GE-20`):**
  - Whenever a creature or vehicle uses `pose: 'fly'` or `pose: 'hover'`, declare `altitude: 160..280` (px above the floor; `MO-15` warns if omitted).
  - For airborne `SUBJECTS` (`altitude > 20`), `Film.tsx` automatically separates the **ground-plane `GroundShadow`** (projected at `y + altitude`) from the **elevated airspace body (`+1200` depth)** so flying creatures and their straddling riders are **NEVER occluded** by ground/tabletop `mid` props (beakers, machines, desks) while still flying beneath overhead `layers.fg` ceiling fans!
  - **`GE-20` Enforcement:** Checks Hero Subject / flying creature occlusion (`> 45%` hard ERROR, `> 25%` WARN + HOT) and automatically queues an 8-frame `subject motion/occlusion` strip into `qa/strips_needed.json` for every flying/moving Hero Subject.

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

### 6. Long-Shot Multi-Action Choreography Density (`MO-16`, `long_16x9`)
- Under `v5.1` Long-Form pacing (`shots_long_16x9`: `4.5–9.5 s` mean, `max 14.0 s`, `~65–110` shots per 10-minute episode), longer takes MUST stay continuously alive — never a dead static hold!
- **`MO-16` Enforcement on `long_16x9`:**
  - Any shot **`> 5.0 s`** with **`0` choreography events** is a hard **ERROR** (dead static hold).
  - Any shot **`> 5.0 s`** with **`< 2` choreography events** triggers **WARN**.
  - Any shot **`> 8.5 s`** with **`< 3` choreography events** triggers **WARN**.
- **Counted choreography events (`MO-16`):** motivated `cam2` moves, set `keys`, multi-waypoint `path`, `arcH`, `mount`, `pushTarget`, `reach`, keyed `p`/`e`/`view`/`face`/`legs`/`arms`, `fx`/`wind`, and animated `extras`. Choreograph a clear Beginning → Mid-beat → Reaction arc inside every 5–12 s take (e.g. walk-in `path` → `reach` / `keys` door reaction → expression `e` + `cam2` push).

### DO vs DON'T (`MO-13`, `MO-14`, `MO-15`, `MO-16`, `MO-17`, `GE-20`)
| Beat | DON'T (Pasted-Sticker Fail) | DO (Studio 2D Craft `v5.3`) | Guard |
|---|---|---|---|
| Pushing a door / crate / lever | `{p: 'push', x: 500, y: 840}` with hands pushing empty air | `{p: 'push', x: 500, y: 840, pushTarget: [640, 560], lean: 14, fx: ['sweat']}` + `keys` door reaction | `MO-13` |
| Two riders on a flying creature | Flat `seats: {fly: [{dx: 20, dy: -70}, {dx: -40, dy: -70}]}` or opposing `face: 1` / `face: -1` | `straddle: true`, real `grip: [gx, gy]`, `wind: 1.4`, same `face` facing travel direction + `altitude: 220` on creature | `MO-14`, `MO-15` |
| Flying / hovering creature over props | `{k: 'ladybug', pose: 'fly', x: 900, y: 420}` with no `altitude` or clipped behind table/beaker props | `{k: 'ladybug', pose: 'fly', x: 900, y: 420, altitude: 240}` — ground shadow on floor, body sorted in `+1200` elevated airspace above `mid` props, verified on 8-frame strip | `MO-15`, `GE-20` |
| Jump across a gap | `arcH: 150` stretched across a 4 s walk path (mid-air walking!) or static mid-air pose | Bounded jump window (`<= 2.2 s`): `legs: [['run', 0], ['jump', t0], ['run', t1]], arcH: 150` → 4-stage `jumpPhase` takeoff crouch → apex tuck → reach → grounded `<DustPuff>` squash | `MO-17` |
| Trip / bonk / hard fall | `{p: 'fall'}` with no FX and `shake: 0` (weightless sticker) | `{p: 'fall', fx: ['impact', 'stars']}` or `{legs: 'fall', fx: ['dust']}` + `shake: 8` | `MO-15` |
| 6–10 s Long-Form shot (`long_16x9`) | Static wide frame with 0–1 pose changes across 7 seconds | Layer `≥ 2` (`≥ 3` if `> 8.5 s`) events: `path` + `reach`/keyed `p`/`e` + `cam2` push + set `keys` / `fx` | `MO-16` |

---

## Strip checklist (what "correct" looks like)
| Strip | Must see |
|---|---|
| walk / run | profile or 3/4 view; 4-phase heel-strike → down squash → toe-off → high knee; stance foot planted on the same floor spot across 2–3 frames; `GroundShadow` beneath feet; hip bob + delayed head nod; arms swing opposite legs; `fx: ['dust']` on sprints; zero moonwalk |
| reach / push | settle frame, anticipation, hand physically ON the target / `pushTarget` in ≥ 2 frames (zero air-pushing, `MO-13`), world reacting (`keys`), arm returning |
| sit/stand | path ends at the seat, hip lowers over ~0.45 s, knees bend forward, feet stay planted, a seat is under the hip |
| ride / mount | piggyback rider attached to carrier's back; `Actor.mount` riders straddling with `layer="far"` behind shell, `SeatShadow` under hips, hands on `grip`, wind-blown hair, all riders facing travel direction (`MO-14`) |
| jump / fall | 8-frame `jump takeoff/apex/land` strip (`MO-17`): takeoff crouch (feet grounded) → rising stretch/apex tuck (arms UP, zero mid-air walking!) → descending landing reach → flat-foot landing squash + `<DustPuff>`, `GroundShadow` stays on floor; falls pop with `fx: ['impact', 'stars']` or `['dust']` (`MO-15`) |
| flying / moving subject | 8-frame `subject motion/occlusion` strip (`GE-20`): airborne `SUBJECT` (`altitude > 20`) + straddling riders stay clean in elevated airspace above tabletop/ground `mid` props (`<= 25%` occlusion), casting a grounded `GroundShadow` below while passing under `layers.fg` ceiling elements |
| set key | the change (door sliding, number changing) is visible and starts on the word |

## Core Rules (`MO-01..MO-17`, `GE-20`)
- Walking = side view, always (`MO-04`). Front view is for standing, talking, gesturing.
- No action without anticipation; no touch without the world reacting.
- Speeds come from the character (`actor-api.md` table, `MO-02`/`MO-03`), not from "whatever fits the time": if the line is too short for the walk, start earlier or cut to the arrival. Waypoints must be monotonic in time (`MO-01`).
- Reach geometry: arrive `>= 0.3 s` before reaching (`MO-06`), stand within arm range (`MO-05`), and stand 120–180 px beside the target at its `fy` floor line (`MO-09`). Piggyback `ride` target must be in the shot (`MO-07`).
- Talkers are big enough to read (≥ 480 px tall on screen, lint `SZ-01`); acting bodies stay inside the frame during reaches (`SZ-02`). Listeners react on the punch word.
- Every shot changes something (`MO-08` warns on frozen shots — recognizes `cam2`, `keys`, `over`, `path`, `reach`, `talk`, `hop`, `shake`, `pant`, `ride`, `mount`, `arcH`, `pushTarget`, `fx`, `wind`, or keyed poses/expressions).
- **Never reverse `path` `dx` when `face` is locked (`MO-10`)**: `Film.tsx` triggers horizontal turnaround squash (`sx = 0.12`) whenever `dx` flips sign. Use monotonic `dx` or `dx = 0`.
- **Articulated Action Physics:** Side, 3/4, front, and back rigs support full articulated joint bends (`legs` / `arms`: `run`, `crouch`, `jump`, `fall`, `push`, `climb`, `cheer`, `walk`, `sit`, `carried`, `ride`). Match `legs` and `arms` to the physical beat.
- **Z-Aware Depth Sorting & Elevated Airspace (`Actor.z`, `ExtraDef.z`, `ExtraDef.altitude`, `GE-20`):** Use explicit `z` nudges when an actor and prop share a floor plane (`depthY = y + z`); `GE-17` compares `depthY` rather than raw `y`, and `Actor.mount` riders group with their mount as one `LA-02` cluster. Flying `SUBJECTS` with `altitude > 20` automatically sort in elevated airspace (`+1200` depth) with a separate ground-plane `GroundShadow` (`GE-20`).
- **First-pass motion pitfalls:**
  - `flip: true` mirrors `pointL` / `pointR` — verify pointing direction points TOWARD the subject, never off-screen.
  - Never reach across the opposite side of `face` (`MO-11`: `(rc.x - x) * dir < -15`, arm slices across own face) or walk in `side` view with `arms: 'raise'` (`MO-11`: use `arms: 'swing'` or `arms: 'hold'`).
  - Never leave a floating sit (`MO-12`): keep `seatH <= 180` everywhere, and avoid `seatH > 40` on `outdoor`/`street`/`rain` sets unless `extras` includes a `bench`, `stool`, `chair`, or `desk` prop.
  - Never air-push (`MO-13`), paste flat/contradictory riders on a creature (`MO-14`), use unknown `fx`, leave falls weightless, fly a creature without `altitude` (`MO-15`), leave a `long_16x9` shot `> 5.0 s` dead/under-choreographed (`MO-16`), stretch `arcH > 0` across a `> 1.85 s` path without a bounded `<= 2.2 s` `legs: 'jump'` window (`MO-17`), or let a flying Hero Subject be occluded by ground/tabletop `mid` props (`GE-20`).
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
| Mid-air walking / stretched jump arc (`MO-17`) | bind `arcH > 0` to a bounded `legs: [..., ['jump', t0], ['run'|'walk', t1]]` window (`<= 2.2 s`) so `PersonSide` plays 4-stage `jumpPhase` takeoff/apex/land and `Film.tsx` keeps `arcY > 4` locked off walk/run cycles |
| Flying creature occluded by tabletop/mid props (`GE-20`) | ensure flying `SUBJECT` declares `altitude > 20` (typically `160..280`) for elevated `+1200` airspace sorting, clear foreground `fg` blockers (`> 45%` ERROR, `> 25%` WARN + HOT), and inspect the auto-queued 8-frame strip |
| Hand stops short of button / pushes empty air (`MO-05`, `MO-13`) | stand closer and lock hands with `pushTarget: [tx, ty]` or `reach` using exact `geo.ts` coordinates |
| Reach looks like touching the face / air (`MO-09`) | stand 120–180 px to the side of target, at the fixture's `fy` floor line |
| Arm swings up mid-step (`MO-06`) | reach while walking: arrive ≥ 0.3 s before reaching |
| Riders look pasted flat on creature shell (`MO-14`) | add `straddle: true`, `grip: [gx, gy]`, and `wind: 1.2..1.5` to `SubjectSeat`, and match rider `face` to travel direction |
| Flying creature floats disconnected (`MO-15`) | set `altitude: 160..280` on the flying/hovering `ExtraDef` so `GroundShadow` projects below |
| Jump or fall looks stiff / weightless (`MO-15`) | add `arcH: 100..200` on bounded jumps (`MO-17`) and `fx: ['impact', 'stars']` or `fx: ['dust']` + `shake` on falls/trips |
| Long-Form shot `> 5.0 s` feels dead (`MO-16`) | choreograph `>= 2` events (`>= 3` if `> 8.5 s`): combine motivated `cam2`, `path`/`arcH`/`mount`/`pushTarget`/`reach`, keyed `p`/`e`/`view`/`face`/`legs`/`arms`, set `keys`, `fx`/`wind`, or animated `extras` |
| Sitting in mid-air (`MO-12`) | match hip to seat (`seatH <= 180`; if `> 40` on `outdoor`/`street`/`rain`, add `bench`/`stool`/`chair`/`desk`) |
| Character squashes thin (`sx = 0.12`) mid-path (`MO-10`) | `path` `dx` reversed while `face` is locked: make `dx` monotonic or `0` |
| Character pops between views | key `view` ≥ 0.25 s before the move starts |
| Expression changes off-beat | anchor `e` keys to the word, not to seconds |
