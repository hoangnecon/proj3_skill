import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {Defs, FONT, L, PAL, S, E} from './kit';
import {Person, POSES, Pose, poseMix, Expr, Look} from './chars';
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
import {resolveSeat, SubjectDef} from './subjects';
import {EX_LOOKS} from './exemplar/looks';

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
/** vị trí + vận tốc (px/s) + hướng tại t */
const motion = (segs: Seg[], t: number) => {
  const first = segs.find((g) => Math.abs(g.x1 - g.x0) > 2);
  const d0 = first ? Math.sign(first.x1 - first.x0) : 0;
  let x = segs[0].x0, y = segs[0].y0, v = 0, dir = d0, lastDir = d0, segStart = -99, prevDir = d0;
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
    if (sd) {
      if (sd !== lastDir) { prevDir = lastDir; segStart = g.t0; }
      lastDir = sd;
    }
    dir = lastDir;
  }
  return {x, y, v, dir, prevDir, segStart};
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
  let x = ex.x, y = ex.y, dir = ex.flip ? -1 : 1;
  if (ex.path && ex.path.length > 1) {
    const m = motion(segsFromPath(ex.path, shot), t);
    x = m.x; y = m.y;
    if (m.dir) dir = m.dir;
  }
  const subj = SUBJECTS[ex.k];
  const pose = keyAt<string>(ex.pose, subj?.poses?.[0] ?? 'idle', shot, t).cur;
  const expr = keyAt<string | undefined>(ex.expr, subj?.exprs?.[0], shot, t).cur;
  const s = ex.s ?? 1;
  const tilt = ex.tilt ?? 0;
  const flip = ex.flip ?? (dir < 0);
  return {x, y, dir, pose, expr, s, tilt, flip};
};

type ExtraState = ReturnType<typeof extraStateOf> & {def?: SubjectDef; ex: ExtraDef};
type Ctx = {
  shot: Shot;
  t: number;
  actors: Actor[];
  memo: Map<string, {x: number; y: number; dir: number; v: number; s: number}>;
  extraStates: Map<string, ExtraState>;
};

/** vị trí thế giới của actor (dùng cho người được cõng) */
const placeOf = (a: Actor, ctx: Ctx) => {
  const hit = ctx.memo.get(a.id);
  if (hit) return hit;
  let x = a.x, y = a.y, v = 0, dir = a.flip ? -1 : 1;
  if (a.path && a.path.length > 1) {
    const m = motion(segsOf(a, ctx.shot), ctx.t);
    x = m.x; y = m.y; v = m.v;
    if (m.dir) dir = m.dir;
  }
  const fk = keyAt<1 | -1>(a.face, dir as 1 | -1, ctx.shot, ctx.t);
  if (a.face !== undefined) dir = fk.cur;
  const r = {x, y, dir, v, s: a.s ?? 1};
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

const ActorView: React.FC<{a: Actor; ctx: Ctx}> = ({a, ctx}) => {
  const {shot, t} = ctx;
  const ph = useMemo(() => (a.id.split('').reduce((n, c) => n + c.charCodeAt(0), 0) % 17) * 0.7, [a.id]);
  const look: Look = LOOKS[a.look];
  if (!look) throw new Error('unknown look ' + a.look + ' (add it to src/episode/cast.ts)');
  const ek = keyAt<Expr>(a.e, 'neutral', shot, t);
  let talk = 0;
  for (const [s, e] of a.talk ?? []) if (t >= tAt(s) && t <= tAt(e, true)) talk = 0.35 + 0.65 * Math.abs(Math.sin(t * 15 + ph));

  let op = a.op ?? 1;
  if (a.enter !== undefined) op *= clamp((t - abs(a.enter, shot)) / 0.3);
  if (a.exit !== undefined) op *= 1 - clamp((t - abs(a.exit, shot)) / 0.3);
  if (op <= 0.01) return null;

  // ---- vị trí ----
  let {x, y, dir, v, s} = placeOf(a, ctx);
  let bob = 0;
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
      bob = 0;
    }
  }
  let mountRot = 0;
  let mountSeat: ReturnType<typeof resolveSeat> = null;
  if (a.mount) {
    const ms = ctx.extraStates.get(a.mount.target);
    if (ms && ms.def) {
      const seat = resolveSeat(ms.def, ms.pose, a.mount.slot ?? 0);
      if (seat) {
        mountSeat = seat;
        const fSign: 1 | -1 = ms.flip ? -1 : 1;
        const lx = seat.dx * fSign * ms.s;
        const ly = seat.dy * ms.s;
        const ang = (ms.tilt * Math.PI) / 180;
        const cosA = Math.cos(ang), sinA = Math.sin(ang);
        x = ms.x + lx * cosA - ly * sinA;
        y = ms.y + lx * sinA + ly * cosA;
        const seatFace: 1 | -1 = (seat.face ? seat.face * fSign : fSign) as 1 | -1;
        if (a.face === undefined) dir = seatFace;
        mountRot = (seat.angle ?? 0) * fSign + ms.tilt;
      }
    }
  }
  const hasPath = !!(a.path && a.path.length > 1);
  const defaultView = mountSeat ? (mountSeat.view ?? '3q') : (hasPath || a.ride ? 'side' : 'front');
  const vk = keyAt<'front' | 'side' | 'back' | '3q'>(a.view, defaultView, shot, t, 0.24);
  const hop = a.hop ? Math.abs(Math.sin(t * 9 + ph)) * a.hop : 0;
  const sh = a.shake ? Math.sin(t * 40 + ph) * a.shake : 0;

  // ---- lật/quay người: bóp ngang qua 0 ----
  let sx = dir;
  const m = hasPath ? motion(segsOf(a, shot), t) : null;
  if (m && m.prevDir && m.prevDir !== m.dir && t - m.segStart < 0.22) {
    const u = smooth(clamp((t - m.segStart) / 0.22));
    sx = lerp(m.prevDir, m.dir, u);
    if (Math.abs(sx) < 0.12) sx = 0.12 * Math.sign(sx || m.dir);
  }
  let view = vk.cur;
  if (vk.u < 1) {
    const u = vk.u;
    if (u < 0.5) { view = vk.prev; sx *= Math.max(0.12, 1 - 2 * u); } else sx *= Math.max(0.12, 2 * u - 1);
  }

  const H = look.h ?? 1;
  const rb = reachBlend(a, shot, t);
  let body: React.ReactNode;
  if (view === 'side') {
    // nhịp bước: cadence cố định khi chậm hơn vNom (bước ngắn lại), bàn chân trụ đứng yên
    const vNom = 230 * s * (a.tip ? 0.55 : 1);
    const Hf = Math.min(1.15, H);
    const cyc = SIDE_CYCLE * Hf * s;
    let phase = (vNom * t) / cyc;
    let speed = clamp(v / vNom);
    if (v > vNom && hasPath) {
      // phần dư: tích phân số
      let ex = 0;
      const segs = segsOf(a, shot);
      const t0 = segs[0].t0;
      for (let tt = t0; tt < t; tt += 1 / 60) ex += Math.max(0, motion(segs, tt).v - vNom) / 60;
      phase += ex / cyc;
    }
    if (riderOf || mountSeat) speed = 0;
    const defaultSideLegs: SideLegs = a.ride
      ? 'carried'
      : mountSeat
        ? (mountSeat.pose && SIDE_LEGS.has(mountSeat.pose as SideLegs) ? (mountSeat.pose as SideLegs) : 'ride')
        : 'walk';
    const lk = keyAt<SideLegs>(a.legs, defaultSideLegs, shot, t, 0.45);
    let legs: SideLegs = lk.cur;
    let seatH = a.seatH ?? 120;
    if (legs === 'sit' && lk.prev === 'walk' && lk.u < 1) seatH = lerp(200 * H, seatH, easeIO(lk.u));
    if (legs === 'walk' && lk.prev === 'sit' && lk.u < 1) { legs = 'sit'; seatH = lerp(seatH, 200 * H, easeIO(lk.u)); }
    const ak = keyAt<string>(a.arms, a.ride ? 'ride' : (mountSeat ? 'ride' : 'swing'), shot, t);
    let arms: SideArms = SIDE_ARMS.has(ak.cur) ? (ak.cur as SideArms) : 'swing';
    if (a.ride && ak.cur === 'ride') arms = {near: {x: 110, y: -330 * H}, far: {x: 120, y: -350 * H}};
    if (ak.cur === 'shh') arms = {near: {x: 96, y: -470 * H}};
    if (ak.cur === 'raise') arms = {near: {x: 60, y: -700 * H}, far: {x: 40, y: -690 * H}};
    if (ak.cur === 'pocket') arms = {near: {x: -10, y: -190 * H}, far: {x: -14, y: -195 * H}};
    if (rb) {
      // tay gần với tới điểm thế giới (đổi sang toạ độ rig)
      const lx = (rb.x - x) / (s * (sx < 0 ? -1 : 1));
      const ly = (rb.y - y) / s;
      const rest = {x: 22 - 22 * rb.back, y: -190 * H - 14 * rb.back};
      const tg = {x: lerp(rest.x, lx + rb.press * 7, rb.w), y: lerp(rest.y, ly, rb.w)};
      arms = {near: tg, far: typeof arms === 'object' ? arms.far : undefined};
    }
    let sideSquash: number | undefined;
    let sidePitch: number | undefined;
    if (a.p !== undefined) {
      const pk = keyAt<string>(a.p, 'idle', shot, t);
      const p0: Pose = POSES[pk.prev] ?? POSES.idle;
      const p1: Pose = POSES[pk.cur] ?? POSES.idle;
      const sp = pk.u < 1 ? poseMix(p0, p1, smooth(pk.u)) : p1;
      sideSquash = sp.squash;
      sidePitch = sp.pitch;
    }
    const pant = a.pant ? Math.sin(t * 7 + ph) : 0;
    body = (
      <g>
        <g transform={`translate(0 ${pant * 4}) scale(1 ${1 + pant * 0.012})`}>
          <PersonSide look={look} t={t} phase={phase} speed={speed} slope={a.slope ?? 0} legs={legs} seatH={seatH} arms={arms} expr={ek.cur} talk={talk} blinkPh={ph} lean={(a.lean ?? 0) + (a.tip ? 8 : 0) + (ak.cur === 'carry' ? 12 : 0) + (a.ride ? 14 : 0)} look2={a.look2 ?? 0} squash={sideSquash} pitch={sidePitch} prop={sidePropFor(a.prop, t)} />
        </g>
        {a.pant && [0, 1].map((i) => {
          const k = ((t * 1.6 + i * 0.5) % 1);
          return <circle key={i} cx={150 + k * 90} cy={(-560 + 80 - (legs === 'sit' ? 200 * H - seatH : 0)) * H - k * 40} r={10 + k * 22} fill={PAL.white} opacity={0.6 * (1 - k)} />;
        })}
      </g>
    );
  } else {
    const defaultPose = mountSeat ? (mountSeat.pose ?? 'ride') : 'idle';
    const pk = keyAt(a.p as Keys<string> | undefined, defaultPose, shot, t);
    const p0: Pose = POSES[pk.prev] ?? POSES.idle;
    const p1: Pose = POSES[pk.cur] ?? POSES.idle;
    let pose = pk.u < 1 ? poseMix(p0, p1, smooth(pk.u)) : p1;
    const face3q: 1 | -1 = dir < 0 ? -1 : 1;
    if (rb) {
      const flipSign = view === '3q' ? face3q : (a.flip ? -1 : 1);
      const lx = (rb.x - x) / (s * flipSign);
      const ly = (rb.y - y) / s;
      const W = look.w ?? 1;
      const side = rb.hand === 'l' ? -1 : 1;
      const rest = {x: side * (78 * W + 6) - side * 14 * rb.back, y: -205 * H - 10 * rb.back};
      const tg = {x: lerp(rest.x, lx + side * rb.press * 6, rb.w), y: lerp(rest.y, ly, rb.w)};
      pose = side > 0 ? {...pose, ra: tg} : {...pose, la: tg};
    }
    if (view === 'back') {
      sx = (a.flip ? -1 : 1) * Math.abs(sx);
      body = <PersonBack look={look} pose={pose} t={t} gaze={a.gaze ?? 0} lean={a.lean} prop={propFor(a.prop, t)} />;
    } else if (view === '3q') {
      sx = Math.abs(sx);
      body = <Person3Q look={look} pose={pose} expr={ek.cur} talk={talk} t={t} face={face3q} gaze={a.gaze ?? 0} blinkPh={ph} prop={propFor(a.prop, t)} />;
    } else {
      sx = (a.flip ? -1 : 1) * Math.abs(sx);
      body = <Person look={look} pose={pose} expr={ek.cur} talk={talk} t={t} gaze={a.gaze ?? 0} blinkPh={ph} prop={propFor(a.prop, t)} />;
    }
  }
  const rotStr = mountRot ? ` rotate(${mountRot.toFixed(2)})` : '';
  return (
    <g transform={`translate(${x + sh} ${y - hop + bob})${rotStr} scale(${s * sx} ${s})`} opacity={op}>
      {body}
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
  const e = shot.ease === 'lin' ? u : shot.ease === 'out' ? easeOut(u) : shot.ease === 'in' ? u * u * u : easeIO(u);
  const c1 = shot.cam, c2 = shot.cam2 ?? shot.cam;
  let k = Math.exp(lerp(Math.log(c1[2]), Math.log(c2[2]), e));
  if (shot.punch) k *= 1 + shot.punch * Math.exp(-ts * 9);
  const sh = shot.shake ?? 0;
  const cam: [number, number, number] = [
    lerp(c1[0], c2[0], e) + Math.sin(t * 0.9) * 3 + Math.sin(t * 37) * sh,
    lerp(c1[1], c2[1], e) + Math.cos(t * 0.7) * 3 + Math.cos(t * 31) * sh,
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
    if (item.ex.id) extraStates.set(item.ex.id, {...item.st, def: item.def, ex: item.ex});
  }

  const acts = shot.actors ?? [];
  const ctx: Ctx = {shot, t, actors: acts, memo: new Map(), extraStates};
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
        yy = ms.y + (ms.ex.z ?? 0) + (seat?.zOffset ?? 20);
      }
    }
    return {y: yy + (a.z ?? 0), key: 'a-' + a.id, node: <ActorView key={a.id} a={a} ctx={ctx} />};
  };
  const actors: Item[] = acts.filter((a) => !a.fg).map(toActorItem);
  const fgActors: Item[] = acts.filter((a) => a.fg).map(toActorItem);
  const midExtras: Item[] = [];
  const fgExtras: Item[] = [];
  for (const {i, ex, st, def: subj} of extraList) {
    let content: React.ReactNode;
    if (subj) {
      content = subj.render(st.pose, {t, expr: st.expr, flip: false, c: ex.c});
    } else {
      const f = WORLD_PROPS[ex.k];
      if (!f) throw new Error('unknown world prop ' + ex.k + ' (register it in props.tsx WORLD_PROPS or episode/subjects.tsx SUBJECTS)');
      content = f(ex.c, t);
    }
    const item: Item = {
      y: st.y + (ex.z ?? 0),
      key: ex.id ? `x-${i}-${ex.id}` : 'x' + i,
      node: <g transform={`translate(${st.x} ${st.y}) rotate(${st.tilt}) scale(${st.s * (st.flip ? -1 : 1)} ${st.s})`}>{content}</g>,
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
  const fadeIn = 1 - clamp(t / 0.3);
  const fadeOut = clamp((t - (DURATION - 0.8)) / 0.7);
  const grainSeed = 0; // hạt tĩnh: hạt nhấp nháy mỗi 2 khung làm mỏi mắt

  return (
    <AbsoluteFill style={{background: PAL.navy}}>
      <Audio src={staticFile('mix.wav')} />
      <svg viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} width={FRAME_W} height={FRAME_H} style={{display: 'block'}}>
        <Defs seed={grainSeed + 1} />
        <clipPath id="wipe"><rect x={0} y={0} width={FRAME_W * wipe} height={FRAME_H} /></clipPath>
        <g clipPath={wipe < 1 ? 'url(#wipe)' : undefined}>{world}</g>
        {wipe < 1 && <rect x={FRAME_W * wipe - 40} y={0} width={40} height={FRAME_H} fill={PAL.yellow} />}
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
