// Shot data model + word-anchored timing. Pure TS (no React) so node scripts can import it.
// DO NOT add episode-specific fields here: episode state goes through ShotDef.o / keys / of.
import words from './data/words.json';
import cues from './data/cues.json';
import type {Expr} from './chars';

export const FPS = 30;
export const TAIL = 3.0; // seconds held on the end card after the last word
export const C = cues as unknown as {seg_starts: Record<string, number>; total: number; voice_end: number};
export const DURATION = Math.ceil((C.total + TAIL) * FPS) / FPS;

type W = {w: string; s: number; e: number; seg: string};
export const WORDS = words as W[];
export const normWord = (s: string) => s.toLowerCase().replace(/[.,:;!?…"“”()]/g, '');

/**
 * Anchor grammar:  's5'  |  's5@ông'  |  's5@ông#2'  |  's5@ông+0.2'  |  's5@ông#2-0.1'
 * Matching is case-insensitive and keeps Vietnamese diacritics. A word that occurs more than once
 * in its segment MUST carry #n (the lint fails otherwise). end=true returns the word's end time.
 */
export const tAt = (spec: string, end = false): number => {
  const m = /^(s\d+[a-z]?)(?:@([^#+\-]+))?(?:#(\d+))?(?:([+-][\d.]+))?$/.exec(spec);
  if (!m) throw new Error('bad anchor: ' + spec);
  const [, seg, word, nth, off] = m;
  let t = C.seg_starts[seg];
  if (t === undefined) throw new Error('no segment ' + seg + ' (anchor ' + spec + ')');
  if (word) {
    const hits = WORDS.filter((x) => x.seg === seg && normWord(x.w) === normWord(word));
    const hit = hits[(nth ? parseInt(nth, 10) : 1) - 1];
    if (!hit) throw new Error('word not found: ' + spec);
    t = end ? hit.e : hit.s;
  }
  return t + (off ? parseFloat(off) : 0);
};
export const segEnd = (seg: string) => Math.max(...WORDS.filter((w) => w.seg === seg).map((w) => w.e));

export type TT = number | string; // seconds from shot start, or an absolute word anchor
export type Keys<T> = T | [T, TT][];
export type ActionFx = 'dust' | 'sweat' | 'speed' | 'impact' | 'stars';

export type Actor = {
  id: string; // stable within a shot; the same character keeps the same id across shots
  look: string; // key in CAST (src/episode/cast.ts)
  x: number; // standing position (ignored when path is set)
  y: number; // ground contact line in world px — also the depth sort key
  s?: number; // scale; principals 0.9–1.15
  flip?: boolean; // front view: mirror
  p?: Keys<string>; // front-view pose name from POSES (chars.tsx)
  e?: Keys<Expr>; // expression keys
  talk?: [string, string][]; // [startAnchor, endAnchor] mouth flaps
  gaze?: number; // front view: -1..1 pupils
  prop?: string; // hand prop: front -> HAND_PROPS, side -> SIDE_PROPS (props.tsx)
  op?: number;
  enter?: TT; // fade in over 0.3 s from this moment
  exit?: TT; // fade out over 0.3 s from this moment
  hop?: number; // bouncing (joy/anger), px
  shake?: number; // trembling, px
  z?: number; // depth-sort nudge
  // ---- detailed motion (see sv-21-motion) ----
  path?: [number, number, TT][]; // waypoints (x, y, arrival time). Walks with planted feet, trapezoid speed.
  view?: Keys<'front' | 'side' | 'back' | '3q'>; // default: side when path/ride is set, else front
  face?: Keys<1 | -1>; // side/3q view facing (default: travel direction or flip)
  fg?: boolean; // render in foreground OTS plane (d = 1.2) after mid layers
  slope?: number; // ground slope dy/dx for stairs/ramps (negative = going up to the right)
  legs?: Keys<'walk' | 'run' | 'sit' | 'carried' | 'ride' | 'crouch' | 'jump' | 'fall' | 'push' | 'climb'>; // side view leg mode; walk->sit animates sitting down
  seatH?: number; // hip height when sitting (rig units, standing hip = 200*h)
  arms?: Keys<string>; // side view: swing | down | hold | phone | cane | carry | ride | shh | raise | pocket
  reach?: {at: TT; x: number; y: number; hold?: number; hand?: 'near' | 'far' | 'r' | 'l'; fy?: number}[]; // touch a world point
  ride?: string; // id of the actor carrying this one piggyback
  mount?: {target: string; slot?: number}; // attach rider to a Hero Subject extra by id + seat slot
  lean?: number; // degrees, + = forward
  look2?: number; // side view head tilt, + = look up
  tip?: boolean; // tiptoe (short steps, lean)
  pant?: boolean; // out of breath (chest heave + puffs)
  // ---- studio 2D animation physics & action FX (v5.0) ----
  arcH?: number; // parabolic jump height (px) along path or jump bounce, keeping ground shadow planted on floor
  wind?: number; // wind force (-1..+1, or higher e.g. 1.5 in flight) driving secondary hair & cloth drag
  pushTarget?: [number, number]; // world (x, y) contact point that push/pull hands lock directly onto via IK
  fx?: ActionFx[]; // procedural action FX ('dust' | 'sweat' | 'speed' | 'impact' | 'stars') rendered with the actor
  shadow?: boolean; // ground contact shadow (default true for grounded non-ghost non-fg actors; false to opt out)
};

export type OverKind = 'tag' | 'bubble' | 'label' | 'stamp' | 'score' | 'pin' | 'title' | 'card' | 'arrow';
export type Over = {
  k: OverKind;
  text?: string;
  sub?: string;
  x: number;
  y: number;
  at?: TT;
  until?: TT;
  r?: number;
  s?: number;
  c?: string;
  world?: boolean; // moves with the camera (pinned to the set) instead of the screen
  tail?: [number, number]; // bubble tail tip relative to bubble centre
};

/** a key track for one set option: [value, at, tweenSeconds?]. Numbers tween (easeIO), other values switch. */
export type KeyTrack = [number | string | boolean | number[] | string[], TT, number?][];

export type ExtraDef = {
  id?: string; // stable id so actors can reference via `mount: {target: id, slot}`
  k: string; // key in WORLD_PROPS or SUBJECTS
  x: number;
  y: number;
  s?: number;
  c?: string; // legacy variant string for WORLD_PROPS
  pose?: Keys<string>; // multi-pose state for SUBJECTS (e.g. 'stalk', 'pounce', [['stalk', 0], ['pounce', 's4@vồ']])
  expr?: Keys<string>; // expression for SUBJECTS
  flip?: boolean;
  tilt?: number; // roll/bank angle in degrees
  z?: number; // depth-sort nudge
  fg?: boolean; // render in foreground plane (d = 1.2)
  path?: [number, number, TT][]; // optional animated motion path for creatures/vehicles
  altitude?: number; // vertical elevation (px) above floor plane (y is visual flying center, shadow projects onto y + altitude)
  shadow?: boolean; // contact/altitude shadow (default true for SUBJECTS)
};

export type Mood = 'default' | 'morning' | 'golden' | 'danger' | 'lab' | 'flashback' | 'dramatic';

export type ShotDef = {
  at: string; // word anchor where this shot starts (first shot: 's1')
  name: string; // short human description, shown in QA sheets
  set: string; // key in SETS (src/sets/index.ts)
  o?: Record<string, unknown>; // static set options
  keys?: Record<string, KeyTrack>; // animated set options (door: [[0,0],[1,'s5@mở']])
  of?: (u: number, ts: number, t: number) => Record<string, unknown>; // escape hatch: computed options
  cam: [number, number, number]; // [centreX, centreY, zoom] in world px; zoom 1 = 1080 px wide
  cam2?: [number, number, number]; // end of the move (motivated moves only, see sv-22)
  ease?: 'io' | 'out' | 'in' | 'lin';
  actors?: Actor[];
  over?: Over[];
  extras?: ExtraDef[]; // WORLD_PROPS or Hero SUBJECTS placed in the scene
  punch?: number; // zoom kick at shot start (gags), 0.04–0.08
  shake?: number; // camera shake px (impacts only)
  tilt?: number; // subtle Dutch/cinematic camera roll in degrees (e.g. -4..+4)
  angle?: 'wide' | 'low' | 'high' | 'ots' | 'reverse' | 'closeup' | 'pov'; // optional cinematic shot grammar metadata
  night?: number; // 0..1 night grade
  mood?: Mood; // studio atmospheric lighting grade (strictly PAL tokens, lightweight GPU-friendly gradient overlay)
  dof?: boolean; // subtle atmospheric depth separation haze between d=0.5 far layer and d=1 midground
  tr?: 'cut' | 'flash' | 'wipe';
  bg?: string; // background token for the 'solid' set
};

export type Shot = ShotDef & {t0: number; t1: number; idx: number};
export const LEAD = 0.06; // cut slightly before the word

export const resolveShots = (defs: ShotDef[]): Shot[] => {
  const t0s = defs.map((d, i) => (i === 0 ? 0 : tAt(d.at) - LEAD));
  return defs.map((d, i) => ({...d, idx: i, t0: t0s[i], t1: i + 1 < defs.length ? t0s[i + 1] : DURATION}));
};

/** TT -> absolute seconds */
export const abs = (tt: TT, shot: Shot) => (typeof tt === 'number' ? shot.t0 + tt : tAt(tt));
