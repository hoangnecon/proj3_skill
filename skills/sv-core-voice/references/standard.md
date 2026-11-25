# Voice Standard v4.0 — Empirically Calibrated Hải Đăng Rhythm, Bilingual `<en>`, and Emotion Tags

## 1. Empirical Calibration (`v4.0` Single Source of Truth)
Read exact parameters directly from the episode's `standards/voice_standard.json` and `standards/pacing.json` — never override from memory.

Empirical calibration across 54 real raw VieNeu V3 Turbo `Hải Đăng` sentences benchmarked against the 11-video YouTube reference corpus (`median 4.59 wps`, `[4.52–4.71]`, `19.6–22.0%` audio pause share) solved both historical extremes:
- Old `v2.0` pushed hard WSOLA speedup (`1.15–1.39×`) and shifted pitch (`1.02`) — sounding hurried and clipped.
- Old `v3.0` stacked five additive slowdowns (yielding `~4.02 wps`) while a loose CI floor let sluggish narration slip through.
- **`v4.0` (locked in `standards/core/voice_standard.json` + `standards/{short,long}/pacing.json`):**
  - `target_ups: 5.05`, `phonation_ups: 5.45`, `blend_raw: 0.30`
  - `pitch_ratio: 1.00` (natural northern male timbre — zero pitch warp)
  - `tempo_clamp: [0.95, 1.20]` (gentle WSOLA median `~1.11×`)
  - `inside_pause_threshold_s: 0.38`, `inside_pause_target_s: 0.18`
  - `sentence_gap_s: 0.15`, `clause_pad_s: 0.03`, `short_sentence_pad_s: 0.00`, `emotion_cue_s: 0.36`
  - **Empirical output:** `overall_wps = 4.57` (locked inside tight CI corridor `[4.42, 4.74]` Short / `[4.40, 4.74]` Long), `pause_share = 6.4%` (`[0.05, 0.14]`), real RMS audio breathing `20.1%`.

## 2. Synthesis & Verification Pipeline (`scripts/voice.py`)
1. **Per-sentence synthesis:** VieNeu V3 Turbo `Hải Đăng` (`use_ref_codes=True, temperature=0.7, top_k=25, top_p=0.95, repetition_penalty=1.2`, deterministic seed per sentence, `takes: 1`, `clone: false`).
2. **Syllable-aware duration model:** Each Vietnamese word = `1` unit; English words inside `<en>...</en>` count vowel-cluster syllables so English names are never rushed.
3. **ASR & Audio QA:** Every sentence is checked with `faster-whisper` + `librosa` (`asr_sim`, `word_rate`, `syllable_rate`, `pitch_hz`, `hnr_db`, `clip_frac`, `tail_silence_s`). Failed sentences auto-retry up to 3 seeds.
4. **Raw dynamics preserved for `sv-core-audio`:** `voice.py` does NOT run `-14 LUFS` mastering; all cleanup, EQ, de-essing, expansion, music ducking, and mastering live in `scripts/mix.py`.

## 3. Bilingual `<en>...</en>` & Expressive Tags
- Wrap English words/names in `<en>...</en>` or declare `"english": [...]` in `script.json` to activate English IPA (`sea-g2p`).
- Ellipsis (`...` / `…`) and em-dashes (`—` / `–`) are allowed for rhythmic beats.
- Exact supported non-verbal emotion cues (`SC-17`): `[cười]` / `[chuckle]`, `[thở dài]` / `[sigh]`, `[hắng giọng]` / `[clear throat]`.
- `voice.py` strips `</?en>` and `[...]` before writing `src/data/words.json`, so captions remain clean Vietnamese/English text.

## 4. Fast Per-Sentence Iteration
- Re-take one segment or sentence: `python scripts/voice.py --only s12.2`
- Re-time pauses/tempo from cached `audio/_sents/*_raw.wav` in `< 2 s`: `python scripts/voice.py --reuse`
