---
name: sv-42-mix-master
description: House mixing and mastering standard for story-video episodes — fixed processing chain (voice clean-up: denoise, EQ, de-ess, gentle compression, per-segment levelling, expander against noise and codec reverb tails, voice peak limit; series theme music with voice-band carve, side-chain duck and auto-ride; levelled sfx; glue, -14 LUFS, true-peak limiter), measured by audio_qa.py against mix_targets.json (loudness, true peak, LRA, music under voice per window, masking, sibilance, spectrum bands) with waveform/loudness/spectrum plots, then re-measured inside the rendered video (AAC drift, A/V length, sync). Use for gate G6 and the audio part of G7, whenever the user says the music is too loud/quiet, the mix sounds off, levels jump, or a video's sound must be checked.
---

# sv-42 · Mix & master (gate G6, audio part of G7)

Why this exists: earlier mixes were set by ear, one number at a time ("nhạc to quá", then "nhạc hơi nhỏ…
chưa đo đoạn này đoạn kia, sóng, tần số"). Every episode must sound the same, so the chain and the
targets are fixed in code and every number is measured, plotted and gated. sv-40 decides *what* sounds
there are (beds, foley, accents, silences); this skill decides *how they sit together*.

## Read first
`references/standard.md` — every target with its reason, the chain step by step, and how to read the plots.

## The standard lives in one file
`standards/mix_targets.json` (shared by all episodes, versioned). `processing` = chain settings, the other
groups = pass ranges. Never edit it for one episode; a change is a series decision (user request), made in
the suite's `standards/mix_targets.json` with a CHANGELOG line, and it makes G6 stale everywhere it is copied.

| Layer | Target (summary) |
|---|---|
| Master | −14 LUFS integrated (±0.5), true peak ≤ −1.0 dBTP, max short-term ≤ −9 LUFS, no clipped samples, starts ≤ 0.15 s, fades 0.3–3.5 s after the last word |
| Voice | segment loudness spread ≤ 2 LU, speech p10–p90 ≤ 6 LU, sibilance ≤ −14 dB of the voice, between words ≤ −50 dB (clean, no noise or echo tail) |
| Music | 15–18 dB under the voice while speaking (aim 16), never closer than 12 dB in any 1 s window, its 1–4 kHz band ≥ 22 dB under the voice's |
| SFX | 400 ms peak ≤ voice median + 3 dB |
| Spectrum (master) | sub < −18 dB, low −14…−3, low-mid −6…−0.5, presence −18…−7, air −28…−13 (share of total) |
| Delivered video | loudness drift ≤ 0.5 LU after AAC, true peak ≤ −0.5 dBTP, audio/video length ±0.07 s, sync ±20 ms |

## Workflow
1. Inputs ready: G5 PASS, `node scripts/times.mjs`, sv-40 has written `audio.json`
   (`"music": {"theme": "series", "under_voice_db": 16, …}`).
2. `/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/mix.py` (≈ 20 s). It runs the chain, writes
   `public/mix.wav`, stems in `audio/stems/`, `qa/mix_report.json`, then runs `scripts/audio_qa.py`:
   `qa/audio_qa.json`, `qa/mix/overview.png`, `qa/mix/segments.png`. Exit code 1 = a check failed.
3. Open both PNGs. Read them in this order (details in references/standard.md §4):
   waveform (no brick wall, the silence before the turn is visible) → loudness lanes (voice steady,
   music lane parallel and ~16 dB lower, no orange spikes) → voice-minus-music dots (inside the green band,
   none under the red line) → spectrum (black follows blue; music sits under the voice above 1 kHz) →
   segments (no red bar = no sentence jumps out).
4. Fix by cause, never by moving a target: between_words_db fails → a noisy or damaged take (sv-12 re-take), not a stronger gate; music too close → `under_voice_db` within 15–18 or check the
   theme; a sfx hit flagged → its `g` in audio.json or the sound itself (sv-40); a segment jumping → re-take
   that voice segment (sv-12); spectrum out → a bed or sfx with too much low end (sv-40).
5. Listen on headphones at least: the hook (0–10 s), every sfx-heavy shot, the silence before the turn,
   the ending. Then on the laptop speaker for the first 20 s (phones play it that small).
6. `gates/G6.review.md` (template lists what to write), `python3 scripts/sv_gate.py pass G6`.
   The gate re-reads every check, refuses a non-theme music, a master limiter working > 6 dB, a voice peak limiter working > 10 dB (a click
   or pop in a take → re-take in sv-12), a mix_report without the voice peak stage, or a stale mix.
7. At delivery (sv-41) `deliver.mjs` runs `audio_qa.py --video` on the master and the phone copy →
   `qa/video_audio.json`; G7 refuses any failed delivery check.

## Commands
| Command | Writes |
|---|---|
| `…/python scripts/mix.py` | public/mix.wav, audio/stems/*.wav, qa/mix_report.json, then audio_qa outputs |
| `…/python scripts/audio_qa.py` | qa/audio_qa.json, qa/mix/overview.png, qa/mix/segments.png (re-measure only) |
| `…/python scripts/audio_qa.py --video out/final.mp4` | qa/video_audio.json entry for that file |
| `…/python scripts/theme.py --sec 60 --end 56 --out audio/theme.wav` | the series theme alone (preview) |

Code: `scripts/audiolib.py` holds the DSP and the BS.1770 meters (integrated loudness matches ffmpeg
ebur128 to 0.1 LU); `scripts/mix.py` the chain; `scripts/audio_qa.py` the measurements and plots.

## Rules
- The voice arrives raw from sv-12 (one take per line, never processed there); this chain is the only
  place it is cleaned. Never add prosody edits (pitch, stretch, per-word gain): the user rejected them.
- Voice first. Music and sound make the story feel alive; they never compete with a word.
- One series theme, generated to length (scripts/theme.py). No per-episode music.
- Do not judge a mix by ear alone and do not judge it by numbers alone: the PNGs and a listen, both.
- Never pass G6 with a failed check "because it sounds fine". If a target is wrong for the series, tell
  the user and change the standard for every episode.
- Re-run mix.py after any voice, shot, audio.json or standard change (the gate detects staleness).
