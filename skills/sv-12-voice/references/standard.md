# Voice standard v3.0 — Native 1.0× Hải Đăng `4.70 ups` rhythm, breathable pauses, bilingual `<en>`, and emotion tags

## 1. Why Native 1.0× adaptive rhythm (and why v2.0 `5.25 ups` was retired)
Empirical voice-band audio audits across 11 reference Shorts in `SCRIPT_YOUTUBE` (`standards/script_dna_db.json`) proved two things:
1. Natural VieNeu V3 Turbo `Hải Đăng` already speaks at **`4.64–4.69 ups`** at native `1.0×` — matching the reference corpus's **`4.59 eff. wps`** (`[4.52–4.71]`) and **`19.6–22.0%` audio pause share**.
2. v2.0's `5.25 ups` target + `0.32 → 0.16 s` internal-silence chopping forced `1.14–1.42×` WSOLA speedup on nearly every sentence and crushed pause breathing to `15.8%` (0th percentile — breathless and hard to follow).

`voice_standard.json` `v3.0` locks the **Native 1.0× Hải Đăng `4.70 ups`** configuration **100% offline** using built-in Python + FFmpeg WSOLA:
1. **Per-sentence synthesis:** Each segment in `script.json` splits into individual sentences (or uses explicit `seg["sentences"]`), synthesized with VieNeu V3 Turbo `Hải Đăng` (`use_ref_codes=True, temperature=0.7, top_k=25, top_p=0.95, repetition_penalty=1.2`).
2. **Breathable internal pause trimming (`rhythm_trim`):** Leading/trailing silence is trimmed (`5 ms` peak windows `> 210/32768`, `10 ms` pad) and only genuinely excessive internal silence **`> 0.55 s`** (`< 145/32768`) is shortened to **`0.25 s`** with a `10 ms` crossfade — preserving every natural `0.18–0.45 s` comma/em-dash breath.
3. **Syllable- & clause-aware per-sentence target duration:**
   - Each Vietnamese word counts as `1` syllable-unit; English words inside `<en>...</en>` count vowel-cluster syllables (`Graham` = 2, `Henderson` = 3, `TripAdvisor` = 4) so English proper nouns are never rushed.
   - Default target rate is **`target_ups = 4.70`** syllable-units/s (`phonation_ups = 4.90`, `sentence_gap_s = 0.24`, `clause_pad_s = 0.08` on `, ; : … — –`, `short_sentence_pad_s = 0.08`), blended `65/35` (`blend_raw = 0.65`) with VieNeu's raw trimmed duration so natural prosody dominates and episode effective wps lands at **`4.2–4.65 wps`** with **`20–24%` pause breathing**.
   - Inline emotion cues (`[cười]`, `[thở dài]`, `[hắng giọng]`) add `0.38 s` each so non-verbal cues breathe naturally without rushing spoken words.
4. **Native pitch + gentle WSOLA nudge (`pitch_ratio = 1.00`, `tempo_clamp = [0.95, 1.08]`):** Keeps Hải Đăng's natural northern male timbre (`~155.4 Hz`) un-shifted and prevents aggressive time-compression (`> 1.08×`).
5. **Raw dynamics preserved for `sv-42`:** `voice.py` does **not** run `-16 LUFS` `loudnorm`; all denoising, EQ, de-essing, compression, between-word expansion (`≤ -50 dB`), music ducking, and `-14.0 LUFS` mastering stay strictly in `sv-42-mix-master` (`scripts/mix.py`).

## 2. Bilingual `<en>...</en>` and Expressive Tags
- **Bilingual G2P (`sea-g2p` inside VieNeu V3 Turbo):** Wrapping foreign names/words in `<en>...</en>` (or listing `"english": ["Graham", "Henderson"]` in `script.json`) switches VieNeu's phonemizer to English IPA (`<en>Graham</en>` → `ɡɹˈeɪəm`, `<en>Henderson</en>` → `hˈɛndɚsən`), making pronunciation accurate enough that even `faster-whisper` (`language="vi"`) transcribes them cleanly.
- **Ellipsis (`...` / `…`) & Em-dashes (`—` / `–`):** Allowed (`no_ellipsis: false`). Both receive `clause_pad_s = 0.08 s` in `voice.py` while `rhythm_trim` prevents `> 0.55 s` dead holes.
- **Inline emotion tokens:** VieNeu V3 Turbo supports exact three non-verbal tokens trained in `VieNeu-TTS-1000h`:
  - `[cười]` / `[chuckle]` → `<|emotion_1|>`
  - `[thở dài]` / `[sigh]` → `<|emotion_2|>`
  - `[hắng giọng]` / `[clear throat]` → `<|emotion_3|>`
  `script_lint.py` (`SC-17`) and `voice.py` allow these six spellings and reject unsupported `[...]` tags (which VieNeu would otherwise read aloud as words).
- **Clean captions:** `voice.py` strips `</?en>` and `[...]` before building `src/data/words.json`, so burned-in subtitles never display markup tags.

## 3. Per-Sentence Fine-Tuning Controls
Authors can refine phrasing down to any individual sentence in `script.json`:
- Segment-level: `"tts_text"`, `"wps"` (e.g. `4.25–4.45` on a climactic/emotional turn), `"pause_after"` (`0.12–1.20 s`, default `0.30 s`, `≥ 0.45 s` on ≥ 3 dramatic turns per Short), `"english": [...]`.
- Sentence-level: `"sentences": [{"tts_text": "...", "wps": 4.35, "pause_after": 0.32, "seed": 20261199}, ...]`.
- Fast iteration: `voice.py --only s12.2` re-synthesizes only sentence 2 of `s12`; `voice.py --reuse` re-computes WSOLA tempo and pauses from `audio/_sents/*_raw.wav` in `< 2 s`.
