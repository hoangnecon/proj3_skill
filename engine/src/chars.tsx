// Rig nhân vật 2D chính diện, style riso: đầu to, viền mực, bóng chấm.
// Gốc toạ độ = điểm giữa hai bàn chân. Trục y âm là đi lên.
import React from 'react';
import {E, L, PAL, R, Rr, S, Sh, col, LINE, Smoke} from './kit';

export type Hair = 'bald' | 'side' | 'bun' | 'curly' | 'short' | 'neat' | 'thin' | 'kid' | 'long';
export type Hat = 'none' | 'khanxep' | 'cap' | 'chef' | 'helmet' | 'band';
export type Top = 'shirt' | 'polo' | 'tank' | 'suit' | 'uniform' | 'robe' | 'chef' | 'blouse' | 'aothe' | 'tee';

export type Look = {
  name: string;
  skin?: string;
  top: Top;
  topC: string;
  topC2?: string; // cổ áo, cà vạt, viền
  pattern?: 'dots' | 'stripes' | 'flowers';
  patC?: string;
  pants: string;
  shoes?: string;
  hair: Hair;
  hairC?: string;
  hat?: Hat;
  hatC?: string;
  glasses?: 'round' | 'square' | 'sun';
  mustache?: boolean;
  beard?: 'goatee' | 'long';
  beardC?: string;
  brows?: string;
  lips?: boolean;
  earrings?: boolean;
  chain?: boolean;
  vest?: boolean; // áo phản quang khoác ngoài
  w?: number; // độ rộng vai (1 = chuẩn)
  belly?: number; // 0..1
  h?: number; // chiều cao thân (1 = chuẩn)
  head?: number; // cỡ đầu
  ghost?: boolean;
};

export type Arm = [number, number] | string | {x: number; y: number}; // [góc vai, góc khuỷu] độ (0 = buông, + = ra ngoài/lên) hoặc tên điểm đích IK: mouth, eye, chest, hip, head, over, ear, front
export type Pose = {la: Arm; ra: Arm; legs?: 'stand' | 'sit' | 'walk' | 'none'; lean?: number; hop?: number};
export type Expr = 'neutral' | 'smug' | 'angry' | 'shock' | 'sad' | 'cry' | 'joy' | 'stern' | 'sly' | 'deadpan' | 'eager' | 'shh';

export const POSES: Record<string, Pose> = {
  idle: {la: [8, 0], ra: [8, 0]},
  hip: {la: 'hip', ra: 'hip'},
  hipR: {la: [8, 0], ra: 'hip'},
  hold: {la: [14, -95], ra: [14, -95]}, // bưng vật trước ngực
  holdHigh: {la: 'over', ra: 'over'}, // nâng vật lên cao
  raise: {la: [150, 10], ra: [150, 10]}, // giơ hai tay
  cheer: {la: [140, 30], ra: [140, 30]},
  pointR: {la: [8, 0], ra: [95, 0]},
  pointUp: {la: [8, 0], ra: [160, 5]},
  pointL: {la: [95, 0], ra: [8, 0]},
  argue: {la: [60, -70], ra: [110, 20]},
  argue2: {la: [110, 20], ra: [60, -70]},
  cross: {la: 'crossL', ra: 'crossR'},
  clap: {la: [20, -110], ra: [20, -110]},
  pray: {la: 'pray', ra: 'pray'}, // chắp tay cầm hương
  cry: {la: 'eye', ra: 'eye'},
  shrug: {la: [50, 70], ra: [50, 70]},
  write: {la: [14, -95], ra: [20, -105]},
  shh: {la: [8, 0], ra: 'mouth'},
  thumb: {la: [8, 0], ra: [40, -120]},
  tape: {la: [80, 5], ra: [80, 5]}, // kéo thước dây hai bên
  whisper: {la: [8, 0], ra: 'mouth'},
  taste: {la: [8, 0], ra: 'taste'},
  sprinkle: {la: [8, 0], ra: [70, -40]},
  wave: {la: [8, 0], ra: [150, -30]},
  seeds: {la: 'chest', ra: 'mouth'}, // cắn hạt hướng dương
  phone: {la: [8, 0], ra: 'ear'},
  confess: {la: 'chest', ra: 'chest'},
  sit: {la: [14, -60], ra: [14, -60], legs: 'sit'},
  sitPhone: {la: [14, -60], ra: 'ear', legs: 'sit'},
  sitRaise: {la: [8, -40], ra: [160, 5], legs: 'sit'},
  sitShh: {la: [14, -60], ra: 'mouth', legs: 'sit'},
  sitCross: {la: 'crossL', ra: 'crossR', legs: 'sit'},
  sitCry: {la: 'eye', ra: 'eye', legs: 'sit'},
  sitHold: {la: [14, -95], ra: [14, -95], legs: 'sit'},
  hands: {la: 'mouth', ra: 'mouth'},
  sitHands: {la: 'mouth', ra: 'mouth', legs: 'sit'},
};

const mixArm = (a: Arm, b: Arm, u: number): Arm => (!Array.isArray(a) || !Array.isArray(b) ? (u < 0.5 ? a : b) : [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
export const poseMix = (a: Pose, b: Pose, u: number): Pose => ({
  la: mixArm(a.la, b.la, u),
  ra: mixArm(a.ra, b.ra, u),
  legs: u < 0.5 ? a.legs : b.legs,
  lean: (a.lean ?? 0) + ((b.lean ?? 0) - (a.lean ?? 0)) * u,
  hop: (a.hop ?? 0) + ((b.hop ?? 0) - (a.hop ?? 0)) * u,
});

const rad = (d: number) => (d * Math.PI) / 180;

type Hands = {l: [number, number]; r: [number, number]};

export type PersonProps = {
  look: Look;
  pose: Pose;
  expr?: Expr;
  talk?: number; // 0..1 độ mở miệng khi nói
  t: number;
  gaze?: number; // -1..1 hướng nhìn
  blinkPh?: number;
  prop?: (h: Hands) => React.ReactNode; // vật cầm, vẽ trước bàn tay
  propBack?: (h: Hands) => React.ReactNode; // vật vẽ sau thân
};

const limb = (pts: [number, number][], w: number, c: string, key: string, nl = false) => {
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  return (
    <g key={key}>
      {!nl && <path d={d} fill="none" stroke={PAL.ink} strokeWidth={w + LINE * 2} strokeLinecap="round" strokeLinejoin="round" />}
      <path d={d} fill="none" stroke={col(c)} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
};

export const Person: React.FC<PersonProps> = ({look, pose, expr = 'neutral', talk = 0, t, gaze = 0, blinkPh = 0, prop, propBack}) => {
  const g = look.ghost;
  const skin = g ? 'ghost' : look.skin ?? 'skin';
  const W = look.w ?? 1;
  const H = look.h ?? 1;
  const belly = look.belly ?? 0;
  const sw = 78 * W; // nửa vai
  const ww = (64 + belly * 34) * W; // nửa eo
  const legY = -200 * H; // hông
  const shY = legY - 225 * H; // vai
  const HR = 86 * (look.head ?? 1); // bán kính đầu
  const hy = shY - 16 - HR * 0.92;
  const legs = g ? 'none' : pose.legs ?? 'stand';
  const sitDrop = legs === 'sit' ? 70 : 0;

  // --- tay ---
  const armW = 30 * Math.min(1.25, W);
  const ua = 118 * H, fa = 108 * H;
  const shoulder = (sg: number): [number, number] => [sg * (sw - 14), shY + 18 + sitDrop];
  const shY0 = shY, legY0 = legY;
  const target = (sg: number, n: string): [number, number] => {
    const hyy = hy + sitDrop;
    const shY = shY0 + sitDrop;
    const legY = legY0 + sitDrop;
    switch (n) {
      case 'mouth': return [sg * HR * 0.32, hyy + HR * 0.6];
      // tay cầm thìa: thìa dài ~96 px nghiêng -20°, nên bàn tay ở dưới cằm để đầu thìa chạm miệng
      case 'taste': return [sg * HR * 0.32 + 33, hyy + HR * 0.6 + 90];
      case 'eye': return [sg * HR * 0.3, hyy + HR * 0.2];
      case 'ear': return [sg * HR * 0.95, hyy + HR * 0.1];
      case 'head': return [sg * HR * 0.7, hyy - HR * 0.6];
      case 'over': return [sg * 40, hyy - HR * 1.6];
      case 'chest': return [sg * 10, shY + 90];
      case 'pray': return [0, shY + 40];
      case 'crossL': return [sw * 0.45, shY + 120];
      case 'crossR': return [-sw * 0.45, shY + 104];
      case 'hip': return [sg * (ww + 8), legY - 10];
      case 'front': return [sg * 26, shY + 150];
    }
    return [sg * sw, shY + 200];
  };
  const armPts = (sg: number, a: Arm): [number, number][] => {
    const [x0, y0] = shoulder(sg);
    if (typeof a === 'string' || !Array.isArray(a)) {
      const [tx, ty] = typeof a === 'string' ? target(sg, a) : [a.x, a.y];
      let dx = tx - x0, dy = ty - y0;
      let d = Math.hypot(dx, dy);
      let A = ua, B = fa;
      if (d > A + B - 2) { const k = d / (A + B - 2); A *= k; B *= k; }
      if (d < Math.abs(A - B) + 4) d = Math.abs(A - B) + 4;
      const base = Math.atan2(dy, dx);
      const cosA = (A * A + d * d - B * B) / (2 * A * d);
      const off = Math.acos(Math.max(-1, Math.min(1, cosA)));
      // khuỷu tay chĩa ra ngoài và xuống
      const ang = base + (sg > 0 ? -off : off) * (dy < 0 ? -1 : 1);
      let ex2 = x0 + Math.cos(ang) * A, ey2 = y0 + Math.sin(ang) * A;
      const alt = base - (sg > 0 ? -off : off) * (dy < 0 ? -1 : 1);
      const ex3 = x0 + Math.cos(alt) * A, ey3 = y0 + Math.sin(alt) * A;
      if (sg * ex3 > sg * ex2) { ex2 = ex3; ey2 = ey3; }
      return [[x0, y0], [ex2, ey2], [tx, ty]];
    }
    const t1 = rad(a[0]);
    const t2 = rad(a[0] + a[1]);
    const x1 = x0 + sg * Math.sin(t1) * ua, y1 = y0 + Math.cos(t1) * ua;
    const x2 = x1 + sg * Math.sin(t2) * fa, y2 = y1 + Math.cos(t2) * fa;
    return [[x0, y0], [x1, y1], [x2, y2]];
  };
  const lp = armPts(-1, pose.la);
  const rp = armPts(1, pose.ra);
  const hands: Hands = {l: lp[2], r: rp[2]};
  const sleeveC = look.top === 'tank' ? skin : g ? 'ghostDeep' : look.topC;
  const fullSleeve = ['suit', 'uniform', 'robe', 'chef', 'aothe', 'blouse'].includes(look.top);
  const drawArm = (p: [number, number][], k: string) => (
    <g key={k}>
      {limb(p, armW, fullSleeve ? sleeveC : skin, k + 'a')}
      {!fullSleeve && limb([p[0], [p[0][0] + (p[1][0] - p[0][0]) * 0.5, p[0][1] + (p[1][1] - p[0][1]) * 0.5]], armW + 6, sleeveC, k + 's')}
    </g>
  );
  const drawHand = (p: [number, number], k: string) => <S key={k} d={E(p[0], p[1], 17, 17)} f={skin} />;

  // --- chân ---
  const legX = 34 * W + belly * 10;
  const legW = 40 * Math.min(1.2, W);
  const legEls: React.ReactNode[] = [];
  const shoe = look.shoes ?? 'red';
  if (legs === 'stand' || legs === 'walk') {
    const sw2 = legs === 'walk' ? Math.sin(t * 9) * 16 : 0;
    for (const sg of [-1, 1]) {
      const fx = sg * legX + sg * sw2 * (sg > 0 ? 1 : -1);
      legEls.push(limb([[sg * legX, legY + 10], [fx, -18]], legW, look.pants, 'leg' + sg));
      legEls.push(<S key={'sh' + sg} d={Rr(fx - 30 + sg * 8, -24, 60, 24, 11)} f={shoe} />);
    }
  } else if (legs === 'sit') {
    for (const sg of [-1, 1]) {
      legEls.push(limb([[sg * legX, legY + sitDrop], [sg * (legX + 14), legY + sitDrop + 20], [sg * (legX + 10), -18]], legW, look.pants, 'leg' + sg));
      legEls.push(<S key={'sh' + sg} d={Rr(sg * (legX + 10) - 30 + sg * 8, -24, 60, 24, 11)} f={shoe} />);
    }
  }

  // --- thân ---
  const bY = legY + sitDrop;
  const sY = shY + sitDrop;
  const long = look.top === 'robe' || look.top === 'aothe' || g;
  const hemY = long ? (g ? bY + 40 : -40) : bY + 26;
  const hemW = long ? ww + 36 : ww + 4;
  const torso = `M${-sw} ${sY + 22}C${-sw - 4} ${sY - 6} ${-sw + 30} ${sY - 18} ${-30} ${sY - 18}L${30} ${sY - 18}C${sw - 30} ${sY - 18} ${sw + 4} ${sY - 6} ${sw} ${sY + 22}C${sw + belly * 40} ${(sY + bY) / 2} ${hemW + belly * 30} ${hemY - 40} ${hemW} ${hemY}L${-hemW} ${hemY}C${-hemW - belly * 30} ${hemY - 40} ${-sw - belly * 40} ${(sY + bY) / 2} ${-sw} ${sY + 22}Z`;
  const topC = g ? 'ghostDeep' : look.topC;

  const pattern: React.ReactNode[] = [];
  if (look.pattern === 'dots' || look.pattern === 'flowers') {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 6; c++) {
        const px = -sw + 18 + c * ((2 * sw) / 5.5) + (r % 2) * 14;
        const py = sY + 4 + r * 26;
        if (py > hemY - 12 || Math.abs(px) > sw + belly * 30) continue;
        pattern.push(look.pattern === 'flowers'
          ? <g key={`${r}-${c}`}>{[0, 1, 2, 3].map((k) => <circle key={k} cx={px + Math.cos(k * 1.57) * 5} cy={py + Math.sin(k * 1.57) * 5} r={3.6} fill={col(look.patC ?? 'yellow')} />)}</g>
          : <circle key={`${r}-${c}`} cx={px} cy={py} r={5} fill={col(look.patC ?? 'yellow')} />);
      }
  } else if (look.pattern === 'stripes') {
    for (let i = 0; i < 12; i++) {
      const py = sY + 12 + i * 22;
      if (py > hemY - 6) break;
      pattern.push(<rect key={i} x={-sw - 40} y={py} width={2 * sw + 80} height={8} fill={col(look.patC ?? 'trim')} />);
    }
  }

  const collar: React.ReactNode[] = [];
  const c2 = look.topC2 ?? 'trim';
  if (look.top === 'shirt' || look.top === 'polo' || look.top === 'uniform') {
    collar.push(<S key="cl" d={`M-30 ${sY - 18}L0 ${sY + 22}L-34 ${sY + 14}Z`} f={look.top === 'polo' ? c2 : topC} />);
    collar.push(<S key="cr" d={`M30 ${sY - 18}L0 ${sY + 22}L34 ${sY + 14}Z`} f={look.top === 'polo' ? c2 : topC} />);
    const nb = look.top === 'polo' ? 2 : 5;
    for (let i = 0; i < nb; i++) collar.push(<circle key={'b' + i} cx={0} cy={sY + 34 + i * 34} r={4.5} fill={PAL.ink} />);
    if (look.top === 'uniform') {
      collar.push(<S key="p1" d={Rr(-sw + 22, sY + 50, 44, 40, 6)} f={topC} />, <S key="p2" d={Rr(sw - 66, sY + 50, 44, 40, 6)} f={topC} />);
      collar.push(<S key="ep1" d={Rr(-sw - 2, sY - 8, 44, 14, 6)} f="gold" />, <S key="ep2" d={Rr(sw - 42, sY - 8, 44, 14, 6)} f="gold" />);
      collar.push(<S key="bd" d={E(-sw + 44, sY + 30, 11, 11)} f="red" />);
    }
  } else if (look.top === 'suit') {
    collar.push(<S key="sh" d={`M-30 ${sY - 18}L30 ${sY - 18}L18 ${sY + 120}L-18 ${sY + 120}Z`} f="trim" />);
    collar.push(<S key="tie" d={`M-9 ${sY - 8}h18l8 100l-17 22l-17 -22Z`} f={c2} />);
    collar.push(<S key="lp1" d={`M-30 ${sY - 18}L-6 ${sY + 130}L-50 ${sY + 40}Z`} f={topC} />);
    collar.push(<S key="lp2" d={`M30 ${sY - 18}L6 ${sY + 130}L50 ${sY + 40}Z`} f={topC} />);
    collar.push(<circle key="b1" cx={0} cy={sY + 170} r={5} fill={PAL.ink} />);
  } else if (look.top === 'chef') {
    for (let i = 0; i < 3; i++) collar.push(<circle key={i} cx={-22} cy={sY + 30 + i * 40} r={5} fill={PAL.ink} />, <circle key={'r' + i} cx={22} cy={sY + 30 + i * 40} r={5} fill={PAL.ink} />);
    collar.push(<S key="nk" d={Rr(-40, sY - 26, 80, 22, 8)} f="red" />);
  } else if (look.top === 'robe') {
    collar.push(<S key="v" d={`M-34 ${sY - 18}L0 ${sY + 70}L34 ${sY - 18}`} f={c2} />);
    collar.push(<S key="belt" d={R(-ww - 6, bY - 40, 2 * ww + 12, 22)} f={c2} />);
  } else if (look.top === 'aothe') {
    collar.push(<S key="v" d={`M-30 ${sY - 18}C-10 ${sY + 10} 20 ${sY + 40} ${sw - 10} ${sY + 80}`} f="none" sw={6} />);
    collar.push(<S key="n" d={Rr(-28, sY - 30, 56, 20, 8)} f={c2} />);
  } else if (look.top === 'blouse') {
    collar.push(<S key="v" d={`M-34 ${sY - 18}Q0 ${sY + 50} 34 ${sY - 18}Z`} f={skin} />);
  } else if (look.top === 'tank') {
    collar.push(<S key="nk" d={`M-40 ${sY - 18}Q0 ${sY + 50} 40 ${sY - 18}Z`} f={skin} />);
  } else if (look.top === 'tee') {
    collar.push(<S key="nk" d={`M-30 ${sY - 18}Q0 ${sY + 18} 30 ${sY - 18}Z`} f={skin} />);
  }
  if (look.chain) collar.push(<path key="ch" d={`M-34 ${sY - 10}Q0 ${sY + 60} 34 ${sY - 10}`} fill="none" stroke={PAL.gold} strokeWidth={7} strokeDasharray="2 9" strokeLinecap="round" />);
  if (look.vest) {
    collar.push(<S key="v1" d={`M${-sw + 4} ${sY + 6}L-30 ${sY - 10}L-24 ${bY + 20}L${-ww - 4} ${bY + 20}Z`} f="orange" />);
    collar.push(<S key="v2" d={`M${sw - 4} ${sY + 6}L30 ${sY - 10}L24 ${bY + 20}L${ww + 4} ${bY + 20}Z`} f="orange" />);
    collar.push(<rect key="v3" x={-ww - 6} y={bY - 70} width={2 * ww + 12} height={16} fill={PAL.trim} stroke={PAL.ink} strokeWidth={3} />);
    collar.push(<rect key="v4" x={-ww - 6} y={bY - 30} width={2 * ww + 12} height={16} fill={PAL.trim} stroke={PAL.ink} strokeWidth={3} />);
  }

  // --- đầu ---
  const head = <Head look={look} hy={hy + sitDrop} R={HR} expr={expr} talk={talk} t={t} gaze={gaze} blinkPh={blinkPh} />;

  // ma: đuôi khói thay cho chân, cơ thể trôi bồng bềnh
  const bob = g ? Math.sin(t * 2.2 + blinkPh) * 10 : (pose.hop ?? 0);
  const tail = g ? (
    <g>
      <path d={`M${-hemW} ${hemY - 4}C${-hemW + 20} ${hemY + 60} ${-30} ${hemY + 40} ${-10 + Math.sin(t * 2) * 14} ${hemY + 130}C${40} ${hemY + 60} ${hemW - 10} ${hemY + 50} ${hemW} ${hemY - 4}Z`} fill={PAL.ghost} stroke={PAL.ink} strokeWidth={LINE} opacity={0.85} />
      <Smoke x={-10} y={hemY + 150} t={t} h={60} w={10} o={0.5} />
    </g>
  ) : null;

  return (
    <g transform={`translate(0 ${-bob}) rotate(${pose.lean ?? 0} 0 ${legY})`} opacity={g ? 0.93 : 1}>
      {g && <ellipse cx={0} cy={hy} rx={HR * 3.2} ry={HR * 4} fill="url(#glowG)" />}
      {propBack?.(hands)}
      {legEls}
      {tail}
      <S d={torso} f={topC} />
      <clipPath id={`tc-${look.name}`}><path d={torso} /></clipPath>
      <g clipPath={`url(#tc-${look.name})`}>
        {pattern}
        <Sh d={`M${sw * 0.35} ${sY - 30}L${sw + 60} ${sY - 30}L${hemW + 60} ${hemY + 10}L${hemW * 0.45} ${hemY + 10}Z`} o={0.55} />
      </g>
      {collar}
      {/* cổ */}
      <S d={R(-20, sY - 30 - 14, 40, 30)} f={g ? 'ghost' : 'skinShade'} />
      {head}
      {drawArm(lp, 'la')}
      {drawArm(rp, 'ra')}
      {prop?.(hands)}
      {drawHand(hands.l, 'hl')}
      {drawHand(hands.r, 'hr')}
    </g>
  );
};

const Head: React.FC<{look: Look; hy: number; R: number; expr: Expr; talk: number; t: number; gaze: number; blinkPh: number}> = ({look, hy, R: r, expr, talk, t, gaze, blinkPh}) => {
  const g = look.ghost;
  const skin = g ? 'ghost' : look.skin ?? 'skin';
  const hairC = look.hairC ?? 'hair';
  const gx = gaze * r * 0.16;
  const els: React.ReactNode[] = [];

  // tóc sau đầu
  if (look.hair === 'bun') els.push(<S key="bun" d={E(0, hy - r * 0.95, r * 0.42, r * 0.32)} f={hairC} />);
  if (look.hair === 'curly') for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.95 + (i / 8) * 1.1);
    els.push(<S key={'cu' + i} d={E(Math.cos(a) * r * 1.02, hy + Math.sin(a) * r * 1.0 + r * 0.1, r * 0.36, r * 0.36)} f={hairC} />);
  }
  if (look.hair === 'long') els.push(<S key="lg" d={`M${-r * 0.98} ${hy}C${-r * 1.1} ${hy + r * 1.4} ${-r * 0.6} ${hy + r * 1.7} ${-r * 0.2} ${hy + r * 1.5}L${r * 0.2} ${hy + r * 1.5}C${r * 0.6} ${hy + r * 1.7} ${r * 1.1} ${hy + r * 1.4} ${r * 0.98} ${hy}Z`} f={hairC} />);

  // tai + mặt
  els.push(<S key="ea1" d={E(-r * 0.9, hy + r * 0.08, r * 0.17, r * 0.24)} f={skin} />);
  els.push(<S key="ea2" d={E(r * 0.9, hy + r * 0.08, r * 0.17, r * 0.24)} f={skin} />);
  if (look.earrings) els.push(<S key="er1" d={E(-r * 0.92, hy + r * 0.4, 7, 7)} f="gold" />, <S key="er2" d={E(r * 0.92, hy + r * 0.4, 7, 7)} f="gold" />);
  els.push(<S key="face" d={E(0, hy, r * 0.9, r)} f={skin} />);
  els.push(<Sh key="fsh" d={`M${r * 0.35} ${hy - r * 0.95}A${r * 0.9} ${r} 0 0 1 ${r * 0.35} ${hy + r * 0.95}A${r * 0.66} ${r} 0 0 0 ${r * 0.35} ${hy - r * 0.95}Z`} o={0.5} />);

  // tóc trước
  const hp = (d: string, k: string) => els.push(<S key={k} d={d} f={hairC} />);
  switch (look.hair) {
    case 'bald':
      hp(`M${-r * 0.92} ${hy + r * 0.05}C${-r * 0.96} ${hy - r * 0.4} ${-r * 0.8} ${hy - r * 0.55} ${-r * 0.62} ${hy - r * 0.5}L${-r * 0.7} ${hy + r * 0.1}Z`, 'h1');
      hp(`M${r * 0.92} ${hy + r * 0.05}C${r * 0.96} ${hy - r * 0.4} ${r * 0.8} ${hy - r * 0.55} ${r * 0.62} ${hy - r * 0.5}L${r * 0.7} ${hy + r * 0.1}Z`, 'h2');
      els.push(<path key="shine" d={`M${-r * 0.3} ${hy - r * 0.78}q${r * 0.2} ${-r * 0.1} ${r * 0.4} ${-r * 0.02}`} stroke={PAL.white} strokeWidth={8} strokeLinecap="round" fill="none" />);
      break;
    case 'side':
    case 'neat':
      hp(`M${-r * 0.95} ${hy + r * 0.05}C${-r * 1.05} ${hy - r * 1.42} ${r * 1.05} ${hy - r * 1.42} ${r * 0.95} ${hy + r * 0.0}C${r * 0.8} ${hy - r * 0.5} ${r * 0.2} ${hy - r * 0.62} ${-r * 0.3} ${hy - r * 0.52}C${-r * 0.6} ${hy - r * 0.45} ${-r * 0.8} ${hy - r * 0.2} ${-r * 0.95} ${hy + r * 0.05}Z`, 'h');
      if (look.hair === 'side') els.push(<L key="part" d={`M${-r * 0.3} ${hy - r * 0.95}L${-r * 0.36} ${hy - r * 0.55}`} w={4} c="white" o={0.6} />);
      break;
    case 'short':
    case 'kid':
      hp(`M${-r * 0.95} ${hy + r * 0.1}C${-r * 1.05} ${hy - r * 1.42} ${r * 1.05} ${hy - r * 1.42} ${r * 0.95} ${hy + r * 0.1}L${r * 0.8} ${hy - r * 0.3}L${r * 0.5} ${hy - r * 0.45}L${r * 0.3} ${hy - r * 0.32}L${0} ${hy - r * 0.5}L${-r * 0.3} ${hy - r * 0.35}L${-r * 0.6} ${hy - r * 0.5}L${-r * 0.8} ${hy - r * 0.25}Z`, 'h');
      break;
    case 'bun':
    case 'long':
      hp(`M${-r * 0.95} ${hy + r * 0.2}C${-r * 1.0} ${hy - r * 1.42} ${r * 1.0} ${hy - r * 1.42} ${r * 0.95} ${hy + r * 0.2}C${r * 0.8} ${hy - r * 0.45} ${r * 0.1} ${hy - r * 0.7} ${0} ${hy - r * 0.62}C${-r * 0.1} ${hy - r * 0.7} ${-r * 0.8} ${hy - r * 0.45} ${-r * 0.95} ${hy + r * 0.2}Z`, 'h');
      break;
    case 'curly':
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.12 + (i / 6) * 0.76);
        els.push(<S key={'cf' + i} d={E(Math.cos(a) * r * 0.78, hy + Math.sin(a) * r * 0.82, r * 0.3, r * 0.26)} f={hairC} />);
      }
      break;
    case 'thin':
      hp(`M${-r * 0.92} ${hy}C${-r * 0.95} ${hy - r * 0.5} ${-r * 0.7} ${hy - r * 0.62} ${-r * 0.5} ${hy - r * 0.6}L${-r * 0.66} ${hy + r * 0.1}Z`, 'h1');
      hp(`M${r * 0.92} ${hy}C${r * 0.95} ${hy - r * 0.5} ${r * 0.7} ${hy - r * 0.62} ${r * 0.5} ${hy - r * 0.6}L${r * 0.66} ${hy + r * 0.1}Z`, 'h2');
      break;
  }

  // mũ
  const hat = look.hat ?? 'none';
  const hatC = look.hatC ?? 'navy';
  if (hat === 'khanxep') {
    els.push(<S key="kx" d={`M${-r * 0.98} ${hy - r * 0.42}C${-r * 1.02} ${hy - r * 1.05} ${r * 1.02} ${hy - r * 1.05} ${r * 0.98} ${hy - r * 0.42}C${r * 0.6} ${hy - r * 0.3} ${-r * 0.6} ${hy - r * 0.3} ${-r * 0.98} ${hy - r * 0.42}Z`} f={hatC} />);
    for (let i = 0; i < 4; i++) els.push(<L key={'kxl' + i} d={`M${-r * 0.9} ${hy - r * (0.5 + i * 0.12)}Q0 ${hy - r * (0.42 + i * 0.12) - r * 0.08} ${r * 0.9} ${hy - r * (0.5 + i * 0.12)}`} w={3} c="trim" o={0.5} />);
  } else if (hat === 'cap') {
    els.push(<S key="cap" d={`M${-r * 0.9} ${hy - r * 0.45}C${-r * 0.95} ${hy - r * 1.2} ${r * 0.95} ${hy - r * 1.2} ${r * 0.9} ${hy - r * 0.45}Z`} f={hatC} />);
    els.push(<S key="capb" d={`M${-r * 0.95} ${hy - r * 0.45}h${r * 1.9}l${-r * 0.1} ${r * 0.16}h${-r * 1.7}Z`} f="ink" />);
    els.push(<S key="caps" d={E(0, hy - r * 0.78, r * 0.16, r * 0.16)} f="gold" />);
  } else if (hat === 'chef') {
    els.push(<S key="ch1" d={`M${-r * 0.7} ${hy - r * 0.55}L${-r * 0.75} ${hy - r * 1.3}C${-r * 1.2} ${hy - r * 1.5} ${-r * 0.8} ${hy - r * 2.1} ${-r * 0.3} ${hy - r * 1.8}C${-r * 0.1} ${hy - r * 2.3} ${r * 0.5} ${hy - r * 2.2} ${r * 0.45} ${hy - r * 1.8}C${r * 1.0} ${hy - r * 2.0} ${r * 1.2} ${hy - r * 1.4} ${r * 0.75} ${hy - r * 1.3}L${r * 0.7} ${hy - r * 0.55}Z`} f="white" />);
    els.push(<S key="ch2" d={R(-r * 0.75, hy - r * 0.8, r * 1.5, r * 0.28)} f="white" />);
  } else if (hat === 'helmet') {
    els.push(<S key="hm" d={`M${-r * 1.0} ${hy - r * 0.3}C${-r * 1.05} ${hy - r * 1.3} ${r * 1.05} ${hy - r * 1.3} ${r * 1.0} ${hy - r * 0.3}Z`} f={hatC} />);
  } else if (hat === 'band') {
    els.push(<S key="bd" d={R(-r * 0.95, hy - r * 0.62, r * 1.9, r * 0.24)} f={hatC} />);
  }

  // biểu cảm
  const blink = ((t * 1000 + blinkPh * 700) % 3700) < 120;
  const ex = r * 0.34;
  const ey = hy + r * 0.04;
  const browC = look.brows ?? (g ? 'white' : 'hair');
  const bw = 7;
  const brow = (dl: number, dr: number, lift = 0) => {
    els.push(<L key="bl" d={`M${-ex - r * 0.2 + gx} ${ey - r * 0.3 - lift + dl}L${-ex + r * 0.18 + gx} ${ey - r * 0.3 - lift - dl}`} w={bw} c={browC} />);
    els.push(<L key="br" d={`M${ex + r * 0.2 + gx} ${ey - r * 0.3 - lift + dr}L${ex - r * 0.18 + gx} ${ey - r * 0.3 - lift - dr}`} w={bw} c={browC} />);
  };
  const eyesDot = (sz = 8) => {
    if (blink) {
      els.push(<L key="e1" d={`M${-ex - 10 + gx} ${ey}h20`} w={5} />, <L key="e2" d={`M${ex - 10 + gx} ${ey}h20`} w={5} />);
    } else {
      els.push(<ellipse key="e1" cx={-ex + gx} cy={ey} rx={sz} ry={sz * 1.15} fill={PAL.ink} />, <ellipse key="e2" cx={ex + gx} cy={ey} rx={sz} ry={sz * 1.15} fill={PAL.ink} />);
      els.push(<circle key="e1h" cx={-ex + gx + 2.5} cy={ey - 3} r={2.4} fill={PAL.white} />, <circle key="e2h" cx={ex + gx + 2.5} cy={ey - 3} r={2.4} fill={PAL.white} />);
    }
  };
  const eyesArc = (up = true) => {
    const s = up ? -1 : 1;
    els.push(<L key="e1" d={`M${-ex - 13 + gx} ${ey + 3}q13 ${s * 12} 26 0`} w={5.5} />, <L key="e2" d={`M${ex - 13 + gx} ${ey + 3}q13 ${s * 12} 26 0`} w={5.5} />);
  };
  const eyesWide = () => {
    els.push(<S key="e1w" d={E(-ex + gx, ey, 15, 17)} f="white" sw={4} />, <S key="e2w" d={E(ex + gx, ey, 15, 17)} f="white" sw={4} />);
    els.push(<circle key="e1" cx={-ex + gx} cy={ey + 2} r={5.5} fill={PAL.ink} />, <circle key="e2" cx={ex + gx} cy={ey + 2} r={5.5} fill={PAL.ink} />);
  };
  const eyesNarrow = () => {
    els.push(<L key="e1" d={`M${-ex - 14 + gx} ${ey}h28`} w={6} />, <L key="e2" d={`M${ex - 14 + gx} ${ey}h28`} w={6} />);
    els.push(<circle key="e1p" cx={-ex + gx + 6} cy={ey + 3} r={4} fill={PAL.ink} />, <circle key="e2p" cx={ex + gx + 6} cy={ey + 3} r={4} fill={PAL.ink} />);
  };

  const my = hy + r * 0.56;
  // son môi: vẽ chính nét miệng màu đỏ, dày hơn — không đặt hình son đè lên miệng (đè lên răng khi cười)
  const lipC = look.lips ? 'red' : 'ink';
  const lipW = look.lips ? 8 : 5.5;
  const mouth = (kind: string) => {
    if (talk > 0.05 && kind !== 'wail' && kind !== 'O') {
      const o = 6 + talk * 20;
      els.push(<S key="m" d={`M${-r * 0.2 + gx} ${my}Q${gx} ${my - 4} ${r * 0.2 + gx} ${my}Q${gx} ${my + o * 1.6} ${-r * 0.2 + gx} ${my}Z`} f="redDark" sw={4.5} />);
      return;
    }
    switch (kind) {
      case 'flat': els.push(<L key="m" d={`M${-r * 0.16 + gx} ${my}h${r * 0.32}`} w={lipW} c={lipC} />); break;
      case 'smile': els.push(<L key="m" d={`M${-r * 0.24 + gx} ${my - 4}q${r * 0.24} ${r * 0.2} ${r * 0.48} 0`} w={lipW} c={lipC} />); break;
      case 'grin': els.push(<S key="m" d={`M${-r * 0.3 + gx} ${my - 8}Q${gx} ${my - 2} ${r * 0.3 + gx} ${my - 8}Q${gx} ${my + r * 0.42} ${-r * 0.3 + gx} ${my - 8}Z`} f="redDark" sw={4.5} />, <path key="mt" d={`M${-r * 0.24 + gx} ${my - 4}Q${gx} ${my + 2} ${r * 0.24 + gx} ${my - 4}L${r * 0.2 + gx} ${my + 6}L${-r * 0.2 + gx} ${my + 6}Z`} fill={PAL.white} />); break;
      case 'frown': els.push(<L key="m" d={`M${-r * 0.22 + gx} ${my + 6}q${r * 0.22} ${-r * 0.18} ${r * 0.44} 0`} w={lipW} c={lipC} />); break;
      case 'smirk': els.push(<L key="m" d={`M${-r * 0.18 + gx} ${my + 2}q${r * 0.24} ${r * 0.04} ${r * 0.4} ${-r * 0.14}`} w={lipW} c={lipC} />); break;
      case 'O': els.push(<S key="m" d={E(gx, my + 6, r * 0.12, r * 0.17)} f="redDark" sw={4.5} />); break;
      case 'wail': els.push(<S key="m" d={`M${-r * 0.28 + gx} ${my + r * 0.2}Q${gx} ${my - r * 0.18} ${r * 0.28 + gx} ${my + r * 0.2}Q${gx} ${my + r * 0.36} ${-r * 0.28 + gx} ${my + r * 0.2}Z`} f="redDark" sw={4.5} />); break;
      case 'shh': els.push(<S key="m" d={E(gx, my + 2, r * 0.08, r * 0.08)} f="redDark" sw={4} />); break;
    }
  };

  switch (expr) {
    case 'neutral': brow(0, 0); eyesDot(); mouth('flat'); break;
    case 'deadpan': brow(0, 0, -6); eyesDot(7); els.push(<L key="lid1" d={`M${-ex - 13 + gx} ${ey - 6}h26`} w={5} />, <L key="lid2" d={`M${ex - 13 + gx} ${ey - 6}h26`} w={5} />); mouth('flat'); break;
    case 'stern': brow(7, 7, -2); eyesDot(7.5); mouth('frown'); break;
    case 'angry': brow(12, 12, -2); eyesNarrow(); mouth(talk > 0.05 ? 'flat' : 'frown'); break;
    case 'smug': brow(-3, 6); eyesArc(false); mouth('smirk'); break;
    case 'sly': brow(6, -4); eyesNarrow(); mouth('smirk'); break;
    case 'shock': brow(-6, -6, 12); eyesWide(); mouth('O'); break;
    case 'sad': brow(-9, -9, 4); eyesDot(7); mouth('frown'); break;
    case 'cry': brow(-10, -10, 6); eyesArc(true); mouth('wail');
      for (const sg of [-1, 1]) els.push(<path key={'tr' + sg} d={`M${sg * ex + gx} ${ey + 10}q${sg * 8} ${30 + Math.sin(t * 12) * 6} 0 ${60}`} stroke={PAL.blue} strokeWidth={9} fill="none" strokeLinecap="round" />);
      break;
    case 'joy': brow(-4, -4, 8); eyesArc(true); mouth('grin'); break;
    case 'eager': brow(-5, -5, 10); eyesWide(); mouth('grin'); break;
    case 'shh': brow(4, 4); eyesWide(); mouth('shh'); break;
  }

  // má hồng, mũi
  if (!g) els.push(<ellipse key="bl1" cx={-r * 0.55 + gx} cy={hy + r * 0.36} rx={r * 0.15} ry={r * 0.09} fill={PAL.blush} opacity={0.5} />, <ellipse key="bl2" cx={r * 0.55 + gx} cy={hy + r * 0.36} rx={r * 0.15} ry={r * 0.09} fill={PAL.blush} opacity={0.5} />);
  els.push(<L key="nose" d={`M${gx * 1.3} ${hy + r * 0.14}q${-r * 0.1} ${r * 0.18} ${r * 0.05} ${r * 0.24}`} w={4.5} c={g ? 'ghostDeep' : 'skinShade'} />);

  if (look.mustache) els.push(<S key="mu" d={`M${-r * 0.34 + gx} ${my - 8}q${r * 0.34} ${-r * 0.2} ${r * 0.68} 0q${-r * 0.1} ${r * 0.1} ${-r * 0.34} ${r * 0.02}q${-r * 0.24} ${r * 0.08} ${-r * 0.34} ${-r * 0.02}Z`} f={look.beardC ?? hairC} />);
  if (look.beard === 'goatee' || look.beard === 'long') {
    const bl = look.beard === 'long' ? r * 0.9 : r * 0.4;
    els.push(<S key="bd" d={`M${-r * 0.16 + gx} ${my + r * 0.2}Q${gx} ${my + r * 0.24 + bl} ${r * 0.16 + gx + Math.sin(t * 2) * 3} ${my + r * 0.2}Z`} f={look.beardC ?? hairC} />);
  }

  if (look.glasses === 'round' || look.glasses === 'square') {
    const gr = look.glasses === 'round';
    for (const sg of [-1, 1]) els.push(gr ? <circle key={'gl' + sg} cx={sg * ex + gx} cy={ey} r={r * 0.24} fill={PAL.white} fillOpacity={0.25} stroke={PAL.ink} strokeWidth={5} /> : <rect key={'gl' + sg} x={sg * ex + gx - r * 0.26} y={ey - r * 0.18} width={r * 0.52} height={r * 0.36} rx={6} fill={PAL.white} fillOpacity={0.25} stroke={PAL.ink} strokeWidth={5} />);
    els.push(<L key="glb" d={`M${-ex + r * 0.24 + gx} ${ey}h${2 * ex - r * 0.48}`} w={4} />);
  } else if (look.glasses === 'sun') {
    // kính râm cài trên đầu
    els.push(<S key="sg1" d={Rr(-r * 0.62, hy - r * 0.86, r * 0.52, r * 0.26, 10)} f="ink" sw={3} />, <S key="sg2" d={Rr(r * 0.1, hy - r * 0.86, r * 0.52, r * 0.26, 10)} f="ink" sw={3} />);
    els.push(<rect key="sgh" x={-r * 0.56} y={hy - r * 0.83} width={r * 0.18} height={5} fill={PAL.yellow} />);
  }
  return <g>{els}</g>;
};
