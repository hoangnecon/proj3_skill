# sv-short-production · Short 9:16 Blocking, Motion & Blind QA (G5)

## 1. Track Lock, Prerequisites & References
- **Active only for:** `.episode.json` `"track": "short"` (`9:16`, `1080×1920`).
- **Upstream lock:** BOTH `G3` (voice) and `G4` (design) MUST be `PASS` (`hooks/sv_guard.py H3` denies edits to `src/episode/shotlist.ts` earlier).
- **Craft references:**
  - `references/acting.md` & `references/actor-api.md` (distance-locked walk/run stop-settle, `lookAt`, `livingIdle`, `jumpPhase`, `pushTarget`, 3-layer straddle mounts, `ActionFx`, story-motivated `leap`/`pop` squash-and-stretch with strict restraint)
  - `references/shot-grammar.md` & `references/shotlist-api.md` (word anchors `tAt`, shot sizes, `cam`/`cam2`/`camKeys`, transitions `ShotDef.tr`, overlays, `standards/pacing.json` `shots` pacing)
  - `references/review-cards.md` (9-check blind review protocol, HOT crops, 3-shot `continuity` check)

## 2. General Physical & Continuity Invariants (Never Bypass)
1. **Floor-Plane Grounding (`GE-21`):** Every ground-bound `SUBJECT` (`vehicle`, `creature`, `machine`) must be anchored on the set's floor lane (`zones.mgY`) unless airborne (`altitude > 0` / airborne pose). Never float vehicles/objects in sky or upper wall regions.
2. **No Disembodied Limbs in Wide/Medium Shots (`PR-10`, `GE-19`):** Never place a `partialOf` / limb asset next to full `<Person>` actors in establishing/medium shots — use a dedicated `closeup`/`insert` plate or animate the `<Person>`'s own arm/hand.
3. **Chronological & Spatial Continuity (`continuity`):** Never depict impact/aftermath BEFORE the spoken narration reaches it; keep inter-actor distances believable for the spoken beat; keep operators/riders consistent across consecutive moving-object shots; populate group locations with background extras.
4. **Zero-Bounce Geometry Check:** Run `node scripts/qa.mjs where <i> [--free WxH]` to place overlays and verify actor/sign clearance BEFORE rendering.

## 3. Mandatory Execution Steps (Gate G5)
1. **Init Executor Log & Author `src/episode/shotlist.ts`:**
   ```bash
   python scripts/sv_cli.py log init --role executor --actor exec-shots --stage G5 --task "Author Short 9:16 shotlist and resolve all shot CI" --json
   python scripts/sv_cli.py doctor --stage G5 --json
   ```
2. **Run Shot CI (`0` errors) & Render QA + Blind Pack:**
   ```bash
   python scripts/sv_cli.py ci shots --json
   node scripts/qa.mjs pass changed
   node scripts/blind_pack.mjs
   ```
   Close Executor log (`log complete --verdict pass`) and verify `python scripts/sv_cli.py ci log --stage G5 --role executor --json`.
3. **Independent Blind Review (`roles/reviewer.md`, `reviewer_id != exec-shots`):**
   - Reviewer reads ONLY `qa/blind_review/{RUBRIC.md, slice_*.json}`, `qa/design/*_v.jpg`, and rendered JPEGs (`contact_p*.jpg`, `contact_segments/*.jpg`, `cards/NN.jpg`, HOT `crops/NN.jpg`, `shots/NN.jpg`, `strips/*.jpg`).
   - Evaluates ALL **9 checks** (`acting`, `contact`, `overlap`, `set`, `text`, `caption`, `beat`, `model`, `continuity`) using `context_window.prev_shot`/`next_shot`, submits via:
     ```bash
     python scripts/sv_cli.py review submit --batch qa/blind_review/rev_1.jsonl --actor rev-1 --run <rev_run_id> --json
     ```
   - Logs concrete observations (`--action inspect_visual --target <jpg_path>`) and passes `python scripts/sv_cli.py ci log --stage G5 --role reviewer --json`.
   - Any `fix` shot loops back to Executor → `ci shots` → `qa.mjs pass changed` → `blind_pack.mjs` → Reviewer re-review.
4. **Orchestrator Independent Spot-Check & Gate G5 Pass:**
   - Orchestrator opens ALL `qa/contact_p*.jpg`, `>= 10%` random `qa/cards/NN.jpg`, and every HOT `qa/crops/NN.jpg` via `read_file` (`hooks/sv_guard.py H6`), writes `gates/G5.review.md`, closes Orchestrator log, and runs:
     ```bash
     python scripts/sv_cli.py gate check G5 --json
     python scripts/sv_cli.py gate pass G5 --actor <coord_id> --json
     ```
