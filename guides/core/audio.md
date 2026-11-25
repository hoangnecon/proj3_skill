# sv-core-audio · Gate G6 Sound Design, Mix & Master

## 1. Prerequisites & Single Source of Truth
- **Upstream gates:** BOTH `G3` (voice) and `G5` (shots + `qa/timing.json`) MUST be `PASS` before authoring `audio.json` or passing `G6`.
- **Targets:** Exact loudness, true peak, LRA, music-under-voice ducking, masking, sibilance, and spectrum targets live in `standards/mix_targets.json`. Read `references/mix-standard.md` for full DSP chain details.

## 2. Authoring `audio.json`
1. **Series Theme Music (Required):** Set `"music": { "theme": "series", ... }` so `scripts/mix.py` generates the house series theme (`scripts/theme.py`) to exact episode length with voice-band carve and side-chain ducking.
2. **Ambience Beds:** Automatically derived from each shot's `SetDef.bed` (`room`, `hum`, `quiet`, `echo`, `outdoor`, `fan`, `motor`, `basement`, `paper`, `street`, `market`, `kitchen`, `rain`, `night`); crossfade cleanly on location changes.
3. **Word-Anchored Foley & Accents:**
   - Automatic foley derives from `shotlist.ts` (`reach`, `keys`, `over`, `tr`).
   - Add targeted word-anchored accents in `audio.json` (`hits` / `sfx`) strictly on key story beats (impacts, reveals, stamps, transitions) — keep sparse so SFX never competes with narration clarity.

## 3. Mandatory Execution Steps (Gate G6)
1. **Init Executor Log & Preflight:**
   ```bash
   python scripts/sv_cli.py log init --role executor --actor exec-audio --stage G6 --task "Build audio.json and master mix" --json
   python scripts/sv_cli.py doctor --stage G6 --json
   ```
2. **Mix, Master & Measure (`scripts/mix.py` runs `audio_qa.py`):**
   ```bash
   python scripts/mix.py
   ```
   Outputs: `audio/mix.wav`, `public/mix.wav`, `qa/mix_report.json`, `qa/mix/overview.png`, `qa/mix/segments.png`.
3. **Run Audio CI Gate:**
   ```bash
   python scripts/sv_cli.py ci audio --json
   ```
   Verifies every check in `qa/mix_report.json` against `standards/mix_targets.json`:
   - Integrated loudness `-14.0 LUFS` target, true peak within ceiling, LRA healthy.
   - Music stays cleanly under voice across every window (zero voice masking).
   - `voice_peak_limit_max_gr_db <= 10 dB` (if `> 10 dB`, a click/pop exists in a voice take — re-take that sentence in `G3`).
   - `limiter_max_gr_db <= 6 dB` (if `> 6 dB`, lower spiking SFX accent gain).
   - Zero mix warnings and matching `voice`/`plan`/`targets` input hashes.
4. **Inspect Visual Mix Plots & Pass Gate G6:**
   - Executor completes `logs/executor_exec-audio.jsonl` and passes `python scripts/sv_cli.py ci log --stage G6 --role executor --json`.
   - Orchestrator opens `qa/mix/overview.png`, `qa/mix/segments.png`, and `qa/mix_report.json`, logs `sv_cli.py log step --run <orch_run_id> --action inspect_audio --target qa/mix_report.json --note "..."` (`LG-07`), writes `gates/G6.review.md` naming all three with concrete observations (`>= 4` words each), completes Orchestrator log, and runs:
     ```bash
     python scripts/sv_cli.py gate check G6 --json
     python scripts/sv_cli.py gate pass G6 --actor <coord_id> --json
     ```
