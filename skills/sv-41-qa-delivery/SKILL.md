---
name: sv-41-qa-delivery
description: Final QA and delivery of a story-video episode — render the master (h264 CRF 18, 1080×1920, 30 fps), write qa/deliver_report.json and a 12-frame spot-check sheet, watch the full film against the rubric, pass gate G7 and send the master to the user. Use when an episode is ready to render, when the user asks for the video/file/"bản gửi bạn", when a re-render is needed after any change, or to check what QA evidence exists.
---

# sv-41 · QA and delivery (gate G7)

## Read first
`references/rubrics.md` — contact, strip and final-watch rubrics.

## Workflow
1. Status: `python3 scripts/sv_gate.py status` — G1–G6 must be PASS (not STALE). If something is stale,
   go back to that skill; never deliver around a stale gate.
2. Render: `node scripts/deliver.mjs` (≈ 10–15 min for 150 s; run it in the background). It refuses a stale
   mix and refuses to start when the disk has less free space than the frames need (~0.6 MB per frame + 1.5 GB):
   free space first, and ask the user before deleting anything of theirs (caches included).
   The Remotion render goes to `out/_render.mp4`; ffmpeg then takes its picture and the sound straight from
   `public/mix.wav` (Remotion's AAC kept 2048 priming samples → sound 43 ms late, sync check failed).
   `SV_SKIP_RENDER=1` reuses `_render.mp4` for audio-only fixes.
   Outputs: `out/final.mp4` (the only video file — no phone copy, the user does not want one),
   `qa/deliver_report.json` (duration, size, fps, audio, hashes), `qa/final_check.jpg` (12 frames, light JPEG),
   `qa/video_audio.json` (sv-42 delivery checks on the audio inside the mp4: AAC loudness drift, true
   peak, audio/video length, sync by cross-correlation with the mix). Any failed check blocks G7.
3. Open `qa/final_check.jpg` and compare with the contact sheets.
4. Watch `out/final.mp4` full length with sound (`open out/final.mp4`) against the final-watch rubric.
   Note timestamps of anything wrong. Fix at the source skill (shots → sv-22, sounds → sv-40, levels → sv-42), re-render.
5. `gates/G7.review.md`: deliver report line, final_check line, the rubric table with your notes.
   `python3 scripts/sv_gate.py pass G7`.
6. Send `out/final.mp4` to the user (SendUserFile) with a one-line caption: title, length, size. Mention
   anything you knowingly left imperfect.

## Rules
- One video file only: `out/final.mp4`. Do not make a compressed phone copy.
- Never hand over a file whose gate is not PASS, and never claim "checked" for something you did not open.
