---
name: sv-core-delivery
description: Gate G7 final master render, encoded audio verification, 12-frame spot-check audit, and delivery for both Short 9:16 (1080x1920) and Long 16:9 (1920x1080) Vietnamese story-video episodes. Use only after G1..G6 all pass.
---

# sv-core-delivery · Gate G7 Master Render & Final QA

## 1. Strict Upstream Lock
- `hooks/sv_guard.py H5` **hard-denies** running `deliver.mjs` unless `G1, G2, G3, G4, G5, G6` are ALL `PASS` in `gates/log.jsonl`.
- Read `references/rubrics.md` for the full final-watch and spot-check rubric.

## 2. Mandatory Execution Steps (Gate G7)
1. **Preflight & Executor Log Init:**
   ```bash
   python scripts/sv_cli.py log init --role executor --actor exec-deliver --stage G7 --task "Render master mp4 and run post-encode QA" --json
   python scripts/sv_cli.py doctor --stage G7 --json
   ```
2. **Render Master & Measure Encoded A/V:**
   ```bash
   node scripts/deliver.mjs
   ```
   Produces:
   - `out/final.mp4` (`H.264`, `CRF 18`, `30 fps`, `1080×1920` for Short / `1920×1080` for Long, AAC audio)
   - `qa/deliver_report.json` (duration vs expected `<= 0.15 s`, exact resolution/fps, `final_sha`)
   - `qa/video_audio.json` (`audio_qa.py --video` re-measuring loudness, true peak, AAC drift, and A/V sync *inside* the rendered MP4)
   - `qa/transition_qa.json` (`scripts/transition_qa.py --video out/final.mp4` decoding at 30 fps to verify zero stale-backdrop leaks `DL-01` and zero blank/unrendered flash frames `DL-02` across every set cut)
   - `qa/final_check.jpg` (12-frame spot-check sheet sampled directly from `out/final.mp4`)
3. **Run Delivery CI Gate:**
   ```bash
   python scripts/sv_cli.py ci delivery --json
   ```
   Verifies `deliver_report.json`, `video_audio.json`, and `transition_qa.json` (`DL-01` `stale_bg_frames == 0`, `DL-02` `blank_flash_frames == 0`). Close Executor log (`log complete --verdict pass`) and verify `python scripts/sv_cli.py ci log --stage G7 --role executor --json`.
4. **Independent Reviewer & Orchestrator Visual Audit (MANDATORY — No Blind Pass):**
   - Reviewer (`reviewer_id != exec-deliver`) opens `qa/final_check.jpg` via `read_file` and checks `qa/deliver_report.json` + `qa/video_audio.json` + `qa/transition_qa.json`, logging concrete observations (`--action inspect_visual --target qa/final_check.jpg`, `>= 6` words) and passing `python scripts/sv_cli.py ci log --stage G7 --role reviewer --json`.
   - Orchestrator ALSO opens `qa/final_check.jpg` via `read_file` (verified by `hooks/sv_guard.py H6`), confirms zero encoding glitches, zero transition flicker (`transition_qa.json`), captions legible, exact format/duration, and writes `gates/G7.review.md` naming `deliver_report.json`, `final_check.jpg`, `video_audio.json`, and `transition_qa.json` (`>= 4` words each).
5. **Pass Gate G7 & Deliver:**
   ```bash
   python scripts/sv_cli.py gate check G7 --json
   python scripts/sv_cli.py gate pass G7 --actor <coord_id> --json
   ```
   Report the clickable `file:///` path to `out/final.mp4`, final duration, resolution, voice `overall_wps`, integrated LUFS, and `qa/final_check.jpg` to the user.
