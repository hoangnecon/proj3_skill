# Unified CLI & Engine Commands (`sv-v6.0`)

Always run from the episode root (the folder containing `.episode.json`, `script.json`, and `scripts/sv_cli.py`).

## 1. Unified CLI (`scripts/sv_cli.py`) — Primary Entry Point
| Command | Purpose | Exit codes |
|---|---|---|
| `python scripts/sv_cli.py status [--json]` | Show episode track, gates `G1..G7` (+ units), role log chain status, next action | `0` / `4` |
| `python scripts/sv_cli.py doctor --stage <G\|all> [--json]` | Zero-cost preflight & SLA profiler (`sv_doctor.py`) | `0` / `4` |
| `python scripts/sv_cli.py log init --role <r> --actor <id> --stage <G> --task "<t>" [--scope "<s>"] [--unit <U>] [--inputs p1,p2] [--json]` | Start hash-chained role run (returns `run_id`) | `0` / `2` |
| `python scripts/sv_cli.py log step --run <run_id> --action <a> [--target <p>] [--cmd <c>] [--exit-code 0] [--result ok] [--note "<n>"] [--approval user\|delegated] [--user-quote "<q>"] [--json]` | Append tamper-evident step (`read_skill`, `run_tool`, `inspect_visual`, `inspect_audio`, `cross_check`, `user_approval`) | `0` / `2` |
| `python scripts/sv_cli.py log complete --run <run_id> --verdict <pass\|fix\|blocked> --outputs "<p1,p2>" --note "<n>" [--json]` | Close role run with output SHA-256 hashes | `0` / `2` |
| `python scripts/sv_cli.py ci script [--json]` | Run `script_lint.py` (`SC-01..27`, `SC-29..43`) | `0` / `1` |
| `python scripts/sv_cli.py ci voice [--json]` | Verify `qa/voice_report.json` against `standards/voice_standard.json` + `pacing.json` | `0` / `1` |
| `python scripts/sv_cli.py ci design [--json]` | Run `node scripts/lint.mjs design` (`CH-*`, `SE-*`, `PR-*`, `TK-*`) | `0` / `1` |
| `python scripts/sv_cli.py ci shots [--json]` | Run `node scripts/lint.mjs shots` (`SH-*`, `MO-*`, `GE-15..21`, `LA-01..04`, `PR-10`, `PC-*`) | `0` / `1` |
| `python scripts/sv_cli.py ci audio [--json]` | Verify `qa/mix_report.json` against `standards/mix_targets.json` | `0` / `1` |
| `python scripts/sv_cli.py ci delivery [--json]` | Verify `qa/deliver_report.json` + `qa/video_audio.json` | `0` / `1` |
| `python scripts/sv_cli.py ci log --stage <G> [--role all\|executor\|reviewer\|orchestrator] [--actor <id>] [--unit <U>] [--allow-fix] [--json]` | Run 12-rule Log-CI (`sv_log_lint.py`, `LG-01..LG-12`) | `0` / `2` |
| `python scripts/sv_cli.py review submit --batch <file.jsonl> --actor <id> [--run <run_id>] [--json]` | Submit validated blind shot reviews (`qa.mjs review --batch`) | `0` / `1` |
| `python scripts/sv_cli.py gate check <G> [--unit <U>] [--json]` | Run full 5-Pillar Verification Gate without writing pass | `0` / `2` / `3` |
| `python scripts/sv_cli.py gate pass <G> --actor <coord_id> [--unit <U>] [--json]` | Verify all 5 pillars and log immutable gate pass (`orchestrator` only) | `0` / `2` / `3` / `5` |

## 2. Direct Generation & Render Scripts (Called During Build Steps)
| Phase | Command | Output |
|---|---|---|
| Scaffold | `python <suite>/tools/new_episode.py <dest> --track short\|long` | Episode folder + `.episode.json` + `logs/` + track `standards/` |
| G3 Voice | `python scripts/voice.py [--only s3,s7.2] [--reuse]` | `audio/voice.wav`, `public/voice.wav`, `qa/voice_report.json`, `src/data/{words,cues}.json` |
| G4 Design | `node scripts/design.mjs [--changed\|--status]` | `qa/design/*_v.jpg`, `*_grid.png`, `location_*_pack.jpg`, `subject_*.png` |
| G5 Geometry | `node scripts/qa.mjs where <i> [--free WxH]` | Exact screen coordinates & free overlay zones (no render) |
| G5 QA Pack | `node scripts/qa.mjs pass changed [--unit U1]` | Contact sheets, cards, HOT crops, motion strips, `carry.py` |
| G5 Blind Pack | `node scripts/blind_pack.mjs [--unit U1]` | `qa/blind_review/{manifest,slice_1..3,unit_*,RUBRIC.md}` with 3-shot `context_window` |
| G6 Audio | `python scripts/mix.py` | `audio/mix.wav`, `public/mix.wav`, `qa/mix_report.json`, `qa/mix/*.png` |
| G7 Delivery | `node scripts/deliver.mjs` | `out/final.mp4`, `qa/deliver_report.json`, `qa/video_audio.json`, `qa/final_check.jpg` |
