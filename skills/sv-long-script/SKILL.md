---
name: sv-long-script
description: Long 16:9 track Gates G1 and G2 — 5-chapter cinematic adventure ideation, brief.md, 10-year-old crystal-clear linear worldbuilding, 3+ Plant-to-Payoff knots (SC-29..37), Episodic Units plan U1..Uk (SC-37), Adversarial Story Doctor audit (qa/story_doctor.json score at least 80), script CI, and user approval. Use ONLY when .episode.json has track "long".
---

# sv-long-script · Long 16:9 Adventure Brief (G1), Script & Story Doctor (G2)

## 1. Track Lock & References
- **Active only for:** `.episode.json` `"track": "long"` (`16:9`, `1920×1080`, `"format": "16:9"`, `"length": "long_16x9"`).
- **Single Source of Truth:** Read exact word, segment, duration, and voice pacing ranges from the episode's `standards/pacing.json` (`episode_long_16x9` + `voice`) and `standards/voice_standard.json` (`v4.0`).
- **Deep prompt references:**
  - `references/ideation-system-prompt.md` (5-chapter cinematic ideation & 10yo clarity)
  - `references/story-doctor-prompt.md` (independent Adversarial Story Doctor 100-point rubric)

## 2. Gate G1 — Cinematic Brief (`brief.md`, User Approval Gate)
1. Init Orchestrator + Executor logs (`--stage G1`).
2. Design an adventure premise passing `sv-core-bible` AND supporting **5 escalating chapters** across **4–6 distinct Locations** (with mini-cliffhangers between chapters).
3. Write `brief.md` with all 8 required sections (`## Archetype`..`## Not copying`), zero `TODO`s, and a `## Length override` section with verbatim `user_quote` if confirming custom duration.
4. Independent Reviewer (`reviewer_id != executor_id`) audits `brief.md` against `sv-core-bible` + 5-chapter scope and passes `ci log --stage G1 --role reviewer`.
5. Run `python scripts/sv_cli.py doctor --stage G1 --json`, get explicit user approval, write `gates/G1.review.md`, log `user_approval`, close Orchestrator log, verify `ci log --stage G1 --role all`, and pass `G1` via `sv_cli.py gate pass G1 --actor <coord_id>`.

## 3. Gate G2 — 5-Chapter Script, Episodic Units & Story Doctor (User Approval Gate)
1. Init Executor log (`--stage G2`). Confirm `G1` is `PASS`.
2. Write `beats.md` containing:
   - **5 Chapters** (`SC-29`), each covering `10–34%` of segments (`[sA-sB]`), with `Mini-Cliffhanger` on Chapters 1–4 and `Ending` / `Payoff` on Chapter 5.
   - `## Plant & Payoff` (`SC-30`): `≥ 3` distinct Plants (`≤ 55%`) paired with `≥ 3` distinct Payoffs (`≥ 60%`), every `Plant < Payoff`.
3. Write `script.json`:
   - Set `"format": "16:9"`, `"length": "long_16x9"`, `"voice": "Hải Đăng"`.
   - **Crystal-clear 10yo prose (`SC-36`):** Opening hook (`s1..s5`) sentences `≤ 18` words with an immediate wonder/curiosity cue in `s1..s3`; mean spoken sentence `≤ 15.5` words (`max 24`); zero textbook mechanical jargon.
   - **Pure voice integrity (`SC-35`):** Never warp TTS speed outside `standards/voice_standard.json` bounds (`≤ 10%` custom `wps`).
   - **Mandatory Episodic Units (`SC-37`):** Declare `"units": [{"id": "U1", "title": "...", "seg_start": "s1", "seg_end": "...", "scale_mode": "normal"|"tiny"}, ...]` spanning `4–9` contiguous non-overlapping units covering every segment `s1..sN`.
4. **Run Script CI (`0` errors):**
   ```bash
   python scripts/sv_cli.py ci script --json
   ```
   Close Executor log (`log complete --verdict pass`) and verify `ci log --stage G2 --role executor`.
5. **Independent Adversarial Story Doctor (`roles/reviewer.md`, `reviewer_id != executor_id`):**
   - Audit `script.json` + `beats.md` using `references/story-doctor-prompt.md`.
   - Write `qa/story_doctor.json` with current `script_sha`, `reviewer` (`!= author/builder`), `score >= 80`, `meandering_stretches: []`, and `verdict: "pass"`.
   - Log Reviewer audit and pass `python scripts/sv_cli.py ci log --stage G2 --role reviewer --json`.
6. Present `script.json`, `qa/script_lint.json`, and `qa/story_doctor.json` to the user, write `gates/G2.review.md` (`approval: user`, verbatim `user_quote`), close Orchestrator log, and run `sv_cli.py gate check G2` → `sv_cli.py gate pass G2 --actor <coord_id>`.
