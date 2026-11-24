---
name: sv-12-voice
description: Record the narration of a story-video episode with the house voice Hải Đăng (VieNeu V3 Turbo preset, northern male, no cloning, corpus-calibrated v3.0 native 1.0x 4.70 ups rhythm at 1.00 pitch with natural 20–24% breathing pauses across both 9:16 Shorts and 16:9 Long-Form, bilingual en tags, ellipsis, em-dash, and emotion tags) — one take per sentence with deterministic seeds, gentle pause trimming, SC-35 voice-integrity guard, whisper word alignment, words.json/cues.json — and pass gate G3. Use whenever script.json changed, narration sounds wrong, flat, too fast or slow on a sentence, a word or English name is misread, or word anchors are missing.
---

# sv-12 · Voice (gate G3 · `v3.0` Native 1.0× Breathing Standard)

Why this exists: forcing VieNeu-TTS up to `5.25` ups via WSOLA (`1.14–1.42×` acceleration) while chopping pauses `> 0.32 s → 0.16 s` pushed audio pause breathing down to `15.8%` (0th percentile of our 41-folder `SCRIPT_YOUTUBE` corpus) and made episodes sound breathless and rushed. House standard **`v3.0` (Option B1)** synthesizes **sentence by sentence** with the `Hải Đăng` preset (`t=0.7, top_k=25, top_p=0.95, use_ref_codes=True`) at its **natural native 1.0× speed (`target_ups: 4.70`, `phonation_ups: 4.90`, `blend_raw: 0.65`, `pitch_ratio: 1.00`, `tempo_clamp: [0.95, 1.08]`)**, preserving natural human cadence and **20–24% real audio breathing room** (`inside_pause_threshold_s: 0.55 s → 0.25 s`, `sentence_gap_s: 0.24 s`, `clause_pad_s: 0.08 s` including Vietnamese em-dashes `—`/`–`, `default_pause_after_s: 0.30 s` up to `1.20 s` for dramatic silent visual holds) across **ALL** formats.

## Read first
`references/standard.md` — how per-sentence rhythm, bilingual `<en>...</en>`, emotion tags, and quality checks work.

## The standard lives in two files (shared, versioned; never edit per episode)
| File | Holds |
|---|---|
| `standards/voice_standard.json` | engine settings, v3.0 native 1.0× rhythm (`4.70` ups, `pitch 1.00`, `blend_raw 0.65`, `tempo_clamp [0.95, 1.08]`, `0.55s→0.25s` trim, `0.24s` sentence gap, `0.08s` clause pad incl. `—`/`–`, `max_hole_s ≤ 0.75 s`), bilingual/tag text rules, line & episode checks, Hải Đăng profile (`4.70` ups, `155.4 Hz`) |
| `standards/pacing.json` | shared voice targets (`overall_wps [4.0, 4.65]`, `default_pause_after_s 0.30`, `pause_after_s [0.12, 1.20]`, `pause_share [8%, 20%]`), `9:16` Short budget (`105–160 s` target `135 s`, `450–660` words sweet spot `500–620w`, `20–36` segments), and `16:9` `episode_long_16x9` budget (`380–960 s` target `600 s`, `1,700–3,800` words, `70–225` segments across `4–9` episodic `units` `SC-37`) |

| Engine & Rhythm setting | 9:16 Short (`default`) | 16:9 Long-Form (`"length": "long_16x9"`) |
|---|---|---|
| voice & sampling | `"Hải Đăng"` preset (`use_ref_codes: true`, no cloning; `t=0.7 / top_k=25 / top_p=0.95 / rep=1.2`) | Identical `"Hải Đăng"` preset & sampling (`voice_standard.json` untouched) |
| per-sentence rhythm | Native 1.0× `target_ups: 4.70` (`phonation 4.90`, `blend_raw 0.65`, `pitch_ratio: 1.00`, `tempo_clamp [0.95, 1.08]`) | **Identical native 1.0× `target_ups: 4.70`** (zero overrides) |
| pause trimming & gaps | internal `> 0.55 s → 0.25 s`, `sentence_gap_s: 0.24 s`, `default_pause_after_s: 0.30 s` (up to `1.20 s` on twists/silent beats) | Identical (`mean pause_after` `[0.16, 0.55] s`, `pause_share` `[8%, 20%]`) |
| voice integrity (`SC-35`) | `script.wps` in `[4.45, 4.90]`, segment/sentence `wps` in `[4.15, 5.05]`, `≤ 10%` custom `wps` | **Strict `SC-35` + `SC-36..37`:** ban artificial speedups (`90–100%` at default `4.70` ups); pacing comes from staccato sentences (`SC-38`) and pauses (`SC-41`) |
| takes & retries | 1 take/sentence with deterministic `seed_for`; retries on failed check (max 3) | Identical; `line_checks` compares default segments against `4.70` ups (`-22% / +20%`) |

| Per-segment check (vs native `4.70` ups, `155.4 Hz`, centroid `1295 Hz`) | Range |
|---|---|
| `asr_similarity` (`faster-whisper` small, accent-free, markup stripped) | `≥ 0.85` |
| `rate_vs_profile` | `-22 % … +20 %` |
| `f0_vs_profile_st` | `±2.2` semitones |
| `timbre_vs_profile` | `±20 %` |
| `max_hole_s` (unintended silence inside a segment) | `≤ 0.75 s` |

Episode checks: `f0_spread_st ≤ 1.1`, `rate_cv ≤ 0.14` (preserving natural human phrasing variance), `timbre_cv ≤ 0.12`, `retry_share ≤ 0.25`, `between_words_db ≤ −50` (target `≤ -51.5 dB` at G3); pacing: `overall_wps` `4.0–4.65` and `pause_share` `8–20 %` on **both** formats (`9:16` Short `voice_s` `105–160 s`, `20–36` segments; `long_16x9` `voice_s` `380–960 s` target `600 s`, `70–225` segments).

## Text, Bilingual & Expressive Tag Rules (`SC-15..17` + `voice.py`)
- **Numbers in words** in spoken text (`"mười tỷ đồng"`, never `"10.000.000.000"`).
- **Bilingual (`<en>...</en>`):** Declare English names/terms in `"english": ["Graham", "Henderson", "London"]` at the top of `script.json` (auto-wrapped as `<en>Graham</en>` for VieNeu English G2P) or write `<en>...</en>` directly in `tts_text`. English multi-syllable vowel clusters are counted automatically so English names are never rushed, and `<en>` tags are stripped from `words.json` captions.
- **Ellipsis (`...` / `…`) & em-dashes (`—` / `–`) are allowed:** VieNeu renders natural hesitant intonation while `clause_pad_s` (`0.08 s`) budgets clean breathing on commas, semicolons, colons, ellipses, and em-dashes, and `rhythm_trim` cuts only holes `> 0.55 s` down to `0.25 s`.
- **Native VieNeu emotion tags are allowed:** `[cười]`, `[thở dài]`, `[hắng giọng]` (and `[chuckle]`, `[sigh]`, `[clear throat]`) map to `<|emotion_1..3|>`. `voice.py` budgets `0.38 s` per cue and strips tags from burned-in captions (`words.json`). Unsupported `[...]` tags are rejected (`SC-17`).

## Per-Sentence Fine-Tuning (`script.json`)
When a rare emotional turn (`≤ 10%` of segments per `SC-35`; never outside `[4.80, 5.45]` ups!) needs slightly gentler weight, a tighter/longer pause, a custom pronunciation, or a specific seed, tune that exact sentence in `script.json`:
```json
{
  "id": "s29",
  "text": "“Em biết,” tôi bảo… “Nhưng Mơ chỉ lên bảy tuổi một lần thôi.” Anh im lặng rất lâu.",
  "sentences": [
    {"tts_text": "Em biết, tôi bảo…"},
    {"tts_text": "[thở dài] Nhưng Mơ chỉ lên bảy tuổi một lần thôi.", "wps": 4.9, "pause_after": 0.30},
    {"tts_text": "Anh im lặng rất lâu.", "wps": 4.85, "seed": 20261199}
  ],
  "pause_after": 0.35
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
   - `episode_checks`: if `voice_s` is outside `125–170 s` (or `540–960 s` for `long_16x9`), tighten/expand beats in G2 rather than editing `standards/` or warping `wps`.
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
