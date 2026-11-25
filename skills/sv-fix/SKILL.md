---
name: sv-fix
description: Investigate root causes and fix specific user-reported visual, motion, timeline, script, voice, audio, or render defects in a story-video episode with minimal blast-radius re-runs and mandatory visual/CI verification. Invoke via /sv-fix followed by the issue description.
---

# `/sv-fix` — Root-Cause Investigation & Targeted Episode Fix

Announce immediately: **"Using `sv-fix` to investigate the root cause of the reported issue(s) and apply a verified minimal-blast-radius fix."**

> **The Iron Law:** `NO FIXES WITHOUT ROOT-CAUSE EVIDENCE FIRST.`
> Never guess from memory or patch symptoms blindly. Inspect the actual frame, strip, audio report, or transition log BEFORE editing a single line.

## Phase 1 — Reproduce & Collect Evidence (Mandatory)
1. Read what the user described (and any screenshot/timestamp they provided).
2. Run `python scripts/sv_cli.py status --json` to inspect track (`short` vs `long`) and gate state.
3. Open real on-disk visual/diagnostic evidence matching the symptom via `read_file` or diagnostic commands:
   - **Flicker / jumping backgrounds / blank flashes:** run `python scripts/transition_qa.py --video out/final.mp4` and inspect `sets.tsx` (`<RasterPlate>` vs bare `<image>`).
   - **Treadmill animals / frozen poses / wrong proportions:** inspect `qa/strips/*.jpg` or `qa/design/subject_*_v.jpg` via `read_file` and check `src/episode/subjects.tsx` (`o.moving`/`o.speed`/`o.phase`, `PR-11`).
   - **Bad timeline / teleporting / wrong facing / occluded face / day-night mismatch:** render or open `qa/cards/NN.jpg`, `qa/crops/NN.jpg`, `qa/shots/NN.jpg` (`node scripts/qa.mjs shot <i>`), and cross-check `src/data/words.json` anchors.
   - **Wrong voice pronunciation / pacing / pause:** inspect `qa/voice_report.json` and `script.json`.
   - **Loud music / missed foley / A-V sync:** inspect `qa/mix_report.json`, `qa/video_audio.json`, and `qa/mix/overview.png`.

## Phase 2 — Route to the Exact Root Layer (Minimal Blast-Radius Table)
Fix ONLY the true root layer and run ONLY the downstream steps actually affected:

| Symptom Category | Root Layer | Target Files | Exact Guide to Consult | Minimal Re-Run Chain |
|---|---|---|---|---|
| Wrong words, English pronunciation, pause, voice speed/click | `G3` Voice | `script.json` (`<en>`, `pause_after`, emotion) | `guides/core/voice.md` | `voice.py` → `ci voice` → `times.mjs` → `ci shots` → `mix.py` → `ci audio` → `deliver.mjs` → `ci delivery` |
| Set quality, perspective, missing `<RasterPlate>`, character model, treadmill subject (`PR-11`) | `G4` Design | `src/episode/{cast,sets,subjects,geo}.ts(x)` (or `plates/pack_*.mjs`) | `guides/<track>/design.md`, `guides/short/references/{atmospheric-plates,props-overlays}.md` | `ci design` → `design.mjs --only ...` → `qa.mjs pass changed` → `deliver.mjs` *(skip `mix.py` if `qa/timing.json` is unchanged!)* → `ci delivery` |
| Blocking, occluded face, teleporting, wrong `flip`, wrong set/lighting for spoken beat, timeline error | `G5` Shots | `src/episode/shotlist.ts` | `guides/<track>/production.md`, `guides/short/references/{acting,actor-api,review-cards}.md` | `ci shots` → `qa.mjs pass changed` + `strips` → `times.mjs` *(run `mix.py` + `ci audio` ONLY if `qa/timing.json` changed!)* → `deliver.mjs` → `ci delivery` |
| Music/SFX balance, wrong bed/foley, LUFS/peak fail | `G6` Audio | `audio.json` | `guides/core/audio.md` | `mix.py` → `ci audio` → `deliver.mjs` → `ci delivery` |
| Stale backdrop bleed (`DL-01`), blank flash (`DL-02`), AAC sync | `G7` Delivery | Fix `<RasterPlate>` in `sets.tsx` (never edit read-only engine `src/*` inside an episode — `H1`) | `guides/core/delivery.md` | `deliver.mjs` → `transition_qa.py --video out/final.mp4` → `ci delivery` |

## Phase 3 — Apply Surgical Fix (Zero Anti-Bypass Violations)
- Respect `hooks/sv_guard.py`: NEVER edit read-only suite files (`H1`), CI reports (`H2`), or logs (`H4`), and NEVER silence genuine bugs with `// lint-ok:` waivers.
- Batch related fixes cleanly in one pass rather than re-rendering the full MP4 after every tiny tweak.

## Phase 4 — Verification Before Completion (Non-Negotiable)
Before reporting the fix as done:
1. Run every CI check in the Minimal Re-Run Chain above until **exit `0`** (including `scripts/transition_qa.py --video out/final.mp4` → **`0` stale-bg, `0` blank-flash** whenever `out/final.mp4` was rebuilt).
2. Re-render and **open the fixed frames/strips AND `qa/final_check.jpg` via `read_file`** to visually confirm every reported defect is genuinely gone and no new overlap/clipping was introduced.
3. Report concisely: **Root cause → Exact edits → Before/After verified frames & CI numbers** with clickable `file:///` links.
