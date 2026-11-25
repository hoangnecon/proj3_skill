# Story Video Skills (`story-video-skills` · v6.3.0) — Mandatory Non-Bypass Rules

Applies to every primary agent, subagent, and swarm worker whenever working on a Vietnamese 2D story-video episode (`9:16` Short or `16:9` Long-Form) or any folder containing `.episode.json`, `.suite.json`, `gates/`, `logs/`, `script.json`, or `src/episode/`.

Suite root: `C:/Users/Admin/.gemini/config/plugins/story-video-skills`

## 1. Intent-First Slash Command Routing (Announce & Follow)
Invoke the matching action skill BEFORE replying, exploring, or editing, and announce **"Using `sv-<name>` to <purpose>"**:

| User Command (`/…`) or Natural Intent | Skill (`skills/<name>/SKILL.md`) | Deep Guides Loaded On Demand (`guides/`) |
|---|---|---|
| `/sv-create-short` ("tạo tập short mới") | `sv-create-short` | `guides/core/{router,bible}.md`, `guides/short/script.md` |
| `/sv-create-long` ("tạo tập long 16:9 mới") | `sv-create-long` | `guides/core/{router,bible}.md`, `guides/long/script.md` |
| `/sv-write-script` ("viết / sửa brief, kịch bản") | `sv-write-script` | `guides/core/bible.md`, `guides/<track>/script.md` |
| `/sv-design` ("art direction, nhân vật, bối cảnh, G4") | `sv-design` | `guides/<track>/design.md`, `guides/short/references/*` |
| `/sv-produce` ("chạy tiếp tập đang dở, shots, deliver") | `sv-produce` | `guides/<track>/production.md`, `guides/core/delivery.md` |
| `/sv-voice-audio` ("thu giọng Hải Đăng, mix nhạc/foley") | `sv-voice-audio` | `guides/core/{voice,audio}.md` |
| `/sv-audit` ("soi lỗi / kiểm toán tập — chỉ báo cáo") | `sv-audit` | `guides/short/references/review-cards.md`, `guides/core/references/rubrics.md` |
| `/sv-fix` ("sửa lỗi cảnh/chớp nền/timeline/âm thanh") | `sv-fix` | Root-cause table → exact `guides/<track>/*.md` |

- **Track Lock:** Detect `"track": "short" | "long"` from `.episode.json`; scaffold new episodes ONLY via `python C:/Users/Admin/.gemini/config/plugins/story-video-skills/tools/new_episode.py <dest> --track short|long`.
- **Single Source of Truth:** Read exact numeric corridors from `standards/` (`voice_standard.json`, `pacing.json`, `mix_targets.json`, `script_dna_db.json`). Never invent thresholds from memory.

## 2. Unified CLI, Native Agents & 5-Pillar Verification Gate
1. **Gate order:** `G1 -> G2 -> G3 || G4 -> G5 (U1..Uk sequential for long) -> G6 -> G7`.
2. **Native role agents (`agents/`):** Use `agents/sv-orchestrator.md`, `agents/sv-executor.md`, or `agents/sv-reviewer.md` (mirrors in `roles/*.md`).
3. **Hash-chained logs (`LG-01..LG-13`):** Every Executor, Reviewer, and Orchestrator MUST log via `python scripts/sv_cli.py log init|step|complete` and pass `python scripts/sv_cli.py ci log --stage <G> --json` BEFORE `sv_cli.py gate check|pass <G>`.
4. **Pre-G4 Art Direction, Zero-Flicker Plates & Anti-Treadmill (`AD-01..AD-08`, `PR-11`, `LG-13`, `DL-01..02`):** Lock `art_direction.json` via `sv_cli.py ci art-direction` BEFORE editing `src/episode/*` or `plates/*` (`H3`); mount static raster plates via `<RasterPlate>` (`src/kit.tsx`) and split workers (`<= 5–6` plates/worker) when `rasterPlate >= 6`; lock grounded `SUBJECTS` locomotion to `opts.phase` + `opts.moving`/`opts.speed` (`PR-11`); Reviewer MUST pass 8-axis `sv_cli.py design score` (`total >= 82`, every axis `>= 7`) before `G4`; Delivery MUST pass 30fps `scripts/transition_qa.py` (`0` stale-bg `DL-01`, `0` blank-flash `DL-02`).
5. **Separation of duties:** An Executor NEVER reviews its own work (`LG-08`) and NEVER runs `gate pass`. A Reviewer NEVER edits source files.
6. **User approvals (`G1`, `G2`, `G4`) & Visual proof (`H6`):** Record verbatim `user_quote` in `gates/G*.review.md` and open rendered JPEG evidence via `read_file` before any review, `design score`, or visual gate pass (`hooks/sv_guard.py` enforces hard `PreToolUse` `deny`).

## 3. Subagent Delegation Brief Requirements
Every delegated prompt MUST name: (a) exact agent prompt (`agents/sv-executor.md` or `agents/sv-reviewer.md`) and unique `actor_id`, (b) exact `skills/sv-*/SKILL.md` + `guides/` path(s), (c) owned files/unit, and (d) required `sv_cli.py ci <domain>` + `sv_cli.py ci log` checks returning exit `0`.

## 4. Windows Toolchain (`C:/Work/Tools`)
Prepend `C:\Work\Tools\nodejs;C:\Work\Tools\python-sv\Scripts;C:\Users\Admin\.local\bin` to `$env:PATH` and set `SV_NODE_MODULES=C:\Work\Tools\remotion-runtime\node_modules` and `SV_PY=C:\Work\Tools\VieNeu-TTS\.venv\Scripts\python.exe` if a shell has not inherited User Registry env vars.
