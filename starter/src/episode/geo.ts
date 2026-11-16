// EPISODE GEOMETRY — pure numbers/functions (no React) shared by sets, shotlist and node scripts.
// Every point an actor touches, sits on, walks along or looks at is defined HERE once, and the set
// draws it from the same numbers. Never type a button/door/seat coordinate by hand in shotlist.ts.
//
// Example (see src/exemplar/geo.ts for the elevator episode):
//   export const DOOR = {x0: 360, x1: 720, top: 900, bot: 1560};
//   export const CALL_BTN = {x: 802, y: 1195, fy: 1560};          // every touch point: x, y + fy = floor line under it (lint MO-09)
//   export const SEAT = {x: 820, y: 1700, h: 120};                 // y = ground line, h = seatH
//   export const btn = (n: number): [number, number] => [895 + (n % 2) * 42, 980 - n * 38];
//   export const stairY = (x: number) => ...;                       // ground height along a slope

/** default ground line of interior sets (y where feet touch) */
export const GROUND = 1700;
