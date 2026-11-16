---
name: sv-10-script
description: Write the narration script of a 2–3 minute Vietnamese story-video episode — brief to beats.md to script.json, in the house voice (first-person northern narrator read by Hải Đăng), with measured rhythm (sentence-length variance, short punch lines), an absurd-rule premise that escalates to a system, a fair twist and a short button line; lint it and pass gates G1 (brief) and G2 (script). Use whenever you create, rewrite, shorten or punch up an episode's story, premise, beats or narration text, or when the user asks for a new episode idea.
---

# sv-10 · Script (gates G1 brief, G2 script)

The script is the spine: the shots cut on its words, the voice reads it, the music follows its beats.
A weak script cannot be saved by pictures. This skill turns an idea into `brief.md`, `beats.md` and
`script.json` that pass measured checks and the user's approval.

## Read first
1. sv-01-series-bible `SKILL.md` — what this series is, who narrates, what is off-limits.
2. `references/craft.md` — benchmarks, episode shape, rhythm, northern wording, script.json format, rubric.
3. `references/exemplar.md` — the annotated reference script (structure to learn, content never to reuse).

## Workflow
### G1 — brief
1. Pitch 3 premises to the user in 1–2 lines each (absurd rule + who suffers + where it ends). Each must
   pass the bible's premise test. Let the user pick (or pick yourself if they delegated, and say so).
2. Fill `brief.md`: Premise, Why it is funny (+ 3 escalation steps), Characters (2–3 principals + supports,
   each with a trait and a visual hook), Locations (3–6, each with a drawable gag sign), Ending, Not copying.
3. Show the brief; get approval. `gates/G1.review.md`: verdict, `approval: user|delegated`, `user_quote`.
4. `python3 scripts/sv_gate.py pass G1`.

### G2 — beats and script
5. `beats.md`: the six sections (Hook, Setup, Escalation, Turn, Payoff, Button) and the segment map
   (`| s1 | Hook | main image |`) — write the map BEFORE the text; every row must be one drawable picture.
6. `script.json`: write segment by segment from the map. Read craft.md §3–4 while writing, not after.
7. `python3 scripts/script_lint.py` → fix all SC errors (rules below), consider every warning.
8. Self-review in `gates/G2.review.md`: answer the 10 rubric questions (craft.md §8) with specifics, list
   what you changed because of them.
9. Send the user the full text (segment ids + text, one per line) and the estimated length. Revise until
   they approve; quote them. `python3 scripts/sv_gate.py pass G2`.

## Lint rules (scripts/script_lint.py → qa/script_lint.json)
| Rule | Checks |
|---|---|
| SC-01/02 | title not DEMO; voice is Hải Đăng |
| SC-03 | ids s1, s2, … unique and in order (s3b allowed) |
| SC-04 | 22–34 segments (`standards/pacing.json`) |
| SC-05 | 600–720 spoken words and an estimated 140–165 s at Hải Đăng's native speed (target 150 s = "tầm 2,5 phút") |
| SC-06 | ≤ 45 words per segment |
| SC-07 | sentence length SD ≥ 3 |
| SC-08 | no sentence > 24 words |
| SC-09 | ≥ 3 short sentences (≤ 5 words) |
| SC-10 | southern words (error) / southern-leaning words (warning) |
| SC-11 | repeated phrases |
| SC-12/13 | beats.md sections present, segment map covers every id |
| SC-14 | s1 ≤ 20 words |
| SC-15 | no digits in the spoken text (numbers in words) |
| SC-16 | no "…" in the spoken text (it becomes a hole in the voice) |
| SC-17 | no emotion tags (`voice_standard.json` allows none) |
| SC-18 | pause_after 0.1–0.6 s |

## Rules
- Narrator: first person, northern, calm deadpan. No southern words, no English, no slang from the internet.
- One absurd rule, played completely straight, escalating to a system. No magic explained, no moral stated.
- Every named person has a place ("tầng năm"), every number is spoken in words.
- Pacing is a house standard (`standards/pacing.json`): the same words budget and length for every episode, so
  any agent produces the same speed. Emotion lives in the writing; the voice adds none (sv-12).
- Never reuse a premise, line, character or ending from the reference channels or from earlier episodes.
- After G2 passes, any text change re-opens G2 AND G3 (the voice) — the gate log shows them stale.

## Failure → fix
| Problem | Fix |
|---|---|
| SC-07 monotone | split a long sentence into build + 3-word punch; merge two medium ones |
| Too long (SC-05) | cut a whole consequence segment, not words from every line; never plan to speed the voice up |
| Twist feels cheap | plant it: a detail in s1–s3 that the turn recasts |
| Segment you cannot picture | rewrite around an object or a place, or merge it with its neighbour |
| User says "chưa hài" | sharpen specifics (numbers, names, objects) and cut explanations; do not add jokes words |
