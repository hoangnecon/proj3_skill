# Conventions (`v5.5.0`)

Enforced by `tools/validate_skills.py`.

## Repository layout — one kind of thing per top-level folder
| Folder | Holds | Never holds |
|---|---|---|
| `skills/` | instructions only: `sv-*/SKILL.md` + `references/*.md` (the plugin's `skills` path) | code, data, templates |
| `standards/` | the house standards as versioned data: `voice_standard.json`, `pacing.json`, `mix_targets.json` | anything one episode may change |
| `engine/` | code every episode shares: `scripts/` (tools), `src/` (Remotion engine), `package.json`, `tsconfig.json`, `remotion.config.ts` | episode content, standards, examples |
| `starter/` | the blank episode files an agent fills in: `brief.md`, `beats.md`, `script.json`, `audio.json`, `src/episode/*`, empty `src/data/*`, `gates/*.review.md`, `README.md` | demo or reference content |
| `examples/` | `thang-may/` (reference episode: geo, looks, sets, shotlist), `demo/` (4-shot engine demo, an overlay on a new episode) | anything a real episode needs to run |
| `tools/` | suite tooling: `new_episode.sh` (assembles an episode), `validate_skills.py`, `benchmark_suite.py` (dual-format quality & speed regression CLI) | episode tools (those live in `engine/scripts/`) |
| `docs/` | reviews and research notes about the suite | instructions (those are skills) |

An episode is assembled, never edited in place in the suite: `engine/` → episode root, `standards/` →
`standards/`, `examples/thang-may/` → `src/exemplar/`, `starter/` on top, and `examples/demo/` on top only with
`--demo`. The episode keeps its own copy, so a later suite change never alters a finished episode; the gates
pin `standards/` by hash.

## Skills
- Directory `skills/sv-<TT>-<slug>/` with `SKILL.md`; the tier digit groups phases: 0 pipeline/bible,
  1 story and voice, 2 picture, 4 sound and delivery.
- Frontmatter: `name` equals the directory name; `description` is 150–1024 characters with no `<` or `>`,
  and says both what the skill does and when to use it.
- `SKILL.md` ≤ 500 lines. Every file in `references/` and `scripts/` is mentioned in its SKILL.md
  (or, for scripts, in sv-00's commands reference).
- English prose for instructions. Vietnamese is used where it is the content: narration, on-screen text,
  quoted user feedback, northern/southern word lists, gate review templates.

## Rules and lint IDs (`150` lint rules)
| Prefix | Area | Where |
|---|---|---|
| SC-01..27, SC-29..35 | script, words budget, voice text rules, 5-Knot spine, Long-Form 5-Chapter/3+ Plants/Anti-Padding (`SC-27`, `SC-29..31`), 10-Year-Old Linear Worldbuilding (`SC-32`), Readability & Anti-Bloated-Prose (`SC-33`), Cute/Spooky-Fun/Curious Emotional Triad & Direct Dialogue (`SC-34`), and Brisk `5.65 ups` Anti-Drone Dynamic Tempo (`SC-35`) | `scripts/script_lint.py` |
| CH-01..10 | characters (format-aware cast richness `CH-09`, no hand-drawn characters outside `<Person>` `CH-10`) | `scripts/lint.mjs design` |
| TK-01..03 | tokens (no raw colours, one font) | `lint.mjs design` |
| SE-01..19 | sets: density, text, halftone, glow, bounds, life, plate emptiness, plate sign clipping, Long-Form Spatial Location Packs (target 24–30 drawn sets, ≥15 floor, ≥3 locations with ≥3 redrawn angles `SE-15`), perceptual plate clutter/contrast/balance gate (`SE-16`), Spatial Location-Pack Continuity Guard (`SE-17`: `cameraDir` enum, `landmarks` format/sharing, no duplicate `(angle, shotScale, cameraDir)`), Perspective-Horizon Consistency Guard (`SE-18`: warns against pairing `cameraDir: 'top'` flat 90° floorplans with horizon-rig `side`/`front` actors; use 3/4 elevated `angle: 'high'`, `cameraDir: 'front'|'left'|'right'`), Anti-Clone-Stamp Botanical & Prop Silhouette Variety Guard (`SE-19`: bans `>= 9` verbatim identical curved SVG `<path>` silhouettes across a set; vary plant species — clover, daisy, curved grass blades, ferns, pebbles — scale, and angle) | `lint.mjs design` & `shots` |
| PR-01..06, PR-08 | props & Hero Subjects: human-scale proportions & origin, internal text collision, no disembodied `*Head`, grip distance, giant partial-body continuity (`PR-05`), multi-pose Hero Subjects (`PR-06`), Living Creature Locomotion & Idle Animation Guard (`PR-08`: `kind: 'creature'` subjects MUST animate legs/wings/tail/breathing across `opts.t` / `opts.phase` in `SubjectRenderOpts` — `0` animated poses = ERROR, `< 50%` = WARN) | `lint.mjs design` |
| SH-01..21 | shot table & transitions (`ShotDef.tr`: `cut|flash|wipe|whipL|whipR|iris`), long-hold warning (`SH-15`: warn `> 8.0 s` on `long_16x9`), Long-Form set-fatigue streak/share (`SH-16`), cinematic view/prop diversity (`SH-17`), multi-pose Hero Creature enforcement (`SH-18`), atmospheric `ShotDef.mood` enum & over-dark `danger` + `night > 0.7` guard (`SH-19`), Shot-Scale Alternation & Anti-Dollhouse-Wide Streak Guard (`SH-20`: flags `>= 3` WARN / `>= 4` ERROR consecutive full-stage wide/medium shots `zoom <= 1.16` with zero close-up/POV/OTS breaks), Multi-Location Cut & Spatial Pack Progression Guard (`SH-21`: warns `> 11` / errors `> 16` unbroken shots in a single `location` when multiple Location Packs exist) | `lint.mjs shots` |
| LA-01..04 | layout & scale CI: set `actorScale`/`shotScale`/`location` & `relToActor` ratios (`LA-01`), 3×3 spatial grid & union occupancy clutter budget (`LA-02`), ban fake close-up camera zoom on establishing/wide sets (`LA-03`), z-aware occlusion & awkward hero creature frame-edge cut-off (`LA-04`) | `lint.mjs design` & `shots` |
| AN-01..02 | anchors | `lint.mjs shots` |
| OV-01..04 | overlays | `lint.mjs shots` |
| CA-01..08 | camera: zoom, move jolt, ratio, establish, world bounds (`CA-01..05`), 180° axis/eyeline continuity (`CA-06`), Long-Form shot-size progression & variety rhythm (`CA-07`), multi-waypoint `ShotDef.camKeys` choreography guard (`CA-08`) | `lint.mjs shots` |
| SZ-01..02 | on-screen size and framing | `lint.mjs shots` |
| MO-01..18 | motion (`src/anim.ts`, `side.tsx`, `chars.tsx`, `threeq.tsx`, `back.tsx`, `Film.tsx`): walk/reach/sit/ride (`MO-01..09`), locked-`face` `dx` reversal (`MO-10`), reach-across-face / raised-arms walk (`MO-11`), floating `seatH` (`MO-12`), contact-locked `pushTarget` (`MO-13`), straddle mount & rider cohesion (`MO-14`), valid `ActionFx`, fall/trip impact weight & flying `altitude` shadow (`MO-15`), Long-Shot Choreography Density Guard on `long_16x9` (`MO-16`: `> 5.0 s` / `> 8.5 s`), 4-stage `jumpPhase` bounded `legs: 'jump'` window & zero mid-air walking guard (`MO-17`, auto-queues 8-frame jump strip), Anti-Frozen-Statue & Frozen-Attack Guard (`MO-18`: `SUBJECT` `pounce|charge|dive|attack` frozen `> 1.8 s` without lunge path/follow-through = ERROR; static actor `> 3.4 s` without acting/talk/path beats = WARN + HOT) | `lint.mjs shots` |
| KY-01 | animated set keys | `lint.mjs shots` |
| CO-01..03 | coverage | `lint.mjs shots` |
| PC-01..03 | dual shot pacing (`standards/pacing.json`: `shots` for 9:16 Shorts; `shots_long_16x9` for 16:9 Long-Form) | `lint.mjs shots` |
| GE-01, GE-04, GE-07, GE-10, GE-11, GE-15..20 | screen geometry: overlap, head/caption, size jump, sign clip & parallax-aware sign occlusion (`GE-11`: transient 1-sample pass-through by moving/flying subjects allowed; persistent `>= 2/3` occlusion warns), prop clip, overlay/prop head cover, cast continuity, severed mid-frame giant limb (`GE-19`), Hero Subject / flying creature airspace occlusion (`GE-20`: `> 45%` ERROR, `> 25%` WARN + HOT, auto-queues 8-frame subject strip) | `lint.mjs shots` |

A rule documented in a skill must name its lint ID when one exists. A waiver is
`// lint-ok: <ID> <reason>` on the shot's line, and it must be justified in the G5 review.

## Gates
- There are seven gates, G1 to G7 (see sv-00). Run `scripts/sv_doctor.py --stage G#` for fast zero-cost preflight before checking or passing a gate, `scripts/plan_assets.py` at the G2→G4 handoff to derive the deterministic asset blueprint (cast, Hero Subjects, and multi-angle/sub-scene set targets), and `scripts/plan_audio.py` at the G5→G6 handoff to derive synchronized physical foley cues and ambience bed spans from `qa/shots.json`.
- `scripts/design.mjs` renders all design sheets plus location-sorted `qa/design/overview_sets.jpg` (single-page set overview contact sheet), per-location multi-angle continuity strips `qa/design/location_<loc>_pack.jpg` (for every location with `>= 2` rendered sets), and `qa/design/visual_spec.json`.
- `scripts/qa.mjs pass` generates **Mandatory 3-Tier Hierarchical Contact Sheets** and **Perceptual Pixel Motion-Energy QA** in one browser session: Tier 1 **Đại đoạn** (`qa/contact_p<N>.jpg`: 4 frames/shot `> 4.0 s`, 2 frames `<= 4.0 s`), Tier 2 **Trung đoạn** (`qa/contact_segments/seg_<NN>_<loc>.jpg` per-location/per-scene sequences), Tier 3 **Tiểu đoạn** (`qa/shots/<NN>.jpg` 8-frame `4×2` action filmstrips stamped with `Δ=%` pixel motion delta + `qa/strips/<name>.jpg` 8-frame action strips for dynamic/long/HOT shots), and `qa/motion_energy.json` (warning on `frozen_streak >= 2`); `scripts/blind_pack.mjs` wires `shot_strip` into `blind_sha`, and `qa.mjs review --batch` + `scripts/sv_gate.py` enforce `"shot_strip"` or `"strips"` in `looked` (zero blind review).
- `scripts/sv_gate.py` writes `gates/log.jsonl` with hashes of each gate's inputs. When an input changes, that gate and every later gate become STALE.
- Review files must name every evidence file with a remark of at least 4 words, and must be newer than the evidence.
- G1, G2 and G4 need `approval: user` (with `user_quote`) or `approval: delegated`.

## Episode assembly
- An episode made by `tools/new_episode.sh` (blank and `--demo`) must type-check (`npx tsc --noEmit`) and run
  `node scripts/times.mjs`.
- Generated folders are git-ignored and never committed: `audio/`, `public/`, `qa/`, `out/`, `gates/log.jsonl`
  in an episode, `examples/demo/audio/` and `examples/demo/public/` in the suite.
