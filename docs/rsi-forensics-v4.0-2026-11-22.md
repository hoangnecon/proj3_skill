# RSI Forensic Post-Mortem — `story-video-skills` `v4.0.0` → `v4.1.0` (`2026-11-22`)

> **Subject Episode:** `ca-lop-5a-bi-thu-nho-3cm` (`626.17 s`, `228` shots, `116` segments, `3,067` words, `1920×1080`)
> **User Verdict on `v4.0.0` Output:** Fast execution, good hook & premise, **unacceptable Long-Form quality** — flat repetitive visuals, severed mid-air limbs (`thayHaiShoe`), too few sets (`6` vs `≥ 15` needed), too few characters (`7`, effectively `4`), zero 3rd-person / back / 3/4 / cinematic angles, patchy prop stamp-pasting, and a meandering/circular middle script.

---

## 1. Cold Forensic Measurements (`ca-lop-5a-bi-thu-nho-3cm`)

Extracted directly from `qa/shots.json`, `src/episode/shots_ch*.ts`, `qa/review/*.json`, `engine/scripts/*`, and `engine/src/*`:

| Failure Dimension | Measured in `v4.0.0` Run | Why It Failed | Required `v4.1.0` Floor |
|---|---:|---|---:|
| **Distinct Sets / Angle Plates** | **6 sets** (`phongThiNghiem` = **70 shots / 30.7%**) | `sv-02-long-form` asked for only `5–7` sets; `lint.mjs` had **0** minimum-set check (`SE-15` missing) | **`≥ 15` sets / angle plates** across **`≥ 4` camera angles** (`SE-15`) |
| **Unbroken Static-Wall Streaks** | **`38` shots straight (105 s)** on `hanhLangMeoMuop`, **`36` shots (99 s)** on `hemNuiCapSach`, **`33` shots (91 s)** on `phongThiNghiem`, **`27` shots (74 s)** on `matBanThiNghiem` | Zero streak/dominance lint (`SH-16` missing) | **`≤ 10` consecutive shots** per set, **`≤ 18%`** max share (`SH-16`) |
| **Character Views (`445` placements)** | **`402` front (90.3%)**, **`43` side (9.7%)**, **`0` back (0%)**, **`0` 3/4 (0%)** | `engine/src/` ONLY implemented `Person` (front) + `PersonSide` (profile). Engine literally could not render back/OTS or 3/4 views! | **`PersonBack` (`back`) + `Person3Q` (`3q`) + OTS `fg` plane**; `front ≤ 70%`, `back+3q ≥ 15%` (`SH-17`) |
| **Cast Richness** | **7 looks total** (`banKhanhA` 5×, `banKhanhB` 2× → effectively **4 characters** in a "Whole Class 5A" movie) | `CH-09` still warned `princ.length > 4` (Shorts bias!) with no Long-Form cast minimum | **`≥ 10` looks** (`ERROR < 8`, `CH-09` format-aware) |
| **Severed Floating Giant Limbs** | **`thayHaiShoe` (`538 px` tall) floating cut off in mid-air at `y = 380` (`11` shots!)** | Drawn as standalone calf-height prop (`y = [-520..18]`) on `y = 900` inside `1080 px` frame; **zero** frame-exit limb continuity check | **`PR-05` + `GE-19` (ERROR + HOT)**: giant body parts (`Shoe|Foot|Leg|Hand|Arm|Paw`) MUST bleed off frame top/side (`sy0 ≤ 24`) |
| **Static Prop Copy-Paste Fatigue** | `shrinkMachine` **27×**, `giantCat` **26×**, `ladybug` **25×**, `giantAnt` **17×** | Same static prop pasted onto same flat wall with zero layout/angle variety check | **`SH-17`** prop-reuse variety guard + multi-angle sets |
| **16:9 QA Tooling Corruption (CRITICAL BUG)** | `tile.py:22` hardcoded `h = int(w * 1920 / 1080)`; `crops.py:31–39` hardcoded `1080` & `1920`! | Every `1920×1080` contact page, strip, card, and `final_check.jpg` was **squashed 3.16× horizontally into 9:16 vertical cells**; every 16:9 HOT crop **cropped the wrong pixels & threw away `x > 1080`**! | Dynamic aspect detection in `tile.py` (4×3 wide 16:9 contact grid) & dynamic `[W, H]` in `crops.py` |
| **Blind Review Miss Rate** | Blind Reviewers passed **228/228** (`92.5%` first-pass OK) despite glaring visual defects! | (1) Squashed 9:16 contact cells & broken 16:9 crops blinded reviewers; (2) Narrow 8-check micro-rubric judged shots in isolation with zero **framing/severed-limb** or **sequence-variety** criteria | **10-check Long-Form Blind Rubric** (`+ framing`, `+ variety`) + `set_streak` metadata + true 16:9 tiles & crops |
| **Meandering / Circular 10-Min Script** | `script_lint.py` passed `116` segs / `3,067` words with `0 errors`, yet middle felt padded & aimless | `00-de-cuong-kich-ban-10p.md` had ~3 min of plot events stretched to 10 min; `script_lint.py` only checked Shorts rules (`SC-20..26`, 1 single Plant/Payoff, ≥4 spine links) and G2 had **zero** Adversarial Story Doctor review! | **`SC-29` (5 balanced Chapters w/ Goal/Obstacle/Turn/Cliffhanger)**, **`SC-30` (3+ Plants→Payoffs)**, **`SC-31` (≥12 causal spine turns)**, + **Mandatory G2 Adversarial Story Doctor Gate (`qa/story_doctor.json`, score ≥ 80)** |

---

## 2. Generalized Root Causes (Why Models Produced This in `v4.0.0`)

1. **Shorts-to-Long-Form Scaling Fallacy ("Canvas-Only 16:9"):** `v4.0.0` changed `FRAME_W`/`FRAME_H` from `1080×1920` to `1920×1080` and widened the word-count band, but left **Shorts assumptions** intact across the engine (`front`+`side` only), QA scripts (`tile.py`, `crops.py` hardcoded `1080×1920`), cast/set budgets (`5–7` sets, `CH-09` cap at 4 principals), and script linter (1 Plant, 4 spine links). Agents faithfully optimized for every green check — which meant **stretching a Shorts-shaped movie to 4× length**.
2. **Broken Visual Verification Feedback Loop:** Because `tile.py` squashed `1920×1080` frames into vertical `9:16` thumbnails and `crops.py` clamped crops at `x = 1080`, the blind reviewers were literally looking at distorted/wrong evidence. Even when a limb floated cut in half (`thayHaiShoe`), neither `lint.mjs` nor `RUBRIC.md` defined severed partial-body props as a defect class.
3. **Micro-Shot Validation Without Sequence-Level Validation:** All `v3.9`–`v4.0` gates checked shots individually (`GE-01..18`). A video where 38 consecutive shots sit on the exact same wall with the exact same front-facing characters passes 100% of single-shot lints and feels excruciatingly boring to a human viewer.
4. **Word-Count Inflation Without Plot-Density Enforcement:** Without `SC-29..31` and an independent G2 Story Doctor, expanding a 1-page outline to 3,000 words causes an LLM to pad each thin action beat into 6–10 descriptive segments rather than inventing real sub-conflicts, escalations, and turning points every 45–60 seconds.

---

## 3. `v4.1.0` Architectural Fixes Implemented

1. **Pillar 1 — True 16:9 QA & Verification (`tile.py`, `crops.py`, `qa.mjs`, `design.mjs`, `blind_pack.mjs`):** Dynamic aspect ratio in `tile.py` (4×3 wide 16:9 contact grids), dynamic `[W, H]` frame space in `crops.py`, 16:9 `plateCam` fallback in `design.mjs`, 10-check Blind Review (`+ framing`, `+ variety`) with `set_streak` visibility.
2. **Pillar 2 — Cinematic 4-View 2D Engine (`back.tsx`, `threeq.tsx`, `engine.ts`, `Film.tsx`, `sets/types.ts`, `Sheets.tsx`):** Added `PersonBack` (`view: 'back'`), `Person3Q` (`view: '3q'`), foreground Over-The-Shoulder (`fg: true`) plane, subtle `ShotDef.tilt`, `SetDef.angle` metadata, and multi-angle `CastSheet` turnarounds (Front + 3/4 + Back).
3. **Pillar 3 — Anti-Slop, Anti-Repetition & Severed-Limb CI (`geom.mjs`, `lint.mjs`):** Added `SE-15` (≥ 15 sets & ≥ 4 camera angles for `long_16x9`), format-aware `CH-09` (≥ 10 looks), `PR-05` & `GE-19` (ERROR + HOT on severed giant limbs terminating mid-frame), `SH-16` (max 10-shot streak / 18% single-set share), and `SH-17` (`front ≤ 70%`, `back+3q ≥ 15%`, prop reuse variety).
4. **Pillar 4 — Long-Form Narrative Depth & Story Doctor Gate (`script_lint.py`, `sv_gate.py`, `story-doctor-prompt.md`):** Added `SC-29` (5 structured Chapters with Goal/Obstacle/Turn/Cliffhanger), `SC-30` (≥ 3 Plants → Payoffs), `SC-31` (≥ 12 causal Spine links + max 15-segment plot gap), and mandatory G2 Adversarial Story Doctor audit (`qa/story_doctor.json`, score ≥ 80, 0 meandering stretches).
5. **Pillar 5 — Regression Proof (Measured):**
   - `python3 tools/validate_skills.py`: **`11 skills, 122 lint rules implemented, 0 errors, 0 warnings`**.
   - **Read-only audit of `v4.0.0` episode (`ca-lop-5a-bi-thu-nho-3cm`) under `v4.1.0`:**
     - `script_lint.py` blocked with **3 errors**: `SC-29` (missing 5 structured chapters), `SC-30` (`1 < 3` formal Plant/Payoff pairs), `SC-31` (`9 < 12` causal Spine links); `sv_gate.py check G2` also blocks on missing `qa/story_doctor.json`.
     - `lint.mjs design` blocked with **`CH-09`** (`7 < 8` cast), **`SE-15`** (`6 < 15` sets, `0 < 3` angle types), **`PR-05`** (`thayHaiShoe 538 px < 720 px`).
     - `lint.mjs shots` blocked with **`GE-19`** (9 shots of floating severed `thayHaiShoe`: `#3, #4, #23, #25, #32, #36, #147, #153, #154`), **`SH-16`** (8 unbroken streaks `14–38` shots + `phongThiNghiem` `30.7%`), and **`SH-17`** (`front 90.3% > 70%`, `back + 3q = 0% < 15%`).
   - **Backward compatibility (`9:16` Short `bench-v39-loop2`):** `0 errors` (`1` advisory `WARN [SE-15]` for 3 sets).
   - **Live 4-View Rig Verification (`new_episode.sh --demo`):** `npx tsc --noEmit` exit `0`, `324/324` SVG renders (`0` NaN/undefined), and `cast_exemplar_p1_v.jpg` visually verified showing cohesive **Front + 3/4 + Back** riso-ink turnarounds across all 10 exemplar looks.
