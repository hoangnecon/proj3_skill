---
name: sv-10-script
description: Write the narration script of a 1.75–2.65 minute Vietnamese story-video Short (450–660w, staccato 7.0–8.5 w/sent) or opt-in 6.5–15.0 minute 16:9 adventure movie — from premise ideation and brief.md (Archetype, World and Tone, Scope Economy, 5-Knot Spine) to beats.md and script.json (native 1.0x 4.70 ups Hải Đăng northern voice, 20–24% pause breathing, Corpus DNA DB), passing script_lint.py (SC-01..27, SC-29..43) and gates G1–G2. Use whenever you create, pitch, rewrite, shorten, or punch up an episode's premise, brief, beats, or narration text.
---

# sv-10 · Script (gates G1 brief, G2 script · `v5.9.0`)

The script is the spine: the shots cut on its words, the voice reads it, the music follows its beats.
A weak script cannot be saved by pictures. This skill turns an idea into `brief.md`, `beats.md` and
`script.json` that pass measured structural, corpus-calibrated breathability/anti-ramble (`standards/script_dna_db.json`, `SC-38..43`), 10-year-old clarity, emotional-triad, episodic-unit, and native 1.0× voice rhythm checks (`SC-01..27`, `SC-29..43`) and the user's approval.

## Read first
1. `sv-01-series-bible/SKILL.md` — three archetypes (`Personal Rule-Trap`, `Systemic Satire`, `Hybrid VN Trap`), premise test, banned premise traps, no-copying rule.
2. `references/script-dna-playbook.md` — **10 Corpus-Proven Storytelling & Breathability Laws** distilled from 41 `SCRIPT_YOUTUBE` folders (`standards/script_dna_db.json`), anti-ramble ceilings (`SC-38..43`), and the `bo-lac` Before/After calibration study.
3. `references/premise-ideation.md` — 4 Generative Lenses, **Published-Hits DNA**, Reverse-Design Protocol, and the **4-Pitch → Cross-Critique → Blind Judge** ideation protocol.
4. `references/craft.md` — 3-Act / 10-Beat 5-Knot Engine, rhythm, northern wording, `script.json` format, 14-point rubric.
5. `references/exemplar.md` — *Thang máy ăn bí mật*: study **only** for northern voice, concrete details, and sentence-length rhythm (`SD 4.3`); read the `v3.4.0` warning banner at the top before outlining structure.

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
6. `script.json`: Write segment by segment from the map while reading `references/craft.md §3–5` (and the Long-Form & 10-Year-Old Storytelling Law below for `"length": "long_16x9"`, including top-level `"units"`).
7. Run `python3 scripts/script_lint.py` → fix every `SC-01..27` / `SC-29..37` error and review every warning (plus any `NOTE` on ultra-short onomatopoeia lines).
8. Self-review in `gates/G2.review.md`: answer all **14 rubric questions** (`references/craft.md §8`) with exact segment IDs and note what you changed (for `long_16x9`, also run the independent Adversarial Story Doctor → `qa/story_doctor.json`).
9. Send the user the full narration text (segment IDs + text) and estimated runtime. Revise until approved; quote them and run `python3 scripts/sv_gate.py pass G2`.

## Long-Form & 10-Year-Old Storytelling Law (`SC-32..37`)
1. **Linear Worldbuilding (`SC-32`):** Establish the everyday relatable kid world (classroom, schoolyard, home) + character quirk clearly in `s1..s5`, then trigger the clear 1-sentence physical rule linearly by `s6..s10` (and include `## World & Tone` / `## Thiết lập thế giới` in `brief.md`) — **NEVER** start with a confusing multi-location flash-forward followed by `"Mọi chuyện bắt đầu ba phút trước"`!
2. **Crystal-Clear 3-Sentence Kid Hook & Plain Spoken Sentences (`SC-33`, `SC-36`):** Open `s1..s3` with an immediate wonder/curiosity cue (`?` or `tưởng tượng / chuyện gì / điều gì / bỗng dưng / bất ngờ / bí mật / kỳ lạ / tí hon / thu nhỏ / khổng lồ`) that a 10-year-old grasps on first listen. Every spoken sentence in `s1..s5` must be `≤ 18` words (`SC-36`); episode-wide keep segments `≤ 26` words (hard max `30`), display sentences `≤ 21` words (`SC-33`), and spoken sentences `≤ 24` words with mean `≤ 15.5` words (`target 9–14` words/sentence; never glue clauses together in `tts_text`!). Ban both stiff adult clichés (`SC-33`) and textbook mechanical jargon (`"đòn bẩy loại một"`, `"cấu trúc đòn bẩy"`, `"tâm điểm tựa"`, `"khóa chốt tự động"`, `"cơ chế thu phóng"`, `"hệ thống quang học"` — `SC-36`): explain mechanics through tactile kid props (*"bập bênh bút chì"*, *"nút bấm màu xanh"*).
3. **Emotional Triad & Live Kid Dialogue (`SC-34`):** Weave **Cute/Funny** (`≥ 20%` target, `≥ 16%` hard floor of segments with direct quoted kid banter `“...”` instead of dry `"cậu ta bảo..."` indirect summary), **Spooky-Fun Goosebumps** (creaking floor, glowing cat eyes in dark desk cavern, hushed `"Suỵt…"`), and **Miniature/World Curiosity** (discovering how ordinary school things transform at 3cm) — with `≥ 3` vivid beats in each register.
4. **Native 1.0× `4.70` ups Voice Integrity — Zero Artificial Speed Warping (`SC-35`, `v3.0`):** **ALL** formats (9:16 Shorts AND `6.5–15 min` `long_16x9`) run at the corpus-calibrated native 1.0× **`4.70` ups Hải Đăng** standard (`pitch_ratio: 1.00`, `blend_raw: 0.65`, `default_pause_after_s: 0.30 s`, `mean pause_after` inside `[0.16, 0.55] s`, natural `20–24%` audio pause breathing room). **NEVER** speed up voice to squeeze bloated prose! Top-level `script.wps` outside `[4.45, 4.90]` or segment/sentence `wps` outside `[4.15, 5.05]` is an **error**, and custom `wps` on `> 10%` of segments warns.
5. **Episodic `"units"` Chapter Plan (`SC-37`):** Every `long_16x9` `script.json` MUST declare `"units"` as `4–9` standalone episodic chapters (`12–45` segments / `~2–2.5 min` each, e.g. `{"id": "U1", "title": "...", "seg_start": "s1", "seg_end": "s24", "scale_mode": "normal|tiny|mixed"}`) partitioning `s1..sLast` contiguously in exact order (`U1..Uk`) with `0` gaps and `0` overlaps, built and validated one unit at a time.

## Lint rules (`scripts/script_lint.py` → `qa/script_lint.json` · reads `standards/script_dna_db.json`)
| Rule | Checks |
|---|---|
| SC-01/02 | title not DEMO; voice is Hải Đăng |
| SC-03 | ids `s1, s2, …` unique and ordered (`s3b` allowed) |
| SC-04 | 20–36 segments on Shorts (`standards/pacing.json` v3.0) |
| SC-05 | 450–660 spoken words (sweet spot `500–620w`) and estimated `105–160 s` (target `135 s`) at native 1.0× `4.70 ups` Hải Đăng |
| SC-06 | `≤ 34` words/seg on Shorts (warn `> 26w`; `≤ 45w` on `long`) |
| SC-07 | sentence length SD ≥ 3.0 |
| SC-08 | no sentence `> 20` words on Shorts (warn `19–20w`; `≤ 24w` on `long`) |
| SC-09 | ≥ 6 short sentences ≤ 5 words (error if < 6, warn if < 10) |
| SC-10 | southern words (error) / southern-leaning words (warning), excluding `<en>...</en>` spans |
| SC-11 | repeated phrases |
| SC-12/13 | `beats.md` required sections present (no TODO); segment map covers every id |
| SC-14 | `s1` ≤ 18 words on Shorts (`≤ 20w` on `long`) |
| SC-15 | no digits in spoken text (`voice_standard.json`) |
| SC-16 | balanced `<en>...</en>` bilingual tags (`...`, `…`, `—` allowed) |
| SC-17 | only supported VieNeu inline emotion tags (`[cười]`, `[thở dài]`, `[hắng giọng]`, `[chuckle]`, `[sigh]`, `[clear throat]`) |
| SC-18 | `pause_after` `0.12–1.20 s` (allows deliberate silent visual hold beats!) |
| SC-19 | `beats.md ## Spine` has ≥ 4 `- vì thế …` / `- nhưng …` causal lines |
| SC-20 | active protagonist/family agency in ≥ 25% of middle segments (`35%–70%`) |
| SC-21 | Act-1 setup/world ceiling ≤ 42% of segments (warn `> 35%` via `SC-43`) + narrator enters by `s7` |
| SC-22 | `beats.md ## Plant & Payoff` cites valid `Plant: s<early>` (`≤ 45%`) and `Payoff: s<late>` (`≥ 65%`) |
| SC-23 | `brief.md` declares valid `## Archetype` (`Personal Rule-Trap`, `Systemic Satire`, `Hybrid VN Trap`); warns if trap archetypes lack urgency/clock cues in `35%–85%` |
| SC-24 | final `Button` segment ≤ 12 words (warn 13–14, error > 14); last 3 segments forbid stated-moral clichés and magic-denial twists |
| SC-25 | personal pivot timing: first-person enters in `s1..s7` AND `## Segment map` has `Pivot`/`Handicap`/`Want` < 40% |
| SC-26 | every `- vì thế` / `- nhưng` line in `beats.md ## Spine` cites valid `[sN]` / `[sN-sM]` IDs in non-decreasing order |
| SC-27 | `script.json` `"length": "long"` (`660–980` words, `160–240 s`, `30–50` segments) or `"length": "long_16x9"` + `"format": "16:9"` (`1,700–3,800` words, `380–960 s` target `600 s` at native `4.70 ups`, `70–225` segments) needs `brief.md ## Length override` with `user_quote: "…"`. Never edit `pacing.json` per episode. |
| SC-29 | `long_16x9` `beats.md` has 5 structured chapters (`### Chapter/Chương/Hồi 1..5` with `Goal`, `Obstacle`, `Turn`, `Mini-Cliffhanger`/`Ending`, and `[sA-sB]` span `10%–34%` each) |
| SC-30 | `long_16x9` `beats.md ## Plant & Payoff` pairs `≥ 3` distinct `Plant: s<N>` (`≤ 55%`) with `≥ 3` distinct `Payoff: s<M>` (`≥ 60%`, `Plant < Payoff`) |
| SC-31 | `long_16x9` `beats.md ## Spine` has `≥ 12` causal `- vì thế` / `- nhưng` `[sA-sB]` links; warns on `> 15`-segment narrative gaps |
| SC-32 | Linear worldbuilding guard: bans disorienting opening flashback-rewinds in `s1..s15` |
| SC-33 | 10-year-old readability & anti-bloated-prose guard: bans stiff adult clichés (`long_16x9` `≤ 30w/seg`, `≤ 21w/sent`) |
| SC-34 | `long_16x9` Emotional Triad & live kid dialogue guard (`≥ 16%` direct quotes) |
| SC-35 | Native 1.0× `4.70 ups` voice-integrity guard: bans artificial speed warping (`script.wps` outside `[4.45, 4.90]`, seg `wps` outside `[4.15, 5.05]`, `> 10%` custom `wps` warn) and checks `mean pause_after` in `[0.16, 0.55] s` |
| SC-36 | `long_16x9` spoken hook & plain kid-sentence guard (`≤ 18w` in `s1..s5`, zero mechanical jargon) |
| SC-37 | `long_16x9` episodic `"units"` chapter plan (`4–9` contiguous `U1..Uk`, `12–45` segments/unit) |
| SC-38 | **Prose Breathability & Clause Density (`script_dna_db.json`):** Short mean `≤ 8.8w/sent` (ERR `> 9.5`), `≥ 35%` sentences `≤ 6w` (ERR `< 28%`), mean `≤ 6.0w/clause` (ERR `> 6.5`), max `2` consecutive `≥ 15w` sentences |
| SC-39 | **Short Live Dialogue & Anti-Melodrama:** requires `≥ 3` direct quotes (`“...”`) on Shorts (target `4–8`, unless `Deadpan Satire`), flags indirect emotional summaries & AI melodrama clichés (`≥ 4` = ERR) |
| SC-40 | **Short Scope Economy (Anti-Ramble Ceiling):** `brief.md` caps core story scope at `≤ 3–4` named active characters (ERR `≥ 5`), `≤ 3–4` core locations (ERR `≥ 5`; expand each into 3–4 connected spatial sub-scenes in G4!), and `≤ 3–4` plot props (ERR `≥ 5`) |
| SC-41 | **Peak Segment WPS & Dramatic Breath Budget:** no segment `> 4.85` est. wps (ERR), `Hook`/`Payoff`/`Hack`/`Turn` `≤ 4.35` wps (WARN), and `≥ 3` dramatic breath pauses `≥ 0.45 s` (WARN) |
| SC-42 | **One-Spine / Stealth Plant / Show-Don't-Overexplain:** warns on Act-1 Elder/Authority loophole lectures; errors on late final-25% backstory-dump markers |
| SC-43 | **Tighter Opening Hook & Early Personal Stakes:** `s1+s2 ≤ 32w` (WARN), first-person stakes enter `≤ 28%` of words (WARN), Act 1 `≤ 35%` of segments (WARN) |

## Rules
- Narrator: first person, northern Vietnamese. Zero southern words, zero internet slang. Foreign proper nouns or loanwords (`Graham`, `Henderson`, `London`) keep clean spelling in `text` and are declared in `"english": [...]` at the top of `script.json` (or wrapped in `<en>...</en>` in `tts_text`). Ellipsis (`...` / `…`), em-dash (`—`), and native VieNeu emotion tags (`[cười]`, `[thở dài]`, `[hắng giọng]`) are allowed where expressive phrasing earns them (stripped automatically from burned-in captions).
- **Tone & World-First Flow (`v5.9.0`):** Stories do **NOT** have to be funny (`0%` pure comedy in the 41-folder corpus — humor wraps heart or uncanny mystery). Follow the **10 Corpus DNA Laws** (`references/script-dna-playbook.md`): 1 rule, 1 spine, 2–3 core characters, staccato `7.0–8.5 w/sent` rhythm, 4–8 crisp direct quotes, stealth plant, Show & Withhold, and `3–5` explicit breath pauses (`0.45–1.0 s`).
- One uncanny rule played completely straight. **Never** pad the middle with passive neighbour catalogues, never solve with outside accidents, never deny the magic, and never end with a stated moral.
- Pacing stays locked to `standards/pacing.json` v3.0 at the native 1.0× **`4.70` ups Hải Đăng** voice across **all** formats (`450–660` words sweet spot `500–620w`, `105–160 s` on 9:16 Shorts; `1,700–3,800` words, `380–960 s` on `long_16x9` — never speed up audio to squeeze bloated scripts!).
- After G2 passes, any change to `script.json` or `beats.md` makes G2 and G3 STALE.

## Failure → fix
| Problem | Fix |
|---|---|
| `SC-07` / `SC-09` / `SC-38` dense breathless prose | Split packed clauses (`≤ 5.8w/clause`); target `38–50%` short `2–6w` sentences and mean `7.0–8.5 w/sent` |
| `SC-39` / `SC-42` dry summary, melodrama, or Elder lecture | Replace `"bà bảo..."` / `"già làng kể..."` with crisp `≤ 12w` live quotes (`“...”`), cut AI clichés, and disguise the Act-3 key inside a casual everyday habit |
| `SC-40` / `SC-43` rambling multi-plot Short | Cut to `1` spine, `2–3` core named characters, `2–3` core locations, `1–3` plot props; pivot to `"Còn tôi..."` before `25%` |
| `SC-41` / `SC-35` rushed climax or warped `wps` | Remove custom `wps > 5.05`, add `pause_after: 0.50–1.00` on Hook/Twist/Button, keep `90–100%` at native `4.70` ups |
| `SC-20` / `SC-21` / `SC-22` / `SC-26` weak spine | Map `Plant` (`≤ 45%`) to `Payoff` (`≥ 65%`), anchor every `- vì thế / - nhưng` line to `[sX]`, keep Act 1 `≤ 35%` |
| `SC-24` weak/preachy ending | Cut stated moral and magic-denial; close on a `≤ 12w` callback button |
| Segment you cannot picture | Rewrite around one concrete `sv-20` prop, state meter, or location |
