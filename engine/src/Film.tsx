import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {Defs, FONT, L, PAL, S, E} from './kit';
import {Person, POSES, Pose, poseMix, Expr, Look, LegMode} from './chars';
import {PersonSide, SIDE_CYCLE, SideLegs, SideArms} from './side';
import {PersonBack} from './back';
import {Person3Q} from './threeq';
import {SETS, SetLayers, Item, SetOpts} from './sets';
import {OverView} from './overlays';
import {Actor, DURATION, ExtraDef, FPS, Keys, Shot, TT, WORDS, abs, resolveShots, tAt} from './engine';
import {FRAME_W, FRAME_H, CAPTION_Y} from './format';
import {SHOTS} from './episode/shotlist';
import {clamp, easeIO, easeOut, lerp, smooth} from './math';
import {HAND_PROPS, SIDE_PROPS, WORLD_PROPS} from './props';
import {CAST} from './episode/cast';
import {SUBJECTS} from './episode/subjects';
import {resolveSeat, SubjectDef, SubjectSeat} from './subjects';
import {EX_LOOKS} from './exemplar/looks';
import {
  springSettle,
  parabolicArc,
  evalSquashLeap,
  evalPopSquash,
  poseImpulse,
  computeSubjectKinematics,
  inferHandKind,
  HandKind,
  GroundShadow,
  SeatShadow,
  DustPuff,
  SweatDrops,
  SpeedLines,
  ImpactBurst,
  DizzyStars,
} from './anim';

export const LOOKS: Record<string, Look> = {...EX_LOOKS, ...CAST};

export const RESOLVED: Shot[] = resolveShots(SHOTS);

const keyAt = <T,>(k: Keys<T> | undefined, def: T, shot: Shot, t: number, blend = 0.22): {cur: T; prev: T; u: number} => {
  if (k === undefined) return {cur: def, prev: def, u: 1};
  if (!Array.isArray(k)) return {cur: k as T, prev: k as T, u: 1};
  const ks = k as [T, TT][];
  let i = 0;
  for (let j = 0; j < ks.length; j++) if (t >= abs(ks[j][1], shot)) i = j;
  if (t < abs(ks[0][1], shot)) return {cur: ks[0][0], prev: ks[0][0], u: 1};
  const u = i > 0 ? clamp((t - abs(ks[i][1], shot)) / blend) : 1;
  return {cur: ks[i][0], prev: i > 0 ? ks[i - 1][0] : ks[i][0], u};
};

// ---------------- chuyển động theo path: vận tốc hình thang ----------------
type Seg = {x0: number; y0: number; x1: number; y1: number; t0: number; t1: number};
const trap = (u: number, r: number) => {
  const vm = 1 / (1 - r);
  if (u <= 0) return {s: 0, v: 0};
  if (u >= 1) return {s: 1, v: 0};
  if (u < r) return {s: (vm * u * u) / (2 * r), v: (vm * u) / r};
  if (u < 1 - r) return {s: vm * (r / 2 + (u - r)), v: vm};
  const w = 1 - u;
  return {s: 1 - (vm * w * w) / (2 * r), v: (vm * w) / r};
};
const segsFromPath = (p: [number, number, TT][], shot: Shot): Seg[] => {
  const out: Seg[] = [];
  for (let i = 0; i + 1 < p.length; i++) {
    out.push({x0: p[i][0], y0: p[i][1], x1: p[i + 1][0], y1: p[i + 1][1], t0: abs(p[i][2], shot), t1: abs(p[i + 1][2], shot)});
  }
  return out;
};
const segsOf = (a: Actor, shot: Shot): Seg[] => segsFromPath(a.path!, shot);
/** vị trí + vận tốc (px/s) + quãng đường tích luỹ + hướng tại t */
const motion = (segs: Seg[], t: number) => {
  const first = segs.find((g) => Math.abs(g.x1 - g.x0) > 2);
  const d0 = first ? Math.sign(first.x1 - first.x0) : 0;
  let x = segs[0].x0, y = segs[0].y0, v = 0, vx = 0, dist = 0, dir = d0, lastDir = d0, segStart = -99, prevDir = d0;
  for (const g of segs) {
    const dx = g.x1 - g.x0, dy = g.y1 - g.y0;
    const D = Math.hypot(dx, dy);
    const sd = Math.abs(dx) > 2 ? Math.sign(dx) : 0;
    if (t < g.t0) break;
    const T = Math.max(0.01, g.t1 - g.t0);
    const r = Math.min(0.3, Math.max(0.12, 0.28 / T));
    const m = trap((t - g.t0) / T, r);
    x = g.x0 + dx * m.s;
    y = g.y0 + dy * m.s;
    v = (D / T) * m.v;
    vx = (dx / T) * m.v;
    dist += t >= g.t1 ? D : D * m.s;
    if (sd) {
      if (sd !== lastDir) { prevDir = lastDir; segStart = g.t0; }
      lastDir = sd;
    }
    dir = lastDir;
  }
  return {x, y, v, vx, dist, dir, prevDir, segStart};
};

const propFor = (name: string | undefined, t: number) => {
  if (!name) return undefined;
  const f = HAND_PROPS[name];
  if (!f) throw new Error('unknown hand prop ' + name + ' (register it in props.tsx HAND_PROPS)');
  return (h: {l: [number, number]; r: [number, number]}) => f(h, t);
};
const sidePropFor = (name: string | undefined, t: number) => {
  if (!name) return undefined;
  const f = SIDE_PROPS[name];
  if (!f) throw new Error('unknown side prop ' + name + ' (register it in props.tsx SIDE_PROPS)');
  return (h: {near: [number, number]; far: [number, number]}) => f(h, t);
};

const SIDE_ARMS = new Set([
  'swing', 'down', 'hold', 'phone', 'cane', 'carry',
  'run', 'ride', 'crouch', 'jump', 'fall', 'push', 'climb', 'cheer',
]);
const SIDE_LEGS = new Set<SideLegs>(['walk', 'run', 'sit', 'carried', 'ride', 'crouch', 'jump', 'fall', 'push', 'climb']);

export const extraStateOf = (ex: ExtraDef, shot: Shot, t: number) => {
  let x = ex.x, y = ex.y, dir = ex.flip ? -1 : 1, dist = 0, v = 0;
  if (ex.path && ex.path.length > 1) {
    const m = motion(segsFromPath(ex.path, shot), t);
    x = m.x; y = m.y; dist = m.dist; v = m.v;
    if (m.dir) dir = m.dir;
  }
  const subj = SUBJECTS[ex.k];
  const pk = keyAt<string>(ex.pose, subj?.poses?.[0] ?? 'idle', shot, t, 0.28);
  const pose = pk.cur;
  const expr = keyAt<string | undefined>(ex.expr, subj?.exprs?.[0], shot, t).cur;
  const s = ex.s ?? 1;
  const tilt = ex.tilt ?? 0;
  const flip = ex.flip ?? (dir < 0);
  const speed = Math.min(1.5, v / (180 * Math.max(0.4, s)));
  const phase = dist / (165 * Math.max(0.4, s));
  const moving = speed > 0.05;
  return {x, y, dir, pose, poseU: pk.u, expr, s, tilt, flip, dist, speed, phase, moving};
};

type ExtraState = ReturnType<typeof extraStateOf> & {def?: SubjectDef; ex: ExtraDef; idx: number};
type Ctx = {
  shot: Shot;
  t: number;
  actors: Actor[];
  memo: Map<string, {x: number; y: number; dir: number; v: number; vx: number; s: number}>;
  extraStates: Map<string, ExtraState>;
};

const actorOpacity = (a: Actor, shot: Shot, t: number): number => {
  let op = a.op ?? 1;
  if (a.enter !== undefined) op *= clamp((t - abs(a.enter, shot)) / 0.3);
  if (a.exit !== undefined) op *= 1 - clamp((t - abs(a.exit, shot)) / 0.3);
  return op;
};

/** vị trí thế giới của actor (dùng cho người được cõng) */
const placeOf = (a: Actor, ctx: Ctx) => {
  const hit = ctx.memo.get(a.id);
  if (hit) return hit;
  let x = a.x, y = a.y, v = 0, vx = 0, dir = a.flip ? -1 : 1;
  if (a.path && a.path.length > 1) {
    const m = motion(segsOf(a, ctx.shot), ctx.t);
    x = m.x; y = m.y; v = m.v; vx = m.vx;
    if (m.dir) dir = m.dir;
  }
  const fk = keyAt<1 | -1>(a.face, dir as 1 | -1, ctx.shot, ctx.t);
  if (a.face !== undefined) dir = fk.cur;
  const r = {x, y, dir, v, vx, s: a.s ?? 1};
  ctx.memo.set(a.id, r);
  return r;
};

const reachBlend = (a: Actor, shot: Shot, t: number) => {
  // trả về {w: 0..1 mức duỗi, tgt: điểm thế giới, press: 0..1, hand}
  for (const r of a.reach ?? []) {
    const at = abs(r.at, shot);
    const hold = r.hold ?? 0.4;
    if (t < at - 0.5 || t > at + hold + 0.45) continue;
    let w = 0, back = 0, press = 0;
    if (t < at - 0.32) back = smooth(clamp((t - (at - 0.5)) / 0.18)); // lấy đà: tay khẽ lùi
    else if (t < at) { w = easeOut(clamp((t - (at - 0.32)) / 0.32)); back = 1 - w; }
    else if (t < at + hold) { w = 1; press = Math.sin(clamp((t - at) / 0.18) * Math.PI); }
    else w = 1 - smooth(clamp((t - at - hold) / 0.4));
    return {w, back, press, x: r.x, y: r.y, hand: r.hand ?? 'near'};
  }
  return null;
};

const invertBodyTransform = (
  p: {x: number; y: number},
  rotDeg: number,
  pivX: number,
  pivY: number,
  sq: number,
  innerBob = 0,
): {x: number; y: number} => {
  const safeSq = Math.max(0.5, sq);
  const sxSq = 1 / Math.sqrt(safeSq);
  let ux = p.x;
  let uy = p.y + innerBob;
  if (rotDeg) {
    const r = (rotDeg * Math.PI) / 180;
    const c = Math.cos(r), sn = Math.sin(r);
    const dx = ux - pivX;
    const dy = uy - pivY;
    ux = pivX + dx * c + dy * sn;
    uy = pivY - dx * sn + dy * c;
  }
  return {x: ux / sxSq, y: uy / safeSq};
};

const ActorView: React.FC<{a: Actor; ctx: Ctx; renderLayer?: 'all' | 'far' | 'near'}> = ({a, ctx, renderLayer = 'all'}) => {
  const {shot, t} = ctx;
  const ph = useMemo(() => (a.id.split('').reduce((n, c) => n + c.charCodeAt(0), 0) % 17) * 0.7, [a.id]);
  const look: Look = LOOKS[a.look];
  if (!look) throw new Error('unknown look ' + a.look + ' (add it to src/episode/cast.ts)');
  const ek = keyAt<Expr>(a.e, 'neutral', shot, t);
  let talk = 0;
  for (const [s, e] of a.talk ?? []) if (t >= tAt(s) && t <= tAt(e, true)) talk = 0.35 + 0.65 * Math.abs(Math.sin(t * 15 + ph));

  const op = actorOpacity(a, shot, t);
  if (op <= 0.01) return null;

  // ---- vị trí ----
  let {x, y, dir, v, vx, s} = placeOf(a, ctx);
  let bob = 0;
  let wind = a.wind ?? 0;
  let riderOf: ReturnType<typeof placeOf> | null = null;
  if (a.ride) {
    const c = ctx.actors.find((q) => q.id === a.ride);
    if (c) {
      riderOf = placeOf(c, ctx);
      const cl = LOOKS[c.look];
      const cs = riderOf.s;
      dir = riderOf.dir;
      s = cs * 0.92;
      x = riderOf.x - dir * 84 * cs;
      y = riderOf.y - 350 * cs * (cl.h ?? 1);
      v = riderOf.v;
      vx = riderOf.vx;
      bob = 0;
    }
  }
  let mountRot = 0;
  let mountSeat: ReturnType<typeof resolveSeat> = null;
  let mountGripWorld: [number, number] | null = null;
  if (a.mount) {
    const ms = ctx.extraStates.get(a.mount.target);
    if (ms && ms.def) {
      const seat = resolveSeat(ms.def, ms.pose, a.mount.slot ?? 0);
      if (seat) {
        mountSeat = seat;
        const fSign: 1 | -1 = ms.flip ? -1 : 1;
        const kin = computeSubjectKinematics({
          poseU: ms.poseU,
          pose: ms.pose,
          speed: ms.speed,
          phase: ms.phase,
          altitude: ms.ex.altitude ?? 0,
          s: ms.s,
          tilt: ms.tilt,
          flip: ms.flip,
          t,
          idx: ms.idx,
        });
        const lx = seat.dx * kin.sx;
        const ly = seat.dy * kin.sy;
        const ang = (kin.rot * Math.PI) / 180;
        const cosA = Math.cos(ang), sinA = Math.sin(ang);
        x = ms.x + lx * cosA - ly * sinA;
        y = ms.y + kin.dy + lx * sinA + ly * cosA;
        const seatFace: 1 | -1 = (seat.face ? seat.face * fSign : fSign) as 1 | -1;
        if (a.face === undefined) dir = seatFace;
        mountRot = (seat.angle ?? 0) * fSign + kin.rot;
        wind = a.wind ?? seat.wind ?? (ms.ex.path ? 1.2 : 0);
        vx = 0;
        if (seat.grip) {
          const glx = seat.grip[0] * kin.sx;
          const gly = seat.grip[1] * kin.sy;
          mountGripWorld = [
            ms.x + glx * cosA - gly * sinA,
            ms.y + kin.dy + glx * sinA + gly * cosA,
          ];
        }
      }
    }
  }
  const hasPath = !!(a.path && a.path.length > 1);
  const defaultView = mountSeat ? (mountSeat.view ?? '3q') : (hasPath || a.ride ? 'side' : 'front');
  const vk = keyAt<'front' | 'side' | 'back' | '3q'>(a.view, defaultView, shot, t, 0.24);
  const defaultPose = mountSeat ? (mountSeat.pose ?? 'ride') : 'idle';
  const pk = keyAt<string>(a.p, defaultPose, shot, t, 0.28);
  const pImp = pk.u < 1 ? poseImpulse(pk.u, 1.0) : (ek.u < 1 ? poseImpulse(ek.u, 0.65) : {squash: 1, dy: 0, leanKick: 0});
  const hop = a.hop ? Math.abs(Math.sin(t * 9 + ph)) * a.hop : 0;
  const sh = a.shake ? Math.sin(t * 40 + ph) * a.shake : 0;

  // ---- 3D stepped turnaround + hop-dip (never crushes below |sx| = 0.78) ----
  let sx = dir;
  let view = vk.cur;
  let turnHop = 0;
  if (vk.u < 1) {
    const u = vk.u;
    const bridge3Q =
      (vk.prev === 'side' && vk.cur === 'front') ||
      (vk.prev === 'front' && vk.cur === 'side') ||
      (vk.prev === 'back' && vk.cur === 'front') ||
      (vk.prev === 'front' && vk.cur === 'back');
    if (bridge3Q) {
      view = u < 0.28 ? vk.prev : u <= 0.72 ? '3q' : vk.cur;
    } else {
      view = u < 0.5 ? vk.prev : vk.cur;
    }
    if (vk.prev !== vk.cur) {
      sx *= 1 - 0.18 * Math.sin(u * Math.PI);
      turnHop = Math.max(turnHop, 8 * Math.sin(u * Math.PI));
    }
  }
  let bridgedFromSide = false;
  const m = hasPath ? motion(segsOf(a, shot), t) : null;
  if (m && m.prevDir && m.prevDir !== m.dir && t - m.segStart < 0.24) {
    const u = clamp((t - m.segStart) / 0.24);
    sx = (u < 0.5 ? m.prevDir : m.dir) * (1 - 0.20 * Math.sin(u * Math.PI));
    turnHop = Math.max(turnHop, 9 * Math.sin(u * Math.PI));
    if (u > 0.25 && u < 0.75 && view === 'side') {
      view = '3q';
      bridgedFromSide = true;
    }
  }
  if (Math.abs(sx) < 0.78) sx = (sx < 0 ? -1 : 1) * 0.78;

  const H = look.h ?? 1;
  const rb = reachBlend(a, shot, t);

  // ---- directional focal gaze (Actor.lookAt + smart pose/push auto-bias) ----
  let lookTarget: [number, number] | null = null;
  if (Array.isArray(a.lookAt) && a.lookAt.length > 0) {
    if (Array.isArray(a.lookAt[0])) {
      const rawKeys = a.lookAt as [number, number, TT][];
      const mapped: [[number, number], TT][] = rawKeys.map(([lx, ly, ltt]) => [[lx, ly], ltt]);
      const lk = keyAt<[number, number]>(mapped, mapped[0][0], shot, t, 0.22);
      const su = smooth(lk.u);
      lookTarget = [lerp(lk.prev[0], lk.cur[0], su), lerp(lk.prev[1], lk.cur[1], su)];
    } else {
      const stLook = a.lookAt as [number, number];
      lookTarget = [stLook[0], stLook[1]];
    }
  }
  const eyeWorldY = y - hop + bob + pImp.dy - turnHop - (382 * H + 70 * (look.head ?? 1)) * s;
  const effGazeY = lookTarget
    ? clamp((lookTarget[1] - eyeWorldY) / (260 * Math.max(0.5, s)), -1, 1)
    : pk.cur === 'pointUp' || pk.cur === 'sitRaise'
      ? -0.45
      : a.pushTarget
        ? clamp((a.pushTarget[1] - eyeWorldY) / (340 * Math.max(0.5, s)), -0.4, 0.4)
        : 0;

  type JumpState = {
    arcY: number;
    jumpPhase: number | undefined;
    airborne: boolean;
    landingBurst: boolean;
  };
  const GROUNDED_JUMP: JumpState = {arcY: 0, jumpPhase: undefined, airborne: false, landingBurst: false};
  const evalJumpPhase = (jpRaw: number, arcH: number): JumpState => {
    const jp = clamp(jpRaw);
    const landingBurst = jp >= 0.85 && jp <= 0.98;
    if (jp < 0.14 || jp > 0.86) {
      return {arcY: 0, jumpPhase: jp, airborne: false, landingBurst};
    }
    const uAir = (jp - 0.14) / 0.72;
    const arcY = parabolicArc(uAir, arcH);
    return {arcY, jumpPhase: jp, airborne: arcY > 3, landingBurst};
  };
  const computeJumpState = (activeLegs: string | undefined): JumpState => {
    if (Array.isArray(a.legs)) {
      let hasKeyedJump = false;
      for (let j = 0; j < a.legs.length; j++) {
        if (a.legs[j][0] !== 'jump') continue;
        hasKeyedJump = true;
        const w0 = abs(a.legs[j][1], shot);
        const w1 = j + 1 < a.legs.length ? abs(a.legs[j + 1][1], shot) : Math.min(shot.t1, w0 + 1.15);
        if (t >= w0 && t <= w1) {
          const jp = clamp((t - w0) / Math.max(0.18, w1 - w0));
          return evalJumpPhase(jp, a.arcH ?? 56);
        }
      }
      if (hasKeyedJump) return GROUNDED_JUMP;
    }
    if (a.arcH) {
      if (a.path && a.path.length >= 2) {
        const pt0 = abs(a.path[0][2], shot);
        const pt1 = abs(a.path[a.path.length - 1][2], shot);
        const span = pt1 - pt0;
        let w0 = pt0;
        let w1 = pt1;
        if (span > 1.85) {
          const mid = (pt0 + pt1) * 0.5;
          w0 = mid - 0.55;
          w1 = mid + 0.55;
        }
        if (t < w0 || t > w1) return GROUNDED_JUMP;
        const jp = clamp((t - w0) / Math.max(0.18, w1 - w0));
        return evalJumpPhase(jp, a.arcH);
      }
      const jp = (((t / 1.1 + ph) % 1) + 1) % 1;
      return evalJumpPhase(jp, a.arcH);
    }
    if (a.legs === 'jump' || (!Array.isArray(a.legs) && activeLegs === 'jump')) {
      const jp = (((t / 1.1 + ph) % 1) + 1) % 1;
      return evalJumpPhase(jp, 48);
    }
    return GROUNDED_JUMP;
  };

  let jumpState: JumpState = GROUNDED_JUMP;
  let arcY = 0;
  let poseLegs: string | undefined;
  let body: React.ReactNode;

  const toRigLocal = (wx: number, wy: number, xScale: number, curArcY: number): {x: number; y: number} => {
    const dxW = wx - (x + sh);
    const dyW = wy - (y - hop - curArcY + bob + pImp.dy - turnHop);
    let ux = dxW;
    let uy = dyW;
    if (mountRot) {
      const mRad = (mountRot * Math.PI) / 180;
      const cosM = Math.cos(mRad), sinM = Math.sin(mRad);
      ux = dxW * cosM + dyW * sinM;
      uy = -dxW * sinM + dyW * cosM;
    }
    return {x: ux / xScale, y: uy / s};
  };

  if (view === 'side') {
    const poseSideLegs = POSES[pk.cur]?.legs;
    const defaultSideLegs: SideLegs = a.ride
      ? 'carried'
      : mountSeat
        ? (mountSeat.pose && SIDE_LEGS.has(mountSeat.pose as SideLegs) ? (mountSeat.pose as SideLegs) : 'ride')
        : poseSideLegs && SIDE_LEGS.has(poseSideLegs as SideLegs)
          ? (poseSideLegs as SideLegs)
          : 'walk';
    const lk = keyAt<SideLegs>(a.legs, defaultSideLegs, shot, t, 0.45);
    let legs: SideLegs = lk.cur;
    let seatH = a.seatH ?? 120;
    if (legs === 'sit' && lk.prev === 'walk' && lk.u < 1) seatH = lerp(200 * H, seatH, easeIO(lk.u));
    if (legs === 'walk' && lk.prev === 'sit' && lk.u < 1) { legs = 'sit'; seatH = lerp(seatH, 200 * H, easeIO(lk.u)); }

    // Distance-locked gait phase along path (zero foot slip, freezes cleanly when v === 0)
    const vNom = 230 * s * (a.tip ? 0.55 : 1);
    const Hf = Math.min(1.15, H);
    const cyc = SIDE_CYCLE * Hf * s;
    const phase = hasPath && m ? m.dist / cyc : 0;
    let speed = clamp(v / vNom, 0, legs === 'run' ? 1.3 : 1);
    if (riderOf || mountSeat) speed = 0;
    if (hasPath && speed <= 0.04 && (legs === 'walk' || legs === 'run')) speed = 0;

    jumpState = computeJumpState(legs);
    // Unbreakable mid-air physics lock: zero mid-air walking/running cycles
    if (jumpState.airborne && !a.mount && !a.ride && (legs === 'walk' || legs === 'run')) {
      legs = 'jump';
      speed = 0;
    }
    poseLegs = legs;
    arcY = jumpState.arcY;

    let sideSquash: number | undefined;
    let sidePitch: number | undefined;
    if (a.p !== undefined) {
      const p0: Pose = POSES[pk.prev] ?? POSES.idle;
      const p1: Pose = POSES[pk.cur] ?? POSES.idle;
      const spU = clamp(springSettle(pk.u, 0.12), -0.15, 1.15);
      const sp = pk.u < 1 ? poseMix(p0, p1, spU) : p1;
      sideSquash = sp.squash;
      sidePitch = sp.pitch;
    }

    const defaultSideArms = a.ride ? 'ride' : mountSeat ? 'ride' : pk.cur === 'run' ? 'run' : 'swing';
    const ak = keyAt<string>(a.arms, defaultSideArms, shot, t);
    let arms: SideArms = SIDE_ARMS.has(ak.cur) ? (ak.cur as SideArms) : 'swing';
    if (a.ride && ak.cur === 'ride') arms = {near: {x: 110, y: -330 * H}, far: {x: 120, y: -350 * H}};
    if (ak.cur === 'shh') arms = {near: {x: 96, y: -470 * H}};
    if (ak.cur === 'raise') arms = {near: {x: 60, y: -700 * H}, far: {x: 40, y: -690 * H}};
    if (ak.cur === 'pocket') arms = {near: {x: -10, y: -190 * H}, far: {x: -14, y: -195 * H}};

    const effRunSpd = hasPath ? Math.min(1.3, Math.max(0, speed)) : (speed > 0.05 ? Math.min(1.3, speed) : 1);
    const sideLean = (a.lean ?? 0) + (a.tip ? 8 : 0) + (ak.cur === 'carry' ? 12 : 0) + (a.ride ? 14 : 0) + pImp.leanKick;
    const sideHipX = legs === 'push' ? -10 : legs === 'ride' ? -8 : legs === 'crouch' ? -16 : legs === 'sit' ? -10 : 0;
    const sideHipY =
      legs === 'push' ? -152 * H :
      legs === 'ride' ? -112 * H :
      legs === 'crouch' ? -118 * H :
      legs === 'sit' ? -seatH : -178 * H;
    const sideAutoLean =
      legs === 'push' ? 26 :
      legs === 'ride' ? 18 :
      legs === 'crouch' ? 14 :
      legs === 'run' ? 12 * Math.min(1.15, effRunSpd) :
      legs === 'jump' ? 6 :
      legs === 'climb' ? 8 :
      legs === 'walk' ? 3 * speed : 0;
    const sideAutoSquash =
      legs === 'push' ? 0.95 :
      legs === 'ride' ? 0.96 :
      legs === 'crouch' ? 0.92 :
      legs === 'jump' ? 1.07 :
      legs === 'fall' ? 0.94 : 1;
    const sideAutoPitch = legs === 'fall' ? -65 : 0;
    const passedSideSquash =
      sideSquash !== undefined
        ? sideSquash * pImp.squash
        : pImp.squash !== 1
          ? sideAutoSquash * pImp.squash
          : undefined;
    const sideTotalRot = sideLean + sideAutoLean + (sidePitch ?? sideAutoPitch);
    const sideSq = passedSideSquash ?? sideAutoSquash;
    const sideXSign = sx < 0 ? -1 : 1;

    if (mountGripWorld && ak.cur !== 'cheer' && ak.cur !== 'raise') {
      const gRaw = toRigLocal(mountGripWorld[0], mountGripWorld[1], s * sideXSign, arcY);
      const gLoc = invertBodyTransform(gRaw, sideTotalRot, sideHipX, sideHipY, sideSq);
      arms = {
        near: {x: gLoc.x - 4, y: gLoc.y + 4},
        far: {x: gLoc.x + 6, y: gLoc.y - 4},
      };
    }
    if (a.pushTarget && (legs === 'push' || ak.cur === 'push' || (a.legs === undefined && a.arms === undefined))) {
      const pRaw = toRigLocal(a.pushTarget[0], a.pushTarget[1], s * sideXSign, arcY);
      const pNear = invertBodyTransform({x: pRaw.x, y: pRaw.y + 12}, sideTotalRot, sideHipX, sideHipY, sideSq);
      const pFar = invertBodyTransform({x: pRaw.x, y: pRaw.y - 12}, sideTotalRot, sideHipX, sideHipY, sideSq);
      arms = {near: pNear, far: pFar};
    }
    if (rb) {
      // tay gần với tới điểm thế giới (đổi sang toạ độ rig)
      const lx = (rb.x - x) / (s * sideXSign);
      const ly = (rb.y - y) / s;
      const rest = {x: 22 - 22 * rb.back, y: -190 * H - 14 * rb.back};
      const tg = {x: lerp(rest.x, lx + rb.press * 7, rb.w), y: lerp(rest.y, ly, rb.w)};
      arms = {near: tg, far: typeof arms === 'object' ? arms.far : undefined};
    }

    const localVelX = vx * sideXSign;
    const pant = a.pant ? Math.sin(t * 7 + ph) : 0;
    body = (
      <g>
        <g transform={`translate(0 ${pant * 4}) scale(1 ${1 + pant * 0.012})`}>
          <PersonSide
            look={look}
            t={t}
            phase={phase}
            speed={speed}
            hasPath={hasPath}
            moving={hasPath ? speed > 0 : legs === 'run' || speed > 0.04}
            slope={a.slope ?? 0}
            legs={legs}
            jumpPhase={legs === 'jump' ? jumpState.jumpPhase : undefined}
            seatH={seatH}
            arms={arms}
            expr={ek.cur}
            talk={talk}
            blinkPh={ph}
            lean={sideLean}
            look2={a.look2 ?? -effGazeY * 8}
            squash={passedSideSquash}
            pitch={sidePitch}
            prop={sidePropFor(a.prop, t)}
            wind={wind}
            velX={localVelX}
            layer={renderLayer}
          />
        </g>
        {renderLayer !== 'far' && a.pant && [0, 1].map((i) => {
          const k = ((t * 1.6 + i * 0.5) % 1);
          return <circle key={i} cx={150 + k * 90} cy={(-560 + 80 - (legs === 'sit' ? 200 * H - seatH : 0)) * H - k * 40} r={10 + k * 22} fill={PAL.white} opacity={0.6 * (1 - k)} />;
        })}
      </g>
    );
  } else {
    const p0: Pose = POSES[pk.prev] ?? POSES.idle;
    const p1: Pose = POSES[pk.cur] ?? POSES.idle;
    const spU = clamp(springSettle(pk.u, 0.12), -0.15, 1.15);
    let pose = pk.u < 1 ? poseMix(p0, p1, spU) : p1;
    poseLegs = pose.legs ?? (a.legs !== undefined ? keyAt<string>(a.legs, 'stand', shot, t).cur : 'stand');
    if (pose.legs === undefined && poseLegs && poseLegs !== 'carried' && (bridgedFromSide || poseLegs !== 'stand')) {
      pose = {...pose, legs: poseLegs as LegMode};
    }
    if ((view === '3q' || view === 'front') && hasPath && m && !a.mount && !a.ride) {
      if (m.v > 28 * s && (pose.legs === undefined || pose.legs === 'stand')) {
        const autoLegs: LegMode = m.v > 300 * s ? 'run' : 'walk';
        pose = {...pose, legs: autoLegs};
        poseLegs = autoLegs;
      } else if (m.v <= 5 * s && (pose.legs === 'walk' || pose.legs === 'run')) {
        pose = {
          ...pose,
          legs: 'stand',
          hop: 0,
          lean: 0,
          ...(pk.cur === 'run' ? {la: POSES.idle.la, ra: POSES.idle.ra} : {}),
        };
        poseLegs = 'stand';
      }
    }
    pose = {
      ...pose,
      squash: (pose.squash ?? 1) * pImp.squash,
      lean: (pose.lean ?? 0) + pImp.leanKick,
    };
    jumpState = computeJumpState(poseLegs);
    if (jumpState.airborne && !a.mount && !a.ride && (pose.legs === 'walk' || pose.legs === 'run')) {
      pose = {...pose, legs: 'jump'};
      poseLegs = 'jump';
    }
    arcY = jumpState.arcY;
    const vNom3Q = 230 * s * (a.tip ? 0.55 : 1);
    const cyc3Q = SIDE_CYCLE * Math.min(1.15, H) * s;
    const pathGaitPhase = hasPath && m && !a.mount && !a.ride ? m.dist / cyc3Q : undefined;
    const pathGaitSpeed = hasPath && m && !a.mount && !a.ride ? (m.v <= 5 * s ? 0 : clamp(m.v / vNom3Q, 0.25, 1.25)) : undefined;

    const face3q: 1 | -1 = sx < 0 ? -1 : 1;
    const flipSign = view === '3q' ? face3q : (a.flip ? -1 : 1);
    const bodyDrop =
      poseLegs === 'sit' ? 70 :
      poseLegs === 'crouch' ? 62 * H :
      poseLegs === 'ride' ? 68 * H :
      poseLegs === 'push' ? 24 * H : 0;
    const bY = -178 * H + bodyDrop;
    const innerRot = (pose.lean ?? 0) + (pose.pitch ?? 0) + (view === 'back' ? (a.lean ?? 0) : 0);
    const innerSq = pose.squash ?? 1;
    const innerBob = pose.hop ?? 0;

    if (mountGripWorld) {
      const gRaw = toRigLocal(mountGripWorld[0], mountGripWorld[1], s * flipSign, arcY);
      const isCheer = pk.cur === 'rideCheer' || (Array.isArray(pose.la) && pose.la[0] > 90);
      if (isCheer) {
        const gR = invertBodyTransform(gRaw, innerRot, 0, bY, innerSq, innerBob);
        pose = {...pose, ra: gR};
      } else if (pk.cur === 'ride' || poseLegs === 'ride') {
        const gL = invertBodyTransform({x: gRaw.x - 6, y: gRaw.y + 4}, innerRot, 0, bY, innerSq, innerBob);
        const gR = invertBodyTransform({x: gRaw.x + 6, y: gRaw.y - 2}, innerRot, 0, bY, innerSq, innerBob);
        pose = {...pose, la: gL, ra: gR};
      }
    }
    if (a.pushTarget) {
      const pRaw = toRigLocal(a.pushTarget[0], a.pushTarget[1], s * flipSign, arcY);
      const pL = invertBodyTransform({x: pRaw.x, y: pRaw.y + 12}, innerRot, 0, bY, innerSq, innerBob);
      const pR = invertBodyTransform({x: pRaw.x, y: pRaw.y - 12}, innerRot, 0, bY, innerSq, innerBob);
      pose = {...pose, la: pL, ra: pR};
    }
    if (rb) {
      const lx = (rb.x - x) / (s * flipSign);
      const ly = (rb.y - y) / s;
      const W = look.w ?? 1;
      const side = rb.hand === 'l' ? -1 : 1;
      const rest = {x: side * (78 * W + 6) - side * 14 * rb.back, y: -205 * H - 10 * rb.back};
      const tg = {x: lerp(rest.x, lx + side * rb.press * 6, rb.w), y: lerp(rest.y, ly, rb.w)};
      pose = side > 0 ? {...pose, ra: tg} : {...pose, la: tg};
    }

    const localVelX = vx * flipSign;
    const autoGazeX =
      pk.cur === 'pointR' ? 0.45 :
      pk.cur === 'pointL' ? -0.45 :
      a.pushTarget ? clamp(((a.pushTarget[0] - x) / (280 * Math.max(0.5, s))) * flipSign, -0.5, 0.5) : 0;
    const effGazeX = lookTarget
      ? clamp((a.gaze ?? 0) + clamp((lookTarget[0] - x) / (320 * Math.max(0.5, s)), -1, 1) * flipSign, -1, 1)
      : clamp((a.gaze ?? 0) + (a.gaze === undefined ? autoGazeX : 0), -1, 1);

    let handL: HandKind = inferHandKind(pk.cur, 'l');
    let handR: HandKind = inferHandKind(pk.cur, 'r');
    if (mountGripWorld) {
      const isCheer = pk.cur === 'rideCheer' || (Array.isArray(pose.la) && pose.la[0] > 90);
      if (isCheer) {
        handL = 'open';
        handR = 'fist';
      } else if (pk.cur === 'ride' || poseLegs === 'ride') {
        handL = 'fist';
        handR = 'fist';
      }
    }
    if (a.pushTarget) {
      handL = 'fist';
      handR = 'fist';
    }
    if (rb && rb.w > 0.35) {
      if (rb.hand === 'l') handL = 'point';
      else handR = 'point';
    }

    if (view === 'back') {
      sx = (a.flip ? -1 : 1) * Math.abs(sx);
      body = <PersonBack look={look} pose={pose} t={t} gaze={effGazeX} blinkPh={ph} lean={a.lean} prop={propFor(a.prop, t)} wind={wind} velX={localVelX} layer={renderLayer} />;
    } else if (view === '3q') {
      sx = Math.abs(sx);
      body = <Person3Q look={look} pose={pose} expr={ek.cur} talk={talk} t={t} phase={pathGaitPhase} speed={pathGaitSpeed} face={face3q} gaze={effGazeX} gazeY={effGazeY} handL={handL} handR={handR} blinkPh={ph} prop={propFor(a.prop, t)} wind={wind} velX={vx} layer={renderLayer} />;
    } else {
      sx = (a.flip ? -1 : 1) * Math.abs(sx);
      body = <Person look={look} pose={pose} expr={ek.cur} talk={talk} t={t} phase={pathGaitPhase} speed={pathGaitSpeed} gaze={effGazeX} gazeY={effGazeY} handL={handL} handR={handR} blinkPh={ph} prop={propFor(a.prop, t)} wind={wind} velX={localVelX} layer={renderLayer} />;
    }
  }

  let sqSx = 1;
  let sqSy = 1;
  let sqDy = 0;
  let sqShadowScale = 1;
  let sqDustTakeoff = false;
  let sqDustLand = false;
  if (!a.mount && !a.ride) {
    for (const lp of a.leap ?? []) {
      const sm = evalSquashLeap(t - abs(lp.at, shot), {
        height: lp.h,
        dur: lp.dur,
        squat: lp.squat,
        stretch: lp.stretch,
        land: lp.land,
      });
      if (sm.active) {
        sqSx *= sm.sx;
        sqSy *= sm.sy;
        sqDy += sm.dy;
        sqShadowScale = Math.min(sqShadowScale, sm.shadowScale);
        if (lp.dust !== false) {
          if (sm.takeoffDust) sqDustTakeoff = true;
          if (sm.landingDust) sqDustLand = true;
        }
      }
    }
    for (const pp of a.pop ?? []) {
      const sm = evalPopSquash(t - abs(pp.at, shot), pp.amp);
      if (sm.active) {
        sqSx *= sm.sx;
        sqSy *= sm.sy;
        sqDy += sm.dy;
      }
    }
    if (sqSy !== 1) {
      const clampedSq = clamp(sqSy, 0.65, 1.45);
      sqSy = clampedSq;
      sqSx = 1 / clampedSq;
    }
    sqDy = Math.max(-240, Math.min(40, sqDy));
  }

  const rotStr = mountRot ? ` rotate(${mountRot.toFixed(2)})` : '';
  const showShadow = renderLayer !== 'far' && !a.fg && !a.mount && !a.ride && !look.ghost && a.shadow !== false;
  const fxList = renderLayer !== 'far' && a.fx && a.fx.length > 0 ? a.fx : null;
  const showLandingDust = renderLayer !== 'far' && !a.mount && !a.ride && (jumpState.landingBurst || sqDustLand);
  const showTakeoffDust = renderLayer !== 'far' && !a.mount && !a.ride && sqDustTakeoff;
  const totalAlt = Math.max(0, hop + arcY + turnHop - pImp.dy - sqDy);
  const bodyTransform = `translate(${x + sh} ${y - hop - arcY + bob + pImp.dy - turnHop + sqDy})${rotStr} scale(${s * sx * sqSx} ${s * sqSy})`;

  if (!showShadow && !fxList && !showLandingDust && !showTakeoffDust) {
    return (
      <g transform={bodyTransform} opacity={op < 1 ? op : undefined}>
        {body}
      </g>
    );
  }
  return (
    <g opacity={op < 1 ? op : undefined}>
      {showShadow && (
        <GroundShadow
          x={x + sh}
          y={y + 4}
          rx={(poseLegs === 'fall' ? 135 : 82) * s * sqShadowScale}
          ry={18 * s * sqShadowScale}
          alt={totalAlt}
        />
      )}
      <g transform={bodyTransform}>{body}</g>
      {showTakeoffDust && (
        <DustPuff key="fx-takeoff-dust" x={x} y={y + 2} t={t} dir={dir} seed={ph + 1.7} scale={s * 0.72} intensity={0.85} />
      )}
      {showLandingDust && (
        <DustPuff key="fx-land-dust" x={x} y={y + 2} t={t} dir={dir} seed={ph + 3.1} scale={s * 0.85} />
      )}
      {fxList && fxList.map((fx, fi) => {
        switch (fx) {
          case 'dust':
            return <DustPuff key={`fx-${fi}`} x={x - dir * 36 * s} y={y} t={t} dir={dir} seed={ph} scale={s} />;
          case 'sweat':
            return <SweatDrops key={`fx-${fi}`} x={x + dir * 45 * s} y={y - hop - arcY - 440 * H * s} t={t} />;
          case 'speed':
            return <SpeedLines key={`fx-${fi}`} x={x - dir * 140 * s} y={y - hop - arcY - 240 * H * s} t={t} dir={dir} />;
          case 'impact':
            return <ImpactBurst key={`fx-${fi}`} x={x} y={y - 10} t={t} s={s} />;
          case 'stars':
            return <DizzyStars key={`fx-${fi}`} x={x - dir * 95 * s} y={y - hop - arcY - 310 * H * s} t={t} r={44 * s} />;
        }
      })}
    </g>
  );
};

/** camera 2.5D: lớp có độ sâu d trượt/phóng theo tỉ lệ d */
export const LayerG: React.FC<{d: number; cam: [number, number, number]; children: React.ReactNode}> = ({d, cam, children}) => {
  const [cx, cy, k] = cam;
  const kd = Math.pow(k, d);
  const x = FRAME_W / 2 + (cx - FRAME_W / 2) * d;
  const y = FRAME_H / 2 + (cy - FRAME_H / 2) * d;
  return <g transform={`translate(${FRAME_W / 2} ${FRAME_H / 2}) scale(${kd}) translate(${-x} ${-y})`}>{children}</g>;
};

const Captions: React.FC<{t: number}> = ({t}) => {
  const chunks = useMemo(() => {
    const out: {s: number; e: number; w: typeof WORDS}[] = [];
    let cur: typeof WORDS = [];
    const flush = () => {
      if (cur.length) out.push({s: cur[0].s, e: cur[cur.length - 1].e, w: cur});
      cur = [];
    };
    WORDS.forEach((w, i) => {
      const prev = WORDS[i - 1];
      if (prev && prev.seg !== w.seg) flush();
      const len = cur.map((x) => x.w).join(' ').length + w.w.length + 1;
      if (len > 26 && cur.length) flush();
      cur.push(w);
      if (/[.,:?!…]$/.test(w.w) && cur.length >= 2) flush();
    });
    flush();
    return out;
  }, []);
  const ch = chunks.find((c, i) => t >= c.s - 0.05 && t < (chunks[i + 1]?.s ?? c.e + 0.6) - 0.05 && t < c.e + 0.6);
  if (!ch) return null;
  const age = t - ch.s;
  const y = CAPTION_Y + (1 - easeOut(clamp(age / 0.12))) * 20;
  return (
    <text x={FRAME_W / 2} y={y} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={66} paintOrder="stroke" stroke={PAL.ink} strokeWidth={16} strokeLinejoin="round">
      {ch.w.map((w, i) => (
        <tspan key={i} fill={t >= w.s && t < w.e + 0.15 ? PAL.yellow : PAL.white}>{(i ? ' ' : '') + w.w.replace(/\.{3,}$/, '…').replace(/[,.:]$/, '')}</tspan>
      ))}
    </text>
  );
};

/** animated set options from ShotDef.keys: numbers tween (easeIO), other values switch at the key time */
const keyedOpts = (shot: Shot, t: number): Record<string, unknown> => {
  const o: Record<string, unknown> = {};
  for (const [name, track] of Object.entries(shot.keys ?? {})) {
    let v: unknown = track[0][0];
    for (let i = 1; i < track.length; i++) {
      const [val, tt, dur] = track[i];
      const T = abs(tt, shot);
      if (t < T) break;
      const prev = track[i - 1][0];
      v = typeof val === 'number' && typeof prev === 'number' ? lerp(prev, val, easeIO(clamp((t - T) / (dur ?? 0.6)))) : val;
    }
    o[name] = v;
  }
  return o;
};

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  let shot = RESOLVED[0];
  for (const sh of RESOLVED) if (t >= sh.t0) shot = sh;
  const ts = t - shot.t0;
  const dur = Math.max(0.01, shot.t1 - shot.t0);
  const u = clamp(ts / dur);
  const applyEase = (v: number) =>
    shot.ease === 'lin' ? v : shot.ease === 'out' ? easeOut(v) : shot.ease === 'in' ? v * v * v : easeIO(v);
  let cx: number, cy: number, k: number;
  if (shot.camKeys && shot.camKeys.length >= 2) {
    const ks = shot.camKeys.map(([x, y, z, tt]) => [x, y, z, abs(tt, shot)] as const);
    if (t <= ks[0][3]) {
      [cx, cy, k] = [ks[0][0], ks[0][1], ks[0][2]];
    } else if (t >= ks[ks.length - 1][3]) {
      const last = ks[ks.length - 1];
      [cx, cy, k] = [last[0], last[1], last[2]];
    } else {
      let p0 = ks[0], p1 = ks[1];
      for (let i = 0; i + 1 < ks.length; i++) {
        if (t <= ks[i + 1][3]) {
          p0 = ks[i];
          p1 = ks[i + 1];
          break;
        }
      }
      const segU = clamp((t - p0[3]) / Math.max(0.01, p1[3] - p0[3]));
      const se = applyEase(segU);
      cx = lerp(p0[0], p1[0], se);
      cy = lerp(p0[1], p1[1], se);
      k = Math.exp(lerp(Math.log(p0[2]), Math.log(p1[2]), se));
    }
  } else {
    const e = applyEase(u);
    const c1 = shot.cam, c2 = shot.cam2 ?? shot.cam;
    cx = lerp(c1[0], c2[0], e);
    cy = lerp(c1[1], c2[1], e);
    k = Math.exp(lerp(Math.log(c1[2]), Math.log(c2[2]), e));
  }
  if (shot.punch) k *= 1 + shot.punch * Math.exp(-ts * 9);
  const sh = shot.shake ?? 0;
  const cam: [number, number, number] = [
    cx + Math.sin(t * 0.9) * 3 + Math.sin(t * 37) * sh,
    cy + Math.cos(t * 0.7) * 3 + Math.cos(t * 31) * sh,
    k,
  ];

  const def = SETS[shot.set];
  if (!def) throw new Error('unknown set ' + shot.set + ' (register it in src/episode/sets.tsx)');
  const opts: SetOpts = {t, bg: shot.bg, ...(shot.o ?? {}), ...keyedOpts(shot, t), ...(shot.of ? shot.of(u, ts, t) : {})};
  const layers: SetLayers = def.render(opts);

  const extraList = (shot.extras ?? []).map((ex, i) => ({
    i,
    ex,
    st: extraStateOf(ex, shot, t),
    def: SUBJECTS[ex.k],
  }));
  const extraStates = new Map<string, ExtraState>();
  for (const item of extraList) {
    if (item.ex.id) extraStates.set(item.ex.id, {...item.st, def: item.def, ex: item.ex, idx: item.i});
  }

  const acts = shot.actors ?? [];
  const ctx: Ctx = {shot, t, actors: acts, memo: new Map(), extraStates};
  const straddleByTarget = new Map<string, {actor: Actor; seat: SubjectSeat; slot: number}[]>();
  const mountedByTarget = new Map<string, {actor: Actor; seat: SubjectSeat; slot: number}[]>();
  const straddleIds = new Set<string>();
  for (const a of acts) {
    if (!a.mount) continue;
    const ms = extraStates.get(a.mount.target);
    if (!ms || !ms.def) continue;
    const slot = a.mount.slot ?? 0;
    const seat = resolveSeat(ms.def, ms.pose, slot);
    if (!seat) continue;
    const mArr = mountedByTarget.get(a.mount.target) ?? [];
    mArr.push({actor: a, seat, slot});
    mountedByTarget.set(a.mount.target, mArr);
    if (seat.straddle === true) {
      straddleIds.add(a.id);
      const sArr = straddleByTarget.get(a.mount.target) ?? [];
      sArr.push({actor: a, seat, slot});
      straddleByTarget.set(a.mount.target, sArr);
    }
  }
  for (const arr of straddleByTarget.values()) {
    arr.sort((p, q) => q.slot - p.slot || p.actor.x - q.actor.x);
  }

  const toActorItem = (a: Actor): Item => {
    let yy = a.y;
    if (a.path && a.path.length > 1) yy = placeOf(a, ctx).y;
    if (a.ride) {
      const c = acts.find((q) => q.id === a.ride);
      if (c) yy = placeOf(c, ctx).y - 0.5;
    }
    if (a.mount) {
      const ms = ctx.extraStates.get(a.mount.target);
      if (ms) {
        const seat = ms.def ? resolveSeat(ms.def, ms.pose, a.mount.slot ?? 0) : null;
        const msAirborne = Boolean(ms.def) && !ms.ex.fg && (ms.ex.altitude ?? 0) > 20;
        yy = ms.y + (msAirborne ? (ms.ex.altitude ?? 0) + 1200 : 0) + (ms.ex.z ?? 0) + (seat?.zOffset ?? 20);
      }
    }
    return {y: yy + (a.z ?? 0), key: 'a-' + a.id, node: <ActorView key={a.id} a={a} ctx={ctx} />};
  };
  const actors: Item[] = acts.filter((a) => !a.fg && !straddleIds.has(a.id)).map(toActorItem);
  const fgActors: Item[] = acts.filter((a) => a.fg && !straddleIds.has(a.id)).map(toActorItem);
  const midExtras: Item[] = [];
  const fgExtras: Item[] = [];
  for (const {i, ex, st, def: subj} of extraList) {
    let content: React.ReactNode;
    if (subj) {
      content = subj.render(st.pose, {
        t,
        expr: st.expr,
        flip: false,
        c: ex.c,
        phase: st.phase,
        speed: st.speed,
        moving: st.moving,
        altitude: ex.altitude ?? 0,
      });
    } else {
      const f = WORLD_PROPS[ex.k];
      if (!f) throw new Error('unknown world prop ' + ex.k + ' (register it in props.tsx WORLD_PROPS or episode/subjects.tsx SUBJECTS)');
      content = f(ex.c, t);
    }
    const mounted = ex.id ? (mountedByTarget.get(ex.id) ?? []) : [];
    const straddlers = ex.id ? (straddleByTarget.get(ex.id) ?? []) : [];
    let subjectTransform: string;
    let subjHopLift = 0;
    if (subj) {
      const kin = computeSubjectKinematics({
        poseU: st.poseU,
        pose: st.pose,
        speed: st.speed,
        phase: st.phase,
        altitude: ex.altitude ?? 0,
        s: st.s,
        tilt: st.tilt,
        flip: st.flip,
        t,
        idx: i,
      });
      subjHopLift = kin.hopLift;
      subjectTransform = `translate(${st.x} ${st.y + kin.dy}) rotate(${kin.rot}) scale(${kin.sx} ${kin.sy})`;
    } else {
      subjectTransform = `translate(${st.x} ${st.y}) rotate(${st.tilt}) scale(${st.s * (st.flip ? -1 : 1)} ${st.s})`;
    }
    const showSubjShadow = Boolean(subj) && ex.shadow !== false;
    const isAirborne = Boolean(subj) && (ex.altitude ?? 0) > 20;
    const showSubjDust = Boolean(subj) && !isAirborne && st.pose !== 'fly' && st.pose !== 'hover' && st.speed > 0.45;
    const seatShadows = mounted.map(({actor: rider, seat}) => {
      const rOp = actorOpacity(rider, shot, t);
      if (rOp <= 0.01) return null;
      return (
        <g key={`seat-sh-${rider.id}`} opacity={rOp < 1 ? rOp : undefined}>
          <SeatShadow dx={seat.dx} dy={seat.dy + 12} rx={52} ry={16} />
        </g>
      );
    });
    if (isAirborne && !ex.fg) {
      const groundY = st.y + (ex.altitude ?? 0) + 6;
      if (showSubjShadow) {
        midExtras.push({
          y: groundY,
          key: ex.id ? `xsh-${i}-${ex.id}` : 'xsh' + i,
          node: (
            <GroundShadow
              x={st.x}
              y={groundY}
              rx={170 * st.s}
              ry={26 * st.s}
              alt={(ex.altitude ?? 0) + subjHopLift}
              opacity={0.22}
            />
          ),
        });
      }
      midExtras.push({
        y: st.y + (ex.altitude ?? 0) + 1200 + (ex.z ?? 0),
        key: ex.id ? `x-${i}-${ex.id}` : 'x' + i,
        node: straddlers.length > 0 || mounted.length > 0 ? (
          <g>
            {straddlers.map(({actor: rider}) => (
              <ActorView key={`far-${rider.id}`} a={rider} ctx={ctx} renderLayer="far" />
            ))}
            <g transform={subjectTransform}>
              {content}
              {seatShadows}
            </g>
            {straddlers.map(({actor: rider}) => (
              <ActorView key={`near-${rider.id}`} a={rider} ctx={ctx} renderLayer="near" />
            ))}
          </g>
        ) : (
          <g transform={subjectTransform}>{content}</g>
        ),
      });
      continue;
    }
    const item: Item = {
      y: st.y + (ex.z ?? 0),
      key: ex.id ? `x-${i}-${ex.id}` : 'x' + i,
      node: showSubjShadow || showSubjDust || straddlers.length > 0 || mounted.length > 0 ? (
        <g>
          {showSubjShadow && (
            <GroundShadow
              x={st.x}
              y={st.y + (ex.altitude ?? 0) + 6}
              rx={170 * st.s}
              ry={26 * st.s}
              alt={(ex.altitude ?? 0) + subjHopLift}
              opacity={0.22}
            />
          )}
          {showSubjDust && (
            <DustPuff
              x={st.x - st.dir * 60 * st.s}
              y={st.y}
              t={t}
              dir={st.dir as 1 | -1}
              seed={i + 1.7}
              scale={st.s * 0.85}
              intensity={0.55}
            />
          )}
          {straddlers.map(({actor: rider}) => (
            <ActorView key={`far-${rider.id}`} a={rider} ctx={ctx} renderLayer="far" />
          ))}
          <g transform={subjectTransform}>
            {content}
            {seatShadows}
          </g>
          {straddlers.map(({actor: rider}) => (
            <ActorView key={`near-${rider.id}`} a={rider} ctx={ctx} renderLayer="near" />
          ))}
        </g>
      ) : (
        <g transform={subjectTransform}>{content}</g>
      ),
    };
    if (ex.fg) fgExtras.push(item);
    else midExtras.push(item);
  }
  const midItems = [...layers.mid, ...midExtras, ...actors].sort((p, q) => p.y - q.y);
  const fgItems = [...fgExtras, ...fgActors].sort((p, q) => p.y - q.y);

  // background and actors share depth 1 so feet never slide on the floor when the camera moves
  const worldLayers = (
    <>
      {layers.far && <LayerG d={0.5} cam={cam}>{layers.far}</LayerG>}
      {shot.dof === true && layers.far && <rect width={FRAME_W} height={FRAME_H} fill={PAL.paper} opacity={0.14} />}
      <LayerG d={1} cam={cam}>{layers.back}</LayerG>
      <LayerG d={1} cam={cam}>{midItems.map((m) => <g key={m.key}>{m.node}</g>)}</LayerG>
      {fgItems.length > 0 && <LayerG d={1.2} cam={cam}>{fgItems.map((m) => <g key={m.key}>{m.node}</g>)}</LayerG>}
      {layers.fg && <LayerG d={1.3} cam={cam}>{layers.fg}</LayerG>}
    </>
  );
  const world = shot.tilt ? <g transform={`rotate(${shot.tilt} ${FRAME_W / 2} ${FRAME_H / 2})`}>{worldLayers}</g> : worldLayers;

  const night = shot.night ?? 0;
  const mood = shot.mood && shot.mood !== 'default' ? shot.mood : undefined;
  const overs = (shot.over ?? []).map((o, i) => {
    const t0 = o.at !== undefined ? abs(o.at, shot) : shot.t0 + 0.05;
    if (o.until !== undefined && t > abs(o.until, shot)) return null;
    const node = <OverView key={i} o={o} age={t - t0} t={t} />;
    return o.world ? <LayerG key={i} d={1} cam={cam}>{node}</LayerG> : node;
  });

  const flash = shot.tr === 'flash' ? 1 - clamp(ts / 0.18) : 0;
  const wipe = shot.tr === 'wipe' ? clamp(ts / 0.3) : 1;
  const isWhip = (shot.tr === 'whipL' || shot.tr === 'whipR') && ts < 0.22;
  const whipU = isWhip ? clamp(ts / 0.22) : 1;
  const whipDir = shot.tr === 'whipL' ? 1 : -1;
  const whipDx = isWhip ? (1 - whipU) * (1 - whipU) * 360 * whipDir : 0;
  const isIris = shot.tr === 'iris' && ts < 0.38;
  const irisU = isIris ? clamp(ts / 0.38) : 1;
  const irisR = Math.hypot(FRAME_W, FRAME_H) * 0.55 * easeOut(irisU);
  const clipRef = wipe < 1 ? 'url(#wipe)' : isIris ? 'url(#iris)' : undefined;
  const worldTr = isWhip ? `translate(${whipDx.toFixed(1)} 0)` : undefined;
  const fadeIn = 1 - clamp(t / 0.3);
  const fadeOut = clamp((t - (DURATION - 0.8)) / 0.7);
  const grainSeed = 0; // hạt tĩnh: hạt nhấp nháy mỗi 2 khung làm mỏi mắt

  return (
    <AbsoluteFill style={{background: PAL.navy}}>
      <Audio src={staticFile('mix.wav')} />
      <svg viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} width={FRAME_W} height={FRAME_H} style={{display: 'block'}}>
        <Defs seed={grainSeed + 1} />
        {(wipe < 1 || isIris || isWhip) && <rect width={FRAME_W} height={FRAME_H} fill={PAL.navy} />}
        <clipPath id="wipe"><rect x={0} y={0} width={FRAME_W * wipe} height={FRAME_H} /></clipPath>
        {isIris && <clipPath id="iris"><circle cx={FRAME_W / 2} cy={FRAME_H / 2} r={irisR.toFixed(1)} /></clipPath>}
        <g clipPath={clipRef} transform={worldTr}>{world}</g>
        {wipe < 1 && <rect x={FRAME_W * wipe - 40} y={0} width={40} height={FRAME_H} fill={PAL.yellow} />}
        {isIris && <circle cx={FRAME_W / 2} cy={FRAME_H / 2} r={Math.max(0, irisR).toFixed(1)} fill="none" stroke={PAL.gold} strokeWidth={12} />}
        {isWhip && [0, 1, 2, 3, 4, 5].map((i) => {
          const rem = 1 - whipU;
          const yy = FRAME_H * (0.14 + i * 0.145);
          const len = FRAME_W * (0.38 + ((i * 3) % 4) * 0.12) * (0.45 + 0.55 * rem);
          const xPos = whipDir > 0
            ? rem * FRAME_W * (0.28 + (i % 3) * 0.14)
            : FRAME_W - len - rem * FRAME_W * (0.28 + (i % 3) * 0.14);
          const hBar = i % 2 === 0 ? 14 : 8;
          return (
            <rect
              key={`whip-${i}`}
              x={xPos.toFixed(1)}
              y={(yy - hBar * 0.5).toFixed(1)}
              width={len.toFixed(1)}
              height={hBar}
              rx={hBar * 0.5}
              fill={i % 2 === 0 ? PAL.white : PAL.yellow}
              opacity={(rem * 0.75).toFixed(3)}
            />
          );
        })}
        {night > 0 && <rect width={FRAME_W} height={FRAME_H} fill={PAL.navy} opacity={0.55 * night} style={{mixBlendMode: 'multiply'}} />}
        {night > 0 && <circle cx={FRAME_W / 2} cy={FRAME_H / 2} r={700} fill="url(#glowY)" opacity={0.45 * night} style={{mixBlendMode: 'screen'}} />}
        {mood === 'morning' && <rect width={FRAME_W} height={FRAME_H} fill="url(#moodMorning)" opacity={0.22} />}
        {mood === 'golden' && (
          <>
            <rect width={FRAME_W} height={FRAME_H} fill="url(#moodGolden)" opacity={0.24} style={{mixBlendMode: 'multiply'}} />
            <rect width={FRAME_W} height={FRAME_H} fill="url(#glowY)" opacity={0.18} />
          </>
        )}
        {mood === 'danger' && <rect width={FRAME_W} height={FRAME_H} fill="url(#moodDanger)" opacity={0.34 + Math.sin(t * 5) * 0.05} />}
        {mood === 'lab' && <rect width={FRAME_W} height={FRAME_H} fill="url(#moodLab)" opacity={0.20} />}
        {mood === 'flashback' && <rect width={FRAME_W} height={FRAME_H} fill="url(#moodFlashback)" opacity={0.28} />}
        {mood === 'dramatic' && <rect width={FRAME_W} height={FRAME_H} fill="url(#moodDramatic)" opacity={0.38} />}
        {overs}
        <rect width={FRAME_W} height={FRAME_H} fill="url(#grainPat)" />
        <rect width={FRAME_W} height={FRAME_H} fill="url(#vig)" />
        <Captions t={t} />
        {flash > 0 && <rect width={FRAME_W} height={FRAME_H} fill={PAL.white} opacity={flash} />}
        {Math.max(fadeIn, fadeOut) > 0 && <rect width={FRAME_W} height={FRAME_H} fill={PAL.navy} opacity={Math.max(fadeIn, fadeOut)} />}
      </svg>
    </AbsoluteFill>
  );
};
void L; void S; void E;
