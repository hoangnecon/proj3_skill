# Commands

Run from the episode directory. Remotion renders use `--gl=angle` (set in the scripts).

| Command | Writes | Time | Phase |
|---|---|---|---|
| `python3 scripts/script_lint.py` | qa/script_lint.json | 1 s | G2 |
| `/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/voice.py` | audio/*.wav, public/voice.wav, src/data/words.json, src/data/cues.json, qa/timeline.json, qa/voice_report.json | 15–25 s/segment (one take; retries only for failed lines) | G3 |
| `… voice.py --only s3,s7` / `--reuse` / `--missing` | same, partial | | G3 |
| `node scripts/times.mjs` | qa/shots.json (shot table with absolute times) | 3 s | any |
| `node scripts/lint.mjs design` | qa/lint.json | 3 s | G4 |
| `node scripts/lint.mjs shots` | qa/lint.json, qa/strips_needed.json | 3 s | G5 |
| `node scripts/design.mjs [--exemplar] [--only look:<key>\|set:<id>]` | qa/design/cast_*_p*.png, expr_*.png, set_<id>.png, set_<id>_grid.png | 20–90 s | G4 |
| `node scripts/qa.mjs contact` | qa/contact_p*.png (2 frames/shot, 12 shots/page) | 1–2 min | G5 |
| `node scripts/qa.mjs strips [names]` | qa/strips/<name>.png | 10 s each | G5 |
| `node scripts/qa.mjs shot <i>` | qa/shots/NN.png (6 frames of one shot) | 10 s | G5 |
| `node scripts/qa.mjs frames 12.5,40` | qa/frames/t*.png | 5 s | any |
| `…/python scripts/mix.py` | public/mix.wav, audio/stems/*, qa/mix_report.json, qa/audio_qa.json, qa/mix/*.png | 20 s | G6 |
| `…/python scripts/audio_qa.py [--video f.mp4]` | re-measure the mix / the audio in a video (qa/video_audio.json) | 5 s | G6, G7 |
| `node scripts/deliver.mjs` | out/final.mp4, out/<slug>_phone.mp4, qa/deliver_report.json, qa/final_check.png | 4–8 min | G7 |
| `python3 scripts/sv_gate.py status \| check G# \| pass G#` | gates/log.jsonl | 1–10 s | all |
| `npx remotion studio` | — (interactive preview) | | any |

Long commands (voice, deliver): run in the background and wait for completion; do not poll in a loop.
