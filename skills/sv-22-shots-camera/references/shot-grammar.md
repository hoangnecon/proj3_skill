# Shot grammar

Benchmarks from the reference episode (Thang máy ăn bí mật, 153 s): **67 shots, mean 2.2 s, range
0.9–4.8 s**; zoom 1.0–2.7, mean 1.26; 48 of 67 shots have a camera move; 9 shakes, 2 punches;
overlays: 17 bubbles, 16 labels, 5 stamps, 5 time tags, 4 arrows, 2 titles, 1 card.
A new episode should land close to these numbers: 1 shot per 2–2.5 s of narration, never a whole sentence
on one static frame.

## 1. One shot = one idea
Read `beats.md`. Every narration clause that introduces a new person, place, object, action or twist
gets its own shot, cut ON the word that names it. Ask of every shot: what must the viewer see when they
hear this word? That is the subject; frame it.

## 2. Shot sizes (zoom k at the character's scale s ≈ 1)
| Size | k | Shows | Use |
|---|---|---|---|
| Establishing | 0.9–1.15 | whole room / building, people small | first shot in every set (lint CA-04: first shot in a set must have k ≤ 1.2), returning after a time jump |
| Full | 1.0–1.3 | whole bodies, feet visible | walks, entries, blocking, two-shots |
| Medium | 1.3–1.8 | knees/waist up | talking, reactions, confessions (talker ≥ 480 px tall, SZ-01) |
| Close | 1.8–2.6 | head and shoulders, a hand on a button | punch lines, reactions, small actions |
| Insert | 2.6–3.5 | an object: a notice, a phone screen, the floor number | when the narration names a small thing the viewer must read |

Rhythm: wide → closer as the scene builds; jump back out after the punch. Do not stay at one size for
more than 3 shots. Never two adjacent shots with the same set AND nearly the same framing (jump cut) —
change size by ≥ 1.3× or change angle/subject.

## 3. Camera moves (cam → cam2), only when motivated
| Move | When | How |
|---|---|---|
| Push in | tension, a confession, "and then…" | k × 1.1–1.5 toward the subject, `ease: 'io'` |
| Pull out | reveal the absurd scale, the crowd, the consequence | k ÷ 1.2–1.6, `ease: 'out'` |
| Follow | a character walks | cam2 x follows the path end; keep the walker in the middle third |
| Tilt (y move) | climbing, floors, height gags | cy changes, k constant |
| Drift | quiet held moments | ≤ 40 px, k × 1.03–1.08 — keeps a long shot alive |
Rules: no moves under 1 s (CA-02 warns: a jolt); zoom ratio inside one shot ≤ 2.2 (CA-03); never move
the camera AND cut on the same word unless it is a whip into a punch; the visible rect must stay inside
the set `bounds` (CA-05 error — the edge of the world is showing).

## 4. Punch, shake, transitions
- `punch: 0.05` with a stamp, a reveal, a deadpan verdict. ≤ 1 in 20 shots.
- `shake`: physical impact, a flicker, a rumble, fear. 2–4 px subtle, 6–8 hits. Not for jokes alone.
- `tr: 'flash'` time jump or shock; `'wipe'` chapter change. Default hard cut — cuts are invisible
  when they land on words.

## 5. Overlays and captions
- The caption band (y 1480–1760) belongs to the subtitles. Nothing important there: no faces, no
  overlay, no set text the viewer must read (OV-03).
- Prefer diegetic text (a notice in the set) over overlays. Overlays: ≤ 2 on screen (OV-04), each appears
  on its word.
- Bubble only when the narration quotes the character, ≤ 28 chars, `tail` toward the mouth.
- Time tags ("THÁNG ĐẦU", "BA THÁNG SAU") on the word that says it, with `tr: 'flash'` or a cut to an
  establishing frame.

## 6. Composition
- Faces in the upper half (y 300–1100 on screen). Feet above the caption band when walking (frame the
  floor line at screen y ≤ 1450, or crop at the knees).
- Subject on a third (screen x ≈ 360 or 720), looking/walking into the open space.
- Two people talking: both visible in a medium two-shot, or alternate singles with the listener's
  reaction on the punch word.
- Depth: something in front (fg layer, a door frame, a plant) in ≥ 1 of every 4 shots.

## 7. Scene templates (copy the structure, not the content)
**Hook (s1, 3–4 shots, ≤ 6 s):** establishing of the absurd thing → insert of its rule/sign → reaction.
**Rule demo:** full shot of someone doing it → close on the result (key changes on the word) → stamp/label.
**Escalation:** same set, each beat closer and faster (3.0 → 2.0 → 1.4 s), one overlay per beat.
**Turn:** cut wide on the twist word, punch or flash, silence beat (music drop, see sv-40).
**Button (last 1–2 shots):** a single held image ≥ 2.5 s with a drift and one last small gag, then the end.

## 8. Self-check before G5
- Mean shot length 1.8–2.8 s; none < 0.45 s (SH-14) unless waived; long holds (> 6.5 s) justified.
- Every set's first shot establishes. Every principal has at least one medium or close shot.
- Every walk/reach/sit/ride/key has its strip and it reads (sv-21 checklist).
- Contact sheet: two frames per shot — would a viewer with the sound off follow the story?
