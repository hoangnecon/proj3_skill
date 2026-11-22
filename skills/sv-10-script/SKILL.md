---
name: sv-10-script
description: Write the narration script of a 2–3 minute Vietnamese story-video Short or opt-in 8.5–11.5 minute 16:9 kid-friendly adventure movie — from premise ideation and brief.md (Archetype, World and Tone, 5-Knot Spine, Surface Blocker) to beats.md (causal chain, Plant-to-Payoff, 5-Chapter arcs) and script.json in Hải Đăng's northern voice (5.25 ups Short or brisk 5.65 ups Long-Form with dynamic wps contrast), passing script_lint.py (SC-01..27, SC-29..35) and gates G1–G2. Use whenever you create, pitch, rewrite, shorten, or punch up an episode's premise, brief, beats, or narration text.
---

# sv-10 · Script (gates G1 brief, G2 script)

The script is the spine: the shots cut on its words, the voice reads it, the music follows its beats.
A weak script cannot be saved by pictures. This skill turns an idea into `brief.md`, `beats.md` and
`script.json` that pass measured structural, 10-year-old clarity, emotional-triad, and rhythm checks (`SC-01..27`, `SC-29..35`) and the user's approval.

## Read first
1. `sv-01-series-bible/SKILL.md` — three archetypes (`Personal Rule-Trap`, `Systemic Satire`, `Hybrid VN Trap`), premise test, banned premise traps, no-copying rule.
2. `references/premise-ideation.md` — 4 Generative Lenses, **23-Published-Hits DNA** (kids/school-age audience, World-Sorting/Tiers, Survival/Impostor stakes, Relational Cores, `s1–s2` Inductive Hook, 15s clarity / zero math overload, recurring hero **Nhím**), Reverse-Design Protocol, and the **4-Pitch → Cross-Critique → Blind Judge** ideation protocol.
3. `references/craft.md` — 548-script survey benchmarks, 3-Act / 10-Beat 5-Knot Engine, rhythm, northern wording, `script.json` format, 14-point rubric.
4. `references/exemplar.md` — *Thang máy ăn bí mật*: study **only** for northern voice, concrete details, and sentence-length rhythm (`SD 4.3`); read the `v3.4.0` warning banner at the top before outlining structure.

## Workflow
### G1 — brief
1. Use `references/premise-ideation.md` (Reverse-Design Protocol + 23-Hits DNA) to invent **3 candidate premises** spanning distinct Generative Lenses.
   - **High-stakes / fresh Shorts option:** run the **4-Pitch → Cross-Critique → Blind Judge** protocol (`references/premise-ideation.md §5`) — generate 4 distinct pitches, cross-critique for Stranger Test / math overload / Act-3 hack, and blind-judge the survivors before presenting the winner (and runner-up if close).
   - Every candidate must pass `sv-01` Premise Test, avoid all Banned Premise Traps, use an **Inductive Hook (`s1–s2`)**, and keep the core rule explainable to a **10-year-old in 15 seconds** (zero math overload). Pitch each in 2–3 crisp lines (rule `s1` + blocker + relational core/handicap + double-bind & hack). Let the user pick (or pick if delegated, and quote them).
2. Fill `brief.md`: `## Archetype` (`Personal Rule-Trap | Systemic Satire | Hybrid VN Trap` + Generative Lens), `## Premise` (`s1`, visual state, surface-loophole blocker), `## Spine` (5-Knot Engine: Want/Handicap + Foil, Plant, Crisis + Ticking Clock, Double-Bind, Lateral Rule-Hack + Cost, Past-Reinterpreting Turn), `## Why it is funny`, `## Characters`, `## Locations`, `## Ending` (`≤ 12w` deadpan button), and `## Not copying`.
3. Show `brief.md`; get approval. Fill `gates/G1.review.md` (`verdict: pass`, `approval: user|delegated`, `user_quote`).
4. Run `python3 scripts/sv_gate.py pass G1`.

### G2 — beats and script
5. `beats.md`: Write `## Spine` first (each `- vì thế …` / `- nhưng …` line tagged with `[sN]` or `[sN-sM]`), then `## Plant & Payoff` (`Plant: sX — ...` in `≤ 45%`, `Payoff: sY — ...` in `≥ 65%`), the six beat summaries (`Hook`, `Setup`, `Escalation`, `Turn`, `Payoff`, `Button`), and the full `## Segment map` (`| seg | beat | hình ảnh chính |`) using clear beat labels (`Hook`, `Setup`, `World`, `Pivot`, `Plant`, `Crisis`, `Bind`, `Hack`, `Turn`, `Button` — or `Escalation`/`Payoff` for `Systemic Satire`). Keep Act 1 `≤ 42%` of segments.
6. `script.json`: Write segment by segment from the map while reading `references/craft.md §3–5` (and the Long-Form & 10-Year-Old Storytelling Law below for `"length": "long_16x9"`).
7. Run `python3 scripts/script_lint.py` → fix every `SC-01..27` / `SC-29..35` error and review every warning (plus any `NOTE` on ultra-short onomatopoeia lines).
8. Self-review in `gates/G2.review.md`: answer all **14 rubric questions** (`references/craft.md §8`) with exact segment IDs and note what you changed (for `long_16x9`, also run the independent Adversarial Story Doctor → `qa/story_doctor.json`).
9. Send the user the full narration text (segment IDs + text) and estimated runtime. Revise until approved; quote them and run `python3 scripts/sv_gate.py pass G2`.

## Long-Form & 10-Year-Old Storytelling Law (`SC-32..35`)
1. **Linear Worldbuilding (`SC-32`):** Establish the everyday relatable kid world (classroom, schoolyard, home) + character quirk clearly in `s1..s5`, then trigger the clear 1-sentence physical rule linearly by `s6..s10` (and include `## World & Tone` / `## Thiết lập thế giới` in `brief.md`) — **NEVER** start with a confusing multi-location flash-forward followed by `"Mọi chuyện bắt đầu ba phút trước"`!
2. **10-Year-Old Clarity (`SC-33`):** On `long_16x9`, keep every segment `≤ 26` words (hard max `30`) and every sentence `≤ 21` words (`mean ~ 8–10.5` words, warn `> 11.2`). Ban stiff adult/textbook prose (`"bất khả xâm phạm"`, `"gạt bỏ hết hiềm khích"`, `"thế kẹt hai chiều"`, `"bản năng săn mồi lập tức"`); explain clever physics/tricks through tactile kid objects (pencil, eraser, glowing marble, chalk, biscuit), **never** formulas (`F1 × d1`).
3. **Emotional Triad & Live Kid Dialogue (`SC-34`):** Weave **Cute/Funny** (`≥ 20%` target, `≥ 16%` hard floor of segments with direct quoted kid banter `“...”` instead of dry `"cậu ta bảo..."` indirect summary), **Spooky-Fun Goosebumps** (creaking floor, glowing cat eyes in dark desk cavern, hushed `"Suỵt…"`), and **Miniature/World Curiosity** (discovering how ordinary school things transform at 3cm) — with `≥ 3` vivid beats in each register.
4. **Brisk Dynamic Rhythm (`SC-35`):** `long_16x9` runs at brisk **`5.65 ups`** default (`pause_after: 0.12–0.15 s`, mean `≤ 0.20 s`, varied across `0.10 s` rapid exchange / `0.14 s` normal / `0.26–0.38 s` real turns), with `≥ 15%` target (`≥ 12%` floor) of segments explicitly modulating `wps` (`5.9–6.2` on action/panic/banter, `4.7–5.0` on spooky whispers/emotional turns; `≥ 3` fast bursts and `≥ 3` hushed beats).

## Lint rules (`scripts/script_lint.py` → `qa/script_lint.json`)
| Rule | Checks |
|---|---|
| SC-01/02 | title not DEMO; voice is Hải Đăng |
| SC-03 | ids `s1, s2, …` unique and ordered (`s3b` allowed) |
| SC-04 | 22–40 segments (`standards/pacing.json`) |
| SC-05 | 620–860 spoken words and estimated 125–170 s at Hải Đăng 5.25 ups per-sentence rhythm |
| SC-06 | ≤ 45 words per segment |
| SC-07 | sentence length SD ≥ 3.0 |
| SC-08 | no sentence > 24 words |
| SC-09 | ≥ 6 short sentences ≤ 5 words (error if < 6, warn if < 10) |
| SC-10 | southern words (error) / southern-leaning words (warning), excluding `<en>...</en>` spans |
| SC-11 | repeated phrases |
| SC-12/13 | `beats.md` required sections present (no TODO); segment map covers every id |
| SC-14 | `s1` ≤ 20 words |
| SC-15 | no digits in spoken text (`voice_standard.json`) |
| SC-16 | balanced `<en>...</en>` bilingual tags (`...` and `…` ellipsis are allowed) |
| SC-17 | only supported VieNeu inline emotion tags (`[cười]`, `[thở dài]`, `[hắng giọng]`, `[chuckle]`, `[sigh]`, `[clear throat]`) |
| SC-18 | `pause_after` 0.08–0.70 s |
| SC-19 | `beats.md ## Spine` has ≥ 4 `- vì thế …` / `- nhưng …` causal lines |
| SC-20 | active protagonist/family agency in ≥ 25% of middle segments (`35%–70%`) |
| SC-21 | Act-1 setup/world ceiling ≤ 42% of segments (before `Crisis`/`Escalation`/`Bind`) + narrator enters by `s7` |
| SC-22 | `beats.md ## Plant & Payoff` cites valid `Plant: s<early>` (`≤ 45%`) and `Payoff: s<late>` (`≥ 65%`) |
| SC-23 | `brief.md` declares valid `## Archetype` (`Personal Rule-Trap`, `Systemic Satire`, `Hybrid VN Trap`); warns if trap archetypes lack urgency/clock cues in `35%–85%` |
| SC-24 | final `Button` segment ≤ 12 words (warn 13–14, error > 14); last 3 segments forbid stated-moral clichés and magic-denial twists |
| SC-25 | personal pivot timing: first-person enters in `s1..s7` AND `## Segment map` has `Pivot`/`Handicap`/`Want` < 40% |
| SC-26 | every `- vì thế` / `- nhưng` line in `beats.md ## Spine` cites valid `[sN]` / `[sN-sM]` IDs in non-decreasing order |
| SC-27 | `script.json` `"length": "long"` (`episode_long`: `860–1150` words, `170–240 s`, `34–52` segments) or `"length": "long_16x9"` + `"format": "16:9"` (`episode_long_16x9`: `2,400–3,850` words, `480–720 s` target `570 s` at `5.65 ups`, `85–175` segments) needs `brief.md ## Length override` with `user_quote: "…"`. Never edit `pacing.json` per episode. |
| SC-29 | `long_16x9` `beats.md` has 5 structured chapters (`### Chapter/Chương/Hồi 1..5` with `Goal`, `Obstacle`, `Turn`, `Mini-Cliffhanger`/`Ending`, and `[sA-sB]` span `10%–34%` each) |
| SC-30 | `long_16x9` `beats.md ## Plant & Payoff` pairs `≥ 3` distinct `Plant: s<N>` (`≤ 55%`) with `≥ 3` distinct `Payoff: s<M>` (`≥ 60%`, `Plant < Payoff`) |
| SC-31 | `long_16x9` `beats.md ## Spine` has `≥ 12` causal `- vì thế` / `- nhưng` `[sA-sB]` links; warns on `> 15`-segment narrative gaps |
| SC-32 | Linear worldbuilding guard: bans disorienting opening flashback-rewinds (`"mọi chuyện bắt đầu..."`, `"ba phút trước..."`) in `s1..s15` (error on `long_16x9`, warn on Shorts); checks `brief.md` for `## World & Tone` / `## Thiết lập thế giới` on `long_16x9` |
| SC-33 | 10-year-old readability & anti-bloated-prose guard: bans stiff adult clichés (`≥ 2` hits error on `long_16x9`, `1` warn); on `long_16x9` enforces `≤ 30` words/segment (warn `> 26`), `≤ 21` words/sentence, and warns if mean sentence length `> 11.2` |
| SC-34 | `long_16x9` Emotional Triad & live kid dialogue guard: requires `≥ 16%` (min `8`) segments with direct quoted dialogue (`“...”`), warns on `≥ 4` indirect reporting clichés (`"cậu ta bảo..."`, `"giải thích nhanh:..."`), and checks `≥ 3` beats each of Cute/Funny, Spooky-Fun, and Curious |
| SC-35 | `long_16x9` anti-drone dynamic tempo & brisk pause guard: requires explicit `wps` modulation (error if `0`, warn if `< 12%` or `< 3` fast `≥ 5.8` or `< 3` hushed `≤ 5.05`) and brisk `pause_after` (`mean ≤ 0.20 s` error, `> 70%` identical value warn) |

## Rules
- Narrator: first person, northern Vietnamese. Zero southern words, zero internet slang. Foreign proper nouns or loanwords (`Graham`, `Henderson`, `London`) keep clean spelling in `text` and are declared in `"english": [...]` at the top of `script.json` (or wrapped in `<en>...</en>` in `tts_text`). Ellipsis (`...` / `…`) and native VieNeu emotion tags (`[cười]`, `[thở dài]`, `[hắng giọng]`) are allowed where expressive phrasing earns them (stripped automatically from burned-in captions).
- One uncanny rule played completely straight. **Never** pad the middle with passive neighbour catalogues, never solve with outside accidents, never deny the magic, and never end with a stated moral.
- Pacing stays locked to `standards/pacing.json` (`620–860` words, `125–170` s at `5.25` ups on 9:16 Shorts; `2,400–3,850` words, `480–720` s at brisk `5.65` ups + dynamic `wps` contrast on `long_16x9`). Fix bloat by tightening Act 1 to `≤ 42%` and splitting `> 26`-word beats.
- After G2 passes, any change to `script.json` or `beats.md` makes G2 and G3 STALE.

## Failure → fix
| Problem | Fix |
|---|---|
| `SC-07` / `SC-09` flat rhythm | Split a long build-up into setup + 3-word punch; aim for 10+ short sentences (`≤ 5w`) |
| `SC-20` / `SC-21` catalogue middle | Cut passive neighbour gags back to `≤ 42%`; bring `"Còn tôi?"` to `≤ s7` and launch `Crisis` by ~40% |
| `SC-22` / `SC-26` disconnected spine | Map `Plant` (`≤ 45%`) to `Payoff` (`≥ 65%`) and anchor every `- vì thế / - nhưng` line to `[sX]` |
| `SC-24` weak/preachy ending | Cut stated moral (`"bởi vì đôi khi..."`) and magic-denial; replace with a `≤ 10w` deadpan flip |
| `SC-32` / `SC-33` flashback soup or stiff prose | Open linearly in the normal kid world (`s1..s5` → rule `s6..s10`), trim segments to `≤ 26w` / sentences `≤ 21w`, and swap textbook clichés for tactile school props |
| `SC-34` / `SC-35` dry summary or monotone drone | Turn `"cậu ta bảo..."` into live `“...”` kid banter (`≥ 20%`), balance Cute/Spooky-Fun/Curious beats, keep `pause_after` `0.10–0.15 s`, and vary `wps` (`5.9–6.2` fast vs `4.7–5.0` hush) |
| Segment you cannot picture | Rewrite around one concrete `sv-20` prop, state meter, or location |
