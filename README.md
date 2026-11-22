# story-video-skills (`v5.1.0`)

A gated production suite for **Vietnamese 2D story videos**: vertical 1080×1920 Shorts (2–3 min, **<= 15-min SLA**) and opt-in widescreen 1920×1080 Long-Form (8–12 min, **<= 45-min SLA**, **Spatial Location Packs** of 24–30 multi-angle redrawn sets + **65–110 rich choreographed shots** via `shots_long_16x9`) at 30 fps,
narrated by the northern male voice Hải Đăng, drawn in a flat "riso ink" style (with studio 2D animation physics via `src/anim.ts` — 4-view tapered articulated rigs, 4-phase foot-roll gaits, curved spines, grounded altitude shadows, 3-layer straddle mounts, contact-locked pushing, procedural riso `ActionFx`, multi-pose Hero Subjects, Botanical Kit, atmospheric `mood`/`dof` passes, and static `url(#grainPat)` texture), and animated in Remotion
with every shot anchored to a narration word.

The suite packages the process that produced the reference episode *Thang máy ăn bí mật* (153 s, 26 segments,
67 shots). Each phase ships with:
- exact specs: design tokens, rig numbers, detail budgets, shot grammar and dual rhythm benchmarks (`shots` for 9:16 Shorts; `shots_long_16x9` for 16:9 Long-Form);
- machine checks: 137 lint rules (including Spatial Location-Pack Continuity `SE-17`, Long-Shot Choreography Density `MO-16`, studio animation & contact CI `MO-13..15`, perceptual plate quality `SE-16`, 3×3 spatial layout/scale `LA-01..04`, camera grammar `CA-06..07`, and mood grading `SH-19`), deterministic G2→G4 Spatial Location Pack blueprinting (`scripts/plan_assets.py`), zero-cost preflight doctor (`scripts/sv_doctor.py`), zero-rework placement solver (`qa.mjs place`), and dual-format benchmark CLI (`tools/benchmark_suite.py`);
- rendered evidence the agent must open and remark on (including location-sorted `qa/design/overview_sets.jpg` and per-location `qa/design/location_<loc>_pack.jpg` continuity strips);
- a gate log that goes stale when its inputs change.

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
| `sv-02-long-form` | 16:9 · 10-minute Long-Form mode (horizontal framing, multi-act pacing & production) | G1–G7 |
| `sv-10-script` | brief → beats → script.json; rhythm benchmarks, northern wording, rubric | G1, G2 |
| `sv-12-voice` | Hải Đăng TTS (`v2.0`): per-sentence 5.25 ups rhythm + 1.02 pitch, bilingual `<en>`, `…` & emotion tags, word alignment | G3 |
| `sv-20-design-system` | tokens, characters (sheet procedure), sets (six passes, human scale), props, overlays | G4 |
| `sv-21-motion` | actor API, walks/reaches/sits/rides, acting recipes, strip checklist | G5 |
| `sv-22-shots-camera` | anchors, shot sizes, motivated camera, overlays, contact-sheet review | G5 |
| `sv-40-audio` | audio.json: beds, foley, accents, silences, series theme music (theme.py) | G6 |
| `sv-42-mix-master` | house mix/master chain + 21 measured checks (mix_targets.json), plots, audio checks inside the video | G6, G7 |
| `sv-41-qa-delivery` | master render, final-watch rubric | G7 |

## Repository layout
```
story-video-skills/
├── skills/        instructions only — one folder per phase skill (SKILL.md + references/)
├── standards/     house standards as data: voice_standard.json · pacing.json · mix_targets.json
├── engine/        code every episode shares
│   ├── scripts/   tools: lint, voice, mix, audio QA, design/qa renders, deliver, gates
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
- Set density and perceptual quality are measured on the **rendered** plate (`SE-13`, `SE-16`), so detail hidden off-frame or chaotic background noise never slip through.
- Reaches are checked for distance, depth and framing (MO-05/06/09, SZ-02), and every action gets a frame strip.
- Each evidence image needs a written remark, and the review must be newer than the evidence.
- G1, G2 and G4 need the user's quoted approval.

## Measured RSI Evolution (`v4.0 → v5.1`)
| Dimension | `v4.0` Baseline | `v5.1` Verified Result |
|---|---|---|
| Lint rules | `108` | `137` (`validate_skills.py`: 0 errors, 0 warnings; includes `SE-17` Spatial Location Packs & `MO-13..16` Animation/Choreography CI) |
| Spatial Location Packs (16:9 Long-Form) | 5–6 flat walls | **24–30 drawn sets** (`>= 15` floor, 5–6 locations × 3–5 redrawn `cameraDir` angles sharing `landmarks`), `SE-15`/`SE-17` + per-location `qa/design/location_<loc>_pack.jpg` |
| Long-Form Shot Pacing & Choreography | 220+ static micro-cuts | **65–110 rich choreographed shots** (`shots_long_16x9`: `4.5–9.5 s` mean, `6–14 shots/min`, `max 14 s`) guarded by **`MO-16`** (`>= 2` events `> 5.0 s`, `>= 3` `> 8.5 s`) |
| Character views & animation craft | `2 views / 37 poses` | `4 views (Front/Side/3Q/Back)` + `src/anim.ts` (4-phase foot-roll gaits, tapered limbs, curved torsos, `GroundShadow`/`SeatShadow`, 3-layer straddle mounts, `arcH`, `pushTarget`, `wind`, `ActionFx`) |
| Hero Subjects | `0` | Multi-pose `SubjectSheet` A→Z + `PR-06` / `SH-18` + `SubjectSeat.straddle`/`grip`/`wind` (`MO-14`) |
| Layout, Scale & Blind QA Gates | `0` | `LA-01..LA-04`, `SE-15..SE-17`, `CA-06..CA-07`, `GE-19`, `SH-16..SH-19`, `MO-13..MO-16` + Pasted-Sticker Blind Review Rubric + `qa.mjs place` (`0.3s`) |
| 1920×1080 Render Speed | `4.74 fps` (`v4.2` PNG) | `12.98 fps` (`v4.4` JPEG q=95 + `grainPat` + `veryfast` + Macro-Blocks, **2.74× speedup**) |
| Preflight & Blueprint Speed | Manual / none | `voice.py --preflight` (`0.07s`), `sv_doctor.py --stage all` (`0.83s`), `benchmark_suite.py` (`6.15s`, tracks `locs3+`), `plan_assets.py` (`< 0.5s`) |
| Dual-Standard SLA | Unbounded | **<= 15 min (9:16 Short)** · **<= 45 min (16:9 Long-Form)** |

## Validate & benchmark the suite
```bash
python3 tools/validate_skills.py
python3 tools/benchmark_suite.py
```
