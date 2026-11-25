# Conventions (`v6.3.0`)

Enforced by `tools/validate_skills.py`.

## Repository layout — one kind of thing per top-level folder
| Folder / File | Holds | Never holds |
|---|---|---|
| `plugin.json`, `.claude-plugin/plugin.json`, `gemini-extension.json` | Antigravity, Claude Code & Gemini CLI plugin manifests (must match `CHANGELOG.md`) | code or generated files |
| `assets/` | Plugin visual assets (`logo.svg`, square icon with 10% safe margin) | episode frames |
| `agents/` | Native subagent definitions (`sv-orchestrator.md`, `sv-executor.md`, `sv-reviewer.md`) with Antigravity/Claude YAML frontmatter | episode code |
| `skills/` | Exactly `8` user-invocable intent-first action skills (`skills/sv-*/SKILL.md`) | code, data, templates |
| `guides/` | Progressive-disclosure deep manuals & references split into `guides/{core,short,long}/` | code or standards |
| `hooks.json`, `hooks/` | Antigravity native `PreToolUse`/`PostToolUse` anti-bypass guard (`hooks/sv_guard.py`) | episode files |
| `rules/` | always-on concise plugin rules (`rules/AGENTS.md`) | stale threshold tables |
| `roles/` | backwards-compatible mirrors of `agents/sv-*.md` (`orchestrator.md`, `executor.md`, `reviewer.md`) | episode code |
| `schemas/` | formal JSON Schemas (`cli_envelope`, `role_log`, `review_record`, `art_direction`, `g4_scores`) | runtime logs |
| `standards/` | Single Source of Truth split by track: `core/{voice_standard,mix_targets}.json`, `short/{pacing,script_dna_db}.json`, `long/pacing.json` | episode overrides |
| `engine/` | shared Remotion runtime & scripts (`sv_cli.py`, `sv_log.py`, `sv_log_lint.py`, `sv_gate.py`, `art_direction_lint.py`, `lint.mjs`, `script_lint.py`, `qa.mjs`, `blind_pack.mjs`, `rough_helpers.mjs`, `pixi_stage.mjs`, `pixi_fx.mjs`, `rough_pixi_bake.mjs`, `voice.py`, `mix.py`, `deliver.mjs`, `transition_qa.py`) | episode content or standards |
| `starter/` | blank episode files copied by `tools/new_episode.py` (incl. `art_direction.json`) | demo or reference content |
| `examples/` | `thang-may/` (quality bar exemplar) and `demo/` (4-shot sandbox) | production episode outputs |
| `tools/` | `new_episode.py`, `new_episode.sh`, `new_episode.ps1`, `validate_skills.py`, `benchmark_suite.py`, `doctor.py` | episode-only scripts |
| `tests/` | automated end-to-end verification tests (`tests/test_v6_suite.py`) | generated media |
| `docs/` | design reviews and research notes | operational skills |

## User-Invocable Skills & Anti-Drift Discipline
- `skills/` holds strictly the `8` verb-first action commands: `sv-create-short`, `sv-create-long`, `sv-write-script`, `sv-design`, `sv-produce`, `sv-voice-audio`, `sv-audit`, `sv-fix`.
- Frontmatter: `name` equals directory name; `description` is `150–1024` chars without `<` or `>`.
- `SKILL.md` ≤ `500` lines (target `≤ 100` lines); every `guides/<path>.md` path referenced in `SKILL.md` MUST exist on disk.
- Native agents under `agents/sv-*.md` MUST declare `name`, `description`, `subagent: true`, `mainAgent: false`, and explicit `tools:`.
- **Single Source of Truth (`E18`):** `SKILL.md`, `guides/*/*.md`, and `rules/AGENTS.md` NEVER duplicate stale voice/budget literals — all thresholds come directly from `standards/`.

## Lint & CI Rules
| Prefix | Area | Implemented In |
|---|---|---|
| `SC-01..27`, `SC-29..43` | Script structure, track alignment (`SC-27`), Long 5-chapter & units (`SC-29..37`), Short DNA breathability & scope (`SC-38..43`) | `scripts/script_lint.py` |
| `AD-01..08` | Pre-G4 `art_direction.json` schema, style lock, location expansion, horizon/edge locks, `mandatory_objects` & anti-spoiler guards, 8-axis rubric (`AD-01..06`), cross-plate richness (`AD-07`) & 1-to-1 `EPISODE_SETS` sync (`AD-08`) | `scripts/art_direction_lint.py`, `scripts/lint.mjs` |
| `LG-01..13` | Immutable SHA-256 hash-chained role logs, `init`→`complete`, separation of duties (`executor != reviewer`), real `read_evidence`, non-boilerplate notes, CI-pass proof, Pre-G4 `art_direction.json` SHA lock & 8-axis G4 rubric pass (`LG-13`) | `scripts/sv_log_lint.py` |
| `CH-01..11`, `TK-01..03` | Cast silhouettes, canonical New Nhím (`CH-11`), format cast richness (`CH-09`), no hand-drawn characters outside `<Person>` (`CH-10`), token discipline | `scripts/lint.mjs` |
| `SE-01..20` | Sets: density, bounds, life, plate emptiness, Location Packs (`cameraDir`, `landmarks`), 3/4 high perspective, botanical variety, `scaleMode` & `stateless` plates | `scripts/lint.mjs` |
| `PR-01..06`, `PR-08..11` | Props & Hero Subjects: proportions, grip, multi-pose (`PR-06`), living creatures (`PR-08..09`), disembodied partial-body wide-shot guard (`PR-10`), distance-locked locomotion & stop-settle anti-treadmill guard (`PR-11`) | `scripts/lint.mjs` |
| `DL-01..02` | Post-encode 30fps delivery verification: zero stale-backdrop leaks across set cuts (`DL-01`), zero blank/unrendered flash frames (`DL-02`) | `scripts/transition_qa.py` |
| `SH-01..23`, `LA-01..04` | Shot grammar, transitions, set fatigue, view diversity, shot-scale alternation, multi-location progression, `scaleMode` & temporal bleed guards, 3×3 clutter & anatomical scale lock | `scripts/lint.mjs` |
| `AN-01..02`, `OV-01..04`, `CA-01..08`, `SZ-01..02`, `KY-01`, `CO-01..03`, `PC-01..03` | Anchors, overlays, camera bounds/180° axis/`camKeys`, screen sizes, animated keys, coverage, dual shot pacing | `scripts/lint.mjs` |
| `MO-01..19` | Distance-locked walk/run stop-settle, `pushTarget`, straddle mounts, `ActionFx`, choreography density, 4-stage `jumpPhase`, anti-freeze, late-ramp guard | `scripts/lint.mjs` |
| `GE-01`, `GE-04`, `GE-07`, `GE-10..11`, `GE-15..21` | Screen geometry, sign clipping/occlusion, detached limbs (`GE-19`), flying airspace occlusion (`GE-20`), non-airborne ground-plane contact invariant (`GE-21`) | `scripts/lint.mjs` |
