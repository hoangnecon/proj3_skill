---
name: sv-write-script
description: Ideate, draft, revise, or validate brief.md, beats.md, and script.json for Gates G1 and G2 on either Short 9:16 or Long 16:9 story-video episodes. Invoke via /sv-write-script or when the user asks to write, rewrite, polish, or lint an episode brief or script.
---

# `/sv-write-script` — Brief, Beats & Script Authoring (`G1–G2`)

Announce immediately: **"Using `sv-write-script` to author/revise episode brief and script for Gates G1–G2."**

## 1. Detect Track & Load Exact Guide
1. Inspect `.episode.json` (`"track": "short"` or `"long"`) and run `python scripts/sv_cli.py status --json`.
2. Read ONLY the matching track guide + series bible + `standards/pacing.json`:
   - **Shared (G1):** `guides/core/bible.md`
   - **Short `9:16`:** `guides/short/script.md` (and `guides/short/references/{premise-ideation,craft,exemplar,script-dna-playbook}.md` + `standards/script_dna_db.json`)
   - **Long `16:9`:** `guides/long/script.md` (and `guides/long/references/{ideation-system-prompt,story-doctor-prompt}.md`)

## 2. Execution Protocol
### Gate G1 (`brief.md`)
1. Init Executor log (`--stage G1`) and log `read_skill` on this `SKILL.md` or the track guide (`LG-03`).
2. Write `brief.md` covering every required heading (`Archetype`, `Premise`, `Spine`, `Why it is funny`, `Characters`, `Locations`, `Ending`, `Not copying`) with zero `TODO`s.
3. Run independent Reviewer (`agents/sv-reviewer.md`) against the 7-point premise test (`guides/core/bible.md`).
4. Present `brief.md` to the user, wait for explicit approval, record verbatim `user_quote` in `gates/G1.review.md` (`LG-11`), and pass `G1` via `sv_cli.py gate pass G1 --actor <coord_id>`.

### Gate G2 (`beats.md` + `script.json`)
1. Confirm `G1` is `PASS` (`hooks/sv_guard.py H3` blocks editing `beats.md`/`script.json` earlier).
2. Init Executor log (`--stage G2`), author `beats.md` and `script.json` calibrated strictly to `standards/pacing.json`:
   - **Short `9:16`:** `SC-01..27`, `SC-35`, `SC-38..43` (prose breathability, live dialogue quotes, Short Scope Economy, peak WPS & breath pauses).
   - **Long `16:9`:** `SC-29..37` (5 chapters, `3+` Plant-to-Payoff knots, `units` `U1..Uk`) + independent Adversarial Story Doctor audit (`qa/story_doctor.json` score `>= 80`).
3. Run `python scripts/sv_cli.py ci script --json` until **exit `0`** (0 errors).
4. Complete Executor + Reviewer logs (`sv_cli.py ci log --stage G2 --role all --json`), present script summary to the user, record verbatim `user_quote` in `gates/G2.review.md`, and pass `G2`.

## 3. Guardrails
- Read exact word budgets and pause targets from `standards/pacing.json` — never guess numbers from memory.
- Keep `G1` and `G2` user-approval gates strictly interactive (never forge `user_quote`).
