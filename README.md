# story-video-skills (`v6.2.0`)

An anti-bypass, **3-track** gated production suite for **Vietnamese 2D story videos** in Remotion ("riso ink" flat vector style, canonical New Nhím `CH-11`, empirically calibrated `v4.0` **Hải Đăng** narration at `~4.57 wps` / natural `pitch_ratio: 1.00`):

- **Core Track (`sv-core-*`):** Shared router, series bible, `v4.0` Hải Đăng voice pipeline, `-14 LUFS` audio mix/master, and final delivery QA.
- **Short 9:16 Track (`sv-short-*`):** `1080×1920`, `450–660` words (`96–150 s`), Corpus Script DNA (`SC-38..43`), connected multi-angle sets, 9-check blind review (incl. 3-shot `continuity`).
- **Long 16:9 Track (`sv-long-*`):** `1920×1080`, `1,700–3,800` words (`6–14 min`), 5-chapter Story Doctor (`SC-29..37`), `24–30` Spatial Location Pack plates (`SE-15..20`), sequential unit-by-unit locking (`G5.U1..Uk`), 11-check blind review.

## Quick Start
```bash
# 1. Scaffold with an explicit track (creates .episode.json, logs/, and track standards/)
python tools/new_episode.py <dest-dir> --track short   # or --track long

# 2. Check unified CLI status & preflight
cd <dest-dir>
python scripts/sv_cli.py status --json
python scripts/sv_cli.py doctor --stage G1 --json
```

## 3-Track Skills (11 Total)
| Track | Skill | Gate(s) | Purpose |
|---|---|---|---|
| **Core** | `sv-core-router` | All | Track detection, DAG routing, unified `sv_cli.py`, 5-Pillar Gate protocol |
| **Core** | `sv-core-bible` | `G1` | Series identity, canonical Nhím (`CH-11`), 3 archetypes, 7-point premise test |
| **Core** | `sv-core-voice` | `G3` | `v4.0` Hải Đăng voice synthesis, `<en>` IPA, emotion tags, tight WPS corridor CI |
| **Core** | `sv-core-audio` | `G6` | Ambience beds, word-anchored foley, series theme, `-14 LUFS` mastering & `audio_qa.py` |
| **Core** | `sv-core-delivery` | `G7` | Master MP4 render, post-encode A/V audit, 12-frame `final_check.jpg` spot-check |
| **Short 9:16** | `sv-short-script` | `G1`, `G2` | Short premise/brief (`SC-40`), 5-Knot beats, Corpus DNA script (`SC-38..43`) |
| **Short 9:16** | `sv-short-design` | `G4` | Short cast, connected sub-scenes (`zones.mgY`), multi-pose Hero Subjects |
| **Short 9:16** | `sv-short-production` | `G5` | Word-anchored Short shotlist, physics/placement CI (`GE-21`, `PR-10`), 9-check blind QA |
| **Long 16:9** | `sv-long-script` | `G1`, `G2` | 5-chapter adventure script, `3+` Plants/Payoffs, `units` plan, Adversarial Story Doctor |
| **Long 16:9** | `sv-long-design` | `G4` | `8–10+` cast (`CH-09`), `24–30` Spatial Location Packs (`SE-15..20`), quadruped `SUBJECTS` |
| **Long 16:9** | `sv-long-production` | `G5.U*`, `G5` | Sequential unit-by-unit blocking (`U1..Uk`), `SH-16..23`, 11-check blind QA & locking |

## Anti-Bypass Architecture (`v6.2.0`)
1. **Hash-Chained Role Logs & Log-CI (`LG-01..LG-13`):** Orchestrator (`logs/orchestrator.jsonl`), Executor (`logs/executor_<id>.jsonl`), and Reviewer (`logs/reviewer_<id>.jsonl`) emit SHA-256 chained records via `scripts/sv_cli.py log init|step|complete`, audited deterministically by `scripts/sv_log_lint.py` before any gate can pass.
2. **Mandatory Pre-G4 Art Direction & 8-Axis Rubric Gate (`v6.2.0`, `AD-01..AD-08`, `LG-13`):** Genre-agnostic `art_direction.json` MUST pass `sv_cli.py ci art-direction` before `H3` unlocks `src/episode/*` or `plates/*`; `plate_check.py` + `lint.mjs` verify cross-plate richness (`AD-07`) and 1-to-1 `EPISODE_SETS` sync (`AD-08`); Reviewer MUST pass `sv_cli.py design score` (`total >= 82`, every axis `>= 7` across 8 axes) before `G4`.
3. **Unified CLI & Formal JSON API:** `scripts/sv_cli.py` standardizes every command, exit code (`0..5`), and `--json` envelope (`schemas/cli_envelope.schema.json`).
4. **Antigravity Native Lifecycle Hooks (`hooks.json` + `hooks/sv_guard.py`):** Hard `PreToolUse` `deny` blocks edits to read-only suite files (`H1`), log/report/score tampering (`H2`/`H4`), out-of-order phase & Pre-G4 `art_direction.json` writes (`H3`), premature `deliver.mjs` (`H5`), and blind `design score` / review / gate passes lacking real `read_file` calls on rendered JPEG evidence in `transcriptPath` (`H6`).
5. **General First-Principles CI:** Empirically locked `v4.0` voice corridor (`4.42–4.74 wps` Short / `4.40–4.74 wps` Long), ground-plane contact invariant (`GE-21`), wide-shot partial-body guard (`PR-10`), and 3-shot `context_window` `continuity` blind review.
6. **Opt-In Atmospheric Plates & Restrained 2D Squash & Stretch (`v6.1.0`):** Sets may opt into `rasterPlate: true` using the aspect-agnostic `rough.js + PixiJS v8` toolkit (`scripts/rough_pixi_bake.mjs`, split into `<= 5–6` plates/worker via `plates/pack_*.mjs` when `>= 6`) while keeping 2D Risograph characters untouched on top; `Actor.leap` and `Actor.pop` (`engine/src/anim.ts`) add story-motivated, volume-preserving 2D squash-and-stretch with automatic `GroundShadow` scaling and `<DustPuff>` bursts.

## Repository Layout
```text
story-video-skills/
├── plugin.json · hooks.json · CONVENTIONS.md · CHANGELOG.md
├── hooks/         sv_guard.py (Antigravity PreToolUse/PostToolUse enforcement)
├── rules/         AGENTS.md (lean always-on rules)
├── roles/         orchestrator.md · executor.md · reviewer.md
├── schemas/       cli_envelope · role_log · review_record · art_direction · g4_scores JSON Schemas
├── skills/        11 clean skills across sv-core-* (5), sv-short-* (3), sv-long-* (3)
├── standards/     core/{voice_standard,mix_targets}.json · short/{pacing,script_dna_db}.json · long/pacing.json
├── engine/        shared Remotion engine + scripts/ (sv_cli, sv_log, sv_log_lint, sv_gate, lint, qa, blind_pack, ...)
├── starter/       blank episode templates
├── examples/      thang-may/ (quality bar) · demo/
├── tools/         new_episode.{py,sh,ps1} · validate_skills.py · benchmark_suite.py · doctor.py
└── tests/         test_v6_suite.py (end-to-end automated verification)
```

## Validate & Test
```bash
python tools/validate_skills.py
python tests/test_v6_suite.py
```
