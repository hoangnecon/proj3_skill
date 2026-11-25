---
name: sv-create-long
description: Scaffold and produce a brand-new Vietnamese 2D Long 16:9 (1920x1080) cinematic adventure episode with 5-chapter Story Doctor, 24-30 Spatial Location Pack plates, and sequential U1..Uk production. Invoke via /sv-create-long or when starting a 16:9 long-form episode.
---

# `/sv-create-long` — Create a New Long `16:9` Episode (`G1 → G7`)

Announce immediately: **"Using `sv-create-long` to scaffold and launch a new Long `16:9` cinematic episode."**

## 1. Required Deep Guides (Read Before Acting)
Read these files from `<suite>` (`C:/Users/Admin/.gemini/config/plugins/story-video-skills`) as you enter each stage:
- **Start / Routing:** `guides/core/router.md`
- **G1–G2 (5-Chapter Brief, Units & Story Doctor):** `guides/core/bible.md`, `guides/long/script.md`
- **G3 (Voice) ∥ G4 (Spatial Location Packs):** `guides/core/voice.md`, `guides/long/design.md`
- **G5 (`U1..Uk` Sequential), G6 (Audio), G7 (Delivery):** `guides/long/production.md`, `guides/core/audio.md`, `guides/core/delivery.md`

## 2. Step-by-Step Launch Protocol
1. **Scaffold with explicit Long track** (NEVER hand-copy folders or `--demo`):
   ```bash
   python C:/Users/Admin/.gemini/config/plugins/story-video-skills/tools/new_episode.py <dest> --track long
   ```
   Confirm `.episode.json` has `"track": "long"` and run `python scripts/sv_cli.py doctor --stage G1 --json`.
2. **Gate G1 — 5-Chapter Premise & Brief (User Approval Gate):**
   - Read `guides/core/bible.md`, `guides/long/script.md`, `guides/long/references/ideation-system-prompt.md`, and `standards/pacing.json`.
   - Pitch 5 cinematic 5-chapter premises (10-year-old crystal-clear linear worldbuilding, `3+` Plant-to-Payoff knots `SC-29..37`, episodic `units` plan `U1..Uk`).
   - Lock `brief.md` with role logs, verbatim `user_quote`, and `sv_cli.py gate pass G1 --actor <coord_id>`.
3. **Continue Cleanly Through the Long DAG (`G2 → G3 ∥ G4 → G5.U1..Uk → G5 → G6 → G7`):**
   - **G2 Script:** Author `beats.md` + `script.json` (`units` `U1..Uk`), pass independent Adversarial Story Doctor (`guides/long/references/story-doctor-prompt.md`, `qa/story_doctor.json` score `>= 80`), `ci script`, and user approval.
   - **G3 Voice ∥ G4 Design:** Follow `/sv-voice-audio` (`v4.0` Hải Đăng) in parallel with `/sv-design` (`art_direction.json` `AD-01..08`, `8–10+` cast `CH-09`, `24–30` Spatial Location Packs `SE-15..20`, `<RasterPlate>`, `PR-11`, worker split `<= 5–6` plates/worker, 8-axis `design score` `LG-13`).
   - **G5 Sequential Units (`U1 → U2 → … → Uk`):** Follow `/sv-produce` — lock each `G5.U<k>` completely via 3-Tier 11-check blind QA before starting `U<k+1>`.
   - **G6 Audio → G7 Delivery:** `-14 LUFS` mix, 30fps `transition_qa.py` (`DL-01..02`), 12-frame `qa/final_check.jpg` inspection.

## 3. Non-Negotiable Guardrails
- Never build all Long units in one giant batch (`sv_gate.py` enforces strict sequential `G5.U<k>` lock + cooldown).
- Never mix Short `9:16` guides or pacing tables into a Long `16:9` episode.
- Always enforce role separation (`agents/sv-orchestrator.md`, `agents/sv-executor.md`, `agents/sv-reviewer.md`).
