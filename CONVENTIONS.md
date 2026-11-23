# Conventions (`v5.7.0`)

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

## Rules and lint IDs (`156` lint rules)
| Prefix | Area | Where |
|---|---|---|
| SC-01..27, SC-29..37 | script, words budget, voice text rules, 5-Knot spine, Long-Form 5-Chapter/3+ Plants/Anti-Padding (`SC-27`, `SC-29..31`), 10-Year-Old Linear Worldbuilding (`SC-32`), Readability & Anti-Bloated-Prose (`SC-33`), Cute/Spooky-Fun/Curious Emotional Triad & Direct Dialogue (`SC-34`), Pure `5.25 ups` Voice Integrity banning artificial speed warping (`SC-35`), Crystal-Clear Kid Hook & Plain Spoken Sentences (`SC-36`), and Mandatory Episodic `"units"` Chapter Plan `U1..Uk` (`SC-37`) | `scripts/script_lint.py` |
| CH-01..10 | characters (format-aware cast richness `CH-09`, no hand-drawn characters outside `<Person>` `CH-10`) | `scripts/lint.mjs design` |
| TK-01..03 | tokens (no raw colours, one font) | `lint.mjs design` |
| SE-01..20 | sets: density, text, halftone, glow, bounds, life, plate emptiness, plate sign clipping, Long-Form Spatial Location Packs (`SE-15`), perceptual plate clutter/contrast/balance (`SE-16`), Location-Pack `cameraDir` & shared `landmarks` (`SE-17`), 3/4 elevated `angle: 'high'` perspective (`SE-18`), Anti-Clone-Stamp Botanical & Prop Silhouette Variety (`SE-19`), and Set `scaleMode: 'normal' \| 'tiny'` & Stateless Plate Guard (`SE-20`: never bake transient plot props/shadows into static backgrounds) | `lint.mjs design` & `shots` |
| PR-01..06, PR-08..09 | props & Hero Subjects: human-scale proportions & origin, internal text collision, no disembodied `*Head`, grip distance, giant partial-body continuity (`PR-05`), multi-pose Hero Subjects (`PR-06`), Living Creature Locomotion Guard (`PR-08`), and Anti-Statue Living Creature Motion Guard (`PR-09`: `kind: 'creature'` in shots `> 2.2 s` MUST move along `path` or key `>= 2` distinct `pose`/`expr` beats) | `lint.mjs design` & `shots` |
| SH-01..23 | shot table & transitions (`ShotDef.tr`: `cut|flash|wipe|whipL|whipR|iris`), long-hold warning (`SH-15`), set-fatigue streak/share (`SH-16`), cinematic view/prop diversity (`SH-17`), multi-pose Hero Creature enforcement (`SH-18`), `ShotDef.mood` guard (`SH-19`), Anti-Dollhouse-Wide Streak (`SH-20`), Multi-Location Cut Progression (`SH-21`), Scale-Mode Continuity & Set Bleed Guard (`SH-22`: normal vs tiny set lock), and Temporal Story-Order & Stateful Pose Bleed Guard (`SH-23`: `firstSeg`, `appearSegs`, `poseSegs`) | `lint.mjs shots` |
| LA-01..04 | layout & scale CI: set `actorScale`/`shotScale`/`location` & `relToActor` ratios (`LA-01`), 3×3 spatial grid & union occupancy clutter budget (`LA-02`), ban fake wide-plate zoom, enforce `scaleWithTinyActor` & `<= 1.85×` cross-angle creature scale spread on `tiny` sets (`LA-03`: use `partialOf` `giantCatPaw`/`giantCatHead` for tight close-ups), z-aware occlusion & awkward hero creature frame-edge cut-off (`LA-04`) | `lint.mjs design` & `shots` |
| AN-01..02 | anchors | `lint.mjs shots` |
| OV-01..04 | overlays | `lint.mjs shots` |
| CA-01..08 | camera: zoom, move jolt, ratio, establish, world bounds (`CA-01..05`), 180° axis/eyeline continuity (`CA-06`), Long-Form shot-size progression (`CA-07`), multi-waypoint `ShotDef.camKeys` choreography (`CA-08`) | `lint.mjs shots` |
| SZ-01..02 | on-screen size and framing | `lint.mjs shots` |
| MO-01..18 | motion (`src/anim.ts`, `side.tsx`, `chars.tsx`, `threeq.tsx`, `back.tsx`, `Film.tsx`): distance-locked walk/run stop-settle, rear-heel-kick run swing, `3q`/`front` auto-gait (`MO-01..09`), locked-`face` `dx` reversal (`MO-10`), reach-across-face / raised-arms walk (`MO-11`), floating `seatH` (`MO-12`), contact-locked `pushTarget` (`MO-13`), straddle mount & rider cohesion (`MO-14`), valid `ActionFx`, fall/trip weight & flying `altitude` (`MO-15`), Long-Shot Choreography Density (`MO-16`), 4-stage `jumpPhase` & zero mid-air walking (`MO-17`), Anti-Frozen-Statue & Frozen-Attack (`MO-18`) | `lint.mjs shots` |
| KY-01 | animated set keys | `lint.mjs shots` |
| CO-01..03 | coverage | `lint.mjs shots` |
| PC-01..03 | dual shot pacing (`standards/pacing.json`: `shots` for 9:16 Shorts; `shots_long_16x9` for 16:9 Long-Form) | `lint.mjs shots` |
| GE-01, GE-04, GE-07, GE-10, GE-11, GE-15..20 | screen geometry: overlap, head/caption, size jump, sign clip & parallax-aware sign occlusion (`GE-11`), prop clip, overlay/prop head cover, cast continuity, severed mid-frame giant limb (`GE-19`), Hero Subject / flying creature airspace occlusion (`GE-20`) | `lint.mjs shots` |

A rule documented in a skill must name its lint ID when one exists. A waiver is
`// lint-ok: <ID> <reason>` on the shot's line, and it must be justified in the G5 review.

## Gates
- There are seven phase gates, G1 to G7 (see sv-00), plus **Sequential Episodic Unit Gates (`G5.U1 .. G5.Uk`)** on `long_16x9` episodes declaring `"units"` (`SC-37`). Run `scripts/sv_doctor.py --stage G#` for fast zero-cost preflight, `scripts/plan_assets.py` at G2→G4, and `scripts/plan_audio.py` at G5→G6.
- `scripts/design.mjs` renders all design sheets plus location-sorted `qa/design/overview_sets.jpg`, per-location `qa/design/location_<loc>_pack.jpg`, and `qa/design/visual_spec.json`.
- **Unit-Scoped & 3-Tier QA (`scripts/qa.mjs`, `scripts/blind_pack.mjs`, `scripts/sv_gate.py`):** On `long_16x9`, each Episodic Unit `Uk` is built, rendered via `node scripts/qa.mjs pass --unit Uk` (4-frame/shot `qa/units/Uk_contact.jpg`, 8-frame `qa/shots/NN.jpg` `Δ=%`, `qa/strips/*.jpg`, `qa/cards/NN.jpg`, HOT `qa/crops/NN.jpg`, and `scripts/blind_pack.mjs --unit Uk` → `qa/blind_review/unit_Uk.json` + `manifest.json`), blind-reviewed (`qa.mjs review --batch`), documented in `gates/G5.Uk.review.md`, and locked via **`python3 scripts/sv_gate.py pass-unit Uk`** (`30 s` cooldown; `U2` is rejected unless `G5.U1` already passed in `gates/log.jsonl`!) before building `U(k+1)`. Full-episode `scripts/qa.mjs pass` generates Tier 1 Đại đoạn (`qa/contact_p<N>.jpg`), Tier 2 Trung đoạn (`qa/contact_segments/seg_<NN>_<loc>.jpg`), Tier 3 Tiểu đoạn (`qa/shots/<NN>.jpg` + `qa/strips/*.jpg`), and `qa/motion_energy.json`; `sv_gate.py check G5` / `pass G5` verifies every `G5.U1..G5.Uk` unit pass record plus all shot reviews.
- `scripts/sv_gate.py` writes `gates/log.jsonl` with hashes of each gate's inputs. When an input changes, that gate and every later gate become STALE.
- Review files must name every evidence file with a remark of at least 4 words, and must be newer than the evidence.
- G1, G2 and G4 need `approval: user` (with `user_quote`) or `approval: delegated`.

## Episode assembly
- An episode made by `tools/new_episode.sh` (blank and `--demo`) must type-check (`npx tsc --noEmit`) and run
  `node scripts/times.mjs`.
- Generated folders are git-ignored and never committed: `audio/`, `public/`, `qa/`, `out/`, `gates/log.jsonl`
  in an episode, `examples/demo/audio/` and `examples/demo/public/` in the suite.
