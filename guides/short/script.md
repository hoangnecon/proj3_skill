# sv-short-script · Short 9:16 Brief (G1) & Script (G2)

## 1. Track Lock & References
- **Active only for:** `.episode.json` `"track": "short"` (`9:16`, `1080×1920`).
- **Single Source of Truth:** Read exact word, segment, pause, and sentence-rhythm targets from the episode's `standards/pacing.json` and `standards/script_dna_db.json`.
- **Deep craft references:**
  - `references/premise-ideation.md` (premise ideation & 23-hits DNA)
  - `references/craft.md` (5-Knot causality, Show & Withhold, staccato punch)
  - `references/script-dna-playbook.md` (corpus cadence rules `SC-38..SC-43`)
  - `references/exemplar.md` (annotated Short exemplar structure)

## 2. Gate G1 — Premise & `brief.md` (User Approval Gate)
1. Init Orchestrator + Executor logs (`sv_cli.py log init ... --stage G1`).
2. Pitch or develop a premise passing ALL 7 checks of `sv-core-bible`.
3. Write `brief.md` with all 8 mandatory sections (zero `TODO` placeholders):
   `## Archetype`, `## Premise`, `## Spine`, `## Why it is funny`, `## Characters`, `## Locations`, `## Ending`, `## Not copying`.
4. **Scope Economy (`SC-40`):** Keep `brief.md` focused (target `2–3` active core characters, `≤ 3–4` core locations — expanded into connected sub-scenes in `sv-short-design` — and `1–3` core plot props).
5. Independent Reviewer (`reviewer_id != executor_id`) audits `brief.md` against the 7-point premise test (`sv-core-bible`) and logs Reviewer pass (`ci log --stage G1 --role reviewer`).
6. Run `python scripts/sv_cli.py doctor --stage G1 --json`, present `brief.md` to the user, obtain explicit approval, write `gates/G1.review.md` (`approval: user`, verbatim `user_quote`), log `user_approval`, close Orchestrator log, verify `ci log --stage G1 --role all`, and pass `G1` via `sv_cli.py gate pass G1 --actor <coord_id>`.

## 3. Gate G2 — `beats.md` & `script.json` (User Approval Gate)
1. Init Executor log (`--stage G2`). Confirm `G1` is `PASS` (`hooks/sv_guard.py H3` denies edits to `script.json`/`beats.md` before `G1`).
2. Write `beats.md` mapping every segment `s1..sN` across the 5-Knot Spine, including `## Plant & Payoff` (`Plant: s<N>` in Act 1 `≤ 45%`, `Payoff: s<M>` in Act 3 `≥ 65%`, `SC-22`).
3. Write `script.json` (`"voice": "Hải Đăng"`, `"format": "9:16"`, no `"length": "long_16x9"`):
   - Follow staccato spoken sentences (read `standards/script_dna_db.json`), wrap English words in `<en>...</en>` or `"english": [...]`, spell out numbers in Vietnamese inside `tts_text`, and place `≥ 3` dramatic `pause_after` beats (`SC-41`).
   - Do **not** set aggressive custom `"wps"` overrides (`SC-35`); let `standards/voice_standard.json` + crisp short sentences drive rhythm naturally.
4. **Run Script CI until 0 errors:**
   ```bash
   python scripts/sv_cli.py ci script --json
   ```
   (Executes `scripts/script_lint.py` covering `SC-01..27`, `SC-35`, `SC-38..43` and writes `qa/script_lint.json`.)
5. Close Executor log (`log complete --verdict pass`) and verify `ci log --stage G2 --role executor`.
6. Independent Reviewer (`reviewer_id != executor_id`) audits `script.json` + `beats.md` against the 14-point rubric in `references/craft.md` and passes `ci log --stage G2 --role reviewer`.
7. Present `script.json` and `qa/script_lint.json` to the user for explicit approval, write `gates/G2.review.md` (`approval: user`, verbatim `user_quote`, concrete observation on `script_lint.json`), log `user_approval`, close Orchestrator log, and run:
   ```bash
   python scripts/sv_cli.py gate check G2 --json
   python scripts/sv_cli.py gate pass G2 --actor <coord_id> --json
   ```
