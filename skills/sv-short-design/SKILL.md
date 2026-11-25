---
name: sv-short-design
description: Short 9:16 track Gate G4 visual design system — riso-ink PAL tokens, character turnarounds (cast.ts, canonical Nhím CH-11), connected multi-angle set plates (sets.tsx, geo.ts), multi-pose Hero Subjects (subjects.tsx, PR-06, PR-08..10), props/overlays, design lint CI, and user visual approval. Use ONLY when .episode.json has track "short".
---

# sv-short-design · Short 9:16 Cast, Sets & Hero Subjects (G4)

## 1. Track Lock & References
- **Active only for:** `.episode.json` `"track": "short"` (`9:16`, `1080×1920`). Requires `G1` PASS (`hooks/sv_guard.py H3` blocks design edits before `G1`).
- **Craft references:**
  - `references/tokens.md` (riso-ink `PAL` tokens, line weights, halftone, glow, Be Vietnam Pro typography — zero raw `#hex` `TK-02`, zero literal `fontFamily` `TK-03`)
  - `references/characters.md` (`cast.ts`, `CAST_ROLES`, silhouettes `CH-06..08`, canonical `NHIM_LOOK` `CH-11`, no hand-drawn characters outside `<Person>` `CH-10`)
  - `references/sets.md` (`sets.tsx`, `geo.ts`, 6-pass set building, `bounds` `SE-11`, `zones.mgY` floor lanes, `actorScale`, `location` packs + sub-scene angles, `stateless` plates)
  - `references/props-overlays.md` (`props.tsx`, `subjects.tsx` `SUBJECTS` registry `PR-06`, `PR-08..10`)

## 2. Design Requirements (Short 9:16)
1. **Cast (`src/episode/cast.ts`):**
   - Every principal (`≥ 3` traits) and support (`≥ 2` traits) has a distinct silhouette (`CH-06`, `CH-07`).
   - Add background extra looks whenever scenes take place in populated spaces (classrooms, streets, markets) so rooms never look eerily empty.
   - Use `NHIM_LOOK` from `src/chars.tsx` whenever Nhím appears (`CH-11`).
2. **Connected Multi-Angle Sets (`src/episode/sets.tsx`, `src/episode/geo.ts`):**
   - Expand each core location from `brief.md` into connected sub-scenes (`establishing`, `medium`, `closeup`/`insert`) sharing consistent `location` + `landmarks`.
   - Declare exact `bounds`, `actorScale`, and `zones: { bgY, mgY: [minY, maxY], fgY }` on every grounded set so `GE-21` and `LA-01` lock floor contact and actor scale accurately.
   - Keep plates stateless (`SE-20`): never bake transient plot states or moving vehicles into static background plates.
3. **Hero Subjects (`src/episode/subjects.tsx`):**
   - Register every recurring vehicle, creature, machine, or hero prop in `SUBJECTS` with `kind`, `relToActor`, `>= 4` distinct `poses` (`PR-06`), living `t`/`phase` animation on creatures (`PR-08`), and explicit `partialOf` ONLY for dedicated `closeup`/`insert` limb plates (never placed alongside full `<Person>` actors in wide shots — `PR-10`).
   - Set `airborne: true` ONLY on inherently flying vehicles/machines; ground-bound vehicles/creatures must sit on the floor lane (`GE-21`).

## 3. Mandatory Execution & User Approval Steps (Gate G4)
1. **Init Executor Log & Preflight:**
   ```bash
   python scripts/sv_cli.py log init --role executor --actor exec-design --stage G4 --task "Build Short 9:16 cast, sets, and subjects" --json
   python scripts/sv_cli.py doctor --stage G4 --json
   ```
2. **Run Design CI (`0` errors) & Render Design Sheets:**
   ```bash
   python scripts/sv_cli.py ci design --json
   node scripts/design.mjs
   ```
   Close Executor log (`log complete --verdict pass`) and pass `python scripts/sv_cli.py ci log --stage G4 --role executor --json`.
3. **Independent Reviewer & Orchestrator Visual Audit:**
   - Reviewer (`reviewer_id != exec-design`) opens rendered `qa/design/*_v.jpg` sheets via `read_file`, audits model fidelity, floor lanes, landmarks, and subject poses, logs `--action inspect_visual --target <sheet_path>`, and passes `ci log --stage G4 --role reviewer`.
   - Orchestrator opens the same `qa/design/*_v.jpg` sheets via `read_file` (`hooks/sv_guard.py H6`), presents the cast/set/subject sheets to the user, and waits for explicit approval.
4. **Write `gates/G4.review.md` & Pass Gate G4:**
   Name every `qa/design/*.png` evidence file with `>= 4` words, include `approval: user` + verbatim `user_quote`, close Orchestrator log, and run:
   ```bash
   python scripts/sv_cli.py gate check G4 --json
   python scripts/sv_cli.py gate pass G4 --actor <coord_id> --json
   ```
