---
name: sv-23-scene-design
description: Plan the places, scenes and transitions of a story-video episode before any set or shot is built — a location bible (≤ 6 places, each with a story job, a hero prop, a wall colour and a three-plane layout), a scene list mapping every beat to a place and time, declared transitions, and a clutter budget measured from rendered pixels by scripts/scene_audit.py. Use when starting design (G4) for any episode, when deciding whether a beat needs a new set, when the user says the picture is "rối", "xấu", "nhìn mệt" or "loạn", when changing a transition, and before gate G5.
---

# sv-23 · Scenes, places, transitions (inside G4 and G5)

The user's verdict on "Nước mắt chia đất": the style is right, but the picture is busy and ugly.
The measured causes are:
- 36 % of shots sat in one room;
- 22 place changes were plain cuts;
- five pairs of places shared a wall colour;
- the median frame had 16 colour masses.

This skill fixes the process that let those through. It works through a plan file the user approves and a script that measures the pixels. A review cannot talk its way past either.

## Read first
- `references/scene-rules.md` covers the layout grid, the clutter budget, the transition table, and when a beat earns a new place.
- sv-20 `references/sets.md` covers how a set is built once its plan exists.
- sv-22 `references/shot-grammar.md` covers shot sizes inside a scene.

## Order (do not skip, do not reorder)
1. **Location bible, on paper.**
   - Read `beats.md`.
   - List every place the story needs.
   - Merge until there are ≤ 6.
   - A place that would carry < 3 shots becomes an **insert** (phone, document, close prop) or moves into an existing place.
2. **`scenes.json`**, following the schema below. Each place has:
   - `purpose`: its story job, ≥ 6 words;
   - `hero`: the one prop the eye goes to;
   - `wall`: a palette key whose hue is ≥ 28° from every other place's wall;
   - `layout`:
     - `horizon_y` and `floor`;
     - `subject_zone`: the x-range where people stand;
     - `empty_zone`: where nothing is drawn, for air and overlays;
     - `back`, `mid`, `front`: lists of props, with ≤ 5, ≤ 4 and ≤ 2 items.
3. **Scene list.**
   - Every beat belongs to one scene.
   - A **new scene** starts only when the place or the time changes. Write the reason in `why`.
   - Give each scene an `entry` (`establish` for the first visit, `continue` for a return, `insert`).
   - Give each scene a `transition_in`. Use the table in scene-rules.md.
   - A plain `cut` between places is an error. A time jump needs `tag`, `fade` or `flash`.
4. `python3 scripts/scene_audit.py plan` must report 0 errors. Then open `qa/scene_board.png`.
5. **Show the user `qa/scene_board.png` and `scenes.json`'s scene list, and get approval.** This is part of G4. The G4 review must quote the audit line `0 errors` and the user's words.
6. Build sets (sv-20) exactly as the layout says.
   - A prop not listed in the layout is not drawn.
   - Render the plates. The wall-hue check reads the plates, not the JSON.
7. At G5, fill each scene's `"shots": [first, last]` and `"inserts"`. Render contact sheets, then run `python3 scripts/scene_audit.py shots`. It checks:
   - every shot sits in a scene and uses that scene's set or a declared insert;
   - the first shot of an `establish` scene is a wide (k ≤ 1.15, ≥ 1.2 s);
   - declared transitions are actually used;
   - there are no jump cuts (same set, same people, zoom ratio < 1.25);
   - ≤ 1 text overlay is on screen at a time;
   - **edge density ≤ 0.075 and ≤ 15 colour masses per frame**, measured on both contact frames of every shot;
   - no place carries > 35 % of shots.
8. Open `qa/clutter_board.png` (the 12 busiest frames). The G5 review copies the audit summary line and lists every warning with what was done.

## Anti-bypass rules
- Never edit `STD` in scene_audit.py to make an episode pass. Thresholds change only in the skill repo, with a CHANGELOG entry and the user's say-so.
- A waiver lives only in `scenes.json` → `"waive": {"SC-xx": "reason of at least six words"}`. SC-28 and SC-29 waive per shot (`"#12 #13 because …"`). More than 3 waived shots means the set is wrong: go back to sv-20.
- The audit reads rendered pixels and file timestamps. Stale contact frames are an error (SC-27). Do not hand-copy frames.
- A new set built after G4 approval reopens G4. It must be added to `scenes.json` and shown to the user.
- "Busy" is fixed by removing things or pushing the camera in. Never fix it by darkening, blurring or adding a vignette.

## scenes.json schema
```json
{
 "locations": {
  "altar": {"set": "altar", "purpose": "gian thờ nơi ông nếm mâm và chia đất", "hero": "ảnh ông + tủ sổ đỏ",
            "wall": "wallA",
            "layout": {"horizon_y": 1180, "floor": "gạch hoa", "subject_zone": [180, 900], "empty_zone": "y < 560 trừ ảnh thờ",
                       "back": ["bàn thờ", "ảnh ông", "câu đối"], "mid": ["mâm cỗ"], "front": ["đèn dầu"]}}
 },
 "scenes": [
  {"id": "sc1", "location": "altar", "time": "giỗ 2024", "entry": "establish", "transition_in": "fade",
   "beats": ["s1", "s2"], "why": "mở truyện ở nơi luật chia đất xảy ra", "shots": [0, 5], "inserts": ["plot"]}
 ],
 "waive": {}
}
```

## Failure → fix
| Audit says | Do |
|---|---|
| SC-02 > 6 places | merge two places that share a job; turn a one-scene place into an insert |
| SC-05 too many props in a plane | delete props; the hero stays, the rest must earn their place |
| SC-10 place change on a cut | use `match` (same shape or action across the cut), `wipe` (lateral move), `whip` (fast pan), or `tag` when time also jumps |
| SC-16 walls too close | change one wall colour in the set; check sv-20's palette table |
| SC-23 scene opens tight | add a 1.2–1.8 s wide before the push |
| SC-25 jump cut | change size ≥ 1.25×, change subject, or cut the shot |
| SC-28/29 busy frame | remove mid-plane props, simplify the floor pattern, push in (k ≥ 1.3), drop an overlay |
| SC-30 one place > 35 % | move a beat to another place, or cover it with an insert |
