---
name: sv-21-motion
description: Animate characters and creatures in a story-video episode with studio 2D craft (v5.6) — distance-locked side-view walk/run stop-settle (zero treadmill running in place), rear-heel-kick 42px run swing kinematics, automatic distance-locked gait on 3q and front paths (zero ice-skating), PR-09 anti-statue living creature motion, living micro-acting (livingIdle, talkGesture, poseImpulse), CartoonHand articulated close-up hands, Actor.lookAt 2D eye-line tracking, 3D 3q stepped turnarounds, computeSubjectKinematics flight/quadruped physics, creature spring-morph, 4-stage jumpPhase takeoff/apex/landing (MO-17), elevated airspace sorting (GE-20), 3-layer straddle mounts with IK grip (MO-14), contact-locked pushTarget (MO-13), riso ActionFx (MO-15), choreography density (MO-16), and anti-freeze CI (MO-18). Use when editing actors/extras in shotlist.ts or subjects.tsx and for gate G5.
---

# sv-21 · Motion and Studio 2D Animation Craft (`v5.6`)

Motion is judged frame by frame against the **"Pasted-Sticker Test"**. The user rejected episodes where *"bước chân đi này kia vẫn chưa ổn, chưa rõ ràng và chi tiết"* or where characters/creatures felt *"ghép vào cho có / đứng như trời trồng"* (treadmill running in place after reaching a waypoint, ice-skating on `3q`/`front` paths, symmetric high-stepping runs, creature statues standing in 1 pose for >2.2 s, floating without contact shadows, mid-air walking on jump arcs, cardboard-pancake `sx=0.12` flips, frozen mid-pounce attacks, featureless mitten hands in close-ups, flying creatures clipping behind tabletop props, hands pushing empty air, or riders pasted flat on top of a shell). Every character and creature on screen must carry **distance-locked foot-roll gaits with clean stop-settle, rear-heel-kick run recovery, `3q`/`front` auto-gait, living creature motion (`PR-08`, `PR-09`), `CartoonHand` gestures, 2D `Actor.lookAt` eyelines, 3D stepped turnarounds, `computeSubjectKinematics`, 4-stage jump/airspace physics, and secondary life** verified by 8-frame strips (`MO-01..MO-18`, `PR-08..09`, `GE-20`).

## Read first
- `references/actor-api.md` — every Actor field and its exact behaviour (speeds, reach geometry, seat heights).
- `references/acting.md` — recipes: walk-in + press, climb + sit, confession, argument, reveal, queue,
  piggyback, turn, enter/exit, and the per-shot acting checklist.

## Workflow (inside the Unit-by-Unit G5 loop of sv-02 / sv-22)
1. Block each shot in the current Episodic Unit (`U1..Uk`) from `beats.md`: who is the subject, what physical action carries the line, which word it lands on. Write actors/extras with anchors, coordinates from `src/episode/geo.ts`, and `v5.6` physics fields (`arcH`, bounded `legs: 'jump'` windows, `lookAt`, `pushTarget`, `wind`, `fx`, `altitude`, `SubjectSeat.straddle`/`grip`, creature `path` or `>= 2` keyed `pose`/`expr` beats for `PR-09`, and lunge follow-through for `MO-18`).
2. `node scripts/lint.mjs shots` — fix every `MO-01..MO-18`, `PR-09`, `GE-20`, `SZ-01..02`, `SH-*` error and resolve HOT warnings (`MO-13..18`, `PR-09`, `GE-20`). It writes `qa/strips_needed.json`: one 8-frame strip for every walk/run, reach, sit/stand, ride, jump takeoff/apex/land (`MO-17`), flying/moving Hero Subject (`GE-20`), and animated set key.
3. `node scripts/qa.mjs pass --unit U<k>` (or `node scripts/qa.mjs strips [--unit U<k>]`) → `qa/strips/<name>.jpg` + Tier-3 `qa/shots/<NN>.jpg` `Δ=%` filmstrips and `qa/motion_energy.json`.
4. Look at EVERY strip with the checklist below. Fix, re-render (`node scripts/qa.mjs strips <name>` or `qa.mjs pass --unit U<k>`), look again.
5. Record strip remarks in `gates/G5.U<k>.review.md` (and `gates/G5.review.md`), then lock the unit via `python3 scripts/sv_gate.py pass-unit U<k>`.

---

## Studio 2D Animation Craft (`v5.6` · `src/anim.ts`, `side.tsx`, `chars.tsx`, `threeq.tsx`, `back.tsx`, `Film.tsx`)

Never treat a 2D character or creature as a static cutout slid from `(x0, y0)` to `(x1, y1)`. Build every shot around six physical pillars:

### 1. Weight, Grounding, 4-Stage Jump Physics & Elevated Airspace (`GroundShadow`, `jumpPhase`, `MO-17`, `GE-20`)
- **Automatic Contact Shadows:** Every grounded non-`fg` actor and `SUBJECT` casts an altitude-responsive `GroundShadow` (`PAL.ink` core + soft penumbra) directly onto the floor plane (disable only for intentional ghosts/holograms via `shadow: false`).
- **4-Stage Jump / Takeoff / Landing Physics & Zero Mid-Air Walking (`side.tsx`, `Film.tsx`, `MO-17`):**
  - `PersonSide` drives `jumpPhase` (`0..1`) through: (1) **Takeoff crouch anticipation (`0..0.14`)** feet planted, (2) **Rising ascent / apex tuck (`0.14..0.52`)** body stretch + arms driving UP, (3) **Descending landing reach (`0.52..0.86`)**, and (4) **Grounded landing squash absorb (`0.86..1.0`)** flat feet + `<DustPuff>`.
  - `Film.tsx` binds `arcH` strictly to the keyed `legs: 'jump'` window (`[w0, w1]`) and enforces an **unbreakable mid-air physics lock** (`arcY > 4` cannot animate `walk`/`run` feet across side, `3q`, or `front`!).
  - **`MO-17` Enforcement:** Bans `arcH > 0` stretched across a path `> 1.85 s` without a bounded `legs: [..., ['jump', t0], ['run'|'walk', t1]]` window (`<= 2.2 s`) and auto-queues an 8-frame `jump takeoff/apex/land` strip.
- **Flying / Hovering Subjects & Elevated Airspace Sorting (`ExtraDef.altitude`, `MO-15`, `GE-20`):**
  - Declare `altitude: 160..280` on `pose: 'fly' | 'hover'` extras (`MO-15`). Airborne `SUBJECTS` (`altitude > 20`) split into a ground-plane `GroundShadow` + an elevated `+1200` airspace body above tabletop/ground `mid` props (`GE-20`: `> 45%` ERROR, `> 25%` WARN + HOT, auto-queues 8-frame strip).

### 2. Distance-Locked Gait Stop-Settle, Rear-Heel-Kick Runs & `3q`/`Front` Auto-Gait (`footCycle`, `side.tsx`, `threeq.tsx`, `chars.tsx`, `Film.tsx`)
- **Distance-Locked Side-View Walk/Run & Clean Stop-Settle (Zero Treadmill Running in Place!):**
  - When an actor has an `Actor.path` (`hasPath = true`), `Film.tsx` locks `phase = m.dist / cyc` directly to distance traveled along the floor — **never** free-running wall-clock `t`!
  - The instant path velocity settles (`v === 0` / `speed <= 0.04` before `path` starts or after arriving at the final waypoint), `speed` drops cleanly to `0`, pumping `run`/`swing` arms relax automatically to `'down'`, and torso forward lean settles into subtle breathing (`side.tsx`) — **eliminating treadmill running/walking in place**!
- **4-Phase Gait Biomechanics & Rear-Heel-Kick Run Swing (`anim.ts` `footCycle`):**
  1. **Heel-Strike** (`toeRot < 0`), 2. **Down Squash** (`gaitHipBob` + delayed head counter-nod), 3. **Toe-Off Push** (`toeRot > 0`), 4. **Asymmetric Swing Recovery**: `walk` keeps `60%` grounded stance (`32 px` arch); `run` drops to **`38%` stance** (true double-airborne flight phase) with a **rear-peaked `42 px` heel-kick recovery (`Math.sin(Math.PI * Math.pow(r, 0.72))`)** that folds high behind the hip after push-off and tapers cleanly into forward knee drive (no awkward symmetric high-stepping!). Pair sprints with `fx: ['dust']` (or `['dust', 'speed']`) and `wind: 0.6..1.0`.
- **Automatic Distance-Locked Gait on `3q` & `front` Paths (Zero Ice-Skating!):**
  - While profile `view: 'side'` remains standard for long horizontal walks (`MO-04`: `> 30 px` in `front` view errors), whenever an actor moves along `path` in **`view: '3q'`** (diagonal approaches/retreats) or brief **`front`** repositioning, `Film.tsx` passes distance-locked `phase` (`pathGaitPhase`) and velocity-scaled `speed` (`pathGaitSpeed`) into `Person3Q` and `Person`, scaling stride amplitude, arm counter-swing, hip bob, and head lag smoothly to `0` on arrival — **zero rigid ice-skating**!

### 3. True Straddle Mounting & `computeSubjectKinematics` (`SubjectSeat.straddle`, `grip`, `SeatShadow`, `MO-14`, `PR-08`)
- Attach riders via `mount: {target: 'ladybug', slot: 0}` onto a `SUBJECT` with `SubjectSeat` (`straddle: true`, subject-local IK `grip: [gx, gy]`, `wind: 1.2..1.5`, matching travel `face` across all riders per `MO-14`).
- `Film.tsx` renders the **3-layer straddle sandwich** (`layer="far"` behind shell → creature + `SeatShadow` → `layer="near"` hugging flank with hands IK-locked onto `grip`) and locks both mount and riders to sub-pixel precision with **`computeSubjectKinematics`** (aerial flight bob/bank + quadruped stride rock/bob & paw `<DustPuff>` when `speed > 0.45`; `PR-08` enforces animated creature legs/wings/tail/breathing).

### 4. Contact-Locked Physical Effort (`Actor.pushTarget`, `fx: ['sweat']`, `MO-13`)
- **Zero Air-Pushing (`MO-13`):** Never use `p: 'push'` or `legs: 'push'` without `pushTarget: [tx, ty]` (or timed `reach`) within real arm reach (`<= 280 * H * s * 1.15`; `> 380 * H * s` = ERROR). Pair with `lean: 12..18`, `fx: ['sweat']`, and a set `keys` reaction.

### 5. Living Micro-Acting, `CartoonHand`, 2D `Actor.lookAt`, 3D Turnarounds, Creature Spring-Morph & Impact FX (`MO-15`)
- **`livingIdle`, `talkGesture` & `poseImpulse`:** Continuous chest breathing, hip sway, head micro-tilt, and pupil saccades (`livingIdle`), dialogue nod/brow/hand bounce (`talkGesture`), and spring hop-dip impulses (`poseImpulse`).
- **Articulated `CartoonHand` (`'open' | 'point' | 'fist' | 'cup'` via `inferHandKind`) & 2D `Actor.lookAt` (`[x, y]` or `[x, y, TT][]`):** Real extended index fingers on `pointL`/`pointR` in Close-Ups and full horizontal + vertical pupil tracking toward towering giants, floor targets, or moving creatures.
- **3D `'3q'` Stepped Turnarounds (`|sx| >= 0.78`) & Creature Spring-Morph (`poseU`):** Volumetric `'3q'` view-bridges replace `sx = 0.12` pancake flips (`MO-10` still guards unintended locked-`face` `dx` reversals), and `SUBJECTS` squash-stretch smoothly across pose keys.
- **Procedural Riso `ActionFx` (`MO-15`):** `'dust' | 'sweat' | 'speed' | 'impact' | 'stars'`; `fall`/`trip` requires `fx` or `shake` (`MO-15`).

### 6. Multi-Action Choreography Density (`MO-16`), Anti-Freeze (`MO-18`) & Anti-Statue Living Creatures (`PR-09`)
- **`MO-16` (`long_16x9`):** Shots `> 5.0 s` with `0` choreography events = **ERROR**; `< 2` events (`> 5.0 s`) or `< 3` events (`> 8.5 s`) = **WARN**.
- **`MO-18` (Anti-Frozen-Statue & Frozen-Attack Guard):** `SUBJECT` attack poses (`pounce | charge | dive | attack`) frozen `> 1.8 s` without a lunge `path`/follow-through = **ERROR**; actor standing static `> 3.4 s` without `talk`/`path`/`reach`/keyed `p`/`e`/`view` beats = **WARN + HOT**.
- **`PR-09` (Anti-Statue Living Creature Motion Guard):** On any shot **`> 2.2 s`**, a `kind: 'creature'` `SUBJECT` standing in **`1` static pose at `1` spot** (zero `path` locomotion AND `< 2` distinct keyed `pose` or `expr` beats — *"đứng như trời trồng"*) is a **hard ERROR + HOT**! Give every on-screen creature either a real prowling/stalking/flying `path` (`>= 2` moving waypoints) OR `>= 2` distinct keyed `pose` / `expr` beats (e.g. `pose: [['stalk', 0], ['lookup', 's72@ngẩng']]` or `expr: [['calm', 0], ['alert', 's72@nghe']]`).

### DO vs DON'T (`MO-13..18`, `PR-09`, `GE-20`)
| Beat | DON'T (Pasted-Sticker / Statue Fail) | DO (Studio 2D Craft `v5.6`) | Guard |
|---|---|---|---|
| Run in & stop to speak | `legs: 'run'` pumping in place like a treadmill after arriving at waypoint | `path: [[220, 850, 0], [640, 850, 's8@dừng']]`, `legs: [['run', 0], ['walk', 's8@dừng']]` (distance-locked `phase = dist/cyc` auto-settles `speed → 0` & `arms → 'down'` on stop!) | `MO-06`, `sv-21` |
| Creature in a 3.5 s suspense shot | `{k: 'giantCat', pose: 'idle', x: 1320, y: 860}` frozen in 1 spot & 1 pose for 3.5 s | Add prowl `path: [[1420, 860, 0], [1260, 865, 's74@rình']]` OR key `pose: [['stalk', 0], ['lookup', 's74@khịt']]`, `expr: [['calm', 0], ['fierce', 's74@khịt']]` | `PR-09` |
| Creature attack (`pounce`/`charge`/`dive`/`attack`) | `{k: 'giantCat', pose: 'pounce', x: 1200, y: 860}` frozen mid-air `> 1.8 s` | Key `pose: [['stalk', 0], ['pounce', 's18@vồ'], ['idle', 's18@trượt']]` + lunge `path` (`<= 1.8 s` hold) + `shake` | `MO-18`, `PR-09` |
| Pushing a door / pencil-lever | `{p: 'push', x: 500, y: 840}` pushing empty air | `{p: 'push', x: 500, y: 840, pushTarget: [640, 560], lean: 14, fx: ['sweat']}` + `keys` reaction | `MO-13` |
| Two riders on a flying creature | Flat `seats` or opposing `face: 1` / `face: -1` or `altitude` omitted | `straddle: true`, `grip: [gx, gy]`, `wind: 1.4`, same `face` + `altitude: 220` (`+1200` airspace) | `MO-14..15`, `GE-20` |
| Jump across a gap | `arcH: 150` stretched across a 4 s walk path (mid-air walking!) | Bounded `<= 2.2 s` window: `legs: [['run', 0], ['jump', t0], ['run', t1]], arcH: 150` | `MO-17` |
| Listener in a 4.5 s take | Static `{p: 'stand', e: 'neutral'}` with zero beats `> 3.4 s` | Key reaction `p` / `e` / `view` + 2D `lookAt` on the punch word | `MO-18` |

---

## Strip checklist (what "correct" looks like)
| Strip | Must see |
|---|---|
| walk / run | profile or diagonal `3q` view; distance-locked 4-phase heel-strike → down squash → toe-off → rear-peaked `42 px` heel-kick run swing; stance foot planted on floor; **clean stop-settle (`speed=0`, arms down) when waypoint ends (zero treadmill running in place & zero `3q` ice-skating!)**; `GroundShadow` beneath feet; `fx: ['dust']` on sprints |
| reach / push | settle frame (`>= 0.3 s` after arrival, `MO-06`), anticipation, hand physically ON target / `pushTarget` in ≥ 2 frames (`MO-13`), world reacting (`keys`) |
| sit/stand | path ends at seat, hip lowers over ~0.45 s, knees bend forward, feet stay planted, seat under hip (`MO-12`) |
| ride / mount | piggyback rider on carrier's back; `Actor.mount` riders in 3-layer straddle (`layer="far"` behind shell, `SeatShadow`, hands on `grip`, wind hair, matching travel `face`, `MO-14`) |
| jump / fall | 8-frame `jump takeoff/apex/land` strip (`MO-17`): takeoff crouch → apex tuck (arms UP, zero mid-air walking!) → landing reach → flat-foot squash + `<DustPuff>`; falls pop with `fx: ['impact', 'stars']` (`MO-15`) |
| flying / moving subject | 8-frame `subject motion/occlusion` strip (`GE-20`, `PR-09`): airborne `SUBJECT` (`altitude > 20`) stays unobstructed (`<= 25%`) above `mid` props with floor `GroundShadow`, and creatures actively prowl/shift poses (zero statues!) |
| set key | the change (door sliding, number changing) is visible and starts on the word (`KY-01`) |

## Core Rules (`MO-01..MO-18`, `PR-09`, `GE-20`)
- Long horizontal walks (`> 30 px`) use `side` view (`MO-04`); diagonal `3q` paths auto-gait cleanly via `pathGaitPhase`/`pathGaitSpeed`.
- Speeds come from character physics (`actor-api.md`, `MO-02`/`MO-03`); waypoints must be monotonic (`MO-01`), without reversing `dx` against a locked `face` (`MO-10`).
- Reach geometry: arrive `>= 0.3 s` before reaching (`MO-06`), within arm range (`MO-05`), 120–180 px beside target at its `fy` floor line (`MO-09`); never reach across own face or walk in `side` view with `arms: 'raise'` (`MO-11`). Piggyback `ride` target must be in shot (`MO-07`).
- Talkers meet height floors (`>= 480 px` on 9:16, `>= 270 px` on 16:9, `SZ-01`); acting bodies stay in frame (`SZ-02`); every shot moves/changes (`MO-08`, `MO-16`).
- Keep `seatH <= 180` (`<= 40` outdoors without seat prop, `MO-12`); use `z` nudges for shared floor planes (`GE-17`).
- First-pass staging recipes: for `goKart` / `fireTruckCab`, place vehicle `WORLD_PROP` with `prop.y > actor.y`; for beds (`o.sleeping`), split blanket into `mid` at `y = bedBot + 45` above actor at `y ≈ bedBot`; for bus roof racks, seat rider at `busY - 635` centered over rails.

## Fixes for common defects
| Defect in the strip / card | Fix |
|---|---|
| Feet slide / moonwalk / treadmill in place | verify `path` speed (`<= vNom × 2.4`, `MO-02`); on `path`, `Film.tsx` distance-locks `phase = dist/cyc` and stops `run`/`walk` automatically when `v === 0` — key `legs: 'stand'` or reaction `p` if holding after arrival |
| `3q` / `front` character glides stiffly | move via `Actor.path` (auto-drives `pathGaitPhase`/`pathGaitSpeed`) or switch to `view: 'side'` for long `> 30 px` walks (`MO-04`) |
| Creature stands like a statue (`PR-09`) | on shots `> 2.2 s`, give every `kind: 'creature'` `SUBJECT` either a moving `path` (`>= 2` waypoints) or `>= 2` distinct keyed `pose` / `expr` beats |
| Frozen creature mid-attack or static actor (`MO-18`) | follow through `pounce\|charge\|dive\|attack` within `<= 1.8 s` via lunge `path` or recovery pose; add actor `p`/`e`/`view`/`talk`/`path` beats every `<= 3.4 s` |
| Invalid `SUBJECTS` pose/expr (`SH-10`/`SH-11`) or stalled `keys` ramp (`MO-19`) | use only declared `SUBJECTS[k].poses`/`exprs` (lint errors on unknown strings); remember `keys: {k: [[v0, 0], [v1, atTime, dur]]}` holds `v0` static UNTIL `atTime`, then ramps over `dur` — start `atTime` early (`<= 70%` of shot) so motion reads across the shot |
| Mid-air walking / stretched jump arc (`MO-17`) | bind `arcH > 0` to a bounded `legs: [..., ['jump', t0], ['run'\|'walk', t1]]` window (`<= 2.2 s`) |
| Flying creature occluded by mid props (`GE-20`) | set `altitude: 160..280` for `+1200` airspace sorting and clear foreground blockers (`<= 25%`) |
| Hand pushes air / misses target (`MO-05`, `MO-09`, `MO-13`) | stand 120–180 px beside target at `fy` and lock hands with `pushTarget: [tx, ty]` or `reach` from `geo.ts` |
| Riders look pasted flat (`MO-14`) | add `straddle: true`, `grip: [gx, gy]`, and `wind` on `SubjectSeat` with matching rider `face` |
| Dead Long-Form shot (`MO-16`) / weightless fall (`MO-15`) | layer `>= 2` events on shots `> 5.0 s` (`>= 3` if `> 8.5 s`); add `fx: ['impact', 'stars']` or `['dust']` + `shake` on falls |
