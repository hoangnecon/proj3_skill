# Conventions (`v6.1.0`)

Enforced by `tools/validate_skills.py`.

## Repository layout — one kind of thing per top-level folder
| Folder / File | Holds | Never holds |
|---|---|---|
| `plugin.json`, `.claude-plugin/plugin.json` | Antigravity & Claude plugin manifests (must match `CHANGELOG.md`) | code or generated files |
| `hooks.json`, `hooks/` | Antigravity native `PreToolUse`/`PostToolUse` anti-bypass guard (`hooks/sv_guard.py`) | episode files |
| `rules/` | always-on concise plugin rules (`rules/AGENTS.md`) | stale threshold tables |
| `roles/` | complete per-role system prompts (`orchestrator.md`, `executor.md`, `reviewer.md`) | episode code |
| `schemas/` | formal JSON Schemas (`cli_envelope`, `role_log`, `review_record`) | runtime logs |
| `skills/` | 3-track instructions ONLY: `sv-(core\|short\|long)-*/SKILL.md` + `references/*.md` | code, data, templates |
| `standards/` | Single Source of Truth split by track: `core/{voice_standard,mix_targets}.json`, `short/{pacing,script_dna_db}.json`, `long/pacing.json` | episode overrides |
| `engine/` | shared Remotion runtime & scripts (`sv_cli.py`, `sv_log.py`, `sv_log_lint.py`, `sv_gate.py`, `lint.mjs`, `script_lint.py`, `qa.mjs`, `blind_pack.mjs`, `rough_helpers.mjs`, `pixi_stage.mjs`, `pixi_fx.mjs`, `rough_pixi_bake.mjs`, `voice.py`, `mix.py`, `deliver.mjs`) | episode content or standards |
| `starter/` | blank episode files copied by `tools/new_episode.py` | demo or reference content |
| `examples/` | `thang-may/` (quality bar exemplar) and `demo/` (4-shot sandbox) | production episode outputs |
| `tools/` | `new_episode.py`, `new_episode.sh`, `new_episode.ps1`, `validate_skills.py`, `benchmark_suite.py`, `doctor.py` | episode-only scripts |
| `tests/` | automated end-to-end verification tests (`tests/test_v6_suite.py`) | generated media |
| `docs/` | design reviews and research notes | operational skills |

## 3-Track Skills & Anti-Drift Discipline
- Skill folders MUST follow `skills/sv-(core|short|long)-<slug>/` (5 Core, 3 Short 9:16, 3 Long 16:9).
- Frontmatter: `name` equals directory name; `description` is `150–1024` chars without `<` or `>`.
- `SKILL.md` ≤ `500` lines (target `≤ 120` lines); every `references/*` file must be cited in `SKILL.md`.
- **Single Source of Truth (`E18`):** `SKILL.md` and `rules/AGENTS.md` NEVER duplicate stale voice/budget literals — all thresholds come directly from `standards/`.

## Lint & CI Rules
| Prefix | Area | Implemented In |
|---|---|---|
| `SC-01..27`, `SC-29..43` | Script structure, track alignment (`SC-27`), Long 5-chapter & units (`SC-29..37`), Short DNA breathability & scope (`SC-38..43`) | `scripts/script_lint.py` |
| `LG-01..12` | Immutable SHA-256 hash-chained role logs, `init`→`complete`, separation of duties (`executor != reviewer`), real `read_evidence`, non-boilerplate notes, CI-pass proof | `scripts/sv_log_lint.py` |
| `CH-01..11`, `TK-01..03` | Cast silhouettes, canonical New Nhím (`CH-11`), format cast richness (`CH-09`), no hand-drawn characters outside `<Person>` (`CH-10`), token discipline | `scripts/lint.mjs` |
| `SE-01..20` | Sets: density, bounds, life, plate emptiness, Location Packs (`cameraDir`, `landmarks`), 3/4 high perspective, botanical variety, `scaleMode` & `stateless` plates | `scripts/lint.mjs` |
| `PR-01..06`, `PR-08..10` | Props & Hero Subjects: proportions, grip, multi-pose (`PR-06`), living creatures (`PR-08..09`), disembodied partial-body wide-shot guard (`PR-10`) | `scripts/lint.mjs` |
| `SH-01..23`, `LA-01..04` | Shot grammar, transitions, set fatigue, view diversity, shot-scale alternation, multi-location progression, `scaleMode` & temporal bleed guards, 3×3 clutter & anatomical scale lock | `scripts/lint.mjs` |
| `AN-01..02`, `OV-01..04`, `CA-01..08`, `SZ-01..02`, `KY-01`, `CO-01..03`, `PC-01..03` | Anchors, overlays, camera bounds/180° axis/`camKeys`, screen sizes, animated keys, coverage, dual shot pacing | `scripts/lint.mjs` |
| `MO-01..19` | Distance-locked walk/run stop-settle, `pushTarget`, straddle mounts, `ActionFx`, choreography density, 4-stage `jumpPhase`, anti-freeze, late-ramp guard | `scripts/lint.mjs` |
| `GE-01`, `GE-04`, `GE-07`, `GE-10..11`, `GE-15..21` | Screen geometry, sign clipping/occlusion, detached limbs (`GE-19`), flying airspace occlusion (`GE-20`), non-airborne ground-plane contact invariant (`GE-21`) | `scripts/lint.mjs` |

## 5-Pillar Verification Gates & Hooks
- Unified CLI: `python scripts/sv_cli.py status|doctor|log|ci|review|gate [--json]` conforming to `schemas/cli_envelope.schema.json`.
- Gates: `G1 → G2 → G3 ∥ G4 → G5 (G5.U1..Uk sequential on long) → G6 → G7`.
- Every passing gate requires: **(1)** Domain CI = `0` errors, **(2)** Executor Log-CI (`LG-01..12`) = `0`, **(3)** Reviewer Log-CI + 9/11-check blind reviews (incl. 3-shot `continuity`) = `0`, **(4)** Orchestrator audit + `gates/G*.review.md` (+ `user_quote` on `G1/G2/G4`), and **(5)** Antigravity `hooks/sv_guard.py` hard `PreToolUse` enforcement (`H1..H6`).
