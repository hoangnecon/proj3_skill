# Changelog

## `v3.4.0` — 2026-11-16 · 5-Knot story engine + premise ideation (548-script survey)
Grounded in the 548-script / 28-channel World-Rule Shorts survey (`docs/world-rule-survey-2026-11-16.md`), keeping `standards/pacing.json` unchanged (`140–165 s`, `600–720` words at Hải Đăng `1.0×`):
- **Three archetypes & upgraded Premise Test (`sv-01-series-bible`):** Supports `Personal Rule-Trap` (default, 6.0× median views over external-monster templates), `Systemic Satire` (active moves only), and `Hybrid VN Trap`. Adds *Instant Cognitive Itch (`s1 ≤ 18w`)*, *Cannot-Turn-Off*, *Surface-Loophole Blocker*, *Weaponizable Flaw*, and *Banned Premise Traps* (no arbitrary wrist/step quotas, no generic moral-to-element clichés, no external monsters/magic-denial, no `"name = superpower"`).
- **New ideation guide (`sv-10-script/references/premise-ideation.md`):** Four Generative Lenses (perceptual/physical axiom inversion, strict object state law, binary split humanity, backwards personal glitch) plus Reverse-Design Protocol (designing the Lateral Rule-Hack and Double-Bind before `s1`).
- **3-Act / 10-Beat 5-Knot Engine (`sv-10-script` `SKILL.md` + `craft.md` + `exemplar.md`):** Enforces Act 1 `≤ 42%`, personal pivot by `s7` / `< 40%`, ticking Double-Bind, internal Lateral Rule-Hack from Act-1 `Plant`, Past-Reinterpreting `Turn`, and `≤ 12w` deadpan `Button`; updates rubric to 14 checks and marks *Thang máy* `s4–s20` / `s22–s24` as pre-v3.4 voice/rhythm-only reference.
- **Starter templates (`starter/`):** `brief.md` adds `## Archetype`, Generative Lens, Surface Blocker, and 5-Knot `## Spine`; `beats.md` adds `## Plant & Payoff`, `[sX]` spine citations, and 10-beat `## Segment map` labels; `G1.review.md` & `G2.review.md` aligned.
- **Automated script lint (`engine/scripts/script_lint.py`, `sv_gate.py`, `CONVENTIONS.md`):** Raises `SC-09` short-sentence (`≤ 5w`) floor to `≥ 6` (`< 10` warn), adds `SC-20..26` (middle protagonist agency, Act-1 `≤ 42%` ceiling, `Plant -> Payoff` mapping, `## Archetype` + urgency cues, `≤ 12w` non-moralizing/non-magic-denial endings, early personal pivot, `[sN]` Spine integrity), and requires `## Archetype` in `G1`.

## `v3.3.0` — 2026-11-16 · scene design process + cute faces
- New skill **sv-23-scene-design**. It adds:
  - a location bible (≤ 6 places, each with a purpose, a hero prop, a wall hue and a three-plane layout);
  - `scenes.json`, mapping every beat to a scene;
  - declared transitions;
  - a clutter budget.
- `engine/scripts/scene_audit.py`:
  - `plan` mode checks places, scenes and transitions, and reads wall hues from the rendered plates;
  - `shots` mode checks scene membership, establishing wides, jump cuts and overlay count;
  - it measures **edge density ≤ 0.075 and ≤ 15 colour masses** on every contact frame.
  - It writes `qa/scene_board.png` and `qa/clutter_board.png`.
- `sv_gate.py`: G4 and G5 now run the scene audit and require both boards as evidence. `scenes.json` is an input of both gates.
- Faces (sv-20 characters §1b), front and side rigs:
  - mochi face, big low eyes with highlights, short soft brows;
  - small mouth, no teeth (open mouth = cavity + tongue);
  - button nose in profile, bangs and face-framing locks.
- Proportions: head radius 86 → 100, hip 200 → 178, torso 225 → 196; head ≈ 1/2.6 of height.

## `v3.2.0` — 2026-11-16
User feedback on the "Nước mắt chia đất" draft:
- **State board (sv-20 sets §8, sv-22 grammar).** Numbers that change across the film go on one diagram
  insert whose blocks tween with the numbers; reuse it at the opening and at every change. The reference
  implementation is `examples/devices/state-board.tsx`. The user rejected a push into a static deed cabinet
  as the opening ("mở đầu visual tệ").
- **Prop tip to the face (sv-21 acting §10).** The IK target `taste` puts the hand under the chin so the
  spoon tip lands on the lips. With the hand at `mouth`, the spoon was going to the forehead.
- **Close-up pass for characters (sv-20 characters §4).**
  - Hair caps now reach −1.42 r, so the scalp no longer shows above the hair.
  - `lips` colours the mouth stroke itself instead of an ellipse drawn over the mouth, which covered the
    teeth in grin ("răng ghê"). Teeth are now a band clipped to the mouth path, so they stay inside the lips.
- **Visual rest (sv-20 tokens §8).** Grain is now static at alpha 0.14 (it flickered at 15 Hz), and the
  vignette is down to 0.18 ("nhìn mắc mệt").
- **Delivery (sv-41).** `deliver.mjs` changes:
  - It renders to `out/_render.mp4`, then muxes in the sound straight from `public/mix.wav`. Remotion's AAC
    priming had made the sound 43 ms late.
  - The phone copy is one encode at CRF 33 (the user: "1 bản thôi").
  - It checks free disk space before rendering, because ENOSPC killed a render at 44 %.
  - `SV_SKIP_RENDER=1` is for audio-only fixes.

## `v3.1.0` — 2026-11-16
- **Story spine, not a gag list (sv-10).** The user rejected "Giỗ chia đất": the middle was a list of gags
  ("khai thác này kia"), the narrator only watched, the twist came from outside the rule, and the ending was
  a pun ("cái kết nhảm"). Changes:
  - craft.md §2 now asks for a causal chain in the middle, not a catalogue of groups;
  - new §2b "Spine" tests: want, chain/delete-test, hidden logic, trap, ending, gags;
  - G2 rubric questions 11–13.
- `brief.md` gains `## Spine`: want, the rule's hidden logic, trap, how the ending re-reads the hook.
  Gate G1 requires it.
- `beats.md` gains `## Spine`. New lint SC-19 requires ≥ 4 "- vì thế …" / "- nhưng …" causal lines.

## `v3.0.0` — 2026-11-16
**Repository restructured: one kind of thing per top-level folder** (the user: the template under the skills
mixed engine code, standards, demo and reference content with no structure).
- New layout:
  - `skills/`: instructions only;
  - `standards/`: `voice_standard.json`, `pacing.json`, `mix_targets.json`;
  - `engine/`: `scripts/` tools + `src/` Remotion engine + project config;
  - `starter/`: blank episode files;
  - `examples/`: `thang-may/` reference episode and `demo/` engine demo;
  - `tools/`: `new_episode.sh`, `validate_skills.py`.
- `templates/episode-starter/` is gone. `new_episode.sh` moved from `skills/sv-00-pipeline/scripts/` to `tools/`.
- **Episode layout** (breaking for tools, not for finished episodes — each keeps its own copy):
  - episode code in `src/episode/` (`cast.ts`, `geo.ts`, `sets.tsx`, `shotlist.ts`);
  - generated timing in `src/data/` (`words.json`, `cues.json`, `events.json`);
  - house standards in `standards/`.
  - A `README.md` in every episode marks the three zones: written by the agent, read-only suite copy, generated.
- **New episodes start blank.** The 4-shot demo is opt-in: `new_episode.sh <dir> --demo`. `.suite.json`
  records the suite version.
- `validate_skills.py` checks the layout. It rejects unknown top-level folders, a file kind in the wrong
  folder (code in `skills/`, data in `engine/`), and a skill folder holding more than `SKILL.md` + `references/`.
- Verified:
  - a `--demo` episode gives identical lint output and pixel-identical renders to the v2.2.0 layout;
  - a blank episode type-checks and runs;
  - con-so-dam-ma voice + mix in the new layout give identical words.json and audio QA (22/22).

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
