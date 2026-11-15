# Acting recipes

Every recipe is anchored to words. Copy the shape, change numbers to your set's `geo.ts` points.

## 1. Walk in, press the call button, door opens
```ts
{at: 's2@Ông', name: 'ông khách vào sảnh bấm gọi thang', set: 'lobby', cam: [520, 1220, 1.0], cam2: [600, 1200, 1.25], ease: 'io',
 keys: {door: [[0, 0], [1, 's2@mở', 0.7]], call: [[false, 0], [true, 's2@gọi+0.05']]},
 actors: [{id: 'k', look: 'ongKhach', x: 0, y: 0, s: 0.95, e: [['neutral', 0], ['eager', 's2@cửa']],
   path: [[-120, 1700, 0], [640, 1700, 's2@bấm-0.1']],          // enters from off-frame, settles before 'gọi'
   reach: [{at: 's2@gọi+0.05', ...CALL_BTN, hold: 0.35}]}]}
```
Beats: enter (walk) → settle (0.3–0.8 s) → anticipation → touch on the word → world answers → reaction
(expression change on the next word).

## 2. Climb, give up, sit and pant
```ts
actors: [{id: 'b7', look: 'ongBay', x: 0, y: 0, s: 0.95, slope: -0.6,
  path: [[330, stairY(330), 0], [600, stairY(600), 's3@ngồi']],
  legs: [['walk', 0], ['sit', 's3@ngồi']], seatH: 96, arms: [['cane', 0], ['down', 's3@ngồi']], prop: 'cane',
  e: 'sad', lean: 7, pant: true}]
```
Slow speed (~120 px/s), lean, cane, then the sit lands on the word "ngồi".

## 3. Confession in a confined space (front view, talking)
```ts
actors: [{id: 'h', look: 'baHanh', x: 760, y: 1790, s: 1.12, p: 'confess',
  e: [['shh', 0], ['sly', 's4@thú']], talk: [['s4@thú', 's4@mật']],
  reach: [{at: 's4@năm+0.05', ...btn(5), hold: 0.45}]}],
over: [{k: 'bubble', text: 'Tôi chưa đọc nội quy', x: 520, y: 600, at: 's4@thú', until: 's4@bấm', s: 0.72, tail: [-40, 180]}],
keys: {lit: [[[], 0], [[5], 's4@năm+0.1']]}
```
Camera close enough that the talker is ≥ 480 px tall (lint SZ-01). One bubble, short text, tail to mouth.

## 4. Two people argue
Front view both, facing each other (`flip` the right one), poses `argue` / `argue2` alternating on
their lines, expressions `angry` → `shock` at the twist, `hop` 6 on the angriest line, camera
`cam2` drifting toward whoever wins. Never both talking in the same window.

## 5. Reveal reaction
On the reveal word: expression `shock` for everyone in frame (stagger 0.05–0.15 s between people so it
ripples), `punch: 0.05` on the shot, optionally `shake: 4` for one actor. Next shot: the cause, close.

## 6. Queue / crowd
5–9 extras in a line: `y` steps of 20–40 px (further = smaller y and smaller `s` by 0.03 per step), mixed
`e` (`neutral`, `deadpan`, `eager`), 1–2 with props (`phone`, `clip`), 1 with `talk` muttering, one
`hop` 4 impatient. Nobody identical; looks from the cast's extras.

## 7. Carry someone (piggyback)
```ts
actors: [
  {id: 'con', look: 'conBay', x: 0, y: 0, s: 1.0, path: [[-150, 1700, 0], [520, 1700, 's8b@thang']], arms: 'carry'},
  {id: 'b7', look: 'ongBay', x: 0, y: 0, ride: 'con', e: 'deadpan'},
]
```

## 8. Turn around
Path with a waypoint back the other way; the body squeezes through the turn over 0.22 s. Or key `face`
while standing. Add a 0.3 s pause at the turning waypoint (two waypoints at the same x with 0.3 s
between) so the turn reads.

## 9. Entering / leaving
Walk from/to x beyond the camera edge (`cam` x ± 540/k + 150). Fades (`enter`/`exit`) are only for
memories, ghosts, imagination.

## Acting checklist per shot
- Who is the subject? They move or change expression on the shot's key word.
- Anticipation before every action (settle before reach, crouch before sit is automatic).
- The world reacts (keys) and the sound follows (automatic from keys/reaches/overlays).
- Listeners react too: give non-talking characters an expression key on the punch word.
