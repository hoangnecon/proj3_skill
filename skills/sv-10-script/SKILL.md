---
name: sv-10-script
description: Write the narration script of a 2–3 minute Vietnamese story-video episode — from premise ideation and brief.md (Archetype, 5-Knot Spine, Surface Blocker) to beats.md (causal chain, Plant-to-Payoff, Act-1 ceiling) and script.json in Hải Đăng's deadpan northern voice, passing script_lint.py (SC-01..26) and gates G1–G2. Use whenever you create, pitch, rewrite, shorten, or punch up an episode's premise, brief, beats, or narration text.
---

# sv-10 · Script (gates G1 brief, G2 script)

The script is the spine: the shots cut on its words, the voice reads it, the music follows its beats.
A weak script cannot be saved by pictures. This skill turns an idea into `brief.md`, `beats.md` and
`script.json` that pass measured structural + rhythm checks (`SC-01..26`) and the user's approval.

## Read first
1. `sv-01-series-bible/SKILL.md` — three archetypes (`Personal Rule-Trap`, `Systemic Satire`, `Hybrid VN Trap`), premise test, banned premise traps, no-copying rule.
2. `references/premise-ideation.md` — 4 Generative Lenses and Reverse-Design Protocol (designing the Lateral Rule-Hack and Double-Bind before `s1`).
3. `references/craft.md` — 548-script survey benchmarks, 3-Act / 10-Beat 5-Knot Engine, rhythm, northern wording, `script.json` format, 14-point rubric.
4. `references/exemplar.md` — *Thang máy ăn bí mật*: study **only** for northern voice, concrete details, and sentence-length rhythm (`SD 4.3`); read the `v3.4.0` warning banner at the top before outlining structure.

## Workflow
### G1 — brief
1. Use `references/premise-ideation.md` (Reverse-Design Protocol) to invent **3 candidate premises** spanning distinct Generative Lenses. Every candidate must pass `sv-01` Premise Test and avoid all Banned Premise Traps. Pitch each in 2–3 crisp lines (rule `s1` + blocker + personal handicap + double-bind & hack). Let the user pick (or pick if delegated, and quote them).
2. Fill `brief.md`: `## Archetype` (`Personal Rule-Trap | Systemic Satire | Hybrid VN Trap` + Generative Lens), `## Premise` (`s1`, visual state, surface-loophole blocker), `## Spine` (5-Knot Engine: Want/Handicap + Foil, Plant, Crisis + Ticking Clock, Double-Bind, Lateral Rule-Hack + Cost, Past-Reinterpreting Turn), `## Why it is funny`, `## Characters`, `## Locations`, `## Ending` (`≤ 12w` deadpan button), and `## Not copying`.
3. Show `brief.md`; get approval. Fill `gates/G1.review.md` (`verdict: pass`, `approval: user|delegated`, `user_quote`).
4. Run `python3 scripts/sv_gate.py pass G1`.

### G2 — beats and script
5. `beats.md`: Write `## Spine` first (each `- vì thế …` / `- nhưng …` line tagged with `[sN]` or `[sN-sM]`), then `## Plant & Payoff` (`Plant: sX — ...` in `≤ 45%`, `Payoff: sY — ...` in `≥ 65%`), the six beat summaries (`Hook`, `Setup`, `Escalation`, `Turn`, `Payoff`, `Button`), and the full `## Segment map` (`| seg | beat | hình ảnh chính |`) using clear beat labels (`Hook`, `Setup`, `World`, `Pivot`, `Plant`, `Crisis`, `Bind`, `Hack`, `Turn`, `Button` — or `Escalation`/`Payoff` for `Systemic Satire`). Keep Act 1 `≤ 42%` of segments.
6. `script.json`: Write segment by segment from the map while reading `references/craft.md §3–5`.
7. Run `python3 scripts/script_lint.py` → fix every `SC-01..26` error and review every warning.
8. Self-review in `gates/G2.review.md`: answer all **14 rubric questions** (`references/craft.md §8`) with exact segment IDs and note what you changed.
9. Send the user the full narration text (segment IDs + text) and estimated runtime. Revise until approved; quote them and run `python3 scripts/sv_gate.py pass G2`.

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
| SC-27 | `script.json` `"length": "long"` (opt-in, for an adapted story the user wants kept longer than 2–3 min) needs `brief.md ## Length override` with `user_quote: "…"`; the budget becomes `episode_long` in `pacing.json` (860–1150 words, 170–240 s, 34–52 segments). Never edit `pacing.json` per episode. |

## Rules
- Narrator: first person, northern Vietnamese. Zero southern words, zero internet slang. Foreign proper nouns or loanwords (`Graham`, `Henderson`, `London`) keep clean spelling in `text` and are declared in `"english": [...]` at the top of `script.json` (or wrapped in `<en>...</en>` in `tts_text`). Ellipsis (`...` / `…`) and native VieNeu emotion tags (`[cười]`, `[thở dài]`, `[hắng giọng]`) are allowed where expressive phrasing earns them (stripped automatically from burned-in captions).
- One uncanny rule played completely straight. **Never** pad the middle with passive neighbour catalogues, never solve with outside accidents, never deny the magic, and never end with a stated moral.
- Pacing stays locked to `standards/pacing.json` (`620–860` words, `125–170` s at `5.25` ups per-sentence rhythm; individual segments or `sentences` may fine-tune `wps` and `pause_after` for dramatic turns). Fix bloat by tightening Act 1 to `≤ 42%`.
- After G2 passes, any change to `script.json` or `beats.md` makes G2 and G3 STALE.

## Failure → fix
| Problem | Fix |
|---|---|
| `SC-07` / `SC-09` flat rhythm | Split a long build-up into setup + 3-word punch; aim for 10+ short sentences (`≤ 5w`) |
| `SC-20` / `SC-21` catalogue middle | Cut passive neighbour gags back to `≤ 42%`; bring `"Còn tôi?"` to `≤ s7` and launch `Crisis` by ~40% |
| `SC-22` / `SC-26` disconnected spine | Map `Plant` (`≤ 45%`) to `Payoff` (`≥ 65%`) and anchor every `- vì thế / - nhưng` line to `[sX]` |
| `SC-24` weak/preachy ending | Cut stated moral (`"bởi vì đôi khi..."`) and magic-denial; replace with a `≤ 10w` deadpan flip |
| Segment you cannot picture | Rewrite around one concrete `sv-20` prop, state meter, or location |
