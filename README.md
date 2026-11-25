# story-video-skills (`v6.3.0`)

A multi-provider, anti-bypass **2D Vietnamese story-video studio plugin** for **Antigravity, Claude Code, Gemini CLI, Cursor & Codex** ("riso ink" flat vector style + zero-flicker `<RasterPlate>` atmospheric backdrops, canonical New Nhím `CH-11`, empirically calibrated `v4.0` **Hải Đăng** narration at `~4.57 wps` / natural `pitch_ratio: 1.00`):

- **Short `9:16` Track (`1080×1920`):** `450–660` words (`96–150 s`), Corpus Script DNA (`SC-38..43`), connected multi-angle sets, 9-check blind review (incl. 3-shot `continuity`).
- **Long `16:9` Track (`1920×1080`):** `1,700–3,800` words (`6–14 min`), 5-chapter Story Doctor (`SC-29..37`), `24–30` Spatial Location Pack plates (`SE-15..20`), sequential unit locking (`G5.U1..Uk`), 11-check blind review.

## User-Invocable Slash Commands (`8` Action Skills in `skills/`)
Invoke directly via `/<command>` (or naturally in chat) — deep track manuals live in `guides/` and load progressively on demand so the slash menu stays crisp:

| Slash Command | User Intent | What It Runs |
|---|---|---|
| **`/sv-create-short`** | Start a brand-new Short `9:16` episode | Scaffolds `--track short`, reads Series Bible + Short Script DNA, pitches 5 premises → drives `G1 → G7` |
| **`/sv-create-long`** | Start a brand-new Long `16:9` adventure | Scaffolds `--track long`, plans 5 chapters + `U1..Uk` + Story Doctor → drives `G1 → G7` |
| **`/sv-write-script`** | Write or revise brief/beats/script (`G1–G2`) | Auto-detects Short vs Long from `.episode.json`, enforces `standards/pacing.json` + `ci script` |
| **`/sv-design`** | Lock Art Direction & build cast/sets/subjects (`G4`) | Locks `art_direction.json` (`AD-01..08`), builds `<RasterPlate>` sets + `PR-11` subjects, runs 8-axis `design score` (`LG-13`) |
| **`/sv-produce`** | Resume & drive active production (`G3/G5/G6/G7`) | Reads `sv_cli.py status`, runs next open gate (`G5` / `G5.U*`, blind QA, `-14 LUFS` mix, `deliver.mjs` + 30fps `transition_qa.py`) |
| **`/sv-voice-audio`** | Record/fix voice (`G3`) or mix audio (`G6`) | Runs `v4.0` Hải Đăng `voice.py` + `ci voice`, or `mix.py` + `audio_qa.py` (`-14 LUFS`, `ci audio`) |
| **`/sv-audit`** | Independent read-only QA audit (report only) | Runs full CI + 30fps `transition_qa.py` + opens real JPEGs via `read_file` without modifying source files |
| **`/sv-fix`** | Root-cause investigation & targeted fix | Diagnoses real frames/logs first, fixes only the exact root layer (`G3/G4/G5/G6/G7`), runs minimal re-run chain + visual proof |

## Quick Start
```bash
# 1. Scaffold with an explicit track (or simply type /sv-create-short or /sv-create-long)
python tools/new_episode.py <dest-dir> --track short   # or --track long

# 2. Check unified CLI status & preflight
cd <dest-dir>
python scripts/sv_cli.py status --json
python scripts/sv_cli.py doctor --stage G1 --json
```

## Anti-Bypass Architecture (`v6.3.0`)
1. **Intent-First Plugin Surface & Native Multi-Provider Agents (`v6.3.0`):** `8` clean user-invocable slash commands (`skills/sv-*/SKILL.md`), `3` native plugin subagents (`agents/sv-{orchestrator,executor,reviewer}.md`), progressive-disclosure craft library (`guides/{core,short,long}/`), custom riso-ink badge (`assets/logo.svg`), and full manifest parity across `plugin.json` (Antigravity), `.claude-plugin/plugin.json` (Claude Code), and `gemini-extension.json` (Gemini CLI).
2. **Hash-Chained Role Logs & Log-CI (`LG-01..LG-13`):** Orchestrator (`logs/orchestrator.jsonl`), Executor (`logs/executor_<id>.jsonl`), and Reviewer (`logs/reviewer_<id>.jsonl`) emit SHA-256 chained records via `scripts/sv_cli.py log init|step|complete`, audited deterministically by `scripts/sv_log_lint.py` before any gate can pass.
3. **Mandatory Pre-G4 Art Direction & 8-Axis Rubric Gate (`v6.2.0`, `AD-01..AD-08`, `LG-13`):** Genre-agnostic `art_direction.json` MUST pass `sv_cli.py ci art-direction` before `H3` unlocks `src/episode/*` or `plates/*`; `plate_check.py` + `lint.mjs` verify cross-plate richness (`AD-07`) and 1-to-1 `EPISODE_SETS` sync (`AD-08`); Reviewer MUST pass `sv_cli.py design score` (`total >= 82`, every axis `>= 7` across 8 axes) before `G4`.
4. **Antigravity Native Lifecycle Hooks (`hooks.json` + `hooks/sv_guard.py`):** Hard `PreToolUse` `deny` blocks edits to read-only suite files (`H1`), log/report/score tampering (`H2`/`H4`), out-of-order phase & Pre-G4 `art_direction.json` writes (`H3`), premature `deliver.mjs` (`H5`), and blind `design score` / review / gate passes lacking real `read_file` calls on rendered JPEG evidence in `transcriptPath` (`H6`).
5. **General First-Principles & Post-Encode Delivery CI (`v6.2.1`):** Empirically locked `v4.0` voice corridor (`4.42–4.74 wps` Short / `4.40–4.74 wps` Long), ground-plane contact invariant (`GE-21`), wide-shot partial-body guard (`PR-10`), distance-locked anti-treadmill locomotion guard (`PR-11`), 3-shot `context_window` `continuity` blind review, and 30fps post-encode set-transition flicker/blank-flash verification (`scripts/transition_qa.py`, `DL-01..02`).
6. **Zero-Flicker Atmospheric Plates & Restrained 2D Squash & Stretch (`v6.1.0` / `v6.2.1`):** Sets may opt into `rasterPlate: true` mounted via `<RasterPlate>` (`engine/src/kit.tsx`) + keyed `<LayerG>` (`engine/src/Film.tsx`) using the aspect-agnostic `rough.js + PixiJS v8` toolkit (`scripts/rough_pixi_bake.mjs`, split into `<= 5–6` plates/worker via `plates/pack_*.mjs` when `>= 6`) while keeping 2D Risograph characters untouched on top; `Actor.leap` and `Actor.pop` (`engine/src/anim.ts`) add story-motivated, volume-preserving 2D squash-and-stretch.

## Repository Layout
```text
story-video-skills/
├── plugin.json · .claude-plugin/plugin.json · gemini-extension.json · hooks.json
├── assets/        logo.svg (plugin card icon)
├── agents/        sv-orchestrator.md · sv-executor.md · sv-reviewer.md (native subagents)
├── skills/        8 clean user-invocable slash commands (sv-create-short, sv-create-long, sv-write-script, sv-design, sv-produce, sv-voice-audio, sv-audit, sv-fix)
├── guides/        deep progressive-disclosure manuals split into core/ · short/ · long/ (+ references/)
├── hooks/         sv_guard.py (Antigravity PreToolUse/PostToolUse anti-bypass enforcement)
├── rules/         AGENTS.md (always-on intent routing + anti-bypass invariants)
├── roles/         backwards-compatible role prompt mirrors
├── schemas/       cli_envelope · role_log · review_record · art_direction · g4_scores JSON Schemas
├── standards/     core/{voice_standard,mix_targets}.json · short/{pacing,script_dna_db}.json · long/pacing.json
├── engine/        shared Remotion runtime + scripts/ (sv_cli, sv_log, sv_log_lint, sv_gate, lint, qa, blind_pack, transition_qa, ...)
├── starter/       blank episode templates
├── examples/      thang-may/ (quality bar) · demo/
├── tools/         new_episode.{py,sh,ps1} · validate_skills.py · benchmark_suite.py · doctor.py
└── tests/         test_v6_suite.py (14 end-to-end automated verification tests)
```

## Validate & Test
```bash
python tools/validate_skills.py
python tests/test_v6_suite.py
```
