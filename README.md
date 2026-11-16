# story-video-skills (`v3.4.0`)

A gated production suite for **Vietnamese 2D story videos**: vertical 1080×1920 at 30 fps, 2–3 minutes,
narrated by the northern male voice Hải Đăng, drawn in a flat "riso ink" style, and animated in Remotion
with every shot anchored to a narration word.

The suite packages the process that produced the reference episode *Thang máy ăn bí mật* (153 s, 26 segments,
67 shots). Each phase ships with:
- exact specs: design tokens, rig numbers, detail budgets, shot grammar and rhythm benchmarks;
- machine checks: 60+ lint rules, plus pixel checks on rendered plates;
- rendered evidence the agent must open and remark on;
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
| `sv-10-script` | brief → beats → script.json; rhythm benchmarks, northern wording, rubric | G1, G2 |
| `sv-12-voice` | Hải Đăng TTS to the voice standard: one take per line, measured per line, word alignment, voice report | G3 |
| `sv-20-design-system` | tokens, characters (sheet procedure), sets (six passes, human scale), props, overlays | G4 |
| `sv-21-motion` | actor API, walks/reaches/sits/rides, acting recipes, strip checklist | G5 |
| `sv-22-shots-camera` | anchors, shot sizes, motivated camera, overlays, contact-sheet review | G5 |
| `sv-40-audio` | audio.json: beds, foley, accents, silences, series theme music (theme.py) | G6 |
| `sv-42-mix-master` | house mix/master chain + 21 measured checks (mix_targets.json), plots, audio checks inside the video | G6, G7 |
| `sv-41-qa-delivery` | master render, phone copy ≤ 30 MB, final-watch rubric | G7 |

## Repository layout
```
story-video-skills/
├── skills/        instructions only — one folder per phase skill (SKILL.md + references/)
├── standards/     house standards as data: voice_standard.json · pacing.json · mix_targets.json
├── engine/        code every episode shares
│   ├── scripts/   tools: lint, voice, mix, audio QA, design/qa renders, deliver, gates
│   └── src/       Remotion engine: engine, kit, chars, side, overlays, props, Film, design sheets, set registry
├── starter/       blank episode: brief, beats, script.json, audio.json, src/episode/*, gates/*.review.md
├── examples/
│   ├── thang-may/ reference episode (cast looks, sets, geometry, shotlist) — the quality bar
│   └── demo/      4-shot engine demo, layered on a new episode with --demo
├── tools/         new_episode.sh (assembles an episode) · validate_skills.py
└── docs/          reviews of the suite
```
A new episode is assembled from these parts (see `CONVENTIONS.md`), and its `README.md` marks three zones:
what the agent writes (`brief.md`, `beats.md`, `script.json`, `audio.json`, `src/episode/`, gate reviews),
the read-only suite copy (`scripts/`, engine `src/`, `src/exemplar/`, `standards/`), and generated output
(`src/data/`, `audio/`, `public/`, `qa/`, `out/`).

## Why the gates measure quality, not quantity
v1 was rejected because agents could satisfy counters without good work (`docs/review-2026-11-15.md`).
Every count is backed by something that has to be looked at:
- Set density is measured on the **rendered** plate (SE-13), so detail hidden off-frame does not count.
- Reaches are checked for distance, depth and framing (MO-05/06/09, SZ-02), and every action gets a frame strip.
- Each evidence image needs a written remark, and the review must be newer than the evidence.
- G1, G2 and G4 need the user's quoted approval.

## Validate the suite
```bash
python3 tools/validate_skills.py
```
