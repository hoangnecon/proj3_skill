# Mix & master standard v1.1 — targets, chain, reading the plots

## 1. Why these numbers
| Check | Range | Reason |
|---|---|---|
| integrated_lufs | −14.5…−13.5 | YouTube/TikTok/Facebook normalise to about −14; mastering there means the platform does not turn us down or up, and every episode plays at the same level |
| true_peak_dbtp | ≤ −1.0 | AAC encoding adds overshoot; −1 dBTP on the master keeps the delivered AAC below −0.5 |
| lra_lu | 1…8 | continuous fast narration is naturally compact (≈ 1–3 LU); above 8 the quiet lines get lost on a phone |
| max_short_term_lufs | ≤ −9 | no 3-second stretch blasts (sfx pile-ups, a shouted line plus music) |
| clipped_samples / dc_offset | 0 / ±0.001 | hard errors |
| head_silence_s | ≤ 0.15 | the hook must start at once (shorts are scrolled in under a second) |
| tail_fade_s | 0.3…3.5 | the theme resolves after the last word and fades; no cut-off, no long dead air |
| segment_spread_lu | ≤ 2 | TTS takes come out at different levels; a sentence that jumps ±2 LU is audible |
| speech_short_term_p10_p90_lu | ≤ 6 | inside sentences: words that drop away are not heard on a phone speaker |
| sibilance_ratio_db | ≤ −14 | "s/x/ch" hiss after the presence boost; tiring on earbuds |
| between_words_db | ≤ −50 | p25 (quietest quarter) of 10 ms voice-stem frames between words (not speech, not digital silence) vs the speech level — p25 because whisper word ends are early and the median catches speech. Measured on con-so-dam-ma: raw take −44, chain v2 −60; the v1.0 chain lifted the floor ~8 dB: noise and the codec's reverb-like tail pumped up by the 3:1 compressor — the user heard "noise, eco", "thu kém" |
| under_voice_speaking_db | 15…18 | user feedback: 22 dB was "hơi nhỏ"; closer than 15 starts to fight the words |
| under_voice_pauses_db | 7…13 | where there are real pauses (≥ 0.6 s), music rises to carry the beat. Skipped when the narration has < 2 s of such pauses (normal for fast shorts) |
| presence_masking_db | ≤ −22 | intelligibility lives in 1–4 kHz; music there must be far below the voice |
| max_under_voice_window_db | ≥ 12 | the average can be fine while one loud phrase of music covers a word |
| peak_over_voice_db | ≤ +3 | a sound effect may punctuate, not startle |
| spectrum bands | see json | catches rumble (sub), boom (low), boxiness/thinness (low-mid), harshness or dullness (presence, air) |
| delivery | drift ≤ 0.5 LU, TP ≤ −0.5, length ±0.07 s, sync ±20 ms | the file people hear is the mp4, not the wav |

## 2. The chain (mix.py, settings in `processing`)
1. **Voice (chain v2, 1.1):** HPF 75 Hz (4th order) → spectral denoise (noise profile from the quietest
   frames, ≤ 18 dB cut, smoothed) → −3 dB @ 220 Hz (boxiness) → +2.5 dB @ 3.5 kHz (intelligibility) →
   +1.5 dB shelf 8 kHz → LPF 15 kHz (the codec has nothing above ~14 kHz but hiss) → de-esser 5–9 kHz
   (max −5 dB) → compressor −22 dB, 2:1, soft knee → per-segment levelling (±4 dB) → downward expander
   (−28 dB under the peak, 4:1, floor −40 dB, opens at once, closes ~60 ms) that shortens the tail between
   words → voice peak limit (ceiling = speech RMS + 15 dB, 5 ms look-ahead, 60 ms release). Order matters:
   clean before any gain, expand after all gain, catch spikes last. Measured on the approved test passage:
   floor between words −46 dB raw → −38 dB with chain v1.0 → about −62 dB with v2, word accuracy unchanged.
   The peak limit exists because the chain lifts the crest factor 19.8 → 23 dB: on con-so-dam-ma the onsets
   ("Ai", "soi", "tạch") reached +6.6 dBFS pre-master and the master limiter clamped 7.8 dB on each; with the
   stage it works 1.8 dB, and the voice limiter itself only touches those onsets (≤ 7.4 dB).
2. **Music (series theme, stereo):** HPF 60 Hz → −6 dB @ 2.5 kHz Q 0.7 (carve a hole for the voice) →
   side-chain duck from the voice envelope (7 dB, 40/300 ms) → gain solved so the music sits exactly
   `under_voice_db` under the voice while speaking → auto-ride: any 0.5 s window closer than 13 dB is pulled
   down (smoothed), then the gain is solved again (3 passes).
3. **Ambience:** HPF 40 Hz, 30 dB under the voice, dips with the duck.
4. **SFX:** HPF 90 Hz, each hit limited to the voice RMS + 4 dB (envelope 2/200 ms).
5. **Master:** sum → glue compressor (−18 dB, 1.5:1, 30/250 ms) → cut 2.5 s after the story → tail fade
   1.2 s → gain to −14 LUFS → 4× oversampled look-ahead limiter, ceiling −1.3 dBTP (loudness re-solved
   3 times so the limiter's cost is compensated).
6. Stems are written at master gain (pre-limiter) so audio_qa measures each layer exactly as it sits.

## 3. Measurement (audiolib.py)
BS.1770-4 K-weighting; momentary 400 ms, short-term 3 s, integrated with −70 LUFS / −10 LU gates; LRA
from gated short-term (10–95 %); true peak on 4× oversampled signal. Speech mask = word timings from
`src/data/words.json` (not an energy gate), so "while speaking" means exactly that.

## 4. Reading qa/mix/overview.png
- **Waveform:** even density is normal for narration; a flat solid block means over-limiting (the gate
  also refuses limiter > 6 dB). The red line is the last word; after it the theme must resolve and fade.
- **Loudness lanes:** black (master short-term) should hug −14; blue (voice) steady; orange (music) runs
  parallel about 16 dB lower and drops to the floor in silence sections. An orange bump touching blue =
  music covering a line.
- **Voice minus music dots:** each dot is 1 s of speech. Green band = target, red line = floor. Dots under
  the red line are failures with their time on the x axis.
- **Spectrum:** black (master) should follow blue (voice) from 200 Hz up; orange (music) well below blue
  above 1 kHz (the carve). Band labels turn red when out of range.
- **qa/mix/segments.png:** one row per script segment: voice loudness against the median (red = jumps more
  than 1 LU), music under voice in that segment, master loudness.

## 5. Typical failures and fixes
| Symptom | Cause | Fix |
|---|---|---|
| peak_over_voice_db fails | one sfx too hot | lower its `g` in audio.json, or choose a softer fx (sv-40) |
| max_under_voice_window_db fails | music phrase over a quiet line | the auto-ride should catch it; if not, the line itself is too quiet → re-take (sv-12) |
| segment_spread_lu fails | one TTS take much louder/softer | re-take that segment; levelling clamps at ±4 dB |
| sub_20_60 / low_60_250 high | a bed (motor, basement, rumble) | change the bed or its level (sv-40) |
| air_5k_16k high, sibilance fails | harsh take | de-ess is fixed; re-take or soften presence only via the standard |
| delivery sync fails | render or mux problem | re-render; never shift audio by hand |
