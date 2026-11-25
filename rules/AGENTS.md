# Story Video Skills (`story-video-skills` · v6.2.1) — Mandatory Non-Bypass Rules

Applies to every primary agent, subagent, and swarm worker whenever working on a Vietnamese 2D story-video episode (`9:16` Short or `16:9` Long-Form) or any folder containing `.episode.json`, `.suite.json`, `gates/`, `logs/`, `script.json`, or `src/episode/`.

Suite root: `C:/Users/Admin/.gemini/config/plugins/story-video-skills`

## 1. Strict 3-Track Skill Routing (Zero Improvisation)
1. **Start with `sv-core-router`** (`skills/sv-core-router/SKILL.md`).
2. **Detect track from `.episode.json`** (`"track": "short"` or `"long"`). New episodes MUST be scaffolded with:
   `python C:/Users/Admin/.gemini/config/plugins/story-video-skills/tools/new_episode.py <dest> --track short|long`
3. **Load ONLY the active track's skills** before executing each phase:
   - **Core (shared):** `sv-core-router`, `sv-core-bible` (`G1`), `sv-core-voice` (`G3`), `sv-core-audio` (`G6`), `sv-core-delivery` (`G7`).
   - **Short 9:16 (`track: "short"`):** `sv-short-script` (`G1`–`G2`), `sv-short-design` (`G4`), `sv-short-production` (`G5`).
   - **Long 16:9 (`track: "long"`):** `sv-long-script` (`G1`–`G2`), `sv-long-design` (`G4`), `sv-long-production` (`G5`, sequential `U1..Uk`).
4. **Single Source of Truth:** Read exact numeric corridors from the episode's `standards/` (`voice_standard.json`, `pacing.json`, `mix_targets.json`, `script_dna_db.json`). Never invent thresholds from memory.

## 2. Unified CLI, Role Logs & 5-Pillar Verification Gate
1. **Gate order:** `G1 -> G2 -> G3 || G4 -> G5 (U1..Uk for long) -> G6 -> G7`.
2. **Mandatory role prompts:** Read `roles/orchestrator.md`, `roles/executor.md`, or `roles/reviewer.md` matching your assigned role.
3. **Hash-chained logs (`LG-01..LG-13`):** Every Executor, Reviewer, and Orchestrator MUST log via `python scripts/sv_cli.py log init|step|complete` and pass `python scripts/sv_cli.py ci log --stage <G> --json` BEFORE `sv_cli.py gate check|pass <G>`.
4. **Pre-G4 Art Direction & 8-Axis Rubric (`AD-01..AD-08`, `LG-13`):** Lock `art_direction.json` via `python scripts/sv_cli.py ci art-direction --json` BEFORE editing `src/episode/*` or `plates/*` (`H3`); split plate workers (`<= 5–6` plates/worker) when `rasterPlate >= 6`; Reviewer MUST pass `sv_cli.py design score` (`total >= 82`, every axis `>= 7`) before `G4`.
5. **Separation of duties:** An Executor NEVER reviews shots it built (`LG-08`) and NEVER runs `gate pass`. A Reviewer NEVER edits source files.
6. **User approval gates (`G1`, `G2`, `G4`):** Present evidence, wait for explicit confirmation, and record `user_quote` verbatim in `gates/G*.review.md`.
7. **Visual inspection proof:** Open rendered JPEG evidence via `read_file` before writing any review, submitting `design score`, or passing `G4`/`G5`/`G7`. `hooks.json` (`hooks/sv_guard.py`) enforces hard `PreToolUse` `deny` against read-only edits, log/score tampering, out-of-order writes, and blind passes.

## 3. Subagent Delegation Brief Requirements
Every delegated prompt MUST name: (a) exact role (`roles/executor.md` or `roles/reviewer.md`) and unique `actor_id`, (b) exact `SKILL.md` path(s), (c) owned files/unit, and (d) required `sv_cli.py ci <domain>` + `sv_cli.py ci log` checks returning exit `0`.

## 4. Windows Toolchain (`C:/Work/Tools`)
Prepend `C:\Work\Tools\nodejs;C:\Work\Tools\python-sv\Scripts;C:\Users\Admin\.local\bin` to `$env:PATH` and set `SV_NODE_MODULES=C:\Work\Tools\remotion-runtime\node_modules` and `SV_PY=C:\Work\Tools\VieNeu-TTS\.venv\Scripts\python.exe` if a shell has not inherited User Registry env vars.
