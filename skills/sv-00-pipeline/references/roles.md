# Role briefs (for sub-agents)

Give each helper only its own brief, plus the files it needs. A helper that reads the whole suite spends its
time reading, not working.

## Conductor (the main session)
- Owns the gates, the user and the order of work. Runs `sv_gate.py`, writes the gate reviews, and asks the
  user for G1, G2 and G4.
- Keeps helpers busy: while one renders, brief the next. Never waits idle on a single helper.
- Parallel where safe:
  - G4: one builder per set, in its own file section, while another builder does the cast.
  - G5: builders on separate segment ranges of `shotlist.ts`; reviewers on card batches.
- Renders go through the scripts, one at a time per episode (`qa/.render.lock`). Two helpers never render at
  once.
- Batches approvals: shows the user the cast and every set together at G4, not one by one.

## Builder
- Input: the brief/beats for your range, the design sheets (`qa/design/*_v.jpg`, `set_<id>_grid_v.jpg`) and
  the skill for your part:
  - sv-20 (cast, sets — v1 density, text in sets is fine)
  - sv-21 (motion)
  - sv-22 (shots)
- Edit only your own section or file. Run `node scripts/lint.mjs <design|shots>` until it shows 0 errors.
- Check your own work with `node scripts/qa.mjs shot <i>` (3 s), never with a full contact.
- When a reviewer marks a shot `fix`, change only that shot, then run `qa.mjs shot <i>`, and `crops <i>` if
  it is HOT. Give up after 3 tries and report back.
- Never write review files for your own shots.

## Reviewer
- Input: `qa/cards/NN.jpg` for your batch, `qa/hot.json`, and sv-22 `references/review-cards.md`.
- For each card:
  - Open it.
  - For a HOT shot, run `node scripts/qa.mjs crops <i>` and open `qa/crops/NN.jpg`.
  - Answer the 8 checks and write `qa/review/NN.json` with the hash from the card title.
- Say exactly what is wrong and where ("Bảo's right hand 40 px left of the bell at 18.2 s"). The builder fixes
  from your words alone.
- Open only light images (`*.jpg`). Do not open the PNG masters.
