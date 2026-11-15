---
name: sv-12-voice
description: Record the narration of a story-video episode with the house voice Hải Đăng (VieNeu TTS, northern male) — best-of-N takes per segment, whisper word alignment, words.json/cues.json for word anchors, a voice report with per-segment similarity and pace — fix misread segments with tts_text and pass gate G3. Use whenever script.json changed, the narration sounds wrong, a word is mispronounced, segments are too fast or slow, or word anchors are missing.
---

# sv-12 · Voice (gate G3)

## Facts
- Voice: **Hải Đăng only.** The user rejected Thiện Minh and Thái Sơn. `voice.py` refuses any other voice
  unless `--allow-voice` is passed, and that needs the user's explicit request.
- Engine: VieNeu TTS at `/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python` (has numpy, soundfile, whisper).
- Outputs: `audio/<id>.wav` per segment, `audio/voice.wav`, `public/voice.wav`, `src/words.json` (every
  word with start/end — the shot anchors), `src/cues.json` (segment starts, total), `qa/timeline.json`,
  `qa/voice_report.json` (gate evidence).

## Workflow
1. G2 passed. Run (≈ 1–3 min per segment with 4 takes; run in the background for long scripts):
   `/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/voice.py --takes 4`
   Each segment is generated 4×; the take whose whisper transcript best matches the text wins.
2. Read `qa/voice_report.json`:
   - `low_similarity` (< 0.85): the TTS misread. Listen to that segment
     (`afplay audio/s7.wav`), find the word, add `"tts_text"` to that segment spelling it as it should
     sound (numbers in words, split compounds, remove symbols), then `voice.py --only s7`.
   - `too_fast` (> 5.2 words/s) / `too_slow`: regenerate `--only` with more takes; if it persists, split the
     segment or shorten it (that re-opens G2).
   - `wps` overall must be 3.6–5.0; `total` 100–200 s.
3. Listen to the whole `audio/voice.wav` once, start to end. Note any wrong stress, clipped endings, odd
   pauses. Fix with `--only`.
4. Check anchors: `node scripts/times.mjs` must succeed; spot-check that names and key words in
   `src/words.json` are spelled as in the script (the aligner keeps diacritics).
5. `gates/G3.review.md`: name `qa/voice_report.json` with what you checked, list the segments you
   regenerated and why, your listening notes. `python3 scripts/sv_gate.py pass G3`.

## Options
| Flag | Use |
|---|---|
| `--takes N` | takes per segment (default 4; 6 for a stubborn segment) |
| `--only s3,s7` | regenerate just these segments, then rebuild the joined voice and timeline |
| `--missing` | generate only segments without audio |
| `--reuse` | no generation: recompute timeline/words/cues from existing wavs (after editing pause_after) |
| `--temperature` | default 0.8; 0.6 for flatter, more stable reads |

## Rules
- Changing `script.json` makes G3 stale (the report stores the script hash). Regenerate at least the
  changed segments, then everything downstream (G5 anchors, G6 mix) goes stale too.
- Never time-stretch or pitch-shift the voice to fit pictures; pictures follow the voice.
- `pause_after` shapes the rhythm: 0.18 normal, 0.3 after a punch, 0.45 before the turn. Change, then `--reuse`.
