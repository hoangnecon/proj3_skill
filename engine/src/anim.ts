// Studio 2D animation physics & biomechanics toolkit (RSI v5.0.0 Pillar 1A).
// Pure TypeScript + React SVG (React.createElement, no JSX syntax so strict .ts compiles cleanly).
// Strictly PAL color tokens from ./kit — zero raw hex colors.
import React from 'react';
import {E, L, LINE, PAL, Rr, S, col} from './kit';
import {clamp, smooth} from './math';

const h = React.createElement;
const n1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '0.0');
const n2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '0.00');

// ============================================================================
// 1. 12-Principles Easing & Spring Timing
// ============================================================================

// Peak normalization constant for t^5 * (1 - t)^2 at t = 5/7 (~0.7143):
const SPRING_BUMP_MAX = Math.pow(5 / 7, 5) * Math.pow(2 / 7, 2);

/**
 * Ease-out-back settle (0 -> 1 with subtle overshoot peaking near u ~ 0.72 and
 * crisp zero-velocity settle to 1.0) so pose transitions feel alive instead of robotic.
 */
export function springSettle(u: number, overshoot = 0.14): number {
  const t = clamp(u, 0, 1);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const base = 1 - Math.pow(1 - t, 4);
  if (overshoot <= 0) return base;
  const bump = (Math.pow(t, 5) * Math.pow(1 - t, 2)) / SPRING_BUMP_MAX;
  return base + overshoot * bump;
}

/**
 * Anticipation ease (0 -> -dip -> 1): coils backward smoothly into a subtle
 * reverse dip before snapping forward for punches, leaps, and turns.
 */
export function anticipateEase(u: number, dip = 0.08): number {
  const t = clamp(u, 0, 1);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (dip <= 0) return smooth(t);
  const split = 0.24;
  if (t < split) {
    return -dip * Math.sin(Math.PI * (t / split));
  }
  const q = (t - split) / (1 - split);
  return 1 - Math.pow(1 - q, 3);
}

/**
 * Symmetric parabolic jump arc: returns positive elevation (px above ground),
 * guaranteed 0 at u <= 0 and u >= 1, peaking at `height` at u = 0.5.
 */
export function parabolicArc(u: number, height: number): number {
  const c = clamp(u, 0, 1);
  return 4 * c * (1 - c) * height;
}

/**
 * Volume-preserving 2D squash & stretch scale pair (`sx * sy === 1`).
 * Clamps `scaleY` into `[0.65, 1.45]` so characters never pancake or turn needle-thin.
 */
export function squashStretch(scaleY: number): {sx: number; sy: number} {
  const sy = clamp(Number.isFinite(scaleY) ? scaleY : 1, 0.65, 1.45);
  return {sx: 1 / sy, sy};
}

export type SquashLeapCfg = {
  height?: number; // peak vertical leap height in world px (default 70)
  dur?: number; // full 4-phase leap cycle duration in seconds (default 0.90)
  squat?: number; // anticipation crouch scaleY (default 0.80)
  stretch?: number; // launch vertical stretch scaleY (default 1.24)
  land?: number; // landing impact squash scaleY (default 0.78)
};

export type SquashLeapSample = {
  dy: number; // vertical offset in px (negative = airborne upward; 0 = grounded)
  sx: number; // volume-preserving horizontal scale multiplier (1 / sy)
  sy: number; // vertical scale multiplier
  shadowScale: number; // ground shadow scale multiplier (1 grounded, shrinks at apex)
  takeoffDust: boolean; // true during launch window for <DustPuff>
  landingDust: boolean; // true during impact window for <DustPuff>
  active: boolean; // true while localT is inside [0, dur]
};

/**
 * Story-motivated 4-phase cartoon squash-and-stretch leap anchored at character feet (y = 0):
 *   0.00–0.18  Anticipation crouch (feet planted, body compresses)
 *   0.18–0.72  Launch stretch -> parabolic apex -> pre-land stretch
 *   0.72–0.86  Landing impact squash (volume-preserving wide cushion)
 *   0.86–1.00  Damped elastic settle back to (1, 1)
 */
export function evalSquashLeap(localT: number, cfg: SquashLeapCfg = {}): SquashLeapSample {
  const dur = Math.max(0.25, cfg.dur ?? 0.9);
  const h = Math.max(0, cfg.height ?? 70);
  const squat = clamp(cfg.squat ?? 0.8, 0.68, 0.98);
  const stretch = clamp(cfg.stretch ?? 1.24, 1.02, 1.38);
  const land = clamp(cfg.land ?? 0.78, 0.68, 0.98);

  if (!Number.isFinite(localT) || localT < 0 || localT > dur) {
    return {dy: 0, sx: 1, sy: 1, shadowScale: 1, takeoffDust: false, landingDust: false, active: false};
  }

  const u = localT / dur;
  const tAnt = 0.18;
  const tLand = 0.72;
  const tImpact = 0.86;
  let dy = 0;
  let sy = 1;

  if (u < tAnt) {
    const p = u / tAnt;
    sy = 1 - (1 - squat) * Math.sin(p * Math.PI * 0.5);
  } else if (u < tLand) {
    const p = (u - tAnt) / (tLand - tAnt);
    dy = -parabolicArc(p, h);
    const launch = Math.exp(-p * 6.5) * (stretch - 1);
    const preLand = Math.exp(-(1 - p) * 7.5) * (stretch - 1) * 0.75;
    const apex = -Math.sin(p * Math.PI) * 0.03;
    sy = 1 + launch + preLand + apex;
  } else if (u < tImpact) {
    const p = (u - tLand) / (tImpact - tLand);
    sy = 1 - (1 - land) * Math.sin(p * Math.PI);
  } else {
    const p = (u - tImpact) / (1 - tImpact);
    const damp = Math.exp(-p * 4.5);
    sy = 1 + (1 - land) * 0.28 * damp * Math.sin(p * Math.PI * 1.5);
  }

  const {sx, sy: clampedSy} = squashStretch(sy);
  const liftFrac = h > 0 ? clamp(-dy / h, 0, 1) : 0;
  const shadowScale = 1 - 0.36 * liftFrac;
  const takeoffDust = u >= tAnt && u <= tAnt + 0.14;
  const landingDust = u >= tLand && u <= tLand + 0.18;
  return {dy, sx, sy: clampedSy, shadowScale, takeoffDust, landingDust, active: true};
}

/**
 * Brief volume-preserving pop/startle impulse anchored at character feet (y = 0):
 * Crisp upward stretch pop -> gentle damped settle in ~0.48s.
 * Keep `amp` restrained (0.08–0.14) and strictly story-motivated (startles, reveals, impacts).
 */
export function evalPopSquash(
  localT: number,
  amp = 0.12,
): {sx: number; sy: number; dy: number; active: boolean} {
  const dur = 0.48;
  if (!Number.isFinite(localT) || localT < 0 || localT > dur) {
    return {sx: 1, sy: 1, dy: 0, active: false};
  }
  const a = clamp(amp, 0.02, 0.24);
  const u = localT / dur;
  const env = Math.exp(-u * 6.2);
  const wave = Math.sin(u * Math.PI * 3.0);
  const sy = 1 + a * env * wave;
  const {sx, sy: clampedSy} = squashStretch(sy);
  const dy = -a * 42 * Math.exp(-u * 7.5) * Math.max(0, Math.sin(u * Math.PI * 1.6));
  return {sx, sy: clampedSy, dy, active: true};
}

/**
 * Whole-body 3-stage anticipation dip -> overshoot pop -> damped cosine settle
 * impulse for pose/expression transitions and Hero Subject pose switches (RSI v5.4.0).
 */
export function poseImpulse(
  u: number,
  intensity = 1,
): {squash: number; dy: number; leanKick: number} {
  if (!Number.isFinite(u) || u <= 0 || u >= 1) {
    return {squash: 1, dy: 0, leanKick: 0};
  }
  if (u < 0.25) {
    const w = Math.sin((u / 0.25) * Math.PI * 0.5);
    return {
      squash: 1 - 0.065 * intensity * w,
      dy: 7 * intensity * w,
      leanKick: -3.5 * intensity * w,
    };
  }
  if (u < 0.65) {
    const w = Math.sin(((u - 0.25) / 0.4) * Math.PI);
    return {
      squash: 1 + 0.055 * intensity * w,
      dy: -6 * intensity * w,
      leanKick: 3.0 * intensity * w,
    };
  }
  const r = (u - 0.65) / 0.35;
  const w = Math.sin(r * Math.PI) * Math.cos(r * Math.PI * 0.5) * (1 - r);
  return {
    squash: 1 - 0.02 * intensity * w,
    dy: 2.2 * intensity * w,
    leanKick: -1.1 * intensity * w,
  };
}

/**
 * Continuous organic idle micro-acting: breathing chest/shoulder lift, subtle
 * weight sway, gentle head micro-tilt, and natural eye micro-saccades (RSI v5.4.0).
 */
export function livingIdle(
  t: number,
  ph: number,
): {
  breathe: number;
  swayX: number;
  headTilt: number;
  shoulderLift: number;
  pupilDx: number;
} {
  const breathe = Math.sin(t * 2.7 + ph);
  const swayX = Math.sin(t * 1.45 + ph * 1.3) * 3.2;
  const headTilt = Math.sin(t * 1.85 + ph * 0.7) * 1.8;
  const shoulderLift = breathe * 3.0;
  const sac = Math.sin(t * 1.1 + ph * 2.1);
  const pupilDx = sac > 0.82 ? 2.2 : sac < -0.82 ? -2.2 : 0;
  return {breathe, swayX, headTilt, shoulderLift, pupilDx};
}

/**
 * Expressive speech micro-acting driven by active `talk` envelope: vertical
 * speech nod, conversational head tilt, lively brow emphasis, open-hand gesture
 * bounce, and chest breath pulse (RSI v5.4.0).
 */
export function talkGesture(
  t: number,
  talk: number,
  ph: number,
): {
  headNod: number;
  headTilt: number;
  browBob: number;
  handBob: number;
  chestPulse: number;
} {
  if (!Number.isFinite(talk) || talk <= 0.01) {
    return {headNod: 0, headTilt: 0, browBob: 0, handBob: 0, chestPulse: 0};
  }
  const amp = Math.min(1, talk * 1.25);
  const headNod = Math.sin(t * 9.5 + ph) * 4.5 * amp;
  const headTilt = Math.sin(t * 5.2 + ph * 1.4) * 3.6 * amp;
  const browBob = -Math.abs(Math.sin(t * 8.4 + ph)) * 4.2 * amp;
  const handBob = Math.sin(t * 7.8 + ph * 0.9) * 9.0 * amp;
  const chestPulse = Math.abs(Math.sin(t * 9.5 + ph)) * 0.018 * amp;
  return {headNod, headTilt, browBob, handBob, chestPulse};
}

/**
 * Unified Hero Subject / creature kinematics solver (RSI v5.5.0):
 * Combines pose-switch squash/hop impulse, continuous breathing, aerial hover/flight
 * bob & bank (`altitude > 20 || pose === 'fly' || pose === 'hover'`), and grounded
 * quadruped stride bob & rock (`speed > 0.05`). Shared by `Film` and `ActorView`
 * so mounted riders and IK grips stay 100% sub-pixel locked.
 */
export function computeSubjectKinematics(opts: {
  poseU: number;
  pose: string;
  speed: number;
  phase: number;
  altitude: number;
  s: number;
  tilt: number;
  flip: boolean;
  t: number;
  idx: number;
}): {sx: number; sy: number; dy: number; rot: number; hopLift: number} {
  const fSign = opts.flip ? -1 : 1;
  const cImp = opts.poseU < 1 ? poseImpulse(opts.poseU, 1.35) : {squash: 1, dy: 0, leanKick: 0};
  const cBreathe = 1 + Math.sin(opts.t * 3.1 + opts.idx) * 0.012;
  const dyImp = cImp.dy - (opts.poseU < 1 ? Math.sin(opts.poseU * Math.PI) * 12 : 0);

  const isAerial = opts.altitude > 20 || opts.pose === 'fly' || opts.pose === 'hover';
  let locoDy = 0;
  let locoPitch = 0;
  if (isAerial) {
    locoDy = Math.sin(opts.t * 5.2 + opts.idx * 1.7) * 8.5;
    locoPitch = Math.cos(opts.t * 5.2 + opts.idx * 1.7) * 2.2;
  } else if (opts.altitude <= 20 && opts.speed > 0.05 && opts.pose !== 'fly' && opts.pose !== 'hover') {
    const sp = Math.min(1.25, opts.speed);
    locoDy = -Math.abs(Math.sin(opts.phase * Math.PI * 2)) * 6.5 * sp;
    locoPitch = Math.sin(opts.phase * Math.PI * 2) * 2.2 * sp;
  }

  const sx = (opts.s / Math.sqrt(cImp.squash)) * fSign;
  const sy = opts.s * cImp.squash * cBreathe;
  const dy = dyImp + locoDy;
  const rot = opts.tilt + (cImp.leanKick + locoPitch) * fSign;
  return {sx, sy, dy, rot, hopLift: Math.max(0, -dy)};
}

// ============================================================================
// 2. 4-Phase Foot-Roll Gait Biomechanics
// ============================================================================

export type FootSample = {
  x: number;
  y: number;
  lift: number;
  toeRot: number;
  heelLift: number;
  isStrike: boolean;
};

const swingToeAngle = (r: number, pushRot: number, midRot: number, strikeRot: number): number => {
  if (r < 0.2) {
    const k = smooth(r / 0.2);
    return pushRot + (midRot - pushRot) * k;
  }
  if (r < 0.8) {
    return midRot;
  }
  const k = smooth((r - 0.8) / 0.2);
  return midRot + (strikeRot - midRot) * k;
};

/**
 * 4-phase articulated foot-roll gait sampler (Contact -> Mid-Stance -> Push-Off -> Swing).
 * - `walk`: stance = 0.60, heel strike (-14*speed), flat mid-stance (0), toe push-off (+20*speed), 32px swing arch (+10*speed).
 * - `run`: stance = 0.38 (true double-airborne flight phase!), heel strike (-16*speed), strong push-off (+28*speed),
 *   rear-peaked 42px heel recovery tapering cleanly into forward knee drive.
 */
export function footCycle(
  phase: number,
  legIdx: 0 | 1,
  stride: number,
  speed: number,
  slope: number,
  mode: 'walk' | 'run',
): FootSample {
  const q = (((phase + legIdx * 0.5) % 1) + 1) % 1;
  const spd = Math.max(0, speed);
  const effStride = stride * Math.min(1.35, spd);
  const idleOff = (legIdx ? -1 : 1) * 14 * (1 - clamp(spd * 2, 0, 1));

  let x = 0;
  let lift = 0;
  let toeRot = 0;
  let heelLift = 0;
  let isStrike = false;

  if (mode === 'walk') {
    const stance = 0.6;
    const strikeEnd = 0.12;
    const pushStart = 0.46;
    if (q < stance) {
      x = effStride * (0.5 - q / stance);
      if (q < strikeEnd) {
        const u = q / strikeEnd;
        toeRot = -14 * spd * (1 - smooth(u));
        isStrike = q < 0.08 && spd > 0.4;
      } else if (q < pushStart) {
        toeRot = 0;
      } else {
        const u = (q - pushStart) / (stance - pushStart);
        const su = smooth(u);
        toeRot = 20 * spd * su;
        heelLift = 14 * Math.min(1, spd) * su;
      }
    } else {
      const r = (q - stance) / (1 - stance);
      x = -effStride * 0.5 + effStride * smooth(r);
      lift = Math.sin(Math.PI * r) * (32 + 24 * Math.abs(slope)) * Math.min(1, spd * 1.4);
      toeRot = swingToeAngle(r, 20 * spd, 10 * spd, -14 * spd);
      heelLift = lift * 0.35;
    }
  } else {
    const stance = 0.38;
    const strikeEnd = 0.08;
    const pushStart = 0.24;
    if (q < stance) {
      x = effStride * (0.5 - q / stance);
      if (q < strikeEnd) {
        const u = q / strikeEnd;
        toeRot = -16 * spd * (1 - smooth(u));
        isStrike = q < 0.08 && spd > 0.4;
      } else if (q < pushStart) {
        toeRot = 0;
      } else {
        const u = (q - pushStart) / (stance - pushStart);
        const su = smooth(u);
        toeRot = 28 * spd * su;
        heelLift = 22 * Math.min(1, spd) * su;
      }
    } else {
      const r = clamp((q - stance) / (1 - stance), 0, 1);
      x = -effStride * 0.5 + effStride * Math.pow(smooth(r), 0.85);
      lift = Math.sin(Math.PI * Math.pow(r, 0.72)) * (42 + 22 * Math.abs(slope)) * Math.min(1, spd * 1.35);
      toeRot = swingToeAngle(r, 28 * spd, 12 * spd, -16 * spd);
      heelLift = lift * 0.4;
    }
  }

  x += idleOff;
  const y = x * slope - lift;
  return {x, y, lift, toeRot, heelLift, isStrike};
}

/**
 * Hip bounce, delayed head counter-nod (lagging 0.14 cycle behind hip bob),
 * and rhythmic torso shoulder sway driven by the gait phase.
 */
export function gaitHipBob(
  phase: number,
  speed: number,
  mode: 'walk' | 'run',
): {dy: number; headLagDeg: number; torsoTwist: number} {
  const spd = Math.min(1.3, Math.max(0, speed));
  if (spd <= 0.001) return {dy: 0, headLagDeg: 0, torsoTwist: 0};

  const downPeak = mode === 'walk' ? 10 : 16;
  const upPeak = mode === 'walk' ? -8 : -28;
  const downOffset = mode === 'walk' ? 0.08 : 0.16;

  const wave = Math.cos(4 * Math.PI * (phase - downOffset));
  const mid = (downPeak + upPeak) * 0.5;
  const amp = (downPeak - upPeak) * 0.5;
  const dy = (mid + amp * wave) * Math.min(1.15, spd);

  const laggedWave = Math.cos(4 * Math.PI * (phase - downOffset - 0.14));
  const headLagDeg = -4 * Math.min(1, spd) * laggedWave;
  const torsoTwist = 3 * Math.min(1, spd) * Math.sin(2 * Math.PI * phase);

  return {dy, headLagDeg, torsoTwist};
}

// ============================================================================
// 3. Organic Tapered Articulated Limbs (taperSegPath + TaperLimb)
// ============================================================================

export type P2 = [number, number];

/**
 * Builds a closed G1-tangent tapered capsule SVG path from circle (a, rA) to (b, rB)
 * with smooth rounded endcaps. Degenerate zero-length or nested inputs safely
 * collapse to a circle path (zero NaN).
 */
export function taperSegPath(a: P2, b: P2, rA: number, rB: number): string {
  const ra = Math.max(0.5, Number.isFinite(rA) ? rA : 1);
  const rb = Math.max(0.5, Number.isFinite(rB) ? rB : 1);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dist = Math.hypot(dx, dy);

  if (!Number.isFinite(dist) || dist < 0.5) {
    const r = Math.max(ra, rb);
    return E(a[0], a[1], r, r);
  }
  if (dist <= Math.abs(ra - rb) + 0.25) {
    const c = ra >= rb ? a : b;
    const r = Math.max(ra, rb);
    return E(c[0], c[1], r, r);
  }

  const ux = dx / dist;
  const uy = dy / dist;
  const nx = -uy;
  const ny = ux;

  const cosPhi = clamp((ra - rb) / dist, -0.999, 0.999);
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));

  const tx1 = ux * cosPhi + nx * sinPhi;
  const ty1 = uy * cosPhi + ny * sinPhi;
  const tx2 = ux * cosPhi - nx * sinPhi;
  const ty2 = uy * cosPhi - ny * sinPhi;

  const a1x = a[0] + tx1 * ra;
  const a1y = a[1] + ty1 * ra;
  const b1x = b[0] + tx1 * rb;
  const b1y = b[1] + ty1 * rb;
  const b2x = b[0] + tx2 * rb;
  const b2y = b[1] + ty2 * rb;
  const a2x = a[0] + tx2 * ra;
  const a2y = a[1] + ty2 * ra;

  const largeArcB = rb > ra ? 1 : 0;
  const largeArcA = ra > rb ? 1 : 0;

  return (
    `M${n1(a1x)} ${n1(a1y)}` +
    `L${n1(b1x)} ${n1(b1y)}` +
    `A${n1(rb)} ${n1(rb)} 0 ${largeArcB} 0 ${n1(b2x)} ${n1(b2y)}` +
    `L${n1(a2x)} ${n1(a2y)}` +
    `A${n1(ra)} ${n1(ra)} 0 ${largeArcA} 0 ${n1(a1x)} ${n1(a1y)}Z`
  );
}

export type TaperLimbProps = {
  pts: P2[];
  wTop: number;
  wMid?: number;
  wBot: number;
  fill: string;
  shade?: boolean;
  dim?: number;
  sleeveFrac?: number;
  sleeveFill?: string;
  jointCrease?: boolean;
};

/**
 * 2-segment (or 1-segment) tapered articulated limb with merged silhouette ink outline
 * behind both segments (no internal knee/elbow seam line), optional halftone shade,
 * short-sleeve cuff with hem line, inner-joint crease tick, and far-limb depth dim.
 */
export const TaperLimb: React.FC<TaperLimbProps> = ({
  pts,
  wTop,
  wMid,
  wBot,
  fill,
  shade = false,
  dim = 0,
  sleeveFrac,
  sleeveFill,
  jointCrease = false,
}) => {
  if (pts.length < 2) return null;

  const p0 = pts[0];
  const p1 = pts[1];
  const hasSeg2 = pts.length >= 3;
  const p2 = hasSeg2 ? pts[2] : p1;

  const rTop = Math.max(1, wTop * 0.5);
  const rBot = Math.max(1, wBot * 0.5);
  const rMid = Math.max(1, (wMid ?? (wTop + wBot) * 0.5) * 0.5);

  const d1 = taperSegPath(p0, p1, rTop, hasSeg2 ? rMid : rBot);
  const d2 = hasSeg2 ? taperSegPath(p1, p2, rMid, rBot) : '';
  const bodyFill = col(fill);

  // Optional short-sleeve cuff along segment 1
  const hasSleeve = Boolean(sleeveFrac && sleeveFrac > 0.05 && sleeveFill);
  let sleeveD = '';
  let hemD = '';
  if (hasSleeve && sleeveFrac && sleeveFill) {
    const f = clamp(sleeveFrac, 0.08, 0.95);
    const cuff: P2 = [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f];
    const rEnd = hasSeg2 ? rMid : rBot;
    const rCuff = rTop + (rEnd - rTop) * f + 2.2;
    sleeveD = taperSegPath(p0, cuff, rTop + 2.2, rCuff);

    const sdx = p1[0] - p0[0];
    const sdy = p1[1] - p0[1];
    const sLen = Math.hypot(sdx, sdy);
    if (sLen > 1) {
      const ux = sdx / sLen;
      const uy = sdy / sLen;
      const nx = -uy;
      const ny = ux;
      const hw = rCuff * 0.96;
      const hlx = cuff[0] + nx * hw;
      const hly = cuff[1] + ny * hw;
      const hrx = cuff[0] - nx * hw;
      const hry = cuff[1] - ny * hw;
      const hcx = cuff[0] + ux * (rCuff * 0.36);
      const hcy = cuff[1] + uy * (rCuff * 0.36);
      hemD = `M${n1(hlx)} ${n1(hly)}Q${n1(hcx)} ${n1(hcy)} ${n1(hrx)} ${n1(hry)}`;
    }
  }

  // Optional inner-joint crease tick at bend apex p1
  let creaseD = '';
  if (jointCrease && hasSeg2) {
    const v1x = p0[0] - p1[0];
    const v1y = p0[1] - p1[1];
    const v2x = p2[0] - p1[0];
    const v2y = p2[1] - p1[1];
    const l1 = Math.hypot(v1x, v1y);
    const l2 = Math.hypot(v2x, v2y);
    if (l1 > 1 && l2 > 1) {
      const u1x = v1x / l1;
      const u1y = v1y / l1;
      const u2x = v2x / l2;
      const u2y = v2y / l2;
      const dot = u1x * u2x + u1y * u2y;
      if (dot > -0.92) {
        const bx = u1x + u2x;
        const by = u1y + u2y;
        const bLen = Math.hypot(bx, by);
        if (bLen > 0.05) {
          const ix = bx / bLen;
          const iy = by / bLen;
          const cStartX = p1[0] + ix * (rMid * 0.18);
          const cStartY = p1[1] + iy * (rMid * 0.18);
          const cEndX = p1[0] + ix * (rMid * 0.88);
          const cEndY = p1[1] + iy * (rMid * 0.88);
          const cMidX = (cStartX + cEndX) * 0.5 - iy * (rMid * 0.12);
          const cMidY = (cStartY + cEndY) * 0.5 + ix * (rMid * 0.12);
          creaseD = `M${n1(cStartX)} ${n1(cStartY)}Q${n1(cMidX)} ${n1(cMidY)} ${n1(cEndX)} ${n1(cEndY)}`;
        }
      }
    }
  }

  const dimOp = clamp(dim, 0, 0.72);
  const children: React.ReactNode[] = [
    // 1. Unified outer ink silhouette behind both segments
    h('path', {
      key: 'o1',
      d: d1,
      fill: PAL.ink,
      stroke: PAL.ink,
      strokeWidth: LINE * 2,
      strokeLinejoin: 'round',
      strokeLinecap: 'round',
    }),
  ];

  if (d2) {
    children.push(
      h('path', {
        key: 'o2',
        d: d2,
        fill: PAL.ink,
        stroke: PAL.ink,
        strokeWidth: LINE * 2,
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
      }),
    );
  }

  // 2. Seamless tapered fills covering internal joint seam
  children.push(h('path', {key: 'f1', d: d1, fill: bodyFill, stroke: 'none'}));
  if (d2) {
    children.push(h('path', {key: 'f2', d: d2, fill: bodyFill, stroke: 'none'}));
  }

  // 3. Optional riso halftone depth shade
  if (shade) {
    children.push(h('path', {key: 'sh1', d: d1, fill: 'url(#dots)', opacity: 0.22}));
    if (d2) {
      children.push(h('path', {key: 'sh2', d: d2, fill: 'url(#dots)', opacity: 0.22}));
    }
  }

  // 4. Optional short-sleeve cuff + rounded hem
  if (hasSleeve && sleeveD && sleeveFill) {
    children.push(
      h('path', {
        key: 'so',
        d: sleeveD,
        fill: PAL.ink,
        stroke: PAL.ink,
        strokeWidth: LINE * 2,
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
      }),
      h('path', {key: 'sf', d: sleeveD, fill: col(sleeveFill), stroke: 'none'}),
    );
    if (hemD) {
      children.push(
        h('path', {
          key: 'sh',
          d: hemD,
          fill: 'none',
          stroke: PAL.ink,
          strokeWidth: Math.max(2.6, LINE * 0.7),
          strokeLinecap: 'round',
        }),
      );
    }
  }

  // 5. Optional subtle inner-joint crease tick
  if (creaseD) {
    children.push(
      h('path', {
        key: 'cr',
        d: creaseD,
        fill: 'none',
        stroke: PAL.ink,
        strokeWidth: Math.max(2.2, LINE * 0.55),
        strokeLinecap: 'round',
        opacity: 0.55,
      }),
    );
  }

  // 6. Optional far-limb depth dimming overlay
  if (dimOp > 0.001) {
    children.push(h('path', {key: 'd1', d: d1, fill: PAL.ink, opacity: dimOp, stroke: 'none'}));
    if (d2) {
      children.push(h('path', {key: 'd2', d: d2, fill: PAL.ink, opacity: dimOp, stroke: 'none'}));
    }
    if (hasSleeve && sleeveD) {
      children.push(h('path', {key: 'ds', d: sleeveD, fill: PAL.ink, opacity: dimOp, stroke: 'none'}));
    }
  }

  return h('g', null, ...children);
};

// ============================================================================
// 4. Curved C-Arc Torso Silhouette Builder
// ============================================================================

/**
 * Generates an organic curved cubic-bezier torso path that bends along `bendX`
 * (positive = forward C-curve for run/ride/push/crouch; negative = backward reverse-C
 * arch for fall/cheer/shock) with optional belly fullness.
 */
export function curvedTorsoPath(
  topL: number,
  topR: number,
  botL: number,
  botR: number,
  sY: number,
  hemY: number,
  bendX: number,
  belly = 0,
): string {
  const height = hemY - sY;
  const absH = Math.abs(height);
  const tlX = topL + bendX * 0.35;
  const trX = topR + bendX * 0.35;
  const midTopX = (tlX + trX) * 0.5;
  const crownY = sY - clamp(absH * 0.08, 4, 14);
  const hemMidX = (botL + botR) * 0.5;
  const hemDropY = hemY + clamp(absH * 0.035, 2, 8);

  const bellyOut = belly * 28;
  const cpL1x = tlX - bendX * 0.48 - 4;
  const cpL1y = sY + height * 0.32;
  const cpL2x = botL - bendX * 0.42 - 3;
  const cpL2y = sY + height * 0.7;

  const cpR1x = botR - bendX * 0.18 + bellyOut * 0.95 + 3;
  const cpR1y = sY + height * 0.7;
  const cpR2x = trX - bendX * 0.28 + bellyOut * 0.65 + 2;
  const cpR2y = sY + height * 0.32;

  return (
    `M${n1(tlX)} ${n1(sY)}` +
    `C${n1(cpL1x)} ${n1(cpL1y)} ${n1(cpL2x)} ${n1(cpL2y)} ${n1(botL)} ${n1(hemY)}` +
    `Q${n1(hemMidX)} ${n1(hemDropY)} ${n1(botR)} ${n1(hemY)}` +
    `C${n1(cpR1x)} ${n1(cpR1y)} ${n1(cpR2x)} ${n1(cpR2y)} ${n1(trX)} ${n1(sY)}` +
    `Q${n1(midTopX)} ${n1(crownY)} ${n1(tlX)} ${n1(sY)}Z`
  );
}

// ============================================================================
// 5. Secondary Motion Hair / Wind Helper
// ============================================================================

/**
 * Computes smooth trailing displacement + high-frequency flutter driven by
 * wind stream and horizontal velocity so hair and cowlicks trail naturally.
 */
export function hairWindOffset(
  t: number,
  wind = 0,
  velX = 0,
  phase = 0,
): {dx: number; dy: number; rot: number} {
  const flow = wind + clamp(velX / 260, -2, 2);
  const mag = Math.min(2.5, Math.abs(flow));
  const fl1 = Math.sin(t * 9 + phase);
  const fl2 = Math.cos(t * 14.5 + phase * 1.7);

  const dx = -flow * 14 + fl1 * (1.2 + mag * 3.8);
  const dy = -mag * 3.5 + fl2 * (0.8 + mag * 2.4);
  const rot = clamp(-flow * 12 + fl1 * (1.8 + mag * 4.8), -36, 36);
  return {dx, dy, rot};
}

// ============================================================================
// 6. Grounding Shadows & Procedural Riso Action FX Components
// ============================================================================

export type GroundShadowProps = {
  x?: number;
  y?: number;
  rx: number;
  ry?: number;
  alt?: number;
  opacity?: number;
};

/**
 * Elliptical grounded contact shadow (`PAL.ink`) that scales down and fades softly
 * as altitude `alt` increases, with a sharper darker occlusion core at contact.
 */
export const GroundShadow: React.FC<GroundShadowProps> = ({
  x = 0,
  y = 0,
  rx,
  ry,
  alt = 0,
  opacity = 0.26,
}) => {
  const safeRx = Math.max(2, rx);
  const safeRy = Math.max(2, ry ?? safeRx * 0.24);
  const safeAlt = Math.max(0, alt);
  const scale = 1 / (1 + safeAlt / 260);
  const op = clamp(opacity, 0, 1) / (1 + safeAlt / 200);
  const coreOp = (op * 0.72) / (1 + safeAlt / 90);

  return h(
    'g',
    {pointerEvents: 'none'},
    h('ellipse', {
      cx: n1(x),
      cy: n1(y),
      rx: n1(safeRx * scale),
      ry: n1(safeRy * scale),
      fill: PAL.ink,
      opacity: n2(op * 0.68),
    }),
    h('ellipse', {
      cx: n1(x),
      cy: n1(y),
      rx: n1(safeRx * scale * 0.62),
      ry: n1(safeRy * scale * 0.58),
      fill: PAL.ink,
      opacity: n2(coreOp),
    }),
  );
};

export type SeatShadowProps = {
  dx: number;
  dy: number;
  rx?: number;
  ry?: number;
};

/**
 * Soft curved contact shadow painted directly onto a mount's shell or saddle
 * beneath a rider's seat so the rider looks physically pressed into the mount.
 */
export const SeatShadow: React.FC<SeatShadowProps> = ({dx, dy, rx = 44, ry = 14}) => {
  const safeRx = Math.max(4, rx);
  const safeRy = Math.max(3, ry);
  const lx = dx - safeRx * 0.85;
  const rxEnd = dx + safeRx * 0.85;
  const edgeY = dy + safeRy * 0.15;
  const crescent =
    `M${n1(lx)} ${n1(edgeY)}` +
    `Q${n1(dx)} ${n1(dy + safeRy * 0.95)} ${n1(rxEnd)} ${n1(edgeY)}` +
    `Q${n1(dx)} ${n1(dy + safeRy * 0.42)} ${n1(lx)} ${n1(edgeY)}Z`;

  return h(
    'g',
    {pointerEvents: 'none'},
    h('ellipse', {
      cx: n1(dx),
      cy: n1(dy + 2),
      rx: n1(safeRx),
      ry: n1(safeRy),
      fill: PAL.ink,
      opacity: 0.22,
    }),
    h('path', {
      d: crescent,
      fill: PAL.ink,
      opacity: 0.26,
    }),
  );
};

export type DustPuffProps = {
  x: number;
  y: number;
  t: number;
  dir?: number;
  seed?: number;
  scale?: number;
  intensity?: number;
};

/**
 * Animated 3-puff riso-ink dust cloud (`PAL.paper` / `PAL.trim` with soft `PAL.ink` stroke)
 * expanding and drifting behind footstrikes or bursting outward on jump/fall landings.
 */
export const DustPuff: React.FC<DustPuffProps> = ({x, y, t, dir = 1, seed = 1, scale = 1, intensity = 1}) => {
  const dSign = dir >= 0 ? 1 : -1;
  const safeScale = Math.max(0.15, scale);
  const safeInt = clamp(intensity, 0, 1.5);
  const puffs = [0, 1, 2].map((i) => {
    const u = (((t * 1.85 + seed * 0.37 + i * 0.29) % 1) + 1) % 1;
    const env = Math.sin(Math.PI * u);
    const px = -dSign * (10 + u * (38 + i * 11));
    const py = -4 - u * (18 + i * 6) - (i === 1 ? 6 : 0);
    const r = (12 + i * 3.5) * (0.42 + 0.78 * env);
    const fill = i % 2 === 0 ? PAL.paper : PAL.trim;
    const op = env * 0.88 * safeInt;

    return h(
      'g',
      {key: `p${i}`, opacity: n2(op)},
      h('circle', {
        cx: n1(px),
        cy: n1(py),
        r: n1(r),
        fill,
        stroke: PAL.ink,
        strokeWidth: 2.6,
      }),
      h('circle', {
        cx: n1(px - dSign * r * 0.55),
        cy: n1(py + r * 0.25),
        r: n1(r * 0.58),
        fill,
        stroke: PAL.ink,
        strokeWidth: 2.2,
      }),
      h('circle', {
        cx: n1(px - dSign * (r + 5)),
        cy: n1(py - r * 0.3),
        r: 2.4,
        fill: PAL.ink,
        opacity: 0.45,
      }),
    );
  });

  return h(
    'g',
    {
      pointerEvents: 'none',
      transform: `translate(${n1(x)} ${n1(y)}) scale(${n2(safeScale)})`,
    },
    ...puffs,
  );
};

export type SweatDropsProps = {
  x: number;
  y: number;
  t: number;
  count?: number;
};

/**
 * 2-3 animated teardrop strain beads (`PAL.ghost` / `PAL.white` with `PAL.ink` stroke)
 * flicking outward during push, brace, or panic moments.
 */
export const SweatDrops: React.FC<SweatDropsProps> = ({x, y, t, count = 3}) => {
  const n = Math.round(clamp(count, 1, 5));
  const drops: React.ReactNode[] = [];

  for (let i = 0; i < n; i++) {
    const u = (((t * 2.1 + i * 0.31) % 1) + 1) % 1;
    const spread = n === 1 ? 0 : i / (n - 1) - 0.5;
    const ang = -Math.PI * 0.5 + spread * 1.45;
    const dist = 10 + u * 34;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist + u * u * 18;
    const vx = Math.cos(ang) * 34;
    const vy = Math.sin(ang) * 34 + 36 * u;
    const rotDeg = (Math.atan2(vy, vx) * 180) / Math.PI - 90;
    const op = Math.sin(Math.PI * u) * 0.94;
    const sc = 0.72 + 0.38 * Math.sin(Math.PI * u);

    drops.push(
      h(
        'g',
        {
          key: `sw${i}`,
          transform: `translate(${n1(x + dx)} ${n1(y + dy)}) rotate(${n1(rotDeg)}) scale(${n2(sc)})`,
          opacity: n2(op),
        },
        h('path', {
          d: 'M0 -10 C5 -2 7 4 0 10 C-7 4 -5 -2 0 -10 Z',
          fill: PAL.ghost,
          stroke: PAL.ink,
          strokeWidth: 2.4,
          strokeLinejoin: 'round',
        }),
        h('circle', {cx: -1.8, cy: 1.5, r: 2.1, fill: PAL.white, opacity: 0.9}),
      ),
    );
  }

  return h('g', {pointerEvents: 'none'}, ...drops);
};

export type SpeedLinesProps = {
  x: number;
  y: number;
  w?: number;
  h?: number;
  t: number;
  dir?: number;
};

/**
 * Crisp kinetic motion streaks (`PAL.white` / `PAL.ink` at low opacity)
 * trailing behind sprinting or flying characters.
 */
export const SpeedLines: React.FC<SpeedLinesProps> = ({
  x,
  y,
  w = 180,
  h: bandH = 130,
  t,
  dir = 1,
}) => {
  const dSign = dir >= 0 ? 1 : -1;
  const safeW = Math.max(24, w);
  const safeH = Math.max(20, bandH);
  const lines: React.ReactNode[] = [];

  for (let i = 0; i < 6; i++) {
    const u = (((t * 4.5 + i * 0.19) % 1) + 1) % 1;
    const yOff = ((i + 0.5) / 6 - 0.5) * safeH;
    const len = safeW * (0.34 + ((i * 19) % 5) * 0.11);
    const startOff = u * safeW * 0.62;
    const x1 = x - dSign * startOff;
    const x2 = x1 - dSign * len;
    const yy = y + yOff;
    const isLight = i % 2 === 0;
    const op = Math.sin(Math.PI * u) * (isLight ? 0.62 : 0.28);

    lines.push(
      h('line', {
        key: `sl${i}`,
        x1: n1(x1),
        y1: n1(yy),
        x2: n1(x2),
        y2: n1(yy),
        stroke: isLight ? PAL.white : PAL.ink,
        strokeWidth: isLight ? 4.2 : 3,
        strokeLinecap: 'round',
        opacity: n2(op),
      }),
    );
  }

  return h('g', {pointerEvents: 'none'}, ...lines);
};

export type ImpactBurstProps = {
  x: number;
  y: number;
  t: number;
  s?: number;
};

/**
 * Comic starburst + expanding dust ring on floor contact during falls or trips.
 */
export const ImpactBurst: React.FC<ImpactBurstProps> = ({x, y, t, s = 1}) => {
  const safeS = Math.max(0.15, s);
  const u = (((t * 1.9) % 1) + 1) % 1;
  const pop = Math.sin(Math.PI * clamp(u, 0, 1));
  const op = clamp((1 - u * 0.82) * Math.min(1, u * 8), 0, 1);

  const ringRx = 56 * (0.38 + 0.78 * u);
  const ringRy = 15 * (0.38 + 0.78 * u);

  // 8-point comic jagged starburst rising from contact point
  const spikes = 8;
  const outerR = 34 * (0.55 + 0.65 * pop);
  const innerR = outerR * 0.44;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const ang = -Math.PI + (i / (spikes * 2 - 1)) * Math.PI;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r * 0.85;
    pts.push(`${i === 0 ? 'M' : 'L'}${n1(px)} ${n1(py)}`);
  }
  const starD = pts.join('') + 'Z';

  const ticks = [-2.55, -1.95, -1.2, -0.6].map((ang, i) => {
    const r1 = outerR * 1.05;
    const r2 = outerR * 1.48;
    return h('line', {
      key: `tk${i}`,
      x1: n1(Math.cos(ang) * r1),
      y1: n1(Math.sin(ang) * r1 * 0.85),
      x2: n1(Math.cos(ang) * r2),
      y2: n1(Math.sin(ang) * r2 * 0.85),
      stroke: PAL.ink,
      strokeWidth: 3.2,
      strokeLinecap: 'round',
    });
  });

  return h(
    'g',
    {
      pointerEvents: 'none',
      transform: `translate(${n1(x)} ${n1(y)}) scale(${n2(safeS)})`,
      opacity: n2(op),
    },
    h('ellipse', {
      cx: 0,
      cy: 0,
      rx: n1(ringRx),
      ry: n1(ringRy),
      fill: PAL.paper,
      fillOpacity: 0.45,
      stroke: PAL.ink,
      strokeWidth: 2.8,
      strokeDasharray: '10 6',
    }),
    h('path', {
      d: starD,
      fill: PAL.gold,
      stroke: PAL.ink,
      strokeWidth: 3.2,
      strokeLinejoin: 'round',
    }),
    h('ellipse', {
      cx: 0,
      cy: n1(-outerR * 0.2),
      rx: n1(innerR * 0.55),
      ry: n1(innerR * 0.35),
      fill: PAL.white,
      opacity: 0.85,
    }),
    ...ticks,
  );
};

const fiveStarPath = (rOuter: number, rInner: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${i === 0 ? 'M' : 'L'}${n1(Math.cos(ang) * r)} ${n1(Math.sin(ang) * r)}`);
  }
  return pts.join('') + 'Z';
};

export type DizzyStarsProps = {
  x: number;
  y: number;
  t: number;
  r?: number;
};

/**
 * Orbiting tiny gold stars (`PAL.gold` + `PAL.ink`) circling above a dazed/fallen character's head.
 */
export const DizzyStars: React.FC<DizzyStarsProps> = ({x, y, t, r = 46}) => {
  const safeR = Math.max(12, r);
  const ry = safeR * 0.34;
  const starD = fiveStarPath(10, 4.4);

  const stars = [0, 1, 2].map((i) => {
    const ang = t * 3.4 + (i * Math.PI * 2) / 3;
    const sx = Math.cos(ang) * safeR;
    const sy = Math.sin(ang) * ry;
    const depthScale = 0.78 + 0.3 * Math.sin(ang);
    const spin = (t * 90 + i * 45) % 360;
    return {i, sx, sy, depthScale, spin};
  });

  // Sort back-to-front by vertical orbit position
  stars.sort((a, b) => a.sy - b.sy);

  return h(
    'g',
    {
      pointerEvents: 'none',
      transform: `translate(${n1(x)} ${n1(y)})`,
    },
    h('ellipse', {
      cx: 0,
      cy: 0,
      rx: n1(safeR),
      ry: n1(ry),
      fill: 'none',
      stroke: PAL.ink,
      strokeWidth: 2,
      strokeDasharray: '6 7',
      opacity: 0.35,
    }),
    ...stars.map((st) =>
      h(
        'g',
        {
          key: `ds${st.i}`,
          transform: `translate(${n1(st.sx)} ${n1(st.sy)}) rotate(${n1(st.spin)}) scale(${n2(st.depthScale)})`,
        },
        h('path', {
          d: starD,
          fill: PAL.gold,
          stroke: PAL.ink,
          strokeWidth: 2.2,
          strokeLinejoin: 'round',
        }),
      ),
    ),
  );
};

// ============================================================================
// 7. Articulated Close-Up Cartoon Hands (RSI v5.5.0)
// ============================================================================

export type HandKind = 'open' | 'point' | 'fist' | 'cup';

export type CartoonHandProps = {
  x: number;
  y: number;
  ux?: number;
  uy?: number;
  skin: string;
  kind?: HandKind;
  side?: -1 | 1;
  r?: number;
  dim?: number;
};

/**
 * Expressive articulated cartoon hand centered at `(x, y)` oriented along forearm
 * unit vector `(ux, uy)` (default `(0, 1)` -> `deg = atan2(uy, ux) * 180 / PI - 90`),
 * using strictly `S`, `L`, `E`, `Rr` and `PAL` tokens (`sw = 3.5`).
 */
export const CartoonHand: React.FC<CartoonHandProps> = ({
  x,
  y,
  ux = 0,
  uy = 1,
  skin,
  kind = 'open',
  side = 1,
  r = 16.5,
  dim = 0,
}) => {
  const safeR = Math.max(4, Number.isFinite(r) ? r : 16.5);
  const sg = side < 0 ? -1 : 1;
  const rawUx = Number.isFinite(ux) ? ux : 0;
  const rawUy = Number.isFinite(uy) ? uy : 1;
  const uLen = Math.hypot(rawUx, rawUy);
  const dx = uLen > 1e-3 ? rawUx / uLen : 0;
  const dy = uLen > 1e-3 ? rawUy / uLen : 1;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
  const dimOp = clamp(dim, 0, 0.72);
  const children: React.ReactNode[] = [];

  if (kind === 'point') {
    const thumbD = E(sg * safeR * 0.68, safeR * 0.05, safeR * 0.42, safeR * 0.34);
    const fingerD = Rr(-safeR * 0.26, -safeR * 0.1, safeR * 0.52, safeR * 1.48, safeR * 0.24);
    const palmD = E(0, 0, safeR * 0.92, safeR * 0.88);
    const bridgeD = Rr(-safeR * 0.2, -safeR * 0.06, safeR * 0.4, safeR * 0.96, safeR * 0.18);
    const knD = `M${n1(-sg * safeR * 0.12)} ${n1(safeR * 0.48)}Q${n1(-sg * safeR * 0.44)} ${n1(safeR * 0.62)} ${n1(-sg * safeR * 0.66)} ${n1(safeR * 0.38)}`;
    children.push(
      h(S, {key: 'th', d: thumbD, f: skin, sw: 3.5}),
      h(S, {key: 'fg', d: fingerD, f: skin, sw: 3.5}),
      h(S, {key: 'pm', d: palmD, f: skin, sw: 3.5}),
      h(S, {key: 'br', d: bridgeD, f: skin, nl: true}),
      h(L, {key: 'kn', d: knD, w: 2.8, o: 0.75}),
    );
    if (dimOp > 0.001) {
      children.push(h(S, {key: 'dm', d: palmD, f: 'ink', nl: true, o: dimOp}));
    }
  } else if (kind === 'fist') {
    const fistD = Rr(-safeR * 0.95, -safeR * 0.78, safeR * 1.9, safeR * 1.56, safeR * 0.55);
    const c1D = `M${n1(-safeR * 0.3)} ${n1(safeR * 0.22)}L${n1(-safeR * 0.28)} ${n1(safeR * 0.62)}`;
    const c2D = `M${n1(safeR * 0.3)} ${n1(safeR * 0.22)}L${n1(safeR * 0.28)} ${n1(safeR * 0.62)}`;
    children.push(
      h(S, {key: 'fs', d: fistD, f: skin, sw: 3.5}),
      h(L, {key: 'k1', d: c1D, w: 2.8, o: 0.76}),
      h(L, {key: 'k2', d: c2D, w: 2.8, o: 0.76}),
    );
    if (dimOp > 0.001) {
      children.push(h(S, {key: 'dm', d: fistD, f: 'ink', nl: true, o: dimOp}));
    }
  } else if (kind === 'cup') {
    const thumbD = E(sg * safeR * 0.72, -safeR * 0.04, safeR * 0.38, safeR * 0.3);
    const cupD = E(0, 0, safeR * 0.98, safeR * 0.82);
    const bridgeD = E(sg * safeR * 0.44, -safeR * 0.02, safeR * 0.34, safeR * 0.22);
    const creaseD = `M${n1(-safeR * 0.46)} ${n1(safeR * 0.26)}Q0 ${n1(safeR * 0.48)} ${n1(safeR * 0.46)} ${n1(safeR * 0.26)}`;
    children.push(
      h(S, {key: 'th', d: thumbD, f: skin, sw: 3.5}),
      h(S, {key: 'cp', d: cupD, f: skin, sw: 3.5}),
      h(S, {key: 'br', d: bridgeD, f: skin, nl: true}),
      h(L, {key: 'cr', d: creaseD, w: 2.6, o: 0.6}),
    );
    if (dimOp > 0.001) {
      children.push(h(S, {key: 'dm', d: cupD, f: 'ink', nl: true, o: dimOp}));
    }
  } else {
    const thumbD = E(sg * safeR * 0.78, safeR * 0.08, safeR * 0.44, safeR * 0.32);
    const f1D = E(-safeR * 0.42, safeR * 0.74, safeR * 0.25, safeR * 0.42);
    const f2D = E(0, safeR * 0.8, safeR * 0.26, safeR * 0.45);
    const f3D = E(safeR * 0.42, safeR * 0.74, safeR * 0.25, safeR * 0.42);
    const palmD = E(0, 0, safeR * 0.92, safeR * 0.86);
    const unionPalmD = E(0, safeR * 0.16, safeR * 0.74, safeR * 0.68);
    const unionThumbD = E(sg * safeR * 0.46, safeR * 0.06, safeR * 0.38, safeR * 0.23);
    children.push(
      h(S, {key: 'th', d: thumbD, f: skin, sw: 3.5}),
      h(S, {key: 'f1', d: f1D, f: skin, sw: 3.5}),
      h(S, {key: 'f2', d: f2D, f: skin, sw: 3.5}),
      h(S, {key: 'f3', d: f3D, f: skin, sw: 3.5}),
      h(S, {key: 'pm', d: palmD, f: skin, sw: 3.5}),
      h(S, {key: 'up', d: unionPalmD, f: skin, nl: true}),
      h(S, {key: 'ut', d: unionThumbD, f: skin, nl: true}),
    );
    if (dimOp > 0.001) {
      children.push(h(S, {key: 'dm', d: palmD, f: 'ink', nl: true, o: dimOp}));
    }
  }

  return h('g', {transform: `translate(${n1(x)} ${n1(y)}) rotate(${n1(deg)})`}, ...children);
};

/**
 * Maps active pose name + arm side (`'l'` | `'r'`) to articulated `HandKind`.
 */
export function inferHandKind(poseName: string, side: 'l' | 'r'): HandKind {
  switch (poseName) {
    case 'pointL':
      return side === 'l' ? 'point' : 'fist';
    case 'pointR':
    case 'pointUp':
    case 'sitRaise':
      return side === 'r' ? 'point' : 'fist';
    case 'point':
      return 'point';
    case 'wave':
    case 'cheer':
    case 'shrug':
    case 'raise':
    case 'rideCheer':
      return 'open';
    case 'hands':
    case 'sitHands':
    case 'shock':
    case 'cover':
      return 'cup';
    case 'argue':
    case 'argue2':
    case 'hip':
    case 'ride':
    case 'push':
    case 'brace':
      return 'fist';
    case 'hipR':
      return side === 'r' ? 'fist' : 'open';
    default:
      return 'open';
  }
}
