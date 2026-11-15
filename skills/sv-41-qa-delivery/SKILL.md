---
name: sv-41-qa-delivery
description: Final QA and delivery of a story-video episode — render the master (h264 CRF 18, 1080×1920, 30 fps), make the phone copy ≤ 30 MB, write qa/deliver_report.json and a 12-frame spot-check sheet, watch the full film against the rubric, pass gate G7 and send the phone copy to the user. Use when an episode is ready to render, when the user asks for the video/file/"bản gửi bạn", when a re-render is needed after any change, or to check what QA evidence exists.
---

# sv-41 · QA and delivery (gate G7)

## Read first
`references/rubrics.md` — contact, strip and final-watch rubrics.

## Workflow
1. Status: `python3 scripts/sv_gate.py status` — G1–G6 must be PASS (not STALE). If something is stale,
   go back to that skill; never deliver around a stale gate.
2. Render: `node scripts/deliver.mjs` (≈ 4–8 min for 150 s; run it in the background). It refuses a stale mix.
   Outputs: `out/final.mp4` (master), `out/<slug>_phone.mp4` (CRF 25 → +2 until ≤ 30 MB),
   `qa/deliver_report.json` (duration, size, fps, audio, hashes), `qa/final_check.png` (12 frames).
3. Open `qa/final_check.png` and compare with the contact sheets.
4. Watch `out/final.mp4` full length with sound (`open out/final.mp4`) against the final-watch rubric.
   Note timestamps of anything wrong. Fix at the source skill (shots → sv-22, sound → sv-40), re-render.
5. `gates/G7.review.md`: deliver report line, final_check line, the rubric table with your notes.
   `python3 scripts/sv_gate.py pass G7`.
6. Send the phone copy to the user (SendUserFile) with a one-line caption: title, length, size. Mention
   anything you knowingly left imperfect.

## Rules
- The phone copy is the one the user shares; always ≤ 30 MB.
- Never hand over a file whose gate is not PASS, and never claim "checked" for something you did not open.
- Keep `out/final.mp4` as the master; re-encode copies from it, never from the phone copy.
