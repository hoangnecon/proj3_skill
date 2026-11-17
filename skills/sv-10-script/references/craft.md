# Script craft

## 1. Benchmarks (house standard + 548-script survey)
House pacing (`standards/pacing.json` v2.0) uses the lively per-sentence `Hải Đăng` rhythm (`5.25` syllable-units/s, `pitch 1.02`):

| Measure | House / Survey Benchmark | Required (`script_lint.py`) |
|---|---|---|
| Segments | 22–40 (reference 30) | 22–40 (`SC-04`) |
| Words & Duration | 620–860 spoken words, 125–170 s | 620–860 words, 125–170 s (`SC-05`) |
| Words per segment | 18–26 mean | ≤ 45 (`SC-06`) |
| Sentence rhythm | mean 7.2–10.0 words, SD ≥ 4.0 | SD ≥ 3.0 (`SC-07`), none > 24 words (`SC-08`) |
| Short punch sentences (≤ 5w) | Top 10% VoidCast uses 25–35 per clip | ≥ 6 hard floor, target ≥ 10 (`SC-09`) |
| First segment (`s1`) | 10–16 words (world-rule upfront) | ≤ 20 words (`SC-14`) |
| Act-1 ceiling & Pivot | `"Còn tôi?"` ~20%, Crisis ~38% | Act 1 ≤ 42% (`SC-21`), narrator by `s7` / < 40% (`SC-25`) |
| Middle protagonist agency | Active hero/family in 35%–70% | ≥ 25% of middle segments (`SC-20`) |
| Closing button | VoidCast median 7 words | ≤ 12 words (`SC-24`), zero morals/magic-denial |

Survey context (`docs/world-rule-survey-2026-11-16.md`): across 548 scripts and 28 channels, **Pure Rule-Trap** episodes beat external-monster twists by **6.0×** median views (`2.90M` vs `483K`), and story-button endings beat stated morals by **30×** in Vietnamese (`3.73M` vs `121K`).

## 2. Episode architecture — 3-Act / 10-Beat 5-Knot Engine

An episode is a **causal trap**, never a tour of neighbours (`"khai thác này kia"`). Map every segment in `beats.md` onto this 3-Act budget:

### Act 1 · Rule, Handicap & Plant (`≤ 42%` of segments, e.g. `s1–s10` of 26)
1. **`Hook` (`s1`, ≤ 16–20 words):** State the topsy-turvy rule immediately in plain northern Vietnamese. No long family preambles before the rule.
2. **`Setup` (`s2–s3`, Mechanics + Blocker):** Show how the rule looks in 1 frame (`sv-20` state/visual marker), state its cost, and slam the **Surface-Loophole Blocker** (*"Leaving the room / faking X does not bypass it"*).
3. **`World` (`1–2` segments, max `2–3` gags):** Concrete comic escalation across named neighbours/places (`"Bà Hạnh tầng năm"`). Never exceed `42%` total Act-1 length (`SC-21`).
4. **`Pivot` — Knot 1 (`≤ 25%` / by `s7`, `"Còn tôi?"`):** Enter first-person `"tôi"` (or household) with a specific **Handicap** under the rule, paired against a contrasting **Foil** character whose habit looks stubborn, unfair, or foolish (`SC-25`).
5. **`Plant` (`≤ 45%`):** Embed one specific physical detail, layout limit, or secondary clause casually in Act 1 — this must become the mechanical key in Act 3 (`SC-22`).

### Act 2 · Crisis, Ticking Clock & Double-Bind (`~38%–72%` of segments)
6. **`Crisis` — Knot 2 (`~38%–45%`):** Disaster hits the exact person/place tied to the **Plant**, starting a concrete **Ticking Clock** (`minutes`, `seconds`, `midnight`, `rising water`, `before inspection`). Show **2–3 normal fixes failing** ("Three Closed Doors") so no easy escape remains (`SC-23`).
7. **`Bind` — Knot 3 (The Double-Bind Dilemma):** Lock the protagonist into a lose-lose trap:
   - *Choice A:* Using the rule normally destroys or sacrifices what you are trying to protect.
   - *Choice B:* Not using the rule guarantees disaster before the deadline.
   - *Note for `Systemic Satire`:* Escalation steps (`Escalation`) must still be driven by active moves from `"tôi"` or a named rival (`SC-20`), never passive spectator lists.

### Act 3 · Lateral Rule-Hack, Past-Flip & Deadpan Button (`~72%–100%` of segments)
8. **`Hack` (`Opening Knot`, ≥ 65%):** Break the Double-Bind strictly from **inside the rule's own wording or physical edge case**, combining it with the Act-1 **Plant** (`SC-22`), and pay a **real physical/personal cost**. Five proven hack operators:
   - *Literal Wording Exploit* (obey the letter of the rule, not its assumed spirit)
   - *Polarity / Direction Reversal* (flip input orientation, sign, or sequence)
   - *Weaponizing the Flaw* (use the narrator's Act-1 handicap as the exact tool needed)
   - *Symbiotic Role Swap* (trade vantage points or duties with the opposite partner)
   - *Delayed / Indirect Relay* (trigger early or pass through an inanimate carrier)
9. **`Turn` (`Past-Reinterpreting Flip`):** Re-read the Foil's or parent's confusing Act-1 behavior in a new emotional/ironic light caused by the rule itself. **Never** rescue via outside accidents (road widening, coincidence) or magic-denial (`"it ran on electricity"`).
10. **`Button` (Final segment, ≤ 12 words):** One deadpan line (`SC-24`) that springs the rule's irony one last time. Zero stated morals (`"bởi vì đôi khi..."`), zero explanations.

## 2b. Spine tests (verify before writing narration)
Every beat in `brief.md` (`## Spine`) and `beats.md` (`## Spine` + `## Plant & Payoff`) must pass these six tests:

| Test | Pass | Fail |
|---|---|---|
| **Want & Handicap** | `"Tôi"` (or family) wants/suffers something concrete by `s4–s7` and acts on it (`SC-25`) | Everyone is described; `"tôi"` only watches |
| **Causal Chain** | Deleting any middle segment breaks the plot (`SC-19`, `SC-26` `- vì thế / - nhưng [sX]`) | Middle segments can be shuffled or deleted (a catalogue) |
| **Active Middle** | Narrator/household acts inside `35%–70%` of segments (`SC-20`) | Protagonist disappears between `s4` and `s20` |
| **Double-Bind** | Both obvious choices fail inside the rule under a deadline (`SC-23`) | First normal attempt succeeds; no ticking pressure |
| **Internal Hack & Plant** | Climax combines Act-1 `Plant` with an internal edge case of the rule (`SC-22`) | Rescue comes from outside (`road project`, `dream`, `no magic`) |
| **Deadpan Button** | Final line `≤ 12` words flips the hook/Foil one last time (`SC-24`) | Stated moral, pun, or preachy wrap-up |

## 3. Sentence rhythm
- Mix long build-ups (14–22 words) with rapid punches (2–5 words). `SC-07` enforces `SD ≥ 3.0`; `SC-09` requires `≥ 6` short sentences (`≤ 5` words, aim for `10+`).
- Put punch lines on their own sentence — often their own short segment (`[Cạch.]`, `[Rắc.]`, `Hết.`).
- Rules of three: establish two parallel beats, break the pattern on the third.
- Deadpan rule: never write `"buồn cười"`, `"hài hước"`, `"bất ngờ thay"`, or explain why a line is ironic.
- Concrete beats abstract: `"chép ra lòng bàn tay"` not `"chuẩn bị kỹ"`. Specific floor numbers, minutes, prices, objects.

## 4. Narrator voice (Hải Đăng, northern)
- First person `"tôi"`, calm, slightly tired, observant.
- Northern vocabulary (`vào, bố, mẹ, lợn, thìa, cốc, bát, đắt, gọi, bảo, hôm đấy, thế, nhỉ, à, chứ`). Never southern (`SC-10`: `tui, hông, nhen, vô nhà, ly nước, dìa, mần, ổng, bả, xài, muỗng, heo`).
- Numbers written in full Vietnamese words in spoken text (`SC-15`: `"mười bảy"`, `"chín linh hai"`, `"mười lăm giây"`).
- Bilingual & expressive phrasing (`voice_standard.json` v2.0):
  - Foreign proper nouns/loanwords (`Graham`, `Henderson`, `London`) are declared in `"english": [...]` at the top of `script.json` (or wrapped in `<en>...</en>` in `tts_text`; `SC-16` checks balanced `<en>` tags and `SC-10` excludes them from dialect checks).
  - Ellipsis (`...` / `…`) is allowed (`no_ellipsis: false` — internal pauses `> 0.32s` are trimmed automatically to `0.16s` in `voice.py`).
  - VieNeu V3 Turbo's 3 native inline emotion tags (`[cười]`, `[thở dài]`, `[hắng giọng]` / `[chuckle]`, `[sigh]`, `[clear throat]`) are allowed (`SC-17`) and stripped automatically from burned-in captions.

## 5. Writing for pictures
Every segment is a picture change; every noun must be drawable in `sv-20` flat 2D riso-ink style. Note the main frame in `beats.md` (`## Segment map`). Avoid large crowds (> ~9 characters), fast vehicles in wide motion, or photorealistic hands.

## 6. script.json format
```json
{"title": "Tiêu đề tập", "voice": "Hải Đăng", "pause_after": 0.18,
 "english": ["Graham", "Henderson"],
 "segments": [
  {"id": "s1", "text": "Ở xóm này, …", "pause_after": 0.3},
  {"id": "s8", "text": "Tôi gặp Graham.", "tts_text": "Tôi gặp <en>Graham</en>."},
  {"id": "s21", "text": "Em biết… Nhưng Mơ chỉ lên bảy một lần.",
   "sentences": [
    {"tts_text": "Em biết…"},
    {"tts_text": "[thở dài] Nhưng Mơ chỉ lên bảy một lần.", "wps": 4.5, "pause_after": 0.3}
   ], "pause_after": 0.45}
 ]}
```
- IDs `s1, s2, ...` strictly ordered (`SC-03`); insert revisions as `s3b` rather than renumbering.
- `pause_after` default `0.18` s (`0.08`–`0.70` s, `SC-18`); `0.3` after a punch; `0.45` before `Turn`.
- Optional `"english"` (top-level or per-segment) auto-wraps whole-word matches in `<en>...</en>` for VieNeu V3 Turbo while keeping `text` captions clean.
- Optional `"wps"` or `"sentences": [...]` fine-tunes speed, `pause_after`, `tts_text`, or `seed` on individual sentences without affecting the rest of the episode.

## 7. Process
1. `premise-ideation.md` Reverse-Design → fill `brief.md` → get user approval (`G1`).
2. Fill `beats.md` (`## Spine` with `[sX]` tags, `## Plant & Payoff`, sections, `## Segment map`) → write `script.json`.
3. `python3 scripts/script_lint.py` → fix every `SC-01..26` error, inspect warnings.
4. Read the entire script aloud mentally at ~4.4 words/s; cut any slack beat that fails the delete-test.
5. Complete all 14 rubric items in `gates/G2.review.md` → send full segment text + estimated duration to the user → `python3 scripts/sv_gate.py pass G2`.

## 8. G2 rubric (14 checks — answer each specifically in `gates/G2.review.md`)
1. **Cognitive Itch (`s1`):** Does `s1` (`≤ 20w`) state the uncanny rule immediately and open an irresistible *"Wait — how?"* question?
2. **Blocker & Cost:** Do `s2–s3` establish visual mechanics, real cost, and block the obvious cheap loophole?
3. **Generative Lens & No Copying:** Which Generative Lens was used (`premise-ideation.md`), and how do rule + hack differ from the closest corpus/channel reference?
4. **Act-1 Ceiling & Pivot Timing:** Does Act 1 end `≤ 42%` of segments (`SC-21`), and does `"tôi"` enter with a personal handicap + Foil by `s7` / `< 40%` (`SC-25`)?
5. **Active Middle (`Delete-Test`):** Is `"tôi"` actively acting in `35%–70%` (`SC-20`), and does removing any middle segment break the `- vì thế / - nhưng` chain (`SC-19`, `SC-26`)?
6. **Plant -> Payoff:** Which concrete detail planted in `≤ 45%` becomes the mechanical key in `≥ 65%` (`SC-22`)?
7. **Ticking Crisis & Failed Fixes:** What deadline strikes at `Crisis`, and why do 2–3 normal attempts fail (`SC-23`)?
8. **Double-Bind Trap:** What are Choice A and Choice B at `Bind`, and why does choosing either normally fail?
9. **Lateral Rule-Hack & Cost:** Which internal hack operator solves the trap from *inside* the rule's physics, and what price does the hero pay?
10. **Past-Reinterpreting Turn:** How does `Turn` re-read the Foil's or parent's Act-1 behavior without outside rescues or magic-denial (`SC-24`)?
11. **Deadpan Button:** Is the final segment `≤ 12` words, free of stated morals (`SC-24`), and does it land one final ironic flip?
12. **Rhythm & Punch:** Are there `≥ 6` (aim `10+`) short sentences `≤ 5` words (`SC-09`) and `SD ≥ 3.0` (`SC-07`) with zero joke-explaining?
13. **Northern Ear & Bilingual/Tag Hygiene:** Zero southern words (`SC-10`), zero digits in spoken text (`SC-15`), balanced `<en>...</en>` bilingual tags (`SC-16`), and only valid VieNeu emotion tags (`SC-17`)?
14. **Visual Drawability:** Can every row of `## Segment map` be drawn in one `sv-20` frame?
