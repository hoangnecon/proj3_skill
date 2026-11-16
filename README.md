# story-video-skills (`v2.0.0`)

A gated production suite for **Vietnamese 2D story videos**: vertical 1080×1920 at 30 fps, 2–3 minutes,
narrated by the northern male voice Hải Đăng, drawn in a flat "riso ink" style, and animated in Remotion
with every shot anchored to a narration word.

v2 packages the process that produced the reference episode *Thang máy ăn bí mật* (153 s, 26 segments,
67 shots). Each phase ships with:
- exact specs: design tokens, rig numbers, detail budgets, shot grammar and rhythm benchmarks;
- machine checks: 60+ lint rules, plus pixel checks on rendered plates;
- rendered evidence the agent must open and remark on;
- a gate log that goes stale when its inputs change.

The goal is that any agent reproduces the same level of detail, not "a few boxes".

## Start
Read `skills/sv-00-pipeline/SKILL.md`, then:
```bash
bash skills/sv-00-pipeline/scripts/new_episode.sh ~/Work/PROJ3/<slug> ~/Work/PROJ3/mua-noi-doi/node_modules
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

## Template (`templates/episode-starter/`)
- **Engine:** `src/engine.ts`, `kit.tsx`, `chars.tsx`, `side.tsx`, `overlays.tsx`, `Film.tsx`.
- **Exemplar:** the reference cast, sets and shotlist in `src/exemplar/`. They set the bar; lint rejects them in episode shots.
- **Demo:** a 4-shot demo showing every motion feature. Lint fails until it is replaced.
- **Tools** (all in `scripts/`):
  - lint: `lint.mjs`, `script_lint.py`
  - evidence renderers: `design.mjs`, `qa.mjs`, `plate_check.py`, `tile.py`
  - voice and mix: `voice.py`, `mix.py`
  - delivery and gates: `deliver.mjs`, `sv_gate.py`
- **Gate reviews:** `gates/G1..G7.review.md`.

## Why the gates measure quality, not quantity
v1 was rejected because agents could satisfy counters without good work (`docs/review-2026-11-15.md`).
In v2 every count is backed by something that has to be looked at:
- Set density is measured on the **rendered** plate (SE-13), so detail hidden off-frame does not count.
- Reaches are checked for distance, depth and framing (MO-05/06/09, SZ-02), and every action gets a frame strip.
- Each evidence image needs a written remark, and the review must be newer than the evidence.
- G1, G2 and G4 need the user's quoted approval.

## Validate the suite
```bash
python3 tools/validate_skills.py
```
