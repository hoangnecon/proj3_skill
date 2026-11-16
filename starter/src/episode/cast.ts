// EPISODE CAST — every character that appears on screen, designed BEFORE any shot is written.
// Rules (sv-20-design-system/references/characters.md, enforced by scripts/lint.mjs):
//  • key = camelCase role name (baTu, chuBao). name must equal the key.
//  • every look is listed in CAST_ROLES with a role: 'principal' | 'support' | 'extra'.
//  • principals: ≥ 3 distinguishing traits (glasses, hat, mustache/beard, pattern, earrings, chain,
//    vest, belly ≠ 0, w ≠ 1, h ≠ 1, head ≠ 1, non-default hair colour), unique silhouette
//    (hair + top + topC combination not shared with any other look).
//  • topC must not equal the dominant wall colour of the set where the character mostly appears.
//  • extras may share a silhouette family but not an identical look.
import type {Look} from '../chars';

export type Role = 'principal' | 'support' | 'extra';

export const CAST: Record<string, Look> = {
  // baTu: {name: 'baTu', top: 'blouse', topC: 'pink', pattern: 'flowers', patC: 'yellow', pants: 'navy', shoes: 'white',
  //        hair: 'bun', hairC: 'hairGrey', glasses: 'round', earrings: true, w: 0.92, belly: 0.4},
};

/** one line per look: role + a Vietnamese description used on the cast sheet */
export const CAST_ROLES: Record<string, {role: Role; vi: string}> = {
  // baTu: {role: 'principal', vi: 'Bà Tư tầng 3 — người kể chuyện nhà bên'},
};
