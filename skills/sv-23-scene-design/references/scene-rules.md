# Scene rules

## 1. When does a beat get a new place?
Ask these in order and stop at the first yes.

1. Does the beat happen where an existing place already is, or could it happen there? → **reuse** that place, maybe with a different camera or time of day.
2. Is the beat about one object: a phone, a document, a pot, a number? → **insert**. Use a full-frame object on a plain field, not a room.
3. Does the beat change who has power, or what the character wants? And will the place carry ≥ 3 shots? → **new place**.
4. Otherwise → reuse a place.

A **new scene** in an existing place needs a change of time, such as next morning, a year later or night. Mark it with a `tag` card or a `fade`.

## 2. Layout grid (1080 × 1920 frame, world units)
```
y 0     ┌───────────────┐
        │  empty zone   │  sky / plain wall — air, titles, tags (≥ 25 % of a wide)
y ~600  │  BACK plane   │  ≤ 5 shapes: wall features, one hero object
y ~1100 │  MID plane    │  people stand here — ≤ 4 props, none taller than a person behind them
y ~1500 │  FRONT plane  │  ≤ 2 props, only for depth (table edge, plant), never covering faces
y 1560  │ caption band  │  nothing important below this line
y 1920  └───────────────┘
```
- One hero per place. It carries the place's strongest colour (red or gold). Every other prop is a tint of the wall or a neutral.
- Floor: one flat colour plus at most one large pattern. Avoid small repeating tiles behind people.
- People's subject zone is x 180–900. Keep the hero at the opposite third from where the main person stands.
- Value: the wall is light, people are mid-to-dark, and outlines are ink. A prop is never darker than the people in front of it.

## 3. Clutter budget (measured by scene_audit.py above the caption band)
| Metric | Warn | Error | Reference: "Nước mắt" median / worst |
|---|---|---|---|
| Edge density (strong-gradient pixels) | 0.060 | 0.075 | 0.074 / 0.155 |
| Colour masses (3-bit bins ≥ 1 %) | 12 | 15 | 16 / 26 |
| Text overlays on screen | — | 1 | — |

Fix a busy frame in this order:
1. Remove mid-plane props.
2. Turn the floor pattern into a plain floor.
3. Push in to k ≥ 1.3.
4. Drop the overlay.

## 4. Transitions
| From → to | Transition | How it looks |
|---|---|---|
| shot → shot, same scene | `cut` | size change ≥ 1.25× or new subject |
| place → place, same time | `match` | the same shape or motion at the same screen position across the cut (hand reaching → hand reaching, pot → pot) |
| place → place, travel | `wipe` / `whip` | a lateral move in the direction of travel, 8–12 frames |
| time jump | `tag` | a short card ("SÁNG HÔM SAU", "NĂM SAU") over the new place's establishing wide |
| ending, dream, memory | `fade` / `flash` | 12–18 frames; use at most 3 per episode |

A plain cut between two places only works when the next shot is a recognisable establishing wide **and** the previous scene ended on a held wide. Even then, declare it as `match`.

## 5. Places must look different
- Each place gets one wall hue that is ≥ 28° from every other place's (SC-16).
- Night uses the same set with the night layer, not a new set.
- Outdoor places get a horizon line and sky. Indoor places get a ceiling edge or a lamp. The viewer should know inside from outside within 0.3 s.

## 6. Characters in a scene
- Main speaker: at k 1.0 their head is ≥ 120 px tall. At medium they occupy 40–55 % of the frame height.
- At most 4 people in a medium. In a crowd wide, keep extras to one tint, so the principals keep their colours.
- No principal wears the colour of the wall they stand in front of (sv-20 CO rules).
