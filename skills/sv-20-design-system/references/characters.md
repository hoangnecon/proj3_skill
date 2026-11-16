# Characters — designing the cast

The cast is designed as a SHEET before any shot exists. Never invent a look inside a shot. Never pick
looks "at random": every field is a decision that tells the viewer who this person is from 3 metres away.

## Contents
1. The rig in numbers
2. Look fields (complete)
3. Procedure: from brief to cast sheet
4. Hard rules (lint) and soft rules (review)
5. Recipes by character type
6. Expressions and poses available
7. Exemplar benchmark
8. Review checklist for G4

## 1. The rig in numbers (scale s = 1, h = 1)

| Measure | Value |
|---|---|
| Standing height (feet to top of head) | ≈ 575 · h px (v3.3: head ≈ 1/2.6 of height) |
| Head radius | 100 · head |
| Shoulder height above feet | ≈ 374 · h |
| Hip height (standing) | 178 · h (both rigs) |
| Arm reach from shoulder | ≈ 200 · h |
| Origin | midpoint between the feet; y grows downward |
| Readable face on screen | figure ≥ 480 px tall on screen = 575 · h · s · zoom (lint SZ-01 for talkers) |

### 1b. Face construction — "dễ thương kiểu hoạt hình", never "ghê" (v3.3)
The user rejected the v3.2 faces as ugly. Cô Út's face was "gớm". The problems were:
- small dot eyes high on a tall oval;
- a long mouth with teeth;
- a pointed nose in profile.

The rig now draws faces by these rules. Do not override them per character.

| Part | Rule (r = head radius) |
|---|---|
| Face shape | wide at the cheeks, round chin (`faceD`); widest at y + 0.08r |
| Eyes | big ink ellipses r·0.12 × 0.14, set **low** (y + 0.2r), 0.68r apart, with two white highlights (big upper-right, small lower-left) |
| Brows | short soft arcs (0.24r), never long straight bars |
| Nose | a tiny curve, front view; a soft bump in profile, never a point |
| Mouth | **small** (flat 0.18r, smile 0.28r), 0.32r below the eyes; an open mouth is a D-shape with a dark cavity and a pink tongue — **never draw teeth** |
| Lipstick | colours the mouth stroke and the cavity outline red; no separate lip shape |
| Blush | soft ellipses under the eyes (opacity 0.42) |
| Hair | the cap's top sits above the face top; fringe or parted bangs; long hair has two locks framing the face to below the chin |

The G4 check: open every `expr_<look>.png` at 100 % zoom and look at each of the 12 faces. If any reads as creepy, mean (when not meant), or adult-realistic, fix the rig, not the shot.

Principals use `s` 0.9–1.15 in shots; background people 0.7–0.9 placed further up the floor (smaller y).

## 2. Look fields (src/chars.tsx `Look`)

| Field | Values | Notes |
|---|---|---|
| `name` | must equal the CAST key | lint CH-02 |
| `top` | `shirt` `polo` `tank` `suit` `uniform` `robe` `chef` `blouse` `aothe` `tee` | garment silhouette |
| `topC` / `topC2` | PAL token | main colour / collar, tie, trim |
| `pattern` + `patC` | `dots` `stripes` `flowers` + token | one patterned top per 3 characters at most |
| `pants`, `shoes` | token | shoes default ink |
| `hair` | `bald` `side` `bun` `curly` `short` `neat` `thin` `kid` `long` | |
| `hairC` | token, default `hair` (navy) | `hairGrey` / `white` = age |
| `hat` + `hatC` | `none` `khanxep` `cap` `chef` `helmet` `band` | strongest silhouette breaker |
| `glasses` | `round` `square` `sun` | |
| `mustache`, `beard` (`goatee` `long`), `beardC`, `brows` | | age and attitude |
| `lips`, `earrings`, `chain` | booleans | |
| `vest` | boolean | hi-vis vest over the top |
| `w` | 0.72–1.25 shoulder width | thin 0.85, broad 1.15+ |
| `belly` | 0–1 | 0.4 soft, 1 big |
| `h` | 0.7–1.1 body height | child 0.7, short adult 0.92 |
| `head` | 0.95–1.08 | child/elder 0.95–1.0, comic boss 1.08 |
| `skin` | token, default `skin` | |
| `ghost` | boolean | translucent + glow, supernatural only |

## 3. Procedure: brief → cast sheet

1. **List every on-screen person** from `beats.md` (principals, supports, every extra that is seen).
   Give each a camelCase key from their role (`baTu`, `chuBao`, `canBoPhuong`), never `man1`.
2. **Write a one-line card** for each in `CAST_ROLES[key].vi`: who they are + the trait the story uses
   ("Bà Tư tầng 3 — nhiều chuyện, đeo kính lão, áo hoa"). This text is printed on the cast sheet.
3. **Pick the silhouette first** (seen at 25 % size): `hat`, `hair`, `top`, `w`, `belly`, `h`. Squint
   test: two principals must differ in at least two of these six.
4. **Pick colours second**: `topC` from accents or walls that are NOT the wall of the set where they act;
   principals get the most saturated tops (`red`, `teal`, `yellow`, `pink`, `blue`); extras use quieter
   ones (`white`, `concrete`, `wallB`, `wood`). Two principals never share `topC`.
5. **Add the story trait** — the prop or accessory that IS the character: the gossip's glasses + earrings,
   the official's square glasses + tie (`topC2`), the guard's cap, the maintenance man's uniform + cap.
6. **Register**: `CAST` + `CAST_ROLES` in `src/episode/cast.ts`.
7. **Render evidence**: `node scripts/design.mjs` → `qa/design/cast_episode_p*.png` and
   `expr_<key>.png` for every principal and support. LOOK at them next to `cast_exemplar_p*.png`.
8. **Iterate** until the review checklist (§8) passes, then show the user the cast sheet (G4).

## 4. Rules

Hard (lint, `node scripts/lint.mjs design`):
- CH-01 cast not empty · CH-02 `name` = key · CH-03 no `ex_` prefix · CH-04 role present and valid ·
  CH-05 `vi` description ≥ 8 chars · TK-01 every colour field is a PAL token.
- CH-06 traits: principal ≥ 3, support ≥ 2. A trait = glasses, hat, mustache, beard, pattern, earrings,
  chain, vest, lips, belly > 0.05, |w−1| > 0.04, |h−1| > 0.04, |head−1| > 0.03, non-default `hairC`, `topC2`.
- CH-07 principals and supports have unique `hair/top/topC` silhouettes · CH-08 no two identical looks ·
  CH-09 at least one principal (warning above 4).

Soft (G4 review — the reviewer must answer each):
- Can you tell every principal apart in the 25 % cast-sheet thumbnails without reading names?
- Does each look say age, job and attitude? (grey hair + round glasses = elder; cap + uniform = worker…)
- Does any principal's top vanish against the wall of their main set? (compare with the set plates)
- Are heights varied (at least one of: child, short, tall, broad)?
- Is the ghost/supernatural look used only for the supernatural?
- **Close-up pass (user, 2026-11-16).** Render every principal/support at close-up size (head ≥ 300 px)
  in ALL 12 expressions and look for drawing faults that a 25 % thumbnail hides:
  - scalp showing above the hair line ("lòi đầu hói"): a hair cap's cubic control points must sit at
    ≤ −1.42 r so the curve peak (≈ 0.75 × control) covers the skull top at −r;
  - mouth decorations: `lips` colours the mouth stroke itself (red, thicker) — never an extra shape drawn
    on top of the mouth: it covers the teeth in `grin`/`joy` and reads as a gruesome mouth ("răng ghê");
  - teeth sit INSIDE the mouth: a white band under the upper lip, clipped to the mouth path — never a
    separate shape that can poke past the lip line;
  - glasses, brows, mustache staying on the face in profile and when the head tilts.

## 5. Recipes (starting points — change at least two fields per character)

| Type | Fields |
|---|---|
| Gossiping auntie | `blouse` + `flowers`/`dots`, `bun` `hairGrey`, `round` glasses, `earrings`, `w` 0.9, `belly` 0.4 |
| Rich boss / landlord | `polo` `red` + `topC2 gold`, `bald`, `mustache`, `chain`, `w` 1.2, `belly` 1, `head` 1.08 |
| Ward official | `suit` `navy`/`blue` + `topC2 red` (tie), `neat`, `square` glasses, `belly` 0.5 |
| Worker / technician | `uniform` `blue`/`teal`, `cap`, `mustache`, `shoes wood`; hi-vis `vest` on site |
| Young man | `tee`/`shirt`, `side`/`short`, `sun` glasses or `chain`, `w` 1.05 |
| Young woman | `blouse` solid colour, `long`/`curly`, `lips`, `earrings`, `w` 0.86 |
| Elder man | `shirt` `white`, `thin` `white` hair + `brows white`, `mustache`, `square` glasses, `h` 0.95 |
| Child | `tee` bright, `kid` hair, `w` 0.72–0.75, `h` 0.7–0.72, `head` 0.95 |
| Ritual master | `robe` `yellow` + `topC2 red`, `band` hat, `goatee` |

## 6. Expressions and poses

Expressions (`e`): `neutral` `joy` `smug` `sly` `eager` `shock` `angry` `stern` `sad` `cry` `deadpan` `shh`.
Choose by the narration's beat: reveal → `shock`; scheme → `sly`/`smug`; authority → `stern`/`deadpan`;
confession → `shh` then `sly`; loss → `sad`/`cry`. A principal changes expression at least once per shot
they talk in (keyed to the word that causes it).

Front poses (`p`, POSES in chars.tsx): `idle` `hip` `hipR` `hold` `holdHigh` `raise` `cheer` `pointR`
`pointUp` `pointL` `argue` `argue2` `cross` `clap` `pray` `cry` `shrug` `write` `shh` `thumb` `tape`
`whisper` `taste` `sprinkle` `wave` `seeds` `phone` `confess` `hands` and seated `sit` `sitPhone`
`sitRaise` `sitShh` `sitCross` `sitCry` `sitHold` `sitHands`. Side-view arms and legs: see sv-21-motion.

If the story needs a pose that does not exist, add it to POSES (angles in degrees: `[shoulder, elbow]`,
0 = hanging, + = outward/up; or an IK target name `mouth` `eye` `chest` `hip` `head` `over` `ear` `front`)
and render `expr_<key>.png` to check it.

## 7. Exemplar benchmark

`src/exemplar/looks.ts` holds 36 looks from two finished episodes; `qa/design/cast_exemplar_p*.png`
renders them. The level to match: `ex_baHanh` (6 traits), `ex_bacCa` (6), `ex_canBo` (5), `ex_ongBay` (6),
`ex_cu` (child proportions). Do not reuse them (lint SH-07 forbids `ex_*` in shots); study them.

## 8. G4 review checklist (characters part)

Write in `gates/G4.review.md`, one line per evidence image with what you saw:
- `cast_episode_p1.png` — all principals distinguishable at thumbnail size? heights varied? colours clash
  with any set wall?
- `expr_<key>.png` — 12 expressions all read (especially `sly` vs `smug`, `stern` vs `angry`)? glasses or
  hair cover the eyes? poses keep hands visible? walk phases: stance foot flat on the line?
