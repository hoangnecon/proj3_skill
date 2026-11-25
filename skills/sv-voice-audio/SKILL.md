---
name: sv-voice-audio
description: Produce or fix Gate G3 Vietnamese narration using house voice Hai Dang (VieNeu V3 Turbo v4.0 empirical calibration, bilingual en IPA tags, Whisper alignment) and Gate G6 audio design, series theme, foley, and -14 LUFS mastering. Invoke via /sv-voice-audio.
---

# `/sv-voice-audio` — Voice Narration (`G3`) & Audio Mix/Master (`G6`)

Announce immediately: **"Using `sv-voice-audio` to produce or verify episode voice narration (G3) and/or audio mastering (G6)."**

## 1. Required Deep Guides & Standards
- **Gate G3 (Voice):** Read `guides/core/voice.md`, `guides/core/references/standard.md`, `standards/voice_standard.json`, and `standards/pacing.json`.
- **Gate G6 (Audio Mix):** Read `guides/core/audio.md`, `guides/core/references/mix-standard.md`, and `standards/mix_targets.json`.
- **Never invent thresholds from memory** — always use the exact corridors in `standards/*.json`.

## 2. Gate G3 — House Voice Hải Đăng (`VieNeu V3 Turbo`, `v4.0`)
1. Confirm `G2` is `PASS` and init Executor log (`--stage G3`) + `sv_cli.py doctor --stage G3 --json`.
2. Verify foreign words/acronyms in `script.json` use `<en>...</en>` tags and intentional delivery uses inline emotion cues cleanly.
3. Synthesize & align words with the VieNeu Python environment (`SV_PY`):
   ```bash
   python scripts/voice.py
   ```
4. Run Voice CI until **exit `0`**:
   ```bash
   python scripts/sv_cli.py ci voice --json
   ```
   Confirm `overall_wps`, `pause_share`, `max_hole_s`, and clipping/click bounds sit inside `standards/pacing.json` & `standards/voice_standard.json`.
5. Complete Executor log (`ci log --stage G3 --role executor`), have Orchestrator inspect `qa/voice_report.json` (`--action inspect_audio`), write `gates/G3.review.md`, and pass `G3`.

## 3. Gate G6 — Ambience, Word-Anchored Foley, Theme & `-14 LUFS` Master
1. Confirm `G3` and `G5` are `PASS` (`H3` requires `G3` before editing `audio.json`) and init Executor log (`--stage G6`).
2. Author/update `audio.json` (beds per set, word-anchored foley/accents, `"music": {"theme": "series"}`).
3. Ensure `qa/timing.json` is fresh (`node scripts/times.mjs`), then mix and verify:
   ```bash
   python scripts/mix.py
   python scripts/sv_cli.py ci audio --json
   ```
   Confirm `-14 LUFS`, true peak headroom, voice peak limiter GR `<= 10 dB`, master limiter GR `<= 6 dB`, and zero warnings in `qa/mix_report.json`.
4. Complete Executor log (`ci log --stage G6 --role executor`), have Orchestrator inspect `qa/mix/overview.png` + `qa/mix/segments.png` (`read_file`) and `qa/mix_report.json` (`--action inspect_audio`), write `gates/G6.review.md`, and pass `G6`.
