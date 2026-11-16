# Changelog

## `v2.2.0` — 2026-11-16
- **Voice standard (`scripts/voice_standard.json`, sv-12 rewritten):** Hải Đăng preset only (no cloning), native 1.0× speed, temperature 0.8 / top_k 25 / top_p 0.95, **one take per line** with a fixed seed. Every line is measured against the calibrated Hải Đăng profile (word accuracy, rate, pitch, timbre, holes) and regenerated with the next seed only if it fails (max 3). Episode checks cover pitch spread, rate and timbre consistency, and retry share. Text rules: numbers in words, no "…", no emotion tags. The settings come from a temperature × top_k sweep; the user approved the result ("bản E"). Expressive tricks were rejected: punctuation shaping, cloning, and pitch/gain edits.
- **Pacing standard (`scripts/pacing.json`):** calibrated on the three approved episodes.
  - Voice: 140–165 s, 600–720 spoken words, 4.1–4.6 words/s overall, pauses 2–8 %.
  - Structure: 22–34 segments.
  - Shots: 2.0–3.0 s mean, 20–28 per minute.
  - Enforced by `script_lint.py` SC-04/05/15–18, gate G3, and new lint rules PC-01..03.
- **Voice chain v2 (`mix_targets.json` 1.1, sv-42):** denoise first, EQ for the codec (−3 dB @ 220 Hz, +2.5 dB @ 3.5 kHz, LPF 15 kHz), 2:1 compression, then an expander that cuts the codec's reverb tail between words. The old 3:1 chain lifted noise and tails about 10 dB. New check `voice.between_words_db` ≤ −50 (quietest quarter of the frames between words, vs speech: raw take −44, chain v2 −60). Last stage: voice peak limit at speech RMS + 15 dB, so the master limiter stays light (7.8 → 1.8 dB on con-so-dam-ma); G6 refuses a voice peak limit > 10 dB.
- **Fix:** `script_lint.py` rewrote `qa/script_lint.json` on every run, so `sv_gate.py pass G2` always found the evidence newer than the review and could never pass. It now writes only when the result changes.
- **Gates:** G3 rejects old reports, failed or stale lines, off-standard engine settings, and changed standards. G2, G3 and G5 go stale when the standards change.

## `v2.1.0` — 2026-11-15
- **Series theme music** (`scripts/theme.py`): one theme for every episode, chosen by the user. It is "Pizzicato tò mò" v2: D minor, 118 BPM, kalimba, music box and a soft "tưng tưng" bass. It is stored as code and generated to each episode's length; the melody starts at 0 s and resolves after the last word.
- **New skill `sv-42-mix-master`:** a fixed house chain and a measured standard in `scripts/mix_targets.json`.
  - Voice: EQ, de-ess, compression and per-segment levelling.
  - Music: voice-band carve, side-chain duck and auto-ride.
  - SFX: levelled against the voice.
  - Master: glue, −14 LUFS and a 4× true-peak limiter.
- **`audio_qa.py`:** 21 checks on the mix, plus waveform, loudness, voice-minus-music and spectrum plots (`qa/mix/*.png`). A `--video` mode checks the audio inside the delivered mp4s: AAC drift, true peak, A/V length and sync.
- **Gates:** G6 enforces every check, the theme and limiter effort, and goes stale when the standard changes. G7 enforces the video audio checks.
- **Music level:** now 15–18 dB under the voice (was 20–24); the user found 22 dB too quiet.

## `v2.0.0` — 2026-11-15
- **Replaced the v1 suite.** The v1 suite was generic, English-only, and full of counters. v2 is nine skills built from the proven process of the reference episode *Thang máy ăn bí mật*.
- **New template `templates/episode-starter/`:**
  - the generalized engine;
  - the exemplar cast, sets and shotlist;
  - a demo shotlist;
  - one-command evidence renderers: design sheets, contact sheets, motion strips, single frames;
  - delivery with a phone copy of 30 MB or less.
- **Design system (sv-20):**
  - Fixed tokens: palette roles, line weights, halftone and glow, typography, world coordinates.
  - Characters: a procedure with trait and silhouette rules, plus cast and expression sheets.
  - Sets: six-pass building with detail budgets calibrated on the exemplar, a human-scale fixture table, and a collision checklist.
- **Lint (`lint.mjs`):**
  - 60+ rules across characters, tokens, sets, shots, anchors, overlays, camera, size, motion and coverage.
  - SE-13 measures emptiness on the rendered plate.
  - MO-09 checks that the actor stands at the right distance and depth for a reach.
  - SZ-02 catches actors cut by the frame edge.
  - KY-01 requires a strip for every animated set key.
- **Script lint** calibrated on the reference script: rhythm SD, short punch lines, northern wording, beats map.
- **Voice report:** per-segment similarity and pace, with the voice locked to Hải Đăng.
- **Generic mix (`audio.json`):**
  - ambience beds and automatic foley;
  - music at 80 BPM or less, placed 20–24 dB under the voice;
  - a mix report with hashes.
- **Gates G1–G7 (`sv_gate.py`):**
  - input hashes, with stale detection;
  - evidence and remark checks;
  - user approval quotes;
  - order enforcement.
- Removed `templates/stage-starter`, the 40-genre and 50-camera catalogs, and SHA lockfiles per checklist.
