---
name: sv-00-pipeline
description: Entry point and conductor for making a Vietnamese 2D story-video episode (vertical 1080×1920, 2–3 min, narrated by Hải Đăng, riso-ink illustration, Remotion) — scaffold the project, run the seven gated phases G1 brief → G2 script → G3 voice ∥ G4 design → G5 shots → G6 audio → G7 delivery (each after the gates it depends on), with machine checks, evidence files and user approvals, and send the final video. Use at the start of any new episode or video idea, when resuming an episode ("làm tiếp tập…"), when asked what the status of an episode is, or whenever you are unsure which story-video skill to use next.
---

# sv-00 · Pipeline (start here)

This suite reproduces a proven process. Each phase has a skill, a machine check, evidence you must look
at, and a gate that records it. Do the phases in order; never skip ahead because "it is faster". The
reference episode "Thang máy ăn bí mật" (153 s, 67 shots, 26 segments) is the quality bar.

## House standards (same output from any agent, any machine)
Three files in `standards/` plus the theme generator `scripts/theme.py`, versioned in the suite, never edited
per episode (a change is a series decision with a CHANGELOG line; the gates go stale where they changed): `pacing.json` (length 125–170 s, 620–860 words,
5.25 ups per-sentence rhythm, 2.0–3.0 s per shot), `voice_standard.json` (Hải Đăng preset, t0.7/k25, pitch 1.02, bilingual `<en>`, `…` & emotion tags, per-line
checks), `mix_targets.json` (voice chain, music 15–18 dB under, −14 LUFS), `theme.py` (the series theme).

## Phase map
| Gate | Phase | Skill | Machine check | Evidence you must open | Approval |
|---|---|---|---|---|---|
| G1 | Brief | sv-10 (+ sv-01) | Archetype, Blocker, 5-Knot Spine filled | brief.md | **user** |
| G2 | Script + beats | sv-10 | `script_lint.py` (`SC-01..26`) | qa/script_lint.json | **user** |
| G3 | Voice | sv-12 | one take/line vs voice_standard.json + pacing.json | qa/voice_report.json + listening | — |
| G4 | Cast + sets | sv-20 | `lint.mjs design` (CH/TK/SE/PR) | qa/design/*.png (look at `*_v.jpg`, `props_episode_p*_v.jpg`, `*_zoom.jpg`) | **user** |
| G5 | Shots + motion | sv-22, sv-21 | `lint.mjs shots` (SH/AN/OV/CA/SZ/MO/KY/CO/PC/GE) | qa/contact_p*.jpg, qa/strips/*.jpg, qa/review/NN.json per shot | — |
| G6 | Audio | sv-40 (sounds) + sv-42 (mix & master) | 21 measured checks vs mix_targets.json | qa/mix_report.json, qa/mix/overview.png, qa/mix/segments.png + listening | — |
| G7 | Delivery | sv-41 (+ sv-42 audio-in-video) | deliver report + video audio checks | qa/deliver_report.json, qa/final_check.jpg, qa/video_audio.json, full watch | — |

`approval: user` means: show the user the evidence (send the brief / script text / PNGs), wait for their
answer, and quote it in the review (`user_quote`). If the user told you to continue without checking with
them, write `approval: delegated` and quote that instruction.

## Long-form mode (`sv-02-long-form` · 16:9 · 10-minute)
When the user asks for a **16:9 horizontal, ~10-minute Long-Form** episode (instead of the default 1080×1920 2–3 min Short-Form pipeline), read `sv-02-long-form` alongside `sv-01` and `sv-10` before G1. (`sv-02-long-form` governs 16:9 framing, multi-act pacing, and 10-minute production; `SC-27` in `sv-10` remains the opt-in `episode_long` 170–240 s vertical short override.)

## Start a new episode
```bash
bash <suite>/tools/new_episode.sh ~/Work/PROJ3/<slug> --node-modules ~/Work/PROJ3/mua-noi-doi/node_modules
cd ~/Work/PROJ3/<slug>
node scripts/design.mjs --exemplar     # see the bar: exemplar cast + sets
python3 scripts/sv_gate.py status
```
The new project is blank: empty script, cast, sets and shotlist, ready for G1. To study how every engine
feature is used, make a separate sandbox with `--demo` (a 4-shot demo on the exemplar sets; render it with
`node scripts/qa.mjs contact`). Never build an episode on top of the demo: lint SH-04, SH-07 and SC-01 fail on it.

## Gate mechanics (scripts/sv_gate.py)
- `status` — every gate: PASS / STALE (inputs changed since it passed) / OPEN. `status --brief` adds the
  next command(s) and writes `qa/state.json` (gates, next, last file change, live render pid) for helpers.
- Gates follow what they read, not a fixed line: G1 → G2 → G3; G1 → G4; G5 needs G3 + G4; G6 needs G3 + G5;
  G7 needs G5 + G6. So design (G4) passes while the voice is still being made — run them at the same time.
- `watch [--stall 10]` — for the conductor on every wake-up: `STALLED` (exit 2) when no file in the episode
  changed for 10 min and no render is running. A helper that died (server reload, crash) is found in minutes,
  not hours: start a new helper with the same brief and the state file.
- `check G#` — runs the machine checks, lists what is missing; changes nothing.
- `pass G#` — runs checks, verifies the review file, appends to `gates/log.jsonl` with hashes of the gate's
  inputs. Refuses when: a gate it depends on is not PASS; the review still has TODO; an evidence file is not
  named in the review or is named with < 4 words of remark; evidence is newer than the review; approval
  is missing for G1/G2/G4; less than 60 s since the previous pass (it prints the time to retry).
- Freshness is by content hash, not file time: `qa.mjs status` / `design.mjs --status` say exactly which
  shots or sheets no longer match the source, and only those are re-rendered (`qa.mjs pass changed`, `design.mjs --changed`).
  G6 depends on `qa/timing.json` (cut times, keys, reaches), so a visual-only fix does not force a remix.
- Editing an input of a passed gate makes it and every gate that depends on it STALE. Re-do from the earliest
  stale gate. Metadata (title, description, tags) lives outside script.json words: editing it must not touch
  `src/data/words.json`, or every shot goes stale.

## Project layout
Three zones (also in the episode's `README.md`):
```
EPISODE — you write, phase by phase
  brief.md                                    G1
  beats.md  script.json                       G2
  src/episode/cast.ts  sets.tsx  geo.ts        G4 (add props to src/props.tsx only if needed)
  src/episode/shotlist.ts                     G5
  audio.json                                  G6
  gates/G1..G7.review.md                      every gate
SUITE COPY — read-only (fix it in the suite, never per episode)
  scripts/                                    tools (see references/commands.md)
  src/engine.ts kit.tsx chars.tsx side.tsx overlays.tsx props.tsx Film.tsx Root.tsx design/ sets/
  src/exemplar/                               reference cast/sets/shotlist; read, never cast
  standards/                                  voice_standard.json, pacing.json, mix_targets.json
GENERATED — tools only
  src/data/words.json cues.json events.json   voice.py (G3), tracked: the render needs it
  audio/ public/ qa/ out/ gates/log.jsonl     ignored by git
```

## Team (when you can run sub-agents) — `references/roles.md`
Three roles, each with a one-page brief in `references/roles.md` so a helper does not read the whole suite:
- **Conductor** (you): gates, approvals, the user. Never idles waiting — while one helper renders, brief the next.
  On every wake-up run `python3 scripts/sv_gate.py watch`; on `STALLED` replace the silent helper at once.
- **Builders**: write cast/sets (one set per builder, in parallel) and shots (one segment range per builder).
- **Reviewers**: open cards + crops and write batches with `qa.mjs review --batch`; never review shots they built.
Run renders through the scripts only (one render per episode at a time: `qa/.render.lock`).

## 30–45 min parallel execution blueprint (v3.9)
Run independent phases and splits concurrently instead of waiting on a single serial chain:
1. **G1 (Brief)** → user approval.
2. **Parallel G2/G3 + 2-way split G4**: once G1 passes, write script/beats (**G2**) and generate voice (**G3**) while splitting **G4** across two builders in parallel (`cast + props` builder ∥ `sets` builder). Run `node scripts/design.mjs` (auto-generates `qa/design/visual_spec.json`) + `node scripts/lint.mjs design`, get user approval, and pass G4.
3. **G5 (Shots + pre-render CI lint) ∥ G6 (Mix)**: write `shotlist.ts`, run `node scripts/lint.mjs shots` (zero-render pre-flight CI) + `node scripts/qa.mjs where <i>` until clean, then run `node scripts/qa.mjs pass changed` (which also runs `scripts/blind_pack.mjs` to write `qa/blind_review/slice_1..3.json`). Once `qa/timing.json` is stable, run **G6** (`scripts/mix.py` + `scripts/audio_qa.py`) in parallel with G5 QA/fixes.
4. **3-way Blind Reviewers**: dispatch 3 parallel reviewers on `qa/blind_review/slice_1.json`, `slice_2.json`, and `slice_3.json` (each outputting `blind_sha`-verified JSONL via `node scripts/qa.mjs review --batch`), then pass G5 and G6.
5. **G7 (`scripts/deliver.mjs`)**: render `out/final.mp4`, verify `qa/deliver_report.json` + `qa/final_check.jpg` + `qa/video_audio.json`, and pass G7.

## House rules (from the user, non-negotiable)
- Voice Hải Đăng, northern wording. Never switch voices without the user asking.
- Music: the one series theme (scripts/theme.py, 118 BPM, kỳ bí nhẹ, tò mò), 15–18 dB under the voice.
- Mix and master by the house standard (sv-42, standards/mix_targets.json), never by ear alone.
- Every character designed on a sheet before use; every set built in six passes to exemplar density.
- Walks in profile with planted feet; actions with anticipation and a reacting world; verify with strips.
- Camera moves are motivated; cuts land on words.
- Verify every stage with evidence you actually opened. Never write "looks good" for a file you did not view.
- QA images you open are light: JPEG views ≤ 1 MB (`*.jpg`, `*_v.jpg`, `*_zoom.jpg`). Strips stay full frame.
- No reuse of sets or characters from earlier episodes: every episode designs its own.
- Do not copy reference channels (premise, lines, characters, look).
- Deliver `out/final.mp4` (no phone copy) and send it to the user.
- Commit/push only when the user asks.

## When resuming
`python3 scripts/sv_gate.py status`, read the latest review files, then continue from the first gate that
is not PASS. Tell the user in one line where the episode stands.

## Read next
`references/commands.md` — every command with what it writes and how long it takes.
