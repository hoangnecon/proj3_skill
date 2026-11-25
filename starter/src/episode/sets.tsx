// EPISODE SETS — one function per location, registered in EPISODE_SETS at the bottom.
// Before writing a set, read sv-short-design/references/sets.md and open the exemplar plates
// (qa/design/set_ex-*.png). A set must pass `node scripts/lint.mjs` (detail density, tokens, text gag).
//
// Skeleton (copy, rename, then build it out to exemplar density):
//
//   import {E, L, PAL, R, Rr, S, Sh, Txt} from '../kit';
//   import type {Item, SetDef, SetLayers, SetOpts} from '../sets/types';
//   import {GROUND} from './geo';
//
//   const kitchenSet = (o: SetOpts): SetLayers => {
//     const t = o.t;
//     const back = (
//       <g>
//         {/* 1 ceiling + light source with glow */}
//         {/* 2 wall: base colour + dot texture + dado band + trim lines */}
//         {/* 3 signage / diegetic text (≥ 2 texts, ≥ 1 gag) */}
//         {/* 4 functional fixtures the story touches (exported coordinates in geo.ts) */}
//         {/* 5 clutter & wear: ≥ 6 small lived-in details */}
//         {/* 6 floor: base + perspective lines toward x=540 + ground line (w=6) */}
//       </g>
//     );
//     const mid: Item[] = [ /* furniture actors pass in front of / behind, keyed by its front y */ ];
//     return {back, mid};
//   };
//
//   export const EPISODE_SETS: Record<string, SetDef> = {
//     kitchen: {title: 'Bếp nhà bà Tư', bed: 'kitchen', render: kitchenSet},
//   };
import type {SetDef} from '../sets/types';

export const EPISODE_SETS: Record<string, SetDef> = {};
