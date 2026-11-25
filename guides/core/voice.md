# sv-core-voice · Gate G3 Narration & Voice Integrity

## 1. Single Source of Truth (Zero Hardcoded Overrides)
Read exact rhythm & corridor numbers from the episode's:
- `standards/voice_standard.json` (`v4.0`: `Hải Đăng` preset, `takes: 1`, `clone: false`, `pitch_ratio: 1.00`, syllable-aware WSOLA, `tempo_clamp: [0.95, 1.20]`).
- `standards/pacing.json` (`voice.overall_wps` tight corridor calibrated to the real YouTube median, plus `pause_share` and `default_pause_after_s`).

Read `references/standard.md` for full acoustic model, `<en>...</en>` IPA rules, and `[cười]` / `[thở dài]` / `[hắng giọng]` cues.

## 2. Mandatory Execution Steps (Gate G3)
1. **Preflight & Role Log Init:**
   ```bash
   python scripts/sv_cli.py log init --role executor --actor exec-voice --stage G3 --task "Synthesize and validate Hải Đăng voice" --json
   python scripts/sv_cli.py doctor --stage G3 --json
   ```
   Verify `G2` is `PASS` and `script.json` has zero `SC-*` errors before invoking VieNeu-TTS.
2. **Synthesize Voice (VieNeu-TTS venv):**
   ```bash
   $env:SV_PY scripts/voice.py
   ```
   Outputs: `audio/<id>.wav`, `audio/voice.wav`, `public/voice.wav`, `qa/timeline.json`, `qa/voice_report.json`, `src/data/words.json`, `src/data/cues.json`.
3. **Run Voice CI Gate:**
   ```bash
   python scripts/sv_cli.py ci voice --json
   ```
   Checks `script_sha`, `standard_sha`, `pacing_sha`, `failed_lines == {}`, `stale_lines == []`, engine settings (`Hải Đăng`, `per_sentence_rhythm`, `pitch_ratio` & `target_ups` exact match), AND every episode pacing corridor (`overall_wps`, `pause_share`, `voice_s`).
4. **Fix Loop (If Any Line or Corridor Fails):**
   - Mispronounced English word → wrap in `<en>...</en>` or add to `script.json` `"english": [...]`, then run `voice.py --only <sid>`.
   - Numbers/abbreviations misread → spell out in Vietnamese in `tts_text`, then `voice.py --only <sid>`.
   - `overall_wps` too slow or too fast → inspect `pause_after` values and sentence length in `script.json` (never weaken `standards/pacing.json`!), then run `voice.py --reuse` (`< 2 s` re-time from cached raw takes).
   - Remember: editing `script.json` makes `G2` stale — re-verify `ci script` and re-pass `G2` if text changed.
5. **Close Logs & Pass Gate G3:**
   - Executor logs CI pass (`log step` + `log complete --verdict pass`) and passes `python scripts/sv_cli.py ci log --stage G3 --role executor --json`.
   - Orchestrator inspects `qa/voice_report.json` (`overall_wps`, `pause_share`, `total`, `failed_lines`), logs `sv_cli.py log step --run <orch_run_id> --action inspect_audio --target qa/voice_report.json --note "..."` (`LG-07`), writes `gates/G3.review.md` (`>= 4` concrete words naming `voice_report.json`), completes Orchestrator log, and runs:
     ```bash
     python scripts/sv_cli.py gate check G3 --json
     python scripts/sv_cli.py gate pass G3 --actor <coord_id> --json
     ```

## 3. Hard Prohibitions
- NEVER clone another voice or change `pitch_ratio` away from `standards/voice_standard.json`.
- NEVER edit `standards/pacing.json` or `standards/voice_standard.json` inside an episode to force a slow/fast take to pass CI.
- NEVER apply `-14 LUFS` loudnorm inside `voice.py`; mastering belongs strictly to `sv-core-audio` (`G6`).
