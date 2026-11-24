# Story Video Skills (`story-video-skills` · PROJ3) — Mandatory Non-Bypass Rules

These rules are **ALWAYS ON** for both the primary agent and every subagent / swarm worker whenever a request or workspace involves Vietnamese 2D story videos (Short 9:16 or Long-Form 16:9), PROJ3 / Remotion story-video production, "Nhím" / episodic animation, or any folder containing `.suite.json`, `gates/`, `scripts/sv_gate.py`, `brief.md`, `beats.md`, `script.json`, `audio.json`, or `src/episode/shotlist.ts`.

Suite root on this machine: `C:/Users/Admin/.gemini/config/plugins/story-video-skills`

## 1. Mandatory Skill Invocation (Zero Improvisation)

1. **Read `sv-00-pipeline` first**: Before pitching, planning, scaffolding, writing code, or answering procedural questions, read `C:/Users/Admin/.gemini/config/plugins/story-video-skills/skills/sv-00-pipeline/SKILL.md`.
2. **Long-Form mode**: If the task is a 16:9 widescreen / 9.5–16 min Long-Form episode (or uses `"units"`), ALSO read `C:/Users/Admin/.gemini/config/plugins/story-video-skills/skills/sv-02-long-form/SKILL.md` before Gate `G1`.
3. **Phase skills are mandatory**: Before executing any phase, read the full `SKILL.md` (and any referenced docs it requires) for that phase:
   - `G1`–`G2` (Brief & Script): `sv-01-series-bible`, `sv-10-script`
   - `G3` (Voice — Hải Đăng 5.25 ups): `sv-12-voice`
   - `G4` (Cast, Sets, Hero Subjects, Props): `sv-20-design-system`
   - `G5` (Motion, Shots & Camera): `sv-21-motion`, `sv-22-shots-camera`
   - `G6` (Audio & Mix/Master): `sv-40-audio`, `sv-42-mix-master`
   - `G7` (QA & Delivery): `sv-41-qa-delivery`
4. **Never improvise from memory**: Do not invent custom Remotion structures, character rigs, voice speeds, music tracks, or file layouts outside the suite specs.

## 2. Strict Gate, Scaffolding & Evidence Discipline (No Bypass)

1. **Always scaffold from the suite**: Create new episodes via `python C:/Users/Admin/.gemini/config/plugins/story-video-skills/tools/new_episode.py <dest>` (or `tools/new_episode.ps1` on Windows; pass `--in-place` if the directory already holds user notes). Never build on `--demo`.
2. **Run gates in dependency order**: `G1 -> G2 -> G3 || G4 -> G5 -> G6 -> G7` (and for `long_16x9` with `"units"`, strictly sequential `U1 -> U2 -> ... -> Uk` via `sv_gate.py pass-unit U<k>`).
3. **Preflight & gate tools are non-negotiable**:
   - Run `python scripts/sv_doctor.py --stage <G>` before heavy stages or `sv_gate.py check <G>`.
   - Pass gates ONLY through `python scripts/sv_gate.py pass <G>` / `pass-unit U<k>`.
   - **NEVER** forge, skip, or hand-edit `gates/log.jsonl`, `qa/state.json`, or lint/review outputs.
   - **NEVER** edit read-only suite copies inside an episode (`standards/`, `scripts/`, `src/engine.ts`, `kit.tsx`, `chars.tsx`, `side.tsx`, `threeq.tsx`, `back.tsx`, `overlays.tsx`, `props.tsx`, `Film.tsx`, `Root.tsx`, `src/exemplar/`).
4. **User approval gates (`G1`, `G2`, `G4`)**: Show the required evidence (`brief.md`, `script.json` / `qa/script_lint.json`, `qa/design/*.jpg`) to the user, wait for explicit approval, and quote it verbatim (`user_quote`) in `gates/G*.review.md`. Only use `approval: delegated` if the user explicitly instructed you to proceed without checking.
5. **Mandatory visual/audio evidence inspection**: Never write `"looks good"` or pass a gate/review for an unviewed file. Open light JPEGs (`*.jpg`, `*_v.jpg`, `*_zoom.jpg`, `qa/units/U*_contact.jpg`, `qa/cards/NN.jpg`, `qa/crops/NN.jpg`, `qa/strips/*.jpg`, `qa/final_check.jpg`) and write concrete remarks (`>= 4` words in gate reviews; `>= 6` words per check in `qa.mjs review --batch`) newer than the evidence.

## 3. Subagent & Swarm Non-Bypass Protocol

Both the coordinator and every subagent (`invoke_subagent`, `define_subagent`, or `swarm` workers) are bound by these rules:

1. **Coordinator duties**: When delegating any story-video work, explicitly include in the prompt/brief:
   - The exact role from `sv-00-pipeline/references/roles.md` (`Conductor`, `Builder`, or `Reviewer`) and the exact files/segments/unit owned.
   - The exact `SKILL.md` path(s) the subagent MUST read before acting (`C:/Users/Admin/.gemini/config/plugins/story-video-skills/skills/sv-<...>/SKILL.md`, plus `sv-00-pipeline/references/roles.md`, and `sv-22-shots-camera/references/review-cards.md` for Reviewers).
   - Required machine checks the subagent must pass (`script_lint.py`, `lint.mjs design`, `lint.mjs shots`, `qa.mjs where <i>`, `qa.mjs review --batch`).
2. **Subagent duties**:
   - Read your assigned `sv-*` `SKILL.md` and `roles.md` BEFORE editing or reviewing.
   - Edit ONLY your assigned files/segment/unit range.
   - Run the required pre-flight lints/checks with `0` errors before reporting completion.
   - **Separation of duties**: A `Builder` MUST NEVER review shots it built; a `Reviewer` MUST inspect the rendered JPEG cards/crops and submit through `node scripts/qa.mjs review --batch <file.jsonl>`.
   - If upstream gates or required inputs are missing/stale, report the block instead of bypassing the gate.

## 4. Windows Toolchain (`C:/Work/Tools`)

On this machine, the PROJ3 runtime tools are installed under `C:/Work/Tools`:
- Python (`Pillow` + `numpy`): `C:/Work/Tools/python-sv/Scripts/python.exe` (`python` & `python3`, `SV_PYTHON`, `SV_SYS_PY`)
- Node.js (`v22`): `C:/Work/Tools/nodejs` (`node.exe`, `npm.cmd`, `npx.cmd`)
- Remotion `node_modules`: `C:/Work/Tools/remotion-runtime/node_modules` (`SV_NODE_MODULES`)
- VieNeu-TTS Python: `C:/Work/Tools/VieNeu-TTS/.venv/Scripts/python.exe` (`SV_PY`)
- FFmpeg / FFprobe: `C:/Users/Admin/.local/bin` (`SV_FFMPEG_DIR`)

If a command runs in a shell whose inherited `PATH` has not picked up User Registry env vars yet (e.g., `node` missing or `python` resolving to `WindowsApps`), prepend `C:\Work\Tools\nodejs;C:\Work\Tools\python-sv\Scripts` to `$env:PATH` and set `SV_NODE_MODULES`, `SV_PY`, `SV_PYTHON`, `SV_SYS_PY`, `SV_FFMPEG_DIR` in that shell command.
