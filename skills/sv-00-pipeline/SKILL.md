---
name: sv-00-pipeline
description: Entry point and conductor for making a Vietnamese 2D story-video episode (vertical 1080×1920, 2–3 min, narrated by Hải Đăng, riso-ink illustration, Remotion) — scaffold the project, run the seven gated phases G1 brief → G2 script → G3 voice → G4 design → G5 shots → G6 audio → G7 delivery in order, with machine checks, evidence files and user approvals, and send the phone copy. Use at the start of any new episode or video idea, when resuming an episode ("làm tiếp tập…"), when asked what the status of an episode is, or whenever you are unsure which story-video skill to use next.
---

# sv-00 · Pipeline (start here)

This suite reproduces a proven process. Each phase has a skill, a machine check, evidence you must look
at, and a gate that records it. Do the phases in order; never skip ahead because "it is faster". The
reference episode "Thang máy ăn bí mật" (153 s, 67 shots, 26 segments) is the quality bar.

## House standards (same output from any agent, any machine)
Three files in `standards/` plus the theme generator `scripts/theme.py`, versioned in the suite, never edited
per episode (a change is a series decision with a CHANGELOG line; the gates go stale where they changed): `pacing.json` (length 140–165 s, 600–720 words,
voice 1.0×, 2.0–3.0 s per shot), `voice_standard.json` (Hải Đăng preset, t0.8/k25, one take, per-line
checks), `mix_targets.json` (voice chain, music 15–18 dB under, −14 LUFS), `theme.py` (the series theme).

## Phase map
| Gate | Phase | Skill | Machine check | Evidence you must open | Approval |
|---|---|---|---|---|---|
| G1 | Brief | sv-10 (+ sv-01) | brief sections filled | brief.md | **user** |
| G2 | Script + beats | sv-10 | `script_lint.py` | qa/script_lint.json | **user** |
| G3 | Voice | sv-12 | one take/line vs voice_standard.json + pacing.json | qa/voice_report.json + listening | — |
| G4 | Scene plan + cast + sets | sv-23, sv-20 | `scene_audit.py plan` (SC) + `lint.mjs design` (CH/TK/SE) | qa/scene_board.png, qa/design/*.png | **user** |
| G5 | Shots + motion | sv-22, sv-21, sv-23 | `lint.mjs shots` + `scene_audit.py shots` (clutter) | qa/contact_p*.png, qa/strips/*.png, qa/clutter_board.png | — |
| G6 | Audio | sv-40 (sounds) + sv-42 (mix & master) | 21 measured checks vs mix_targets.json | qa/mix_report.json, qa/mix/overview.png, qa/mix/segments.png + listening | — |
| G7 | Delivery | sv-41 (+ sv-42 audio-in-video) | deliver report + video audio checks | qa/deliver_report.json, qa/final_check.png, qa/video_audio.json, full watch | — |

`approval: user` means: show the user the evidence (send the brief / script text / PNGs), wait for their
answer, and quote it in the review (`user_quote`). If the user told you to continue without checking with
them, write `approval: delegated` and quote that instruction.

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
- `status` — every gate: PASS / STALE (inputs changed since it passed) / OPEN.
- `check G#` — runs the machine checks, lists what is missing; changes nothing.
- `pass G#` — runs checks, verifies the review file, appends to `gates/log.jsonl` with hashes of the gate's
  inputs. Refuses when: a previous gate is not PASS; the review still has TODO; an evidence file is not
  named in the review or is named with < 4 words of remark; evidence is newer than the review; approval
  is missing for G1/G2/G4; less than 60 s since the previous pass.
- Editing an input of a passed gate makes it and every later gate STALE. Re-do from the earliest stale gate.

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

## House rules (from the user, non-negotiable)
- Voice Hải Đăng, northern wording. Never switch voices without the user asking.
- Music: the one series theme (scripts/theme.py, 118 BPM, kỳ bí nhẹ, tò mò), 15–18 dB under the voice.
- Mix and master by the house standard (sv-42, standards/mix_targets.json), never by ear alone.
- Every character designed on a sheet before use; every set built in six passes to exemplar density.
- Walks in profile with planted feet; actions with anticipation and a reacting world; verify with strips.
- Camera moves are motivated; cuts land on words.
- Verify every stage with evidence you actually opened. Never write "looks good" for a file you did not view.
- Do not copy reference channels (premise, lines, characters, look).
- Deliver a phone copy ≤ 30 MB and send it to the user.
- Commit/push only when the user asks.

## When resuming
`python3 scripts/sv_gate.py status`, read the latest review files, then continue from the first gate that
is not PASS. Tell the user in one line where the episode stands.

## Read next
`references/commands.md` — every command with what it writes and how long it takes.
