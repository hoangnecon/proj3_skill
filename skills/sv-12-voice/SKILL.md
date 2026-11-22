---
name: sv-12-voice
description: Record the narration of a story-video episode with the house voice Hải Đăng (VieNeu V3 Turbo preset, northern male, no cloning, pure v2.0 per-sentence 5.25 ups rhythm at 1.02 pitch across both 9:16 Shorts and 10–16 minute 16:9 Long-Form, bilingual en tags, ellipsis and emotion tags) — one take per sentence with deterministic seeds, per-sentence pause trimming and WSOLA tempo/pitch control, SC-35 voice-integrity guard (zero artificial speed warping), whisper word alignment, words.json/cues.json — and pass gate G3. Use whenever script.json changed, narration sounds wrong, flat, too fast or slow on a sentence, a word or English name is misread, or word anchors are missing.
---

# sv-12 · Voice (gate G3)

Why this exists: a flat uniform speedup (`1.25×` / `atempo` on a whole segment) or overriding `target_ups` above `5.45` warps VieNeu-TTS into sounding artificially pitched-up, rushed, and hard for kids to follow. House standard `v2.0` synthesizes **sentence by sentence** with the `Hải Đăng` preset (`t=0.7, top_k=25, top_p=0.95, use_ref_codes=True`), trims internal pauses (`> 0.32 s → 0.16 s`), and brings each sentence cleanly to the **pure `5.25` syllable-units/s** profile at **`pitch_ratio = 1.02`** across **ALL** formats (`9:16` Shorts AND `9.5–16.0 min` `16:9` Long-Form `"length": "long_16x9"` — never distort voice speed/pitch to squeeze runtime; `10–15 min` long-form is natural!) via built-in FFmpeg WSOLA (`asetrate + aresample + atempo` — 100% offline, zero external dependencies).

## Read first
`references/standard.md` — how `v2.0` per-sentence rhythm, bilingual `<en>...</en>`, emotion tags, and quality checks work.

## The standard lives in two files (shared, versioned; never edit per episode)
| File | Holds |
|---|---|
| `standards/voice_standard.json` | engine settings, pure per-sentence rhythm (`5.25` ups, `pitch 1.02`, `0.32s→0.16s` trim, `0.16s` sentence gap) shared across **every** format, bilingual/tag text rules, line & episode checks, Hải Đăng profile |
| `standards/pacing.json` | shared voice targets (`overall_wps [4.6, 5.5]`, `default_pause_after_s 0.18`, `pause_share [2%, 9%]`), `9:16` Short budget (`125–170 s`, `620–860` words, `22–40` segments), and `16:9` `episode_long_16x9` budget (`540–960 s` target `720 s`, `2,600–4,900` words, `95–225` segments across `4–9` episodic `units` `SC-37`) |

| Engine & Rhythm setting | 9:16 Short (`default`) | 16:9 Long-Form (`"length": "long_16x9"`) |
|---|---|---|
| voice & sampling | `"Hải Đăng"` preset (`use_ref_codes: true`, no cloning; `t=0.7 / top_k=25 / top_p=0.95 / rep=1.2`) | Identical `"Hải Đăng"` preset & sampling (`voice_standard.json` untouched) |
| per-sentence rhythm | Pure `target_ups: 5.25` (`phonation 5.62`, `blend_raw 0.20`), `pitch_ratio: 1.02` | **Identical pure `target_ups: 5.25`** (`_effective_rhythm` always returns `STD["rhythm"]` — zero overrides) |
| pause trimming & gaps | internal `> 0.32 s → 0.16 s`, `sentence_gap_s: 0.16 s`, `default_pause_after_s: 0.18 s` | Identical (`> 0.32 s → 0.16 s`, `sentence_gap_s: 0.16 s`, `default_pause_after_s: 0.18 s`, `mean pause_after` `[0.11, 0.32] s`) |
| voice integrity (`SC-35`) | `script.wps` in `[4.95, 5.35]`, segment/sentence `wps` in `[4.80, 5.45]`, `≤ 10%` custom `wps` | **Strict `SC-35` + `SC-36..37`:** ban `wps > 5.45` or `< 4.80` (`90–100%` at default `5.25` ups); briskness comes from short kid sentences (`≤ 18w` hook, mean `≤ 15.5w`, zero textbook jargon `SC-36`), validated unit-by-unit (`SC-37`) |
| takes & retries | 1 take/sentence with deterministic `seed_for`; retries on failed check (max 3) | Identical; `line_checks` compares default segments against pure `5.25` ups (`±18%`) |

| Per-segment check (vs pure `5.25` ups, `158.5 Hz`, centroid `1315 Hz` — or gentle `[4.80, 5.45]` `wps`) | Range |
|---|---|
| `asr_similarity` (`faster-whisper` small, accent-free, markup stripped) | `≥ 0.85` |
| `rate_vs_profile` | `±18 %` |
| `f0_vs_profile_st` | `±2.2` semitones |
| `timbre_vs_profile` | `±20 %` |
| `max_hole_s` (unintended silence inside a segment) | `≤ 0.45 s` |

Episode checks: `f0_spread_st ≤ 1.1`, `rate_cv ≤ 0.10` (over default-rate segments), `timbre_cv ≤ 0.12`, `retry_share ≤ 0.25`, `between_words_db ≤ −50` (noise and reverb tails between words, measured through the same voice chain the mix uses — G6 gets the same number, ±0.15 dB on 6 episodes, so **target `between_words_db ≤ -51.5 dB` (`1.5 dB` safety margin under `-50.0 dB`) at G3** so `±0.15 dB` G6 mix variance never causes a late G6 bounce; `voice.py` names the worst segments for `--only`); pacing: `overall_wps` `4.6–5.5` and `pause_share` `2–9 %` on **both** formats (`9:16` Short `voice_s` `125–170 s`, `22–40` segments; `long_16x9` `voice_s` `540–960 s` target `720 s`, `95–225` segments).

## Text, Bilingual & Expressive Tag Rules (`SC-15..17` + `voice.py`)
- **Numbers in words** in spoken text (`"mười tỷ đồng"`, never `"10.000.000.000"`).
- **Bilingual (`<en>...</en>`):** Declare English names/terms in `"english": ["Graham", "Henderson", "London"]` at the top of `script.json` (auto-wrapped as `<en>Graham</en>` for VieNeu English G2P) or write `<en>...</en>` directly in `tts_text`. English multi-syllable vowel clusters are counted automatically so English names are never rushed, and `<en>` tags are stripped from `words.json` captions.
- **Ellipsis (`...` / `…`) is allowed:** VieNeu renders natural trailing/hesitant intonation while `rhythm_trim` cuts any pause `> 0.32 s` down to `0.16 s`, preventing dead holes.
- **Native VieNeu emotion tags are allowed:** `[cười]`, `[thở dài]`, `[hắng giọng]` (and `[chuckle]`, `[sigh]`, `[clear throat]`) map to `<|emotion_1..3|>`. `voice.py` budgets `0.38 s` per cue so spoken words stay at `5.25` ups and strips tags from burned-in captions (`words.json`). Unsupported `[...]` tags are rejected (`SC-17`).

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
