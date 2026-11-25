---
name: sv-produce
description: Resume and drive the active production pipeline for an existing Vietnamese 2D story-video episode across Gates G3 (voice), G5 or sequential G5.U1..Uk (shots and blind visual QA), G6 (audio mix), and G7 (master render and 30fps transition QA). Invoke via /sv-produce.
---

# `/sv-produce` — Resume & Drive Episode Production (`G3 / G5 / G6 / G7`)

Announce immediately: **"Using `sv-produce` to check episode status and drive the next production gate."**

## 1. Inspect Current State First
Always start by checking `.episode.json` (`track: "short" | "long"`) and running:
```bash
python scripts/sv_cli.py status --json
```
Route immediately to the next incomplete gate in the DAG (`G1 → G2 → G3 ∥ G4 → G5 → G6 → G7`):

| Next Open Gate | Guide to Read | Action |
|---|---|---|
| `G1` or `G2` | `guides/<track>/script.md` | Hand off to `/sv-write-script` |
| `G3` (Voice) | `guides/core/voice.md` | Follow `/sv-voice-audio` (Gate G3) |
| `G4` (Design) | `guides/<track>/design.md` | Hand off to `/sv-design` |
| `G5` / `G5.U<k>` (Shots & Blind QA) | `guides/short/production.md` or `guides/long/production.md` + `guides/short/references/{acting,actor-api,shot-grammar,shotlist-api,review-cards}.md` | Author shots, pass `ci shots`, render `qa.mjs pass changed` + `blind_pack.mjs`, run independent blind review (`agents/sv-reviewer.md`) + Orchestrator spot-checks (`H6`), lock gate |
| `G6` (Audio Mix) | `guides/core/audio.md` | Follow `/sv-voice-audio` (Gate G6) |
| `G7` (Delivery) | `guides/core/delivery.md` + `guides/core/references/rubrics.md` | Run `node scripts/deliver.mjs`, verify `sv_cli.py ci delivery --json` (incl. `transition_qa.py` `DL-01..02`), inspect `qa/final_check.jpg` via `read_file`, pass `G7` |

## 2. Gate G5 Production Rules (Short & Long)
- **Upstream lock (`H3`):** Both `G3` and `G4` MUST be `PASS` before editing `src/episode/shotlist.ts`.
- **Long `16:9` Sequential Lock:** Build and lock ONE unit at a time (`G5.U1` → `G5.U2` → … → `G5.Uk`) before full `G5`. Never batch all units together.
- **Physics, Pacing & Restraint:** Read exact shot-length corridors from `standards/pacing.json` (`PC-01..03`). Enforce `GE-21` ground contact, `PR-10` no wide-shot detached limbs, `PR-11` distance-locked subject locomotion, and story-motivated `leap`/`pop` restraint (`MO-15`, `MO-17`).
- **Independent Blind QA (`LG-08`, `LG-09`, `H6`):** Executor NEVER reviews its own shots. Reviewer (`agents/sv-reviewer.md`) reads `qa/blind_review/*`, opens rendered JPEGs via `read_file`, checks all 9 Short / 11 Long criteria (incl. 3-shot `continuity`), and submits via `sv_cli.py review submit --batch ...`.

## 3. Gate G7 Final Delivery Rules
1. Confirm `G1..G6` are ALL `PASS` (`hooks/sv_guard.py H5`).
2. Run `node scripts/deliver.mjs` (renders `out/final.mp4`, runs `audio_qa.py --video`, runs 30fps `scripts/transition_qa.py --video out/final.mp4` for `DL-01`/`DL-02`, builds `qa/final_check.jpg`).
3. Run `python scripts/sv_cli.py ci delivery --json` (`0` errors, `stale_bg_frames == 0`, `blank_flash_frames == 0`).
4. Both Reviewer and Orchestrator open `qa/final_check.jpg` via `read_file` (`H6`), write `gates/G7.review.md` citing `deliver_report.json`, `final_check.jpg`, `video_audio.json`, and `transition_qa.json`, and pass `G7`.
