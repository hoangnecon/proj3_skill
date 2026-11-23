# story-video-skills (`v5.7.0`)

A gated production suite for **Vietnamese 2D story videos**: vertical 1080×1920 Shorts (2–3 min, **<= 15-min SLA**) and opt-in widescreen 1920×1080 Long-Form (9.5–16.0 min, **built and gate-locked Unit-by-Unit across 4–9 standalone Episodic Units `U1..Uk`**, **Spatial Location Packs** of 24–30 multi-angle redrawn sets with `scaleMode: 'normal'|'tiny'`, stateless background plates `SE-20`, 3/4 elevated perspective, dedicated `closeup`/`pov` plates & `SE-19` silhouette variety + **multi-scale cinematic shots** via `shots_long_16x9`, `SH-20..23`, `LA-03`, `PR-09`, `ShotDef.tr` & `ShotDef.camKeys`) at 30 fps,
narrated by the northern male voice Hải Đăng at the **pure `5.25 ups` house standard across all formats** (`SC-35`), drawn in a flat "riso ink" style (with distance-locked side-view walk/run stop-settle, rear-heel-kick `42 px` run swing, automatic `3q`/`front` path gaits, living quadruped Hero Subjects with `firstSeg`/`appearSegs`/`poseSegs` & `scaleWithTinyActor`/`partialOf` close-ups, `CartoonHand`, 2D `Actor.lookAt`, `livingIdle`/`talkGesture`/`poseImpulse`, 3D `'3q'` stepped turnarounds, `computeSubjectKinematics`, 4-stage `jumpPhase`, elevated `+1200` airspace sorting, 3-layer straddle mounts, `pushTarget`, `ActionFx`, Botanical Kit, `mood`/`dof`, and static `url(#grainPat)`), and animated in Remotion with every shot anchored to a narration word.

The suite packages the process that produced the reference episode *Thang máy ăn bí mật* (153 s, 26 segments,
67 shots). Each phase ships with:
- exact specs: design tokens, rig numbers, detail budgets, shot grammar, pure `5.25 ups` Hải Đăng voice across Short & Long-Form, and dual cut-pacing benchmarks (`shots` for 9:16 Shorts; `shots_long_16x9` + sequential `units` for 16:9 Long-Form);
- machine checks: **156 lint rules** (including Episodic `"units"` Chapter Plan `SC-37`, Crystal-Clear Kid Hook & Plain Spoken Sentences `SC-36`, Pure `5.25 ups` Voice Integrity `SC-35`, 10yo Linear Worldbuilding & Emotional Triad `SC-32..34`, Set `scaleMode` & Stateless Plate Guard `SE-20`, Scale-Mode Continuity `SH-22`, Temporal Creature/State Bleed Guard `SH-23`, Cross-Angle Creature Scale Lock & `partialOf` Close-Ups `LA-03`, Anti-Statue Living Creature Motion `PR-09`, Living Creature Locomotion `PR-08`, Botanical Silhouette Variety `SE-19`, Multi-Location Progression `SH-21`, Shot-Scale Alternation `SH-20`, 3/4 Perspective `SE-18`, Anti-Freeze `MO-18`, 4-Stage Jump `MO-17`, Flying Airspace `GE-20`, `camKeys` `CA-08`, and studio contact CI `MO-13..16`), `scripts/plan_assets.py`, `scripts/plan_audio.py`, `scripts/sv_doctor.py`, `qa.mjs place`, and `tools/benchmark_suite.py`;
- rendered evidence the agent must open and remark on: `qa/design/overview_sets.jpg`, `qa/design/location_<loc>_pack.jpg`, **Unit-Scoped QA Sheets** (`qa/units/U<k>_contact.jpg` + `qa/blind_review/unit_U<k>.json`) locked via **`sv_gate.py pass-unit U<k>`**, and **3-Tier Hierarchical Contact Sheets** (Đại đoạn `qa/contact_p*.jpg`, Trung đoạn `qa/contact_segments/seg_*.jpg`, Tiểu đoạn 8-frame `qa/shots/NN.jpg` `Δ=%` + `qa/strips/*.jpg`, and `qa/motion_energy.json`);
- a gate log (`G1`–`G7` + sequential `G5.U1..G5.Uk`) that goes stale when its inputs change.

The goal is that any agent reproduces the same level of detail, not "a few boxes".

## Start
Read `skills/sv-00-pipeline/SKILL.md`, then:
```bash
bash tools/new_episode.sh ~/Work/PROJ3/<slug> --node-modules ~/Work/PROJ3/mua-noi-doi/node_modules
# --demo: a separate sandbox with the 4-shot engine demo
```

## Skills
| Skill | Phase | Gate |
|---|---|---|
| `sv-00-pipeline` | entry point: phase map, commands, gate mechanics, house rules | all |
| `sv-01-series-bible` | series identity, narrator, comedic engine, premise test, no-copying rule | G1 |
| `sv-02-long-form` | 16:9 · 10–15 min Long-Form mode (Episodic Unit-by-Unit `U1..Uk` production & gates) | G1–G7, G5.U* |
| `sv-10-script` | brief → beats → script.json; 10yo hook, linear worldbuilding, pure `5.25 ups`, episodic `units` (`SC-01..27`, `SC-29..37`) | G1, G2 |
| `sv-12-voice` | Hải Đăng TTS (`v2.0`): pure per-sentence `5.25 ups` + `1.02` pitch across Short & Long-Form (`SC-35`), `<en>`, emotion tags, alignment | G3 |
| `sv-20-design-system` | tokens, characters, Spatial Location Packs (`scaleMode`, stateless plates `SE-20`), quadruped Hero Subjects (`partialOf`), props | G4 |
| `sv-21-motion` | distance-locked stop-settle gaits, rear-heel-kick runs, `3q`/`front` auto-gait, `PR-09` living creatures, jumps/mounts | G5 |
| `sv-22-shots-camera` | word anchors, multi-scale cuts, `SH-22..23` continuity, `LA-03` creature scale lock, `--unit` QA & `pass-unit` gates | G5 |
| `sv-40-audio` | audio.json: beds, foley, accents, silences, series theme music (theme.py) | G6 |
| `sv-42-mix-master` | house mix/master chain + 21 measured checks (mix_targets.json), plots, audio checks inside the video | G6, G7 |
| `sv-41-qa-delivery` | master render, final-watch rubric | G7 |

## Repository layout
```
story-video-skills/
├── skills/        instructions only — one folder per phase skill (SKILL.md + references/)
├── standards/     house standards as data: voice_standard.json · pacing.json · mix_targets.json
├── engine/        code every episode shares
│   ├── scripts/   tools: lint, voice, mix, audio QA, design/qa renders, blind_pack, deliver, gates
│   └── src/       Remotion engine: engine, anim, kit, chars, side, back, threeq, overlays, props, subjects, Film, design sheets, set registry
├── starter/       blank episode: brief, beats, script.json, audio.json, src/episode/*, gates/*.review.md
├── examples/
│   ├── thang-may/ reference episode (cast looks, sets, geometry, shotlist) — the quality bar
│   └── demo/      4-shot engine demo, layered on a new episode with --demo
├── tools/         new_episode.sh (assembles an episode) · validate_skills.py · benchmark_suite.py
└── docs/          reviews of the suite
```
A new episode is assembled from these parts (see `CONVENTIONS.md`), and its `README.md` marks three zones:
what the agent writes (`brief.md`, `beats.md`, `script.json`, `audio.json`, `src/episode/`, gate reviews),
the read-only suite copy (`scripts/`, engine `src/`, `src/exemplar/`, `standards/`), and generated output
(`src/data/`, `audio/`, `public/`, `qa/`, `out/`).

## Why the gates measure quality, not quantity
v1 was rejected because agents could satisfy counters without good work (`docs/review-2026-11-15.md`).
Every count is backed by something that has to be looked at:
- Set density and perceptual quality are measured on the **rendered** plate (`SE-13`, `SE-16`), and plates stay stateless (`SE-20`).
- Long-form episodes cannot be batch-dumped: `sv_gate.py pass-unit U<k>` enforces sequential `U1 → U2 → … → Uk` completion with 4-frame/shot `qa/units/U<k>_contact.jpg` and 10-check `blind_sha` reviews before the next unit starts.
- Each evidence image needs a written remark, and the review must be newer than the evidence.
- G1, G2 and G4 need the user's quoted approval.

## Measured RSI Evolution (`v4.0 → v5.6`)
| Dimension | `v4.0` Baseline | `v5.6` Verified Result |
|---|---|---|
| Lint rules | `108` | **`156`** (`validate_skills.py`: 0 errors, 0 warnings; adds `SC-36..37` Kid Hook & Episodic `units`, pure `5.25 ups` `SC-35`, `SE-20` `scaleMode`/stateless plates, `SH-22` scale-mode lock, `SH-23` temporal creature/pose bleed guard, `LA-03` cross-angle creature scale lock + `partialOf`, and `PR-09` anti-statue creature guard) |
| Episodic Unit-by-Unit Gate (`v5.6.0`) | Parallel 160-shot batch dump & giant 55-shot end slices | **Sequential `U1 → U2 → … → Uk` protocol** (`SC-37` `4–9` units, `qa.mjs pass --unit Uk` ~20–30s 4-frame/shot `qa/units/Uk_contact.jpg`, `blind_pack.mjs --unit Uk`, `sv_gate.py pass-unit Uk` sequential lock + 30s cooldown verified by `G5`) |
| Pure Voice & 10yo Storytelling (`v5.6.0`) | Artificial `5.65 ups` speed warp & textbook mechanical jargon | **Pure `5.25 ups` Hải Đăng** across Short & `9.5–16.0 min` Long-Form (`SC-35`), `≤ 18w` wonder hook & plain `9–14w` spoken kid sentences (`SC-36`), linear worldbuilding (`SC-32`), and Emotional Triad (`SC-34`) |
| Spatial Location Packs & Stateless Continuity | 5–6 flat walls, baked plot props & normal/tiny set bleed | **24–30 drawn sets** (`5–6` locations × `5` angles incl. `closeup`/`pov`, 3/4 `high` `SE-18`, varied botanical paths `SE-19`), **`SetDef.scaleMode` & `stateless` (`SE-20`, `SH-22`)**, `qa/design/location_<loc>_pack.jpg` |
| Quadruped Creatures, Scale Lock & Gait Craft | Snowman cat blobs, shrunk cats in close-ups, treadmill stops, `3q` ice-skating | True quadruped anatomy, `firstSeg`/`appearSegs`/`poseSegs` (`SH-23`), `scaleWithTinyActor` + `partialOf` `giantCatPaw`/`giantCatHead` (`LA-03` `<= 1.85×` spread), `PR-09` anti-statue guard, distance-locked stop-settle, rear-heel-kick run, and `3q`/`front` auto-gait |
| 3-Tier & Pixel Freeze QA (`v5.3–v5.6`) | 2–3 frame blind checks | Unit contact sheets (`qa/units/Uk_contact.jpg`) + Đại đoạn / Trung đoạn / Tiểu đoạn 8-frame `qa/shots/NN.jpg` (`Δ=%` `qa/motion_energy.json`) + `blind_sha` & `looked` enforcement |
| 1920×1080 Render & Preflight Speed | `4.74 fps` (`v4.2` PNG) | `12.98 fps` (`v4.4+` JPEG q=95 + `grainPat` + Adaptive Macro-Blocks), `sv_doctor.py` (`0.83s`), `plan_assets.py` (`< 0.5s`), `plan_audio.py` (`< 0.1s`) |

## Validate & benchmark the suite
```bash
python3 tools/validate_skills.py
python3 tools/benchmark_suite.py
```
