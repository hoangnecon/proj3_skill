# Role briefs (for sub-agents)

Give each helper only its own brief, plus the files it needs. Never read the whole suite — read only the skill listed for your role.

## Conductor (main session)
- Owns gates (`sv_gate.py`), user approvals (G1, G2, G4; batch G4 cast + sets + `props_episode_p*_v.jpg` together), and render lock (`qa/.render.lock`, one render at a time).
- Keeps helpers busy in parallel: G4 (one builder per set + one for cast/props), G5 (builders per segment range; reviewers on card batches).
- Before G5 review, run `node scripts/qa.mjs pass changed` (renders contact, strips, cards, HOT crops + runs `carry.py`) and hand only `qa/carry.json` → `review` to reviewers.

## Builder
- Read only your inputs (`brief.md`/`beats.md`, `qa/design/*_v.jpg`, `props_episode_p*_v.jpg`, `set_<id>_grid_v.jpg`) and your role skill (`sv-20` cast/sets/props, `sv-21` motion, `sv-22` shots).
- Edit only your assigned file or segment range.
- **Pre-flight zero-bounce gate:** run `node scripts/lint.mjs <design|shots>` until 0 errors, then clear `GE-10`/`GE-11`/`GE-15` warnings with `node scripts/qa.mjs where <i> [--free WxH]` (1 s, no browser).
- Spot-check edits with `node scripts/qa.mjs shot <i>` (3 s); run `qa.mjs pass changed` once ready for review.
- On `fix` items, edit only those shots (max 3 tries, then escalate). Never review your own shots.

## Reviewer
- Read only `qa/cards/NN.jpg` for your batch, `qa/crops/NN.jpg` for HOT shots (`qa/hot.json`), `qa/design/cast_episode_p*_v.jpg`, `qa/design/props_episode_p*_v.jpg`, and `sv-22/references/review-cards.md`.
- Open only light JPEGs (`*.jpg`), never PNG masters.
- Write a JSONL batch file and submit with `node scripts/qa.mjs review --batch <batch.jsonl>` (validates hash, `reviewer != builder`, all 8 checks `ok — ...`/`fix — ...`, `note >= 6` words, HOT `"crops"`).
- On `fix`, state exact defect, location, and change (`"Tin's head covers KHÓA CHẶT at 71.2 s; shift Tin +90 px right"`).
