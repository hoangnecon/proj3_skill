---
name: sv-long-production
description: Long 16:9 track Gate G5 sequential Unit-by-Unit production (U1..Uk) — multi-scale widescreen blocking (2.8-6.2 s/shot, SH-16..23, CA-06..08, LA-01..04, MO-13..19, GE-15..21, PR-10), per-unit 3-Tier Blind QA (11 checks incl. continuity, framing, variety), sequential sv_cli.py gate pass unit locking, and full Gate G5 sign-off. Use ONLY when .episode.json has track "long".
---

# sv-long-production · Long 16:9 Sequential Unit Production (G5.U1..Uk -> G5)

## 1. Track Lock, Prerequisites & Shared Motion Craft
- **Active only for:** `.episode.json` `"track": "long"` (`16:9`, `1920×1080`, `script.json` `"units"` `U1..Uk`).
- **Upstream lock:** BOTH `G3` and `G4` MUST be `PASS` (`hooks/sv_guard.py H3` denies editing `shotlist.ts` earlier).
- Inherits actor/camera/review mechanics from `sv-short-production/references/{acting,actor-api,shot-grammar,shotlist-api,review-cards}.md`, plus strict Long 16:9 cinematic rules below.

## 2. Mandatory Sequential Unit-by-Unit Protocol (`U1 → U2 → … → Uk`)
**NEVER build all units in one giant batch.** Lock each unit `U<k>` completely via `G5.U<k>` before authoring `U<k+1>` (`sv_gate.py` enforces strict sequential lock + 30 s cooldown):

For each unit `U<k>` in order:
1. **Executor Build (`stage: G5.U<k>`, `unit: U<k>`):**
   - `python scripts/sv_cli.py log init --role executor --actor exec-<U> --stage G5.<U> --unit <U> --task "Author shots for <U>" --json`
   - Author shots covering every segment `[seg_start..seg_end]` of `<U>` obeying ALL Long 16:9 invariants:
     - **Pacing (`PC-01..03`):** `2.8–6.2 s/shot` from `standards/pacing.json` (`shots_long_16x9`).
     - **Visual Variety (`SH-16`, `SH-17`, `SH-20`, `SH-21`, `CA-06..08`):** `≤ 8` consecutive shots on one set, `≤ 18%` episode share per set, `≥ 15%` angled (`back`+`3q`) views, break wide/medium streaks before 4 shots with drawn `closeup`/`insert`/`pov`, rotate locations (`≤ 16` streak), respect 180° axis (`CA-06`).
     - **Scale, Temporal & Grounding Locks (`SH-22`, `SH-23`, `LA-01..04`, `GE-21`, `PR-10`):** Match set `scaleMode` to unit `scale_mode`, respect `firstSeg`/`appearSegs`/`poseSegs`, keep `scaleWithTinyActor` accurate, keep ground-bound `SUBJECTS` on the floor plane (`GE-21`), never place partial-body assets next to full actors in wide shots (`PR-10`).
     - **Living Choreography (`MO-13..19`, `GE-20`):** Distance-locked gaits, bounded 4-stage `jumpPhase` (`≤ 2.2 s`), story-motivated `leap`/`pop` squash-and-stretch (`actor-api.md` restraint rule — never bounce calm dialogue or sad beats), straddle mounts (`MO-14`), contact-locked `pushTarget` (`MO-13`), zero dead-freeze windows on `> 4.2 s` shots (`MO-18`), `≥ 1–2` choreography events on `> 5.0 s` shots (`MO-16`).
   - Run `python scripts/sv_cli.py ci shots --json` (`0` errors on `<U>`), `node scripts/qa.mjs pass --unit <U>`, and `node scripts/blind_pack.mjs --unit <U>`.
   - Close Executor log and pass `python scripts/sv_cli.py ci log --stage G5.<U> --role executor --unit <U> --json`.
2. **Independent 3-Tier Blind Review (`roles/reviewer.md`, `reviewer_id != exec-<U>`):**
   - Init Reviewer log (`--stage G5.<U> --unit <U>`).
   - Open Tier 1 (`qa/units/<U>_contact.jpg`), Tier 2 (`qa/contact_segments/*.jpg`), Tier 3 (`qa/shots/NN.jpg` + `qa/strips/*.jpg`), and every HOT `card`/`crop`.
   - Grade ALL **11 checks** (`acting`, `contact`, `overlap`, `set`, `text`, `caption`, `beat`, `model`, `continuity`, `framing`, `variety`) using `context_window.prev_shot`/`next_shot`, submit via `python scripts/sv_cli.py review submit --batch <file.jsonl> --actor rev-<U> --run <rev_run_id> --json`, and pass `python scripts/sv_cli.py ci log --stage G5.<U> --role reviewer --unit <U> --json`.
   - Fix any `fix` shot and re-verify before proceeding.
3. **Orchestrator Unit Audit & Lock (`G5.U<k>`):**
   - Orchestrator opens `qa/units/<U>_contact.jpg` + spot-check cards/crops via `read_file` (`hooks/sv_guard.py H6`), writes `gates/G5.<U>.review.md`, closes Orchestrator log, and locks `<U>`:
     ```bash
     python scripts/sv_cli.py gate check G5.<U> --json
     python scripts/sv_cli.py gate pass G5.<U> --actor <coord_id> --json
     ```

## 3. Final Full-Episode Gate G5 Sign-Off (After Final Unit `U<k>`)
1. Run full-episode `python scripts/sv_cli.py ci shots --json` (`0` errors across all units), `node scripts/qa.mjs contact`, `node scripts/qa.mjs strips`, `node scripts/blind_pack.mjs`.
2. Orchestrator verifies every `G5.U1..Uk` is `PASS`, inspects full `qa/contact_p*.jpg` + strips via `read_file`, writes `gates/G5.review.md`, completes Orchestrator log for `G5`, and passes:
   ```bash
   python scripts/sv_cli.py gate check G5 --json
   python scripts/sv_cli.py gate pass G5 --actor <coord_id> --json
   ```
