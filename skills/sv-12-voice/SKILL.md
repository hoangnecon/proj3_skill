---
name: sv-12-voice
description: Record the narration of a story-video episode with the house voice Hải Đăng (VieNeu V3 Turbo preset, northern male, no cloning, v2.0 per-sentence 5.25 ups Short rhythm or brisk 5.65 ups Long-Form rhythm at 1.02 pitch, bilingual en tags, ellipsis and emotion tags) — one take per sentence with deterministic seeds, per-sentence pause trimming and WSOLA tempo/pitch control, dynamic wps contrast (SC-35), whisper word alignment, words.json/cues.json — and pass gate G3. Use whenever script.json changed, narration sounds wrong, flat, too fast or slow on a sentence, a word or English name is misread, or word anchors are missing.
---

# sv-12 · Voice (gate G3)

Why this exists: a flat uniform speedup (`1.25×` / `atempo` on a whole segment) blurs fast punch lines while leaving internal punctuation holes intact. House standard `v2.0` synthesizes **sentence by sentence** with the `Hải Đăng` preset (`t=0.7, top_k=25, top_p=0.95, use_ref_codes=True`), trims internal pauses (`> 0.32 s → 0.16 s` on 9:16 Shorts; `> 0.25 s → 0.10 s` on `long_16x9`), and brings each sentence cleanly to **`5.25` syllable-units/s** (`9:16` Short) or brisk **`5.65` syllable-units/s** (`16:9` Long-Form `"length": "long_16x9"`) at **`pitch_ratio = 1.02`** via built-in FFmpeg WSOLA (`asetrate + aresample + atempo` — 100% offline, zero external dependencies), while giving full top-level, per-segment, and per-sentence fine-tuning (`wps`, `pause_after`, `tts_text`, `<en>...</en>`, `…`, `[cười]`/`[thở dài]`/`[hắng giọng]`).

## Read first
`references/standard.md` — how `v2.0` per-sentence rhythm, bilingual `<en>...</en>`, emotion tags, and quality checks work.

## The standard lives in two files (shared, versioned; never edit per episode)
| File | Holds |
|---|---|
| `standards/voice_standard.json` | engine settings, base `9:16` Short per-sentence rhythm (`5.25` ups, `pitch 1.02`, `0.32s→0.16s` trim), bilingual/tag text rules, line & episode checks, Hải Đăng profile |
| `standards/pacing.json` | `9:16` Short budget (`125–170 s`, `620–860` words, `4.6–5.5` overall ups, `0.16s` sentence gap, `0.18s` pause) AND brisk `16:9` `episode_long_16x9` voice/word profile (`480–720 s` target `570 s`, `2,400–3,850` words, `85–175` segments, `5.65` ups, `phonation_ups 6.02`, `blend_raw 0.10`, `0.25s→0.10s` trim, `0.12s` sentence gap, `0.14s` default pause, `overall_wps [5.0, 6.2]`, `pause_share [1.5%, 7.5%]`) |

| Engine & Rhythm setting | 9:16 Short (`default`) | 16:9 Long-Form (`"length": "long_16x9"`) |
|---|---|---|
| voice & sampling | `"Hải Đăng"` preset (`use_ref_codes: true`, no cloning; `t=0.7 / top_k=25 / top_p=0.95 / rep=1.2`) | Identical `"Hải Đăng"` preset & sampling (`voice_standard.json` untouched) |
| per-sentence rhythm | `target_ups: 5.25` (`phonation 5.62`, `blend_raw 0.20`), `pitch_ratio: 1.02` | Brisk `target_ups: 5.65` (`phonation 6.02`, `blend_raw 0.10`), `pitch_ratio: 1.02` |
| pause trimming & gaps | internal `> 0.32 s → 0.16 s`, `sentence_gap_s: 0.16 s`, `default_pause_after_s: 0.18 s` | internal `> 0.25 s → 0.10 s`, `sentence_gap_s: 0.12 s`, `default_pause_after_s: 0.14 s` |
| dynamic tempo (`wps`) | optional top-level `script.wps`, segment `wps`, or sentence `wps` | **Mandatory anti-drone contrast (`SC-35`):** modulate `wps` across `≥ 12%` of segments (`5.9–6.2` action/banter, `4.7–5.0` spooky hush/turns) |
| takes & retries | 1 take/sentence with deterministic `seed_for`; retries on failed check (max 3) | Identical; `line_checks` compares default segments against effective `5.65` ups (`±18%`) |

| Per-segment check (vs effective default `5.25` / `5.65` ups, `158.5 Hz`, centroid `1315 Hz` — or custom `wps`) | Range |
|---|---|
| `asr_similarity` (`faster-whisper` small, accent-free, markup stripped) | `≥ 0.85` |
| `rate_vs_profile` | `±18 %` |
| `f0_vs_profile_st` | `±2.2` semitones |
| `timbre_vs_profile` | `±20 %` |
| `max_hole_s` (unintended silence inside a segment) | `≤ 0.45 s` |

Episode checks: `f0_spread_st ≤ 1.1`, `rate_cv ≤ 0.10` (over default-rate segments), `timbre_cv ≤ 0.12`, `retry_share ≤ 0.25`, `between_words_db ≤ −50` (noise and reverb tails between words, measured through the same voice chain the mix uses — G6 gets the same number, ±0.15 dB on 6 episodes, so **target `between_words_db ≤ -51.5 dB` (`1.5 dB` safety margin under `-50.0 dB`) at G3** so `±0.15 dB` G6 mix variance never causes a late G6 bounce; `voice.py` names the worst segments for `--only`); pacing: `9:16` Short `voice_s` `125–170 s`, `overall_wps` `4.6–5.5`, `pause_share` `2–9 %`, `22–40` segments; `long_16x9` `voice_s` `480–720 s` (target `570 s`), `overall_wps` `5.0–6.2`, `pause_share` `1.5–7.5 %`, `85–175` segments.

## Text, Bilingual & Expressive Tag Rules (`SC-15..17` + `voice.py`)
- **Numbers in words** in spoken text (`"mười tỷ đồng"`, never `"10.000.000.000"`).
- **Bilingual (`<en>...</en>`):** Declare English names/terms in `"english": ["Graham", "Henderson", "London"]` at the top of `script.json` (auto-wrapped as `<en>Graham</en>` for VieNeu English G2P) or write `<en>...</en>` directly in `tts_text`. English multi-syllable vowel clusters are counted automatically so English names are never rushed, and `<en>` tags are stripped from `words.json` captions.
- **Ellipsis (`...` / `…`) is allowed:** VieNeu renders natural trailing/hesitant intonation while `rhythm_trim` cuts any pause `> 0.32 s` down to `0.16 s`, preventing dead holes.
- **Native VieNeu emotion tags are allowed:** `[cười]`, `[thở dài]`, `[hắng giọng]` (and `[chuckle]`, `[sigh]`, `[clear throat]`) map to `<|emotion_1..3|>`. `voice.py` budgets `0.38 s` per cue so spoken words stay at `5.25` ups and strips tags from burned-in captions (`words.json`). Unsupported `[...]` tags are rejected (`SC-17`).

## Per-Sentence Fine-Tuning (`script.json`)
When a specific sentence needs slower emotional weight, a tighter pause, a custom pronunciation, or a specific seed, tune that exact sentence in `script.json`:
```json
{
  "id": "s29",
  "text": "“Em biết,” tôi bảo… “Nhưng Mơ chỉ lên bảy tuổi một lần thôi.” Anh im lặng rất lâu.",
  "sentences": [
    {"tts_text": "Em biết, tôi bảo…"},
    {"tts_text": "[thở dài] Nhưng Mơ chỉ lên bảy tuổi một lần thôi.", "wps": 4.5, "pause_after": 0.32},
    {"tts_text": "Anh im lặng rất lâu.", "wps": 4.3, "seed": 20261199}
  ],
  "pause_after": 0.45
}
```
- `--only s29.2` regenerates **only sentence 2 of `s29`** (`audio/_sents/s29_02_raw.wav` → `s29.wav` → `voice.wav`).
- `--reuse` re-applies `wps` and `pause_after` changes from cached `audio/_sents/*_raw.wav` in `< 2 s` without re-running VieNeu TTS!

## Workflow
1. G2 passed (`script_lint.py` clean).
2. **Mandatory Zero-GPU Preflight (`voice.py --preflight`):** Run `/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/voice.py --preflight` (takes `< 1 s`, zero GPU/TTS load) BEFORE synthesizing audio to verify every segment/sentence splits cleanly, has valid `<en>...</en>` & emotion tags, no digits/symbols that break VieNeu G2P, and sane per-sentence syllable budgets. Fix any flagged line in `script.json` first so you never waste a TTS pass.
3. Run `/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/voice.py` (run asynchronously for a full episode; prints progress per sentence `sN.j`).
4. Inspect `qa/voice_report.json`:
   - `failed_lines`: listen to the offending segment/sentence, fix `tts_text` / `<en>...</en>` / `sentences` in `script.json` (remember editing `script.json` makes G2 stale → re-pass G2), then run `voice.py --only <sid>` or `--only <sid>.<j>`.
   - `episode_checks`: if `voice_s` is outside `125–170 s` (or `480–720 s` for `long_16x9`), tighten/expand beats in G2 rather than editing `standards/`.
5. Listen to `audio/voice.wav` (extract `< 300 KB` `/tmp` clips if inspecting via multimodal tools — never load a 40+ MB WAV raw!). Fine-tune any sentence's `wps`, `pause_after`, `<en>...</en>`, or `[thở dài]`/`[cười]` and run `--reuse` (for rhythm/pause tweaks) or `--only sN.j` (for text/seed tweaks).
6. Run `node scripts/times.mjs` and spot-check `src/data/words.json` (confirm zero `<en>` or `[...]` markup in `words.json`).
7. Fill `gates/G3.review.md` and run `python3 scripts/sv_doctor.py --stage G3 && python3 scripts/sv_gate.py pass G3`.

## Options
| Flag | Use |
|---|---|
| `--preflight` | zero-GPU text, `<en>`/emotion tag, and sentence-split sanity check BEFORE running VieNeu-TTS |
| `--only s3,s7.2` | regenerate segment `s3` and sentence `2` of `s7` |
| `--missing` | generate only segments/sentences missing raw audio |
| `--reuse` | rebuild per-sentence tempo/pauses, `voice.wav`, `words.json`, `cues.json`, and `voice_report.json` from cached raw sentence WAVs |
| `--calibrate a.wav:text …` | print median profile — series standard changes only |
