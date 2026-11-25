---
name: sv-create-short
description: Scaffold and produce a brand-new Vietnamese 2D Short 9:16 (1080x1920) story-video episode from scratch through Gates G1 to G7. Invoke via /sv-create-short or when the user asks to create a new Short episode, pitch Short premises, or start a 9:16 story video.
---

# `/sv-create-short` — Create a New Short `9:16` Episode (`G1 → G7`)

Announce immediately: **"Using `sv-create-short` to scaffold and launch a new Short `9:16` episode."**

## 1. Required Deep Guides (Read Before Acting)
Read these files from `<suite>` (`C:/Users/Admin/.gemini/config/plugins/story-video-skills`) as you enter each stage:
- **Start / Routing:** `guides/core/router.md`
- **G1–G2 (Brief & Script):** `guides/core/bible.md`, `guides/short/script.md`
- **G3 (Voice) ∥ G4 (Design):** `guides/core/voice.md`, `guides/short/design.md`
- **G5 (Shots), G6 (Audio), G7 (Delivery):** `guides/short/production.md`, `guides/core/audio.md`, `guides/core/delivery.md`

## 2. Step-by-Step Launch Protocol
1. **Scaffold with explicit Short track** (NEVER hand-copy folders or `--demo`):
   ```bash
   python C:/Users/Admin/.gemini/config/plugins/story-video-skills/tools/new_episode.py <dest> --track short
   ```
   Confirm `.episode.json` has `"track": "short"` and run `python scripts/sv_cli.py doctor --stage G1 --json`.
2. **Gate G1 — Ideation & Brief (User Approval Gate):**
   - Read `guides/core/bible.md` and `guides/short/script.md` (`guides/short/references/premise-ideation.md`), plus `standards/pacing.json` and `standards/script_dna_db.json`.
   - Pitch **5 distinct premises** passing the 7-point premise test (canonical New Nhím `CH-11` when featured, Short Scope Economy `SC-40`).
   - Once the user selects a premise, write `brief.md`, run role logs (`LG-01..LG-13`), collect explicit user approval (`user_quote` in `gates/G1.review.md`), and pass `G1` via `sv_cli.py gate pass G1 --actor <coord_id>`.
3. **Continue Cleanly Through the DAG (`G2 → G3 ∥ G4 → G5 → G6 → G7`):**
   - **G2 Script:** Follow `/sv-write-script` (`SC-01..27`, `SC-38..43`, user approval).
   - **G3 Voice ∥ G4 Design:** Follow `/sv-voice-audio` (`v4.0` Hải Đăng) in parallel with `/sv-design` (mandatory Pre-G4 `art_direction.json` `AD-01..08`, `<RasterPlate>`, `PR-11`, 8-axis `design score` `LG-13`, user approval).
   - **G5 Shots → G6 Audio → G7 Delivery:** Follow `/sv-produce` (blind 9-check review incl. `continuity`, `-14 LUFS` mix, 30fps `transition_qa.py` `DL-01..02`, visual inspection `H6`).

## 3. Non-Negotiable Guardrails
- Never invent numeric pacing/voice thresholds from memory — read `standards/*.json`.
- Never bypass user approval gates (`G1`, `G2`, `G4`) or visual inspection (`read_file` on JPEG evidence, enforced by `hooks/sv_guard.py H6`).
- Use native role separation (`agents/sv-orchestrator.md`, `agents/sv-executor.md`, `agents/sv-reviewer.md`) so an Executor never reviews its own work (`LG-08`) or passes gates.
