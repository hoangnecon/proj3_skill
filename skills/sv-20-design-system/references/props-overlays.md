# Props and overlays

## 1. Props (src/props.tsx)

Three registries; shots name props by key, the lint rejects unknown names (SH-09).

| Registry | Placed by | Existing keys | Attach point |
|---|---|---|---|
| `HAND_PROPS` | `actor.prop` in FRONT view | `clip` `phone` `book` `money` `env` `trash` `noodle` `wrench` `incense` `seeds` | `h.l` / `h.r` = hand positions in rig units |
| `SIDE_PROPS` | `actor.prop` in SIDE view | `toolbox` `trash` `cane` `box` `bag` `phone` | `h.near` / `h.far` |
| `WORLD_PROPS` | `shot.extras: [{k, x, y, s?, c?}]` | `stool` `cone` `lamp` `gladiolus` `cat` | world point on the floor (y = contact) |

The same key may exist in both hand registries (`phone`, `trash`) so an actor keeps the prop when the
view switches.

### Adding a prop
1. Draw it as a component in props.tsx at rig scale: origin = where the hand grips (hand props) or the
   floor contact point `y = 0` (world props). A phone is ~40 × 70, a book ~120 × 90, a stool ~110 tall;
   vehicles and large props must match the Human-Scale Vehicle & Large-Object Table in `sets.md` §3b
   (anchored to `adult = 575 px`, `child = 435 px`).
2. Style: 3–10 shapes, ink outline (`S` default 5, small parts 3–4), one token fill + one detail colour,
   a highlight line (`white` 0.6) or halftone shade on the dark side, Vietnamese label if it has text.
   Keep opaque wheels/shapes painted after text clear of `<text>` bounding boxes (`PR-02`).
3. Register it in the right registry. Time-based props take `t` (wrench wiggle, incense smoke).
4. **Mandatory G4 scale check (`PR-01`, `PR-02`)**: run `node scripts/design.mjs` and inspect
   `qa/design/props_episode_p*_v.jpg`! Every custom `WORLD_PROP` is rendered on the `y = 0` baseline
   next to the `575 px` adult and `435 px` child reference ruler (`PR-01` errors on undersized
   vehicles/carts/cars or floating `maxY`; `PR-02` errors on prop shapes covering prop text).
5. Check it in context in a shot frame (`node scripts/qa.mjs shot <i>`).

## 2. Overlays (src/overlays.tsx)

Screen graphics on top of the picture. They pop in (scale 0 → 1.12 → 1 over 0.34 s). Use them sparingly:
the world's own text is preferred. Max 2 on screen at once (lint OV-04), never in the caption band
y 1480–1760 (OV-03). `world: true` pins an overlay to the set so it moves with the camera.

| Kind | Looks | Use for | Spec |
|---|---|---|---|
| `tag` | big rounded plate (default `red`), 130 px white text + optional `sub` | time jumps and chapters: "THÁNG ĐẦU", "6:45 SÁNG", "BA THÁNG SAU" | at the word that states the time; 2–3 words |
| `title` | red plate, yellow 150 px text with ink stroke, `sub` line | episode title card only (first shot), or a final title | once or twice per episode |
| `bubble` | white speech bubble, 64 px, tail toward the mouth | the exact words a character says when narration quotes them | ≤ 28 chars (OV-02), `tail` points to the speaker's mouth, `until` the next beat |
| `label` | yellow tag, 56 px | naming a person/thing the narration introduces: "BÀ HẠNH · T5" | near the person, above head height |
| `card` | ink plate, yellow 60 px | a rule or a number the viewer must remember: "1 BÍ MẬT = 1 LẦN" | centred upper half |
| `stamp` | red outline stamp, slams down | verdicts and absurd official conclusions: "DO THANG MÁY", "ĐÃ DUYỆT" | at the word, `r` −8…−12°, add `punch` 0.05 to the shot |
| `pin` | map pin + label | locations on a map/section set | `world: true` on map sets |
| `score` | ink bar, yellow text | counters and prices: "TẦNG 15 = 1 CHỈ VÀNG" | top third |
| `arrow` | yellow down arrow | pointing at a small detail the narration names | `world: true`, above the detail |

Do not add new overlay kinds for one gag — draw the text into the set (diegetic) instead. Audio: the mix
adds a sound for each overlay automatically (stamp → thump, tag → gong, bubble/label/card/pin → pop,
score → ding, title → thump).
