# Voice standard v1.0 — what was tested, what was measured, why

Research files: `research/tts-expressive/` (outside the suite). Test passage: con-so-dam-ma s1–s5 (~33 s).

## 1. What the user judged
| Variant | What it did | Verdict |
|---|---|---|
| A | preset Hải Đăng, best-of-4 takes (the old voice.py) | "chuẩn nhất" but flat |
| B | punctuation shaping ("…", "!", extra commas) + best of 5 at temperature 1.0 | wrong |
| C | B, cloned from Hải Đăng's own liveliest take | liked at first, then: slow, holes, low quality |
| D | B + pitch/gain/stretch on stressed words + inserted beats | "nát" |
| E | **preset, one take, t0.8/k25, plain punctuation, voice chain v2 in the mix** | **approved** |

Lessons: the engine ignores "!"/"…" for intonation but turns them into holes; cloning a TTS output loses
bandwidth (~12.5 kHz vs ~14 kHz) and adds artefacts; prosody edits after the fact break the voice. What is
left to control is the text, the settings and the selection rule.

## 2. Engine knobs (VieNeu V3 Turbo, read from `src/vieneu/v3turbo.py`)
`infer(text, voice|ref_audio, temperature, top_k, top_p, repetition_penalty, repetition_window,
max_new_frames, max_chars, silence_p, crossfade_p, denoise, use_ref_codes)`. `style` is deprecated (style
comes from the reference). Emotion: only `[cười]`, `[thở dài]`, `[hắng giọng]`, marked experimental. No SSML,
no emphasis spans, no rate or pitch control. Long text is split into chunks with 0.3/0.5/0.7 s silences —
our segments stay one chunk (≤ 256 characters), so the model makes its own natural breaks. On CPU the ONNX
backend is deterministic for a given seed (`torch.manual_seed`, `np.random.seed`, `random.seed`).

## 3. The sweep that fixed the settings (6 lines × 2 seeds per setting)
| Setting | Words right (mean) | Pitch spread (st) | Rate CV | Timbre CV | Holes/line |
|---|---|---|---|---|---|
| t0.5 k15 | 0.83 | 0.82 | 0.054 | 0.089 | 0.17 |
| t0.5 k25 | 0.82 | 0.45 | 0.058 | 0.068 | 0 |
| t0.65 k15 | 0.81 | 1.06 | 0.039 | 0.088 | 0.25 |
| t0.65 k25 | 0.81 | 0.68 | 0.029 | 0.078 | 0.17 |
| t0.8 k15 | 0.82 | 0.89 | 0.049 | 0.086 | 0.17 |
| **t0.8 k25** | **0.87** | 0.64 | 0.047 | 0.082 | **0** |
| t0.95 k25 | 0.81 | 0.61 | 0.048 | 0.123 | 0.25 |
(word accuracy here is a strict word-level measure; voice.py's accent-free measure reads ~0.1 higher.)
Higher temperature drifts timbre (out of distribution); lower does not make it steadier and misreads more.

## 4. Profile and thresholds
Measured by `voice.py --calibrate` on 39 lines (the 12 sweep takes + a full 27-line one-take run of
con-so-dam-ma): rate 4.50 words/s, f0 154.6 Hz, centroid 1306 Hz, asr p10 0.937. Spread on good lines:
rate 4.2–5.0, f0 145–170 Hz, centroid 1170–1530 Hz, holes 0.26–0.43 s (sentence breaks). A first profile
from only 12 takes put f0 at 150.7 Hz and failed lines that were fine; calibrate on whole episodes. Thresholds sit
just outside that spread (rate ±12 %, pitch ±2 st, timbre ±20 %, hole 0.55 s, asr 0.85): a line outside is a
different-sounding read, not a different sentence.

Whisper writes numbers as digits ("180"), our text has them in words: voice.py spells the ASR digits out
(`num_vi`) before comparing — without that, every line with a number failed. Known limit: whisper-small
still mishears some correct Vietnamese ("dày cộp", "phúng viếng"). A failed
asr check therefore means "listen to this line", and the fix is in the text. A stronger Vietnamese ASR
(whisper large-v3-turbo / PhoWhisper, ~1.5 GB) would tighten this check; it is not installed.

## 5. Pacing (pacing.json)
Three approved episodes: voice 4.32–4.37 words/s overall (pauses included), 4.56 inside lines, video
148–165 s, 21–27 shots/min, mean shot 2.2–2.8 s. The voice is at native speed 1.0×; length is controlled by
the word budget (600–720 spoken words for 140–165 s), not by speeding anything up.
