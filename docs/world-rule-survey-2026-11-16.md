# World-Rule Shorts Survey Benchmarks (2026-11-16)

Summary of empirical findings used to calibrate `story-video-skills` `v3.4.0` across **548 scripts** (`207` `@VoidCastRants`, `262` across `12` other English channels, `67` across `3` active Vietnamese channels, and `12` local PROJ3 scripts/drafts; `1.21B+` harvested views) and **28 catalogued channels**.

## 1. Key measured findings

1. **Internal Rule-Traps beat external-monster twists by 6.0×:**
   Within VoidCast's `100–179 s` pool, `pure_rule_trap_template` (`n=146`) achieved a median of **2,897,194** views versus **483,023** views (`n=10`) for `verity_monster_template` — even though the latter spoke faster (`4.92` vs `4.39` wps).
2. **Deadpan story buttons beat stated morals by 30×:**
   In the Vietnamese corpus (`n=67`), `story_button_ending` (`n=62`) reached a median of **3,725,737** views versus **121,392** views (`n=5`) for `stated_moral_ending`. In VoidCast (`100–179 s`), top episodes close on a tight button (median `7.0` words).
3. **Act-1 compression & early personal pivot:**
   Across VoidCast's Top 30 episodes, the first-person pivot (`"Me?"` / personal handicap) lands at median **20.4%** (`n=21/30` explicit markers) and the inciting crisis launches at median **37.6%** (`n=18/30`), leaving **~60–65%** of runtime for active crisis escalation, Double-Bind dilemma, and internal rule-hack. By contrast, passive catalogue drafts delayed protagonist action until `50%–70%`.
4. **Rhythm & short-sentence punch density:**
   VoidCast (`n=207`) averages `7.18` words/sentence (`SD 4.39`, median **30.0** short sentences `≤ 5` words) vs PROJ3 local (`n=12`) averaging `10.04` words/sentence (`SD 4.31`, median **7.0** short sentences `≤ 5` words).
5. **Audio transition density (`SFX/min`):**
   Age-controlled VoidCast `100–179 s` Top 10% averaged **2.46 sfx/min** vs **0.93 sfx/min** (`2.65×`) in the Bottom 25%.

## 2. How `v3.4.0` applies these findings (without changing `pacing.json`)

- **Pacing locked (`standards/pacing.json`):** House runtime remains `140–165 s` (`600–720` words, `22–34` segments at `Hải Đăng 1.0×`). Rather than cutting runtime, `v3.4.0` eliminates Act-1 bloat (`SC-21` `≤ 42%` ceiling) so Act 2–3 carry 60%+ of every episode.
- **Three Archetypes (`sv-01`):** `Personal Rule-Trap` (default), `Systemic Satire` (active moves only), and `Hybrid VN Trap`.
- **Four Generative Lenses & Reverse-Design (`sv-10` `premise-ideation.md`):** Guides writers toward curiosity-driven perceptual/physical inversions, strict object state laws, binary split humanity, and backwards personal quirks — explicitly banning arbitrary numeric wrist/step quotas, moral-to-element clichés, and external-rescue/magic-denial twists.
- **Machine Enforcement (`script_lint.py` `SC-09`, `SC-20..26`):** Enforces middle protagonist agency (`35%–70%`), Act-1 ceiling (`≤ 42%`), `Plant -> Payoff` mapping (`≤ 45%` to `≥ 65%`), valid `## Archetype`, `≤ 12w` non-moralizing / non-magic-denial endings, early personal pivot (`s1..s7`, `< 40%`), and `[sX]` segment-ID integrity on every causal line in `beats.md ## Spine`.
