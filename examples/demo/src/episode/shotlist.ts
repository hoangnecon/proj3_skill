// DEMO SHOTLIST — shows every motion feature on exemplar sets/looks so you can render and study it.
// REPLACE THIS FILE with the episode's shots (sv-short-production). The lint fails while any shot
// uses an ex-* set or ex_* look, so the demo can never ship by accident.
import type {ShotDef} from '../engine';
import {carBtn, stairY} from '../exemplar/geo';

// touch points carry fy = the floor line under the fixture (lint MO-09 checks the actor stands at that depth).
// In the lift's box view the panel is on the right side wall, which meets the floor near the front: fy 1800.
const btn = (n: number) => {
  const [x, y] = carBtn(n);
  return {x, y, fy: 1800};
};
const CALL_BTN = {x: 802, y: 1195, fy: 1560}; // lobby call button, wall meets floor at 1560

export const SHOTS: ShotDef[] = [
  {
    at: 's1', name: 'DEMO: thẻ tiêu đề', set: 'solid', bg: 'yellow', cam: [540, 960, 1],
    over: [{k: 'title', text: 'CẢNH MẪU', sub: 'engine demo', x: 540, y: 900}],
  },
  // walk in profile with planted feet, anticipation + press on the call button, door opens on the word
  {
    at: 's2@Ông', name: 'DEMO: đi vào sảnh, bấm nút gọi, cửa mở', set: 'ex-lobby', cam: [520, 1220, 1.0], cam2: [600, 1200, 1.25], ease: 'io',
    keys: {door: [[0, 0], [1, 's2@mở', 0.7]], call: [[false, 0], [true, 's2@gọi+0.05']]},
    actors: [
      {id: 'k', look: 'ex_n6', x: 0, y: 0, s: 0.95, e: [['neutral', 0], ['eager', 's2@cửa']],
        path: [[-120, 1700, 0], [640, 1700, 's2@bấm-0.1']], reach: [{at: 's2@gọi+0.05', ...CALL_BTN, hold: 0.35}]},
    ],
  },
  // stairs: slope-matched gait, cane prop, walk -> sit transition, panting
  {
    at: 's3@Ông', name: 'DEMO: leo cầu thang rồi ngồi thở', set: 'ex-stairs', o: {floorNo: 11}, cam: [520, 1260, 1.2], cam2: [640, 1180, 1.3], ease: 'io',
    actors: [
      {id: 'b7', look: 'ex_ongBay', x: 0, y: 0, s: 0.95, slope: -0.6, path: [[330, stairY(330), 0], [600, stairY(600), 's3@ngồi']],
        legs: [['walk', 0], ['sit', 's3@ngồi']], seatH: 96, arms: [['cane', 0], ['down', 's3@ngồi']], prop: 'cane', e: 'sad', lean: 7, pant: true},
    ],
  },
  // front view inside the car: confess pose + talk + bubble, then a button press lights floor 5
  {
    at: 's4@Bà', name: 'DEMO: thú nhận rồi bấm tầng 5', set: 'ex-car', cam: [640, 1300, 1.1], cam2: [700, 1260, 1.2],
    keys: {lit: [[[], 0], [[5], 's4@năm+0.1']]},
    actors: [
      {id: 'h', look: 'ex_baHanh', x: 760, y: 1790, s: 1.12, p: 'confess', e: [['shh', 0], ['sly', 's4@thú']], talk: [['s4@thú', 's4@mật']],
        reach: [{at: 's4@năm+0.05', ...btn(5), hold: 0.45}]},
    ],
    over: [{k: 'bubble', text: 'Tôi chưa đọc nội quy', x: 520, y: 600, at: 's4@thú', until: 's4@bấm', s: 0.72, tail: [-40, 180]}],
  },
];
