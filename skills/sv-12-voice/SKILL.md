---
name: sv-12-voice
description: Record the narration of a story-video episode with the house voice Hải Đăng (VieNeu V3 Turbo preset, northern male, no cloning, native 1.0× speed) to the house voice standard — one take per line with a fixed seed, every line measured against the calibrated Hải Đăng profile (word accuracy, rate, pitch, timbre, holes) and regenerated only if it fails, episode-level consistency and pacing checks, whisper word alignment, words.json/cues.json — and pass gate G3. Use whenever script.json changed, the narration sounds wrong, flat, inconsistent, too fast or slow, a word is misread, or word anchors are missing.
---

# sv-12 · Voice (gate G3)

Why this exists: earlier episodes picked the "best" of 4–6 takes per line by ear-like scores. Lines came out
in different shapes, and attempts to add emotion (punctuation tricks, cloning from a lively take, pitch/gain
edits afterwards) all sounded worse than the plain read; the user: "hậu kì hardcore vậy là nát". The house
rule is now a **process that is right by construction**: fixed engine settings, text written to rules, one
take per line, measured. Any agent on any machine gets the same voice at the same speed.

## Read first
`references/standard.md` — what was tested and measured, why every setting and threshold is what it is.

## The standard lives in two files (shared, versioned; never edit per episode)
| File | Holds |
|---|---|
| `scripts/voice_standard.json` | engine settings, text rules, per-line checks, episode checks, the Hải Đăng profile |
| `scripts/pacing.json` | episode length, words budget, overall pace, pauses, shot pacing (shared with sv-10, sv-22) |

| Engine setting | Value |
|---|---|
| voice | "Hải Đăng" preset — **no cloning**, no other voice (`--allow-voice` only on the user's explicit request) |
| temperature / top_k / top_p / repetition_penalty | 0.8 / 25 / 0.95 / 1.2 |
| speed | 1.0× native — never time-stretch, atempo or pitch-shift the voice |
| takes | 1, seed = hash(title, line id, attempt) → the same text always gives the same audio |
| attempts | a line is regenerated with the next seed only if it fails a check; max 3 |

| Per-line check (vs profile 4.50 words/s, 154.6 Hz, centroid 1306 Hz) | Range |
|---|---|
| asr_similarity (whisper-small, accent-free) | ≥ 0.85 |
| rate_vs_profile | ±12 % |
| f0_vs_profile_st | ±2 semitones |
| timbre_vs_profile | ±20 % |
| max_hole_s (silence inside a line) | ≤ 0.55 s |

Episode checks: pitch spread between lines ≤ 1 st, rate CV ≤ 0.08, timbre CV ≤ 0.12, lines needing a retry
≤ 25 %; pacing: voice 140–165 s, 4.1–4.6 words/s overall, pauses 2–8 % of the length, 22–34 segments.

## Text rules (what you write decides most of the result)
Applied to `tts_text` if a segment has one, else `text`. `script_lint.py` (SC-15..18) and `voice.py` refuse
violations before any audio is made.
- Numbers in words ("một trăm tám mươi", never "180").
- Plain punctuation: full stops between sentences, commas only where a reader breathes. **No "…"** and no
  decorative commas: each one became a 0.3–0.5 s hole and the read slowed ~20 %.
- No emotion tags (`[cười]`, `[thở dài]`, `[hắng giọng]` are experimental in VieNeu and lowered accuracy).
- ≤ 45 words per segment. A sentence under 5 words is fine inside a segment (the engine forces a full
  stop on a lone short chunk, which flattens it).
- Emotion comes from the writing (word choice, sentence length, the punch line placement), not from markup.

## Workflow
1. G2 passed (`script_lint.py` clean: words budget, text rules).
2. `/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/voice.py` (≈ 15–25 s per line on CPU; run in
   the background for a full episode). Each line prints `ĐẠT` or `trượt <checks>` per attempt.
3. Read `qa/voice_report.json`:
   - `failed_lines`: the line failed every attempt. Listen to `audio/<id>_try0.wav`, find the cause in the
     text (a number, a symbol, a run-on sentence, a word the engine stumbles on → spell it as it sounds in
     `tts_text`), then `voice.py --only <id>`. Never loosen a threshold for one line.
   - `episode_checks`: pacing out of range → the script is too long/short: back to G2 (cut a beat), never
     speed up the voice. Consistency out of range → find the outlier lines in `segments[].measure`.
4. Listen to the whole `audio/voice.wav` once. Note wrong stress, clipped endings, odd pauses → fix the text
   and `--only`.
5. `node scripts/times.mjs` must succeed; spot-check key words in `src/words.json`.
6. `gates/G3.review.md`: name `qa/voice_report.json`, the lines retried and why, listening notes.
   `python3 scripts/sv_gate.py pass G3`.

## Options
| Flag | Use |
|---|---|
| `--only s3,s7` | regenerate these lines (same seeds → change the text first, or it comes out identical) |
| `--missing` | generate only lines without audio |
| `--reuse` | no generation: re-measure, rebuild timeline/words/cues (after editing pause_after) |
| `--calibrate a.wav:text …` | print a new profile — only when the series standard changes (user decision) |

## Gate G3 refuses
A report from the old best-of-N voice.py; any line in `failed_lines` or `stale_lines`; any episode or pacing
check out of range; engine settings off-standard (clone, speed ≠ 1.0, takes ≠ 1); `voice_standard.json`,
`pacing.json` or `script.json` changed after the voice was made.

## Rules
- Changing `script.json` makes G3 stale; everything downstream (G5 anchors, G6 mix) follows.
- The voice is never processed here. Clean-up (denoise, EQ, compression, expander) happens once, in the
  mix (sv-42), to the house chain.
- `pause_after` (0.1–0.6 s, default 0.18) shapes the rhythm between lines: 0.18 normal, 0.3 after a punch,
  0.45 before the turn. Change it, then `--reuse`.
