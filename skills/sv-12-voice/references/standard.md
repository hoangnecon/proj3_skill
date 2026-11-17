# Voice standard v2.0 — per-sentence 5.25 ups rhythm, bilingual `<en>`, and emotion tags

## 1. Why per-sentence adaptive rhythm (not uniform `1.25×`)
Multiplying a finished segment by a flat `1.25×`:
1. Crushes already-brisk punch sentences (`5.0 → 6.25` wps) into slurred syllables while leaving sluggish lines behind.
2. Keeps internal VieNeu punctuation silences (`0.35–0.55 s` on commas/`…`) proportionally bloated.
3. Distorts vocal formants if done by naive resampling, or flattens sentence-level cadence if stretched globally.

`voice_standard.json` `v2.0` reproduces the approved lively **Hải Đăng 5.25 units/s** configuration (`hai-dang-nhip-edge`) **100% offline** using built-in Python + FFmpeg WSOLA:
1. **Per-sentence synthesis:** Each segment in `script.json` splits into individual sentences (or uses explicit `seg["sentences"]`), synthesized with VieNeu V3 Turbo `Hải Đăng` (`use_ref_codes=True, temperature=0.7, top_k=25, top_p=0.95, repetition_penalty=1.2`).
2. **Internal pause trimming (`rhythm_trim`):** Leading/trailing silence is trimmed (`5 ms` peak windows `> 210/32768`, `10 ms` pad) and any internal silence `> 0.32 s` (`< 145/32768`) is shortened to **`0.16 s`** with a `10 ms` crossfade — so commas and `...` / `…` keep their intonation contour without creating dead air.
3. **Syllable- & clause-aware per-sentence target duration:**
   - Each Vietnamese word counts as `1` syllable-unit; English words inside `<en>...</en>` count vowel-cluster syllables (`Graham` = 2, `Henderson` = 3, `TripAdvisor` = 4) so English proper nouns are never rushed.
   - Default target rate is `target_ups = 5.25` syllable-units/s (`phonation_ups = 5.62` inside sentences so that after `0.16 s` intra-segment sentence gaps, segment speech lands at `~5.25` ups and episode speech+pauses lands at `~4.8–5.2` ups), blended `80/20` with VieNeu's raw trimmed duration to preserve natural consonant/diphthong weight.
   - Inline emotion cues (`[cười]`, `[thở dài]`, `[hắng giọng]`) add `0.38 s` each so non-verbal cues breathe naturally without rushing spoken words.
4. **Bright pitch + WSOLA tempo (`pitch_ratio = 1.02`):** Applied per sentence via `ffmpeg -af asetrate=48960,aresample=48000,atempo=<tempo/1.02>`, raising `f0` by `+0.34` semitones (`~155 Hz → ~158.5 Hz`) with crisp time-domain transients and zero external dependencies.
5. **Raw dynamics preserved for `sv-42`:** `voice.py` does **not** run `-16 LUFS` `loudnorm`; all denoising, EQ, de-essing, compression, between-word expansion (`≤ -50 dB`), music ducking, and `-14.0 LUFS` mastering stay strictly in `sv-42-mix-master` (`scripts/mix.py`).

## 2. Bilingual `<en>...</en>` and Expressive Tags
- **Bilingual G2P (`sea-g2p` inside VieNeu V3 Turbo):** Wrapping foreign names/words in `<en>...</en>` (or listing `"english": ["Graham", "Henderson"]` in `script.json`) switches VieNeu's phonemizer to English IPA (`<en>Graham</en>` → `ɡɹˈeɪəm`, `<en>Henderson</en>` → `hˈɛndɚsən`), making pronunciation accurate enough that even `faster-whisper` (`language="vi"`) transcribes them cleanly.
- **Ellipsis (`...` / `…`):** Allowed (`no_ellipsis: false`). Gives natural trailing/hesitant phrasing while `rhythm_trim` prevents `> 0.32 s` gaps.
- **Inline emotion tokens:** VieNeu V3 Turbo supports exact three non-verbal tokens trained in `VieNeu-TTS-1000h`:
  - `[cười]` / `[chuckle]` → `<|emotion_1|>`
  - `[thở dài]` / `[sigh]` → `<|emotion_2|>`
  - `[hắng giọng]` / `[clear throat]` → `<|emotion_3|>`
  `script_lint.py` (`SC-17`) and `voice.py` allow these six spellings and reject unsupported `[...]` tags (which VieNeu would otherwise read aloud as words).
- **Clean captions:** `voice.py` strips `</?en>` and `[...]` before building `src/data/words.json`, so burned-in subtitles never display markup tags.

## 3. Per-Sentence Fine-Tuning Controls
Authors can refine phrasing down to any individual sentence in `script.json`:
- Segment-level: `"tts_text"`, `"wps"` (e.g. `4.5` on an emotional turn), `"pause_after"` (`0.08–0.70 s`), `"english": [...]`.
- Sentence-level: `"sentences": [{"tts_text": "...", "wps": 4.5, "pause_after": 0.30, "seed": 20261199}, ...]`.
- Fast iteration: `voice.py --only s12.2` re-synthesizes only sentence 2 of `s12`; `voice.py --reuse` re-computes WSOLA tempo and pauses from `audio/_sents/*_raw.wav` in `< 2 s`.
