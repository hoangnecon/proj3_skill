---
name: sv-core-router
description: Entry point and 3-track router for Vietnamese 2D story-video episodes (v6.2.1) — detects Short 9:16 vs Long 16:9 from .episode.json, scaffolds new episodes with --track short|long, enforces the 7-gate DAG (G1, G2, G3 in parallel with Pre-G4 art_direction.json AD-01..AD-08 + G4 8-axis scoring, G5, G6, G7 + DL-01..02 transition QA), role logs (LG-01..LG-13), and unified sv_cli.py verification gates. Always read first when starting, resuming, or auditing any story-video episode.
---

# sv-core-router · Pipeline Router & 5-Pillar Verification Gate

## 1. Track Determination (Always First)
1. **New episode:** Scaffold with an explicit track — never start from `--demo` or hand-copy folders:
   ```bash
   python C:/Users/Admin/.gemini/config/plugins/story-video-skills/tools/new_episode.py <dest> --track short|long
   ```
   - `--track short` → `9:16` (`1080×1920`), copies `standards/core/*` + `standards/short/*`, writes `.episode.json` (`"track": "short"`).
   - `--track long` → `16:9` (`1920×1080`), copies `standards/core/*` + `standards/long/*`, writes `.episode.json` (`"track": "long"`).
2. **Existing episode:** Read `.episode.json` (`track`) and run `python scripts/sv_cli.py status --json`.
3. **Load ONLY the active track's skills** — never mix Short and Long skill specs:

| Gate | Core (Always) | Short Track (`track: "short"`) | Long Track (`track: "long"`) |
|---|---|---|---|
| `G1` Brief *(User)* | `sv-core-bible` | `sv-short-script` | `sv-long-script` |
| `G2` Script *(User)* | — | `sv-short-script` | `sv-long-script` |
| `G3` Voice | `sv-core-voice` | `standards/pacing.json` | `standards/pacing.json` |
| `G4` Design *(User)* | — | `sv-short-design` | `sv-long-design` |
| `G5` Production | — | `sv-short-production` | `sv-long-production` (`U1..Uk` sequential) |
| `G6` Audio Mix | `sv-core-audio` | — | — |
| `G7` Delivery | `sv-core-delivery` | — | — |

## 2. Gate DAG & Parallelism
`G1 → G2 → G3` and `G1 → G4` run in parallel once `G1` passes; `G5` unlocks ONLY after BOTH `G3` and `G4` pass; `G6` requires `G3` + `G5`; `G7` requires `G5` + `G6`.

## 3. Mandatory Role Separation & Logging Protocol
Before executing any phase, load your role prompt from `<suite>/roles/`:
- **Orchestrator** (`roles/orchestrator.md`): schedules phases, audits logs, performs independent visual spot-checks, secures user approvals (`G1`, `G2`, `G4`), writes `gates/G*.review.md`, and runs `sv_cli.py gate pass <G>`.
- **Executor** (`roles/executor.md`): edits ONLY assigned files, runs domain CI (`sv_cli.py ci <domain>`), writes hash-chained `logs/executor_<id>.jsonl`, and passes `sv_cli.py ci log --role executor`. NEVER reviews its own work or passes gates.
- **Reviewer** (`roles/reviewer.md`): audits rendered evidence blind (never reads `shotlist.ts`), submits reviews via `sv_cli.py review submit`, writes `logs/reviewer_<id>.jsonl`, and passes `sv_cli.py ci log --role reviewer`.

## 4. 5-Pillar Gate Verification Flow (Every Gate)
```bash
python scripts/sv_cli.py doctor --stage <G> --json
python scripts/sv_cli.py ci art-direction --json   # mandatory Pre-G4 before editing src/episode/* or plates/*
python scripts/sv_cli.py ci <domain> --json
python scripts/sv_cli.py ci log --stage <G> --role all --json
python scripts/sv_cli.py gate check <G> --json
python scripts/sv_cli.py gate pass <G> --actor <orchestrator_id> --json
```
A gate passes ONLY when all 5 pillars are green: **(1) Domain CI = 0 errors** (including `AD-01..AD-08` on `G4`), **(2) Executor Log-CI `LG-01..13` = 0 errors**, **(3) Reviewer Log-CI + 8-axis `design score` (`G4`, `LG-13`) / blind reviews (`G5`) = 0 errors**, **(4) Orchestrator audit + `gates/G*.review.md` (+ `user_quote` on `G1/G2/G4`)**, and **(5) Hash lock + Antigravity `hooks/sv_guard.py` anti-bypass checks**.

## 5. References
- Full command table: `references/commands.md`
- JSON API envelope & `LG-01..LG-13` spec: `references/cli-api.md`
- Formal schemas: `<suite>/schemas/{cli_envelope,role_log,review_record,art_direction,g4_scores}.schema.json`
