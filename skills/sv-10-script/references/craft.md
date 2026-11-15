# Script craft

## 1. Benchmarks (reference episode "Thang máy ăn bí mật")
| Measure | Reference | Required (script_lint) |
|---|---|---|
| Segments | 30 | 18–40 (SC-04) |
| Words | 632 | — |
| Estimated length | ~153 s (voice actual 153 s) | 100–200 s error, 120–180 s target (SC-05) |
| Words per segment | 21 mean, 9–38 | ≤ 45 (SC-06) |
| Sentence length | mean 9.4, SD 4.3 | SD ≥ 3 (SC-07), none > 24 words (SC-08) |
| Short sentences (≤ 5 words) | 9 | ≥ 3 (SC-09) |
| First segment | 17 words, 3 sentences | ≤ 20 words (SC-14) |

## 2. Shape of an episode
1. **Hook (s1–s2, ≤ 8 s).** State the absurd rule in plain words, as if it were normal. First sentence =
   ordinary fact; last sentence of s1 = the twist. "Thang máy ở đây không cần thẻ từ. Nó cần sự thật."
2. **Rules (s2–s3).** The world's mechanics in 2–3 concrete sentences. Rules must be visual (you will have to
   draw them) and have a cost.
3. **First month / innocence (1–2 segments).** People use the rule happily. A named neighbour with a floor,
   a small specific secret.
4. **Consequences (4–8 segments).** Each segment a new group or angle: children, the elderly, a couple, a
   business. Each must be MORE specific than the last (numbers, objects, places) and contain its own
   small punch.
5. **Escalation to the system (3–5 segments).** The rule bends society: a market, a queue, a fraud,
   official meeting, statistics. Bureaucratic deadpan ("Biên bản ghi nguyên nhân, đúng ba chữ: do thang máy.").
6. **Turn (2–4 segments).** Reveal that recasts everything — the narrator's own position, the rule was never
   real, the cure is worse. Prepare it: the turn must be fair (planted earlier, e.g. "Tôi ở tầng mười bảy").
7. **Button (1 segment, ≤ 10 words).** A last line that flips the turn once more, short, said slowly.

## 3. Sentence rhythm
- Mix: long build-up (14–22 words) → short punch (2–6 words). The SD rule enforces it.
- Punch lines stand alone as their own sentence, often their own segment.
- Lists of three, the third one breaks the pattern: "Chồng nói một câu, thang lên một tầng. Vợ nói một
  câu, thang lên ba tầng."
- Deadpan: never explain the joke, never use "buồn cười", "hài hước", "bất ngờ thay".
- Concrete beats abstract: "chép ra lòng bàn tay" not "chuẩn bị kỹ". Numbers, floors, prices, times.
- Everyone has a name or a role + place: "Bà Hạnh tầng năm", "thằng cu tầng ba", "cán bộ phường".

## 4. Narrator voice (Hải Đăng, northern)
- First person "tôi", a resident/witness with a stake in the story; speaks calmly, slightly tired.
- Northern words: vào, bố, mẹ, lợn, thìa, cốc, bát, đắt, gọi, bảo, hôm đấy, thế, nhỉ, à, chứ.
  Never southern (lint SC-10): tui, hông, nhen, vô nhà, ly nước, dìa, mần, ổng, bả, xài, muỗng, heo.
- Numbers in words as spoken: "mười bảy", "chín linh hai", "hai nghìn mười chín", "hai chục nghìn".
- Write for the ear: short clauses, the verb early, no parentheses, no abbreviations, no English.

## 5. Writing for pictures
Every segment is a picture change; every noun you write must be drawable in the house style. While writing,
note in `beats.md` the main image of each segment. If you cannot picture it in one frame, rewrite.
Avoid: crowds of more than ~9 people, vehicles in motion, weather events, anything needing realistic hands.

## 6. script.json format
```json
{"title": "Thang máy ăn bí mật", "voice": "Hải Đăng", "pause_after": 0.18,
 "segments": [
  {"id": "s1", "text": "Chung cư tôi cao mười bảy tầng. …", "pause_after": 0.3},
  {"id": "s3b", "text": "…"},
  {"id": "s8", "text": "… mười một.", "tts_text": "… mười một."}
 ]}
```
- `id` s1, s2, … in order; insert later with letter suffixes (s3b) rather than renumbering — shot anchors
  depend on ids.
- `pause_after` default 0.18 s; 0.3 after a punch; 0.45 before the turn.
- `tts_text` only when the TTS mispronounces something (spell it phonetically); `text` is what the captions show.

## 7. Process
1. Brief (G1) approved → write beats.md (sections + segment map) → write script.json.
2. `python3 scripts/script_lint.py` → 0 errors, read warnings.
3. Read the script ALOUD in your head at ~4.2 words/s; mark every place a listener could get lost.
4. Self-review with the rubric (§8) in `gates/G2.review.md`.
5. Send the full script text to the user, get approval (or delegated), `python3 scripts/sv_gate.py pass G2`.

## 8. G2 rubric (answer each in the review)
1. Does s1 make you want the next sentence? What is the question it opens?
2. Is every rule visual and costly?
3. Does every consequence segment have its own small punch?
4. Does the escalation reach a system (market, office, statistics)?
5. Is the turn fair (planted) and does it change the meaning of earlier lines?
6. Is the button ≤ 10 words and does it flip once more?
7. Any line that explains the joke? Delete it.
8. Any southern word, English word, abbreviation? (lint)
9. Could each segment be one picture? (segment map)
10. How is this different from the reference channels' stories? (premise, characters, ending)
