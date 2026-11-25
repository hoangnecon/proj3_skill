---
name: sv-design
description: Author and lock Pre-G4 art_direction.json (AD-01..08), build cast, zero-flicker RasterPlate or SVG sets, and distance-locked Hero Subjects (PR-06, PR-08..11), run 8-axis Reviewer design scoring (LG-13), and pass Gate G4 on Short 9:16 or Long 16:9 episodes. Invoke via /sv-design.
---

# `/sv-design` — Art Direction, Cast, Sets & Hero Subjects (`Pre-G4 → G4`)

Announce immediately: **"Using `sv-design` to lock Pre-G4 Art Direction and build/score Gate G4 visual assets."**

## 1. Detect Track & Load Exact Guides
1. Read `.episode.json` (`"track": "short"` or `"long"`) and confirm `G1` is `PASS` (`sv_cli.py status --json`).
2. Load the matching track design guide:
   - **Short `9:16`:** `guides/short/design.md`
   - **Long `16:9`:** `guides/long/design.md`
   - **Shared Craft References (`guides/short/references/`):** `art-direction.md`, `tokens.md`, `characters.md`, `sets.md`, `atmospheric-plates.md`, `props-overlays.md`.

## 2. Mandatory Two-Phase Gate G4 Protocol
### Phase A — Pre-G4 Art Direction Blueprint Lock (`H3` Hard Gate)
`hooks/sv_guard.py H3` **denies** editing `src/episode/{cast,sets,subjects,geo}.ts(x)` or `plates/*` until `art_direction.json` passes CI:
1. Init Executor log (`--stage G4`) and log `read_skill`.
2. Fill `art_direction.json` completely (zero `TODO`s, `AD-01..AD-06`): style lock (`flat_2d_riso_characters`, `pal_tokens_only`, `nhim_canonical_ch11`), `>= 3` connected sub-scenes per core location, concrete `horizon_and_perspective` & `terrain_and_edge_transitions` locks, `mandatory_objects` (`>= 12` establishing/medium, `>= 8` closeup/insert), `anti_spoiler_guards`, and all 8 `reviewer_rubric` axes (`min_total >= 82`, `min_dim >= 7`).
3. Run `python scripts/sv_cli.py ci art-direction --json` until **exit `0`**.

### Phase B — Cast, Sets, Subjects & 8-Axis Reviewer Scoring
1. **Cast (`src/episode/cast.ts`):** Distinct silhouettes (`CH-06..08`), canonical `NHIM_LOOK` (`CH-11`), Short or Long (`>= 8–10` cast `CH-09`) richness.
2. **Sets (`src/episode/sets.tsx`, `src/episode/geo.ts`):**
   - 1-to-1 sync with `art_direction.json` `location_matrix` (`AD-08`), explicit `bounds`, `zones: {bgY, mgY, fgY}`, `actorScale`, `location`, `landmarks`, `stateless: true`.
   - **Zero-Flicker Raster Plates:** Whenever using `rasterPlate: true`, mount via **`<RasterPlate src={staticFile(...)} x={...} y={...} width={...} height={...} />`** from `../kit` (NEVER bare `<image>`). Split work into `<= 5–6` plates per worker (`plates/pack_*.mjs`) whenever `rasterPlate` count `>= 6` (`AD-07`).
3. **Hero Subjects (`src/episode/subjects.tsx`):** `>= 4` distinct poses (`PR-06`), living motion (`PR-08`), **distance-locked `opts.phase` gated on `opts.moving`/`opts.speed` for grounded locomotion (`PR-11` — zero treadmill walking in place)**, `partialOf` only on closeup/insert plates (`PR-10`).
4. **Build CI & Sheets:** Run `python scripts/sv_cli.py ci design --json` (`0` errors) and `node scripts/design.mjs`, then close Executor log & pass `ci log --stage G4 --role executor`.
5. **Independent Reviewer 8-Axis Scoring (`agents/sv-reviewer.md`, `LG-13`):**
   - Reviewer opens rendered `qa/design/*_v.jpg` sheets via `read_file` (`H6`), logs `inspect_visual`, and runs:
     ```bash
     python scripts/sv_cli.py design score --input qa/design/scores_draft.json --actor <rev_id> --run <rev_run> --json
     ```
   - Every set MUST achieve `total >= 82` AND every axis `>= 7` (`verdict: "pass"`). Fix any failing plate before presenting to user.
6. **User Approval & Gate G4 Pass:** Orchestrator opens sheets via `read_file`, presents to user, records verbatim `user_quote` + every `qa/design/*.png` in `gates/G4.review.md`, and runs `sv_cli.py gate check G4` → `sv_cli.py gate pass G4 --actor <coord_id>`.
