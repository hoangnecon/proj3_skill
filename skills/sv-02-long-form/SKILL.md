---
name: sv-02-long-form
description: Complete production standard for 10-minute (8–12 min, 2,200–3,600 words, 75–160 segments) 16:9 widescreen (1920×1080) Vietnamese animated story videos — opt-in script/brief flags, 5-chapter retention architecture with Inductive Hook and 3+ Plant-to-Payoff knots, 1920×1080 layout (plateCam, wide bounds, caption band, 5–7 sets, multi-pose creatures), strict G1–G7 gates, bundle/chunk caching, blind_sha review, and lean swarm orchestration. Use whenever creating, pitching, scripting, designing, blocking, rendering, or delivering a 10-minute 16:9 episode.
---

# sv-02 · Long-Form 16:9 Production Standard (10-Minute Widescreen)

This skill extends the core `sv-00`–`sv-42` suite to **10-minute (`8–12 min`) 16:9 widescreen (`1920×1080`)** animated story videos for the `Nhím Là Lốp` audience. It keeps **100% of the suite's strict Gate (`G1–G7`), Content-Hash, Cache, and Anti-Bypass Blind Review discipline** while adapting narrative pacing, widescreen framing, set budget, and chunked rendering for 10-minute scale.

## Read first
1. `references/ideation-system-prompt.md` — reusable **4-Agent Pitch → Cross-Critique → Blind Reviewer** system prompt, `Nhím Là Lốp` Winning DNA, Mandatory Inductive Hook (`Hook Quy Nạp`), and **100-Point Blind Judge Scorecard** for **G1**.
2. `sv-00-pipeline/SKILL.md` — gate dependencies (`G1 → G2 → G3; G1 → G4; G3+G4 → G5; G3+G5 → G6; G5+G6 → G7`), render lock (`qa/.render.lock`), and house rules.

---

## 1. Opt-In & Length Budget (`G1` / `G2`)

A long-form 16:9 episode is an **explicit opt-in** (never the default 2–3 min Short):

- **`script.json`**: Set both `"format": "16:9"` and `"length": "long_16x9"` at the top level.
- **`brief.md`**: Include `## Length override` with `user_quote: "<exact user instruction>"` (same discipline as `SC-27`; never edit `standards/pacing.json` per episode).

| Metric | 16:9 Long-Form Target | Notes |
|---|---|---|
| Runtime | **8–12 min** (`480–720 s`, target ~`600 s`) | At Hải Đăng ~5.25 ups per-sentence rhythm |
| Spoken words | **2,200–3,600 words** | ~440–720 words per chapter |
| Segments | **75–160 segments** | ~15–32 segments per chapter |
| Shots | **200–360 shots** | `PC-01..03` cutting rhythm (~2.0–3.0 s mean, 20–28 shots/min) |
| Sets | **5–7 rich sets** | Six-pass riso-ink density (`SE-01..14`, `TK-01..03`) |

All core script lints (`SC-01..27`) still apply: northern Hải Đăng voice, no digits in spoken text (`SC-15`), balanced `<en>...</en>` tags (`SC-16`), supported VieNeu tags (`SC-17`), sentence length SD ≥ 3.0 (`SC-07`), no sentence > 24 words (`SC-08`), causal spine (`SC-19`, `SC-26`), and no stated-moral / magic-denial endings (`SC-24`).

---

## 2. 5-Chapter 10-Minute Pacing Architecture (`G1` / `G2`)

Shorts rely on a single 5-Knot Spine; 10-minute videos fail if they stretch one Short premise thin. Structure `beats.md` and `script.json` into **5 escalating chapters** with a **curiosity reset every ~2 minutes**:

1. **Inductive Hook (`0:00–0:25`, `s1–s5`) — Mandatory `Hook Quy Nạp`:**
   - Drop straight into the **dramatic crisis, chase, impostor threat, or survival problem** at `0:00`.
   - **Never** open with a textbook world-building lecture. Induce the world rule *from* the immediate crisis (*show the danger first → reveal the rule that explains why it's happening*).
   - Slam the **Surface-Loophole Blocker** early so viewers know nobody can cheese the rule.
2. **Chapter 1 — The Rule & Group Contrast (`0:25–2:00`):**
   - Establish **Nhím** + best-friend / sibling / family bond and distinct **power/trait tiers or group contrasts (`Group A vs Group B vs Group C`)**.
   - Embed **Plant #1** and **Plant #2** casually.
   - **2:00 Mini-Cliffhanger / Reveal:** The rule mutates or a hidden tier/threat surfaces.
3. **Chapter 2 — First Escalation & Active Test (`2:00–4:00`):**
   - Nhím and allies actively test or exploit the rule (`SC-20` agency); embed **Plant #3**.
   - **4:00 Mini-Cliffhanger / Reveal:** A trusted ally's secret, an impostor clue, or a ticking-clock trap snaps shut.
4. **Chapter 3 — Midpoint Reversal & Deeper Stakes (`4:00–6:00`):**
   - The apparent advantage backfires; Group A/B/C hierarchy flips or the environment turns hostile.
   - **6:00 Mini-Cliffhanger / Reveal:** The true cost of the rule is exposed; someone close is in direct danger.
5. **Chapter 4 — Darkest Hour & Double-Bind (`6:00–8:00`):**
   - Construct the **Double-Bind**: Option A (obeying the rule normally) loses what Nhím loves; Option B (breaking/ignoring it) triggers disaster.
   - **8:00 Mini-Cliffhanger / Reveal:** Nhím discovers how **Plants #1–#3** connect into a **Lateral Rule-Hack**.
6. **Chapter 5 — Climax, Payoffs & Open Ending (`8:00–10:00`):**
   - Execute the **Lateral Rule-Hack** (paying off **3+ Plants** cleanly, zero luck/deus ex machina).
   - Deliver the emotional payoff for the best-friend/family/sibling bond.
   - Close with an **open / series-capable ending**: the immediate crisis is solved, but a lingering mystery, new tier, or sequel hook invites the next episode (`SC-24`: no preachy moral, no magic-denial).

---

## 3. 16:9 Widescreen Visual Layout (`G4` / `G5`)

Widescreen `1920×1080` changes staging, camera math, and asset density:

| Parameter | 9:16 Short | 16:9 Long-Form | Lint / Rule |
|---|---|---|---|
| Composition | `1080×1920`, `30 fps` | **`1920×1080`, `30 fps`** | `deliver.mjs`, `sv_gate.py` |
| `plateCam` | `[540, 1150, 1]` | **`[960, 540, 1]`** | `SE-14`, `design.mjs` |
| Set `bounds` | vertical | **`[-240, -120, 2160, 1200]`** (min) | `SE-05`, `CA-05` |
| Caption band | bottom vertical band | **`y = 880..1000`** | `OV-03`, `GE-04` |
| Sets per episode | 2–3 sets | **5–7 rich sets** | `SE-01..14` |

### Staging & Asset Rules for 16:9
- **Horizontal composition:** Use the `1920 px` width for two-shot / three-shot group contrasts (`Group A vs Group B vs Group C`), depth layers (foreground silhouette, midground action, background life `SE-12`), and motivated horizontal pans/follows (`CA-01..05`).
- **Keep caption band clear (`y = 880..1000`):** Never place actors' heads, vital props, or set signs inside `y = 880..1000` (`OV-03`, `GE-04`, `GE-11`).
- **Multi-pose creatures & props:**
  - `PR-03`: Never create disembodied `*Head` world props when a full-body prop/creature exists — use full-body multi-pose props/actors instead.
  - `PR-04`: Custom `HAND_PROPS` must keep grip origin `(0, 0)` within `<= 120 px` of the prop and max dimension `<= 380 px`.
  - All cast/set/prop lints (`CH-01..10`, `TK-01..03`, `SE-01..14`, `PR-01..04`) and shot/motion/geometry lints (`SH-01..15`, `AN-01..02`, `OV-01..04`, `CA-01..05`, `SZ-01..02`, `MO-01..12`, `KY-01`, `CO-01..03`, `PC-01..03`, `GE-01`, `GE-04`, `GE-07`, `GE-10`, `GE-11`, `GE-15..18`) apply with zero unwaived errors.

---

## 4. Strict Gate, Hash, Cache & Anti-Bypass Blind Review Discipline

Long-form episodes follow the **exact same G1–G7 integrity rules** as Shorts — never skip gates or eyeball unverified renders:

1. **G1 (Brief) & G2 (Script + Beats):**
   - Run `references/ideation-system-prompt.md` (4-Agent Pitch → Cross-Critique → Blind Judge) before locking `brief.md`.
   - Run `python3 scripts/script_lint.py` → 0 errors. Get `approval: user` (or `delegated` with `user_quote`) for G1 and G2.
2. **G3 (Voice) ∥ G4 (Cast + 5–7 Sets):**
   - Run `scripts/voice.py` (Hải Đăng preset, `t0.7/k25`, `5.25` ups, `1.02` pitch) and `scripts/design.mjs` (auto-generates `qa/design/visual_spec.json` + `_v.jpg` / `_zoom.jpg` views).
   - Run `node scripts/lint.mjs design` → 0 errors. Get `approval: user` (or `delegated`) and pass G4 via `python3 scripts/sv_gate.py pass G4`.
3. **G5 (Shots + Pre-Flight + Blind Review) ∥ G6 (Mix):**
   - **Pre-flight zero-bounce:** `node scripts/lint.mjs shots` (0 errors) + `node scripts/qa.mjs where <i>` (zero browser) before rendering.
   - **Single-bundle QA & Bundle Cache:** `node scripts/qa.mjs pass changed` uses `scripts/bundle_cache.mjs` (`qa/.bundle_cache/<srcHash>`) so unchanged `src/` skips Webpack bundling (`< 0.1 s`), updates only changed `contact_p*.jpg`, `strips/*.jpg`, `cards/*.jpg`, and HOT `crops/*.jpg`, runs `scripts/carry.py` (`qa/carry.json`), and calls `scripts/blind_pack.mjs` to emit `qa/blind_review/{manifest.json, slice_1..3.json, RUBRIC.md}` with per-shot `blind_sha` tokens.
   - **Anti-Bypass Blind Review:** Independent reviewers (never `reviewer == builder`) inspect only their `slice_*.json` images + narration and submit via `node scripts/qa.mjs review --batch <file.jsonl>` with verbatim `"blind_sha"`. `sv_gate.py pass G5` rejects any missing or mismatched `blind_sha`.
   - **G6 Audio Mix:** Once `qa/timing.json` is stable, run `scripts/mix.py` and `scripts/audio_qa.py` in parallel with G5 visual fixes.
4. **G7 (Chunked Delivery):**
   - Run `SV_CHUNK_RENDER=1 node scripts/deliver.mjs` (uses `scripts/bundle_cache.mjs` + **per-shot chunk cache in `out/_chunks/`** keyed by `globalKey|shotHash|frameRange`). If a 10-minute (`~18,000` frame) render stops or a late visual fix touches 4 shots, only those 4 chunks re-render before `ffmpeg` muxes `public/mix.wav` into `out/final.mp4`.
   - Verify `qa/deliver_report.json`, `qa/final_check.jpg`, and `qa/video_audio.json` (`scripts/audio_qa.py --video out/final.mp4`), pass G7, and send `out/final.mp4`.

---

## 5. Lean Swarm Orchestration for 10-Minute Scale

Because a 10-minute episode has 5–7 sets and 200–360 shots, use lean parallel swarm execution:

- **Conductor (main session):** Owns `sv_gate.py` (`watch --stall 10`, `pass G1..G7`), user approvals, `qa/.render.lock` (strictly one render at a time), and `qa/state.json`.
- **G4 Builders (parallel):** `cast + props` builder ∥ 2–3 `sets` builders (2–3 sets each, writing separate files or set modules).
- **G5 Builders (parallel by chapter):** Assign 1 builder per chapter (`Ch 1–2`, `Ch 3`, `Ch 4–5` segment ranges) so no two builders edit the same shot range; merge cleanly into `src/episode/shotlist.ts`.
- **G5 Blind Reviewers (3-way parallel):** Dispatch 3 reviewers on `qa/blind_review/slice_1.json`, `slice_2.json`, and `slice_3.json`. Kill helpers once their slice is integrated and `sv_gate.py pass G5` succeeds.
