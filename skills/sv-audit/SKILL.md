---
name: sv-audit
description: Perform a strict read-only multi-layer quality audit on an existing story-video episode across gates, lint CI, visual contact sheets, shot cards, motion strips, audio metrics, and 30fps MP4 transition flicker without editing source files. Invoke via /sv-audit.
---

# `/sv-audit` — Read-Only Episode QA Audit & Defect Report

Announce immediately: **"Using `sv-audit` to run a read-only multi-layer QA audit on this episode (no source edits)."**

## 1. Strict Read-Only Discipline
- **NEVER edit source files** (`script.json`, `art_direction.json`, `src/episode/*`, `audio.json`) during `/sv-audit`.
- Your sole deliverable is an evidence-backed defect report telling the user **exact issues, exact shot/timestamp, root layer (`G2/G3/G4/G5/G6/G7`), and ready-to-run `/sv-fix` guidance**.
- Read `guides/short/references/review-cards.md` (9 Short / 11 Long criteria incl. `continuity`) and `guides/core/references/rubrics.md`.

## 2. Deterministic Audit Sequence
1. **Pipeline & Environment Snapshot:**
   ```bash
   python scripts/sv_cli.py status --json
   python scripts/sv_cli.py doctor --stage G7 --json
   ```
2. **Run Applicable Read-Only Verifiers (matching completed stages):**
   - Script (`script.json` exists): `python scripts/sv_cli.py ci script --json`
   - Art Direction (`art_direction.json` exists): `python scripts/sv_cli.py ci art-direction --json`
   - Design (`src/episode/sets.tsx` exists): `python scripts/sv_cli.py ci design --json`
   - Shots (`src/episode/shotlist.ts` exists): `python scripts/sv_cli.py ci shots --json`
   - Voice / Audio (when generated): `python scripts/sv_cli.py ci voice --json` / `python scripts/sv_cli.py ci audio --json`
   - Delivered MP4 (`out/final.mp4` exists):
     ```bash
     python scripts/transition_qa.py --video out/final.mp4 --shots qa/shots.json
     python scripts/sv_cli.py ci delivery --json
     ```
3. **Mandatory Real Visual Inspection (`read_file` — Never Audit Blind):**
   Open existing rendered sheets via `read_file` and inspect them critically:
   - `qa/design/overview_sets.jpg`, `qa/design/cast_episode_p1_v.jpg`, `qa/design/subject_*_v.jpg`
   - `qa/contact_p*.jpg` (or `qa/units/*_contact.jpg`) + any flagged HOT `qa/cards/NN.jpg`, `qa/crops/NN.jpg`, `qa/strips/*.jpg`
   - `qa/final_check.jpg` (if `out/final.mp4` exists)
   Check specifically for:
   - **Continuity:** shot `N` end → shot `N+1` start coordinates & `flip`/facing; genuine camera/blocking change across sub-scene cuts; lighting (day/dusk/night) and arrival/stop poses synced to spoken words.
   - **Physics & Motion:** treadmill walking-in-place (`PR-11`), floating ground objects (`GE-21`), occluded faces/captions (`GE-04`), clipped signs (`GE-10..11`).
   - **Render & Audio:** stale-backdrop flicker (`DL-01`), blank flashes (`DL-02`), LUFS/true-peak/A-V sync drift.

## 3. Structured Audit Output Format
Present findings sorted by severity (**P0 Blocker → P1 Visual/Audio Defect → P2 Polish**):
- `Severity | Shot / Timestamp | Root Layer (G3/G4/G5/G6/G7) | Concrete Evidence (file & frame) | Recommended Fix`
- Close with a ready-to-copy `/sv-fix ...` command covering the confirmed issues, or state clearly **0 defects found** with verified metrics.
