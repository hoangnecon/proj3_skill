---
name: sv-core-bible
description: Shared identity of the Vietnamese 2D story-video series — narrator persona, canonical hero Nhím (CH-11), 3 episode archetypes, premise test, banned premise traps, world motifs, tone limits, and the no-copying rule. Read at Gate G1 before pitching or judging any premise across Short 9:16 or Long 16:9 tracks.
---

# sv-core-bible · Series Identity & Premise Standard

## 1. Visual & Audio Identity (Shared Across Tracks)
- **Visual house style:** Flat "riso ink" 2D illustration (`src/kit.tsx` PAL tokens, ink-navy outlines, halftone dot shadows, paper grain, Be Vietnam Pro typography), animated in Remotion with word-anchored shots.
- **Voice & music:** Narrator **Hải Đăng** (northern male, VieNeu V3 Turbo, natural `pitch_ratio: 1.00`, rhythm calibrated from `standards/voice_standard.json` + track `standards/pacing.json`), mixed with the single series theme (`scripts/theme.py`) under `sv-core-audio`.
- **Track specs:** Exact duration, word count, and shot pacing come strictly from the active track's `standards/pacing.json` (Short `9:16` vs Long `16:9`).

## 2. Narrator & Canonical Hero (`CH-11`)
- **"Tôi" (Narrator):** Ordinary resident inside the story (student, tenant, neighbour, guard, worker) — observant, deadpan, concrete with names, places, and physical details. Never explains the joke or lectures the audience.
- **Canonical New Nhím (`NHIM_LOOK` from `src/chars.tsx`, enforced by `CH-11`):** Swept-up spiky hair with no bangs (`hair: 'spikyUp'`), red backwards snapback cap (`hat: 'capBack'`, `hatC: 'red'`), gold shirt (`topC: 'gold'`, `topC2: 'goldDark'`), navy pants, orange shoes (`w: 0.88, h: 0.86, head: 1.0`).

## 3. Audience & Story Engine
- **Audience:** Kids & school-age students — core rule must be explainable to a **10-year-old in 15 seconds** (zero math overload), dropping into a concrete visual hook immediately (`Inductive Hook`).
- **Tone:** Curiosity, mystery, uncanny intrigue, and genuine relational/survival stakes are first-class. Episodes do **NOT** need slapstick jokes; prioritize a tight causal story (`World Setup → Faction/Personal Stake → Escalation/Double-Bind → Lateral Hack & Twist`).
- **Three Archetypes (choose ONE in `brief.md` `## Archetype`):**
  1. **`Personal Rule-Trap`** *(default)*: Uncanny rule locks the protagonist into a personal handicap, creating a ticking **Double-Bind** in Act 2 broken only by a lateral hack from *inside* the rule's own physics.
  2. **`Systemic Satire`**: Absurd rule bends queues, prices, schools, or committees via **active moves** from protagonist/rivals (never a passive neighbour catalogue).
  3. **`Hybrid VN Trap`**: Everyday Vietnamese texture (apartments, alleys, markets, classrooms, family duties) fused with a ticking Double-Bind and lateral hack.

## 4. Seven-Point Premise Test (All Must Pass at G1)
1. **Instant Cognitive Itch:** Core rule stated in one plain sentence (`≤ 18` words) that triggers immediate curiosity.
2. **Cannot-Turn-Off:** Trigger is involuntary or unavoidable in daily life (cannot be solved by *"just stop doing X"*).
3. **Surface-Loophole Blocker:** Setup immediately closes the cheap cheat viewers invent in 5 seconds.
4. **Drawable in Flat 2D:** Core physical/perceptual state reads clearly in 2D vector illustration without photorealistic anatomy.
5. **Dual-Use / Weaponizable Flaw:** The handicap or rule cost reverses polarity to become the sole mechanical key in Act 3.
6. **Active Escalation:** Drives concrete physical actions and choices — never exposition lectures.
7. **Originality (`No copying`):** Never copy premises, lines, characters, or climaxes from reference channels or past episodes; `brief.md` `## Not copying` names the closest reference and states how rule, mechanism, and climax differ.

## 5. Banned Premise Traps & Tone Limits
- **Auto-reject at G1:** Arbitrary wrist/step bureaucratic counters; generic moral-to-element clichés (tears → crystals); external monster chasers or *"it was just a dream / electricity"* cop-outs; generic *"birth name = superpower"* gifts without paradoxical cost.
- **World motifs:** Chung cư, ngõ nhỏ, lớp học, sân trường, chợ, quán nước, gác xép, tầng hầm; characters grounded with concrete roles/places (`"bà Hạnh tầng năm"`).
- **Tone limits:** Mock systems, habits, and literalized physics — never real people, ethnicities, religions, disabilities, or real tragedies; no vulgarity or real commercial brands.
