# RSI Loop Report — `story-video-skills` `v3.9.0` (`2026-11-21`)

## 1. Root-Cause Forensics (Baseline `v3.8.0` on `vay-ngoc-rong-san-truong`)
Measured wall-clock on `v3.8.0` (`vay-ngoc-rong-san-truong`, `149.2 s`, `67` shots):
- **V1 total**: **`86m 36s`** (`G1–G4: 31m 16s`, `G5 write+render+review+fix: 47m 11s`, `G6+G7: 6m 53s`).
- **V2 rework**: **`+52m 31s`** (dragon head/body sync, disembodied `*Head` prop, `HAND_PROPS` grip offset, `lopHoc` benches, `rongBow` covering Nhím's face, wide-shot cast continuity drop).
- **Root causes**:
  1. **Zero pre-render CI for the top 6 visual bug classes**: disembodied `*Head` props, broken `HAND_PROPS` grip origins, overlays covering faces or set signs, foreground props/creatures covering faces, consecutive wide-shot cast drops, and floating `seatH`.
  2. **Hash & cache gaps**: `design.mjs` hashed `src/data/*` (so `voice.py` writing `words.json` falsely invalidated all G4 sheets); `qa.mjs`/`design.mjs`/`deliver.mjs` rebuilt Webpack from scratch every run; `voice.py` re-synthesized unchanged passing sentences on re-runs; `deliver.mjs` re-rendered all 4,500 frames even when only a few shots changed.
  3. **Token-heavy G5 review & unverified blindness**: reviewers read 60+ individual cards AND had access to `shotlist.ts` code.
  4. **Monolithic G4 & idle swarm agents**: 1 worker drew all cast, props, and sets sequentially while other agents sat waiting.

## 2. `v3.9.0` Engineering Changes (`rsi/v3.9-fast-pipeline`)
- **Stage-1 Front-Loaded Visual Manifest & Design CI (`geom.mjs`, `lint.mjs`, `design.mjs`)**:
  - Auto-writes `qa/design/visual_spec.json` (cast heights/roles, set bounds/plateCam, `WORLD_PROPS` & `HAND_PROPS` bboxes + `gripDist`).
  - Added **`PR-03`** (bans disembodied `*Head` creature props when full-body prop exists) and **`PR-04`** (`HAND_PROPS` grip-origin distance `<= 120 px`, max dim `<= 380 px`).
  - Fixed `design.mjs` `shared` hash to exclude `src/data/` so parallel `voice.py` never invalidates G4 sheets.
- **Pre-Render Spatial, Occlusion & Continuity CI (`geom.mjs`, `lint.mjs`)**:
  - Added **`GE-16`** (active overlay covering actor face `>20%` WARN / `>55%` ERROR, OR covering set sign `>15%` WARN), **`GE-17`** (foreground world prop covering actor face `>35%`), **`GE-18`** (wide-shot cast continuity drop), and **`MO-12`** (floating `seatH`).
  - `validate_skills.py`: **`10 skills, 114 lint rules implemented, 0 errors, 0 warnings`**.
- **Hash & Cache Acceleration (`bundle_cache.mjs`, `deliver.mjs`, `qa.mjs`, `voice.py`)**:
  - `bundle_cache.mjs`: content-addressed Webpack bundle cache in `qa/.bundle_cache/<srcHash>/` (reused in `<0.1 s`, keeps latest 2).
  - `deliver.mjs`: per-shot content-addressed chunk cache (`out/_chunks/<chunkKey>.mp4` + `ffmpeg concat -c:v copy`) + `concurrency = max(4, min(10, cpus - 2))` while keeping `CRF 18, 1080×1920 @ 30fps, 48kHz AAC 256k` 100% unchanged.
  - `voice.py`: auto-skips unchanged passing sentences by `sp_hash` on re-runs.
- **True Blind Review + Anti-Bypass (`blind_pack.mjs`, `qa.mjs`, `sv_gate.py`)**:
  - `blind_pack.mjs` builds `qa/blind_review/{manifest.json, slice_1..3.json, RUBRIC.md}` containing **ONLY** narration + image paths (grouped by contact page + HOT crops, **-70% vision tokens**, **ZERO `shotlist.ts` code**) and cryptographic `blind_sha`.
  - `qa.mjs review --batch` & `sv_gate.py check G5` enforce matching `blind_sha` for all non-carried reviews.
- **Lean Swarm Blueprint (`sv-00-pipeline/SKILL.md`)**:
  - Orchestrator (`Gemini 4 Neon Medium`) + Executors (`Gemini 4 Hydrogen Medium`); spawn parallel workers ONLY for true parallel stages (`G1–G3 ∥ G4 cast+props ∥ G4 sets`, `G5 blind-rev-1..3 ∥ G6 mix`), kill immediately on completion, run CLI/gate/deliver steps directly.

## 3. Measured Live End-to-End Benchmarks (Zero Bypass, Full Quality, Hydrogen Medium Executors)

| Metric | `v3.8.0` Baseline (`vay-ngoc-rong`) | `v3.9.0` Loop 1 (`bench-v39-dong-ho-nguoc`) | `v3.9.0` Loop 2 (`bench-v39-loop2`) |
|---|---:|---:|---:|
| **Duration / Shots** | `149.2 s` / `67` shots | `138.8 s` / `60` shots | `141.43 s` / `60` shots |
| **G4 Design Wall Time** | `28m 41s` (V1+V2) | **`6m 16s`** (parallel!) | **`11m 41s`** (incl. `design.mjs`) |
| **G5 Write + Render** | `21m 29s` | `15m 27s` | **`10m 37s`** |
| **G5 First-Pass Blind OK Rate** | `68.7%` (`46/67`) | **`90.0%`** (`54/60`) | **`96.7%`** (`58/60`!) |
| **G5 Blind Review Wall Time** | `~6m` (22 cards/rev) | **`2m 24s`** (contact-first!) | **`3m 30s`** (contact-first!) |
| **G5 Total Review + Fix** | `25m 42s` | `14m 18s` | **`7m 40s`** (`2` fixes only!) |
| **G7 `deliver.mjs` Render** | `5m 39s` | `5m 15s` (`bundle: cache hit`) | **`4m 49s`** (`bundle: cache hit`) |
| **End-to-End `T0 → final.mp4` (excl. 1m `npm install`)** | **`86m 36s`** (+`52m` V2) | `41m 16s` *(excl. G3 retry)* | **`45m 24s`** *(full cold `G1→final.mp4`, `02:36:26 → 03:21:50`!)* |
| **Bypass / Quality Drop** | `0` | `0` (`blind_sha` verified) | **`0`** (`blind_sha` verified, `CRF 18`, `0` lint err/warn, `4/4` video-audio ok) |
