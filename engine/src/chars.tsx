// Rig nhân vật 2D chính diện, style riso: đầu to, viền mực, bóng chấm.
// Gốc toạ độ = điểm giữa hai bàn chân. Trục y âm là đi lên.
import React from 'react';
import {E, L, PAL, R, Rr, S, Sh, col, LINE, Smoke} from './kit';
import {TaperLimb, curvedTorsoPath, hairWindOffset, livingIdle, talkGesture} from './anim';

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
export type LegMode = 'stand' | 'sit' | 'walk' | 'run' | 'crouch' | 'ride' | 'jump' | 'fall' | 'push' | 'climb' | 'none';
export type Pose = {la: Arm; ra: Arm; legs?: LegMode; lean?: number; hop?: number; squash?: number; pitch?: number};
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
  // --- RSI v4.2.0 expressive physics poses ---
  run: {la: [48, -68], ra: [32, -88], legs: 'run', lean: 10, hop: 12},
  crouch: {la: [28, -55], ra: [28, -55], legs: 'crouch', lean: 8, squash: 0.92},
  brace: {la: [42, -95], ra: [42, -95], legs: 'crouch', lean: -6, squash: 0.90},
  ride: {la: [34, -82], ra: [34, -82], legs: 'ride', lean: 14, squash: 0.96},
  rideCheer: {la: [142, 22], ra: [34, -82], legs: 'ride', lean: 10, squash: 0.97},
  jump: {la: [135, -24], ra: [135, -24], legs: 'jump', hop: 56, squash: 1.08},
  fall: {la: [115, -20], ra: [132, -15], legs: 'fall', pitch: -64, hop: 24, squash: 0.94},
  trip: {la: [105, -30], ra: [122, -25], legs: 'fall', pitch: 52, hop: 18, squash: 0.94},
  push: {la: [78, -18], ra: [78, -18], legs: 'push', lean: 24, squash: 0.95},
  climb: {la: [148, -42], ra: [62, -74], legs: 'climb', lean: 6},
};

const mixArm = (a: Arm, b: Arm, u: number): Arm => (!Array.isArray(a) || !Array.isArray(b) ? (u < 0.5 ? a : b) : [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
export const poseMix = (a: Pose, b: Pose, u: number): Pose => ({
  la: mixArm(a.la, b.la, u),
  ra: mixArm(a.ra, b.ra, u),
  legs: u < 0.5 ? a.legs : b.legs,
  lean: (a.lean ?? 0) + ((b.lean ?? 0) - (a.lean ?? 0)) * u,
  hop: (a.hop ?? 0) + ((b.hop ?? 0) - (a.hop ?? 0)) * u,
  squash: (a.squash ?? 1) + ((b.squash ?? 1) - (a.squash ?? 1)) * u,
  pitch: (a.pitch ?? 0) + ((b.pitch ?? 0) - (a.pitch ?? 0)) * u,
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
  wind?: number;
  velX?: number;
  layer?: 'all' | 'far' | 'near';
  prop?: (h: Hands) => React.ReactNode; // vật cầm, vẽ trước bàn tay
  propBack?: (h: Hands) => React.ReactNode; // vật vẽ sau thân
};

export const Person: React.FC<PersonProps> = ({look, pose, expr = 'neutral', talk = 0, t, gaze = 0, blinkPh = 0, wind = 0, velX = 0, layer = 'all', prop, propBack}) => {
  const g = look.ghost;
  const skin = g ? 'ghost' : look.skin ?? 'skin';
  const W = look.w ?? 1;
  const H = look.h ?? 1;
  const belly = look.belly ?? 0;
  const sw = 78 * W; // nửa vai
  const ww = (64 + belly * 34) * W; // nửa eo
  const legY = -178 * H; // hông (thân ngắn, đầu to = dễ thương)
  const shY = legY - 196 * H; // vai
  const HR = 100 * (look.head ?? 1); // bán kính đầu — đầu ≈ 1/2.6 chiều cao
  const hy = shY - 8 - HR * 0.9;
  const legs = g ? 'none' : pose.legs ?? 'stand';
  const idle = livingIdle(t, blinkPh);
  const tg = talkGesture(t, talk, blinkPh);
  const bodyDrop = legs === 'sit' ? 70 : legs === 'crouch' ? 62 * H : legs === 'ride' ? 68 * H : legs === 'push' ? 24 * H : 0;
  const bY = legY + bodyDrop;
  const sY = shY + bodyDrop - idle.shoulderLift;
  const hyy = hy + bodyDrop - idle.shoulderLift + tg.headNod;

  // --- C-arc spine curvature ---
  const bendX =
    (legs === 'run' ? Math.sin(t * 14) * 8 :
    legs === 'push' ? 14 :
    legs === 'fall' ? -18 :
    legs === 'crouch' || legs === 'ride' ? 6 :
    legs === 'jump' ? -8 : 0) + idle.swayX;
  const topShift = bendX * 0.35;

  // --- tay ---
  const armW = 30 * Math.min(1.25, W);
  const ua = 104 * H, fa = 96 * H;
  const shoulder = (sg: number): [number, number] => [sg * (sw - 14) + topShift, sY + 18];
  const target = (sg: number, n: string): [number, number] => {
    switch (n) {
      case 'mouth': return [sg * HR * 0.32 + topShift, hyy + HR * 0.6];
      // tay cầm thìa: thìa dài ~96 px nghiêng -20°, nên bàn tay ở dưới cằm để đầu thìa chạm miệng
      case 'taste': return [sg * HR * 0.32 + 33 + topShift, hyy + HR * 0.6 + 90];
      case 'eye': return [sg * HR * 0.3 + topShift, hyy + HR * 0.2];
      case 'ear': return [sg * HR * 0.95 + topShift, hyy + HR * 0.1];
      case 'head': return [sg * HR * 0.7 + topShift, hyy - HR * 0.6];
      case 'over': return [sg * 40 + topShift, hyy - HR * 1.6];
      case 'chest': return [sg * 10 + topShift, sY + 90];
      case 'pray': return [topShift, sY + 40];
      case 'crossL': return [sw * 0.45 + topShift, sY + 120];
      case 'crossR': return [-sw * 0.45 + topShift, sY + 104];
      case 'hip': return [sg * (ww + 8), bY - 10];
      case 'front': return [sg * 26 + topShift, sY + 150];
    }
    return [sg * sw + topShift, sY + 200];
  };
  const armPts = (sg: number, a: Arm): [number, number][] => {
    const [x0, y0] = shoulder(sg);
    if (typeof a === 'string' || !Array.isArray(a)) {
      const [tx, rawTy] = typeof a === 'string' ? target(sg, a) : [a.x, a.y];
      const lockedHand = typeof a === 'string' && ['hip', 'pocket'].includes(a);
      const ty = rawTy + (!lockedHand && talk > 0 ? tg.handBob : 0);
      const dx = tx - x0, dy = ty - y0;
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
    let a0 = a[0], a1 = a[1];
    if (legs === 'run') {
      const swRun = Math.sin(t * 14) * sg;
      a0 += swRun * 24;
      a1 -= Math.max(0, swRun) * 14;
    } else if (legs === 'climb') {
      const swClimb = Math.sin(t * 7) * sg;
      a0 += swClimb * 26;
      a1 -= swClimb * 10;
    } else if (legs === 'jump') {
      const jCyc = Math.sin(t * 7 + blinkPh);
      a0 += jCyc * 10;
      a1 -= jCyc * 6;
    } else if (legs === 'fall') {
      const fl = Math.sin(t * 16 + blinkPh + (sg > 0 ? 1.9 : 0));
      a0 += fl * 22;
      a1 += Math.cos(t * 16 + blinkPh + (sg > 0 ? 0.6 : 2.1)) * 14;
    }
    const t1 = rad(a0);
    const t2 = rad(a0 + a1);
    const hBob = talk > 0 ? tg.handBob : 0;
    const x1 = x0 + sg * Math.sin(t1) * ua, y1 = y0 + Math.cos(t1) * ua + hBob * 0.4;
    const x2 = x1 + sg * Math.sin(t2) * fa, y2 = y1 + Math.cos(t2) * fa + hBob * 0.6;
    return [[x0, y0], [x1, y1], [x2, y2]];
  };
  const lp = armPts(-1, pose.la);
  const rp = armPts(1, pose.ra);
  const hands: Hands = {l: lp[2], r: rp[2]};
  const sleeveC = look.top === 'tank' ? skin : g ? 'ghostDeep' : look.topC;
  const fullSleeve = ['suit', 'uniform', 'robe', 'chef', 'aothe', 'blouse'].includes(look.top);
  const hasShortSleeve = !fullSleeve && look.top !== 'tank';
  // TaperLimb takes full diameters (internally halves to radius: rTop = 0.54*armW, rMid = 0.46*armW, rBot = 0.38*armW)
  const drawArm = (p: [number, number][], k: string) => (
    <g key={k}>
      <TaperLimb
        pts={p}
        wTop={armW * 1.08}
        wMid={armW * 0.92}
        wBot={armW * 0.76}
        fill={fullSleeve ? sleeveC : skin}
        sleeveFrac={hasShortSleeve ? 0.48 : undefined}
        sleeveFill={hasShortSleeve ? sleeveC : undefined}
        jointCrease={true}
      />
    </g>
  );
  const drawHand = (p: [number, number], k: string) => <S key={k} d={E(p[0], p[1], 17, 17)} f={skin} />;

  // --- chân khớp gối 2 khúc [hip, knee, ankle] ---
  const legX = 34 * W + belly * 10;
  const legW = 40 * Math.min(1.2, W);
  const legEls: React.ReactNode[] = [];
  const shoe = look.shoes ?? 'red';
  // TaperLimb takes full diameters (internally halves to radius: rTop = 0.56*legW, rMid = 0.48*legW, rBot = 0.40*legW)
  const drawLeg = (pts: [number, number][], k: string) => (
    <TaperLimb
      key={k}
      pts={pts}
      wTop={legW * 1.12}
      wMid={legW * 0.96}
      wBot={legW * 0.80}
      fill={look.pants}
      jointCrease={true}
    />
  );
  const drawShoe = (ax: number, ay: number, sg: number, k: string, rot = 0) => (
    <g key={k} transform={`translate(${ax.toFixed(1)} ${ay.toFixed(1)}) rotate(${rot.toFixed(1)})`}>
      <S d={Rr(-30 + sg * 8, -6, 60, 24, 11)} f={shoe} />
    </g>
  );

  if (legs === 'stand') {
    for (const sg of [-1, 1]) {
      const hip: [number, number] = [sg * legX, bY + 10];
      const knee: [number, number] = [sg * (legX + 2), bY * 0.5];
      const ankle: [number, number] = [sg * legX, -18];
      legEls.push(drawLeg([hip, knee, ankle], 'leg' + sg));
      legEls.push(drawShoe(ankle[0], ankle[1], sg, 'sh' + sg));
    }
  } else if (legs === 'walk') {
    for (const sg of [-1, 1]) {
      const stride = Math.sin(t * 9) * sg;
      const lift = Math.max(0, stride) * 20;
      const hip: [number, number] = [sg * legX, bY + 10];
      const knee: [number, number] = [sg * (legX + 5 + Math.max(0, stride) * 9), bY * 0.5 - lift * 0.65];
      const ankle: [number, number] = [sg * (legX + stride * 10), -18 - lift];
      legEls.push(drawLeg([hip, knee, ankle], 'leg' + sg));
      legEls.push(drawShoe(ankle[0], ankle[1], sg, 'sh' + sg, stride > 0 ? sg * stride * 14 : 0));
    }
  } else if (legs === 'run') {
    for (const sg of [-1, 1]) {
      const stride = Math.sin(t * 14) * sg;
      const lift = Math.max(0, stride) * 44;
      const trail = Math.max(0, -stride) * 18;
      const hip: [number, number] = [sg * legX, bY + 10];
      const knee: [number, number] = [sg * (legX + 10 + Math.max(0, stride) * 14), bY * 0.44 - lift * 0.85];
      const ankle: [number, number] = [sg * (legX + stride * 16), -18 - lift - trail * 0.5];
      legEls.push(drawLeg([hip, knee, ankle], 'leg' + sg));
      legEls.push(drawShoe(ankle[0], ankle[1], sg, 'sh' + sg, sg * (stride > 0 ? 18 : -10)));
    }
  } else if (legs === 'sit') {
    for (const sg of [-1, 1]) {
      legEls.push(drawLeg([[sg * legX, bY], [sg * (legX + 14), bY + 20], [sg * (legX + 10), -18]], 'leg' + sg));
      legEls.push(drawShoe(sg * (legX + 10), -18, sg, 'sh' + sg));
    }
  } else if (legs === 'crouch') {
    for (const sg of [-1, 1]) {
      const hip: [number, number] = [sg * legX, bY + 6];
      const knee: [number, number] = [sg * (legX + 24), bY + 46 * H];
      const ankle: [number, number] = [sg * (legX + 16), -18];
      legEls.push(drawLeg([hip, knee, ankle], 'leg' + sg));
      legEls.push(drawShoe(ankle[0], ankle[1], sg, 'sh' + sg, sg * 6));
    }
  } else if (legs === 'ride') {
    for (const sg of [-1, 1]) {
      const hip: [number, number] = [sg * legX, bY + 6];
      const knee: [number, number] = [sg * (legX + 32), bY + 34 * H];
      const ankle: [number, number] = [sg * (legX + 20), -26 * H];
      legEls.push(drawLeg([hip, knee, ankle], 'leg' + sg));
      legEls.push(drawShoe(ankle[0], ankle[1], sg, 'sh' + sg, sg * 16));
    }
  } else if (legs === 'jump') {
    const jCyc = Math.sin(t * 7 + blinkPh);
    for (const sg of [-1, 1]) {
      const hip: [number, number] = [sg * legX, bY + 8];
      const knee: [number, number] = [sg * (legX + 18 + jCyc * 5), bY + (26 - jCyc * 7) * H];
      const ankle: [number, number] = [sg * (legX + 6 + jCyc * 3), bY + (76 - jCyc * 11) * H];
      legEls.push(drawLeg([hip, knee, ankle], 'leg' + sg));
      legEls.push(drawShoe(ankle[0], ankle[1], sg, 'sh' + sg, sg * (20 + jCyc * 8)));
    }
  } else if (legs === 'fall') {
    for (const sg of [-1, 1]) {
      const kick = Math.sin(t * 16 + blinkPh + (sg > 0 ? 1.8 : 0)) * 18;
      const kick2 = Math.cos(t * 16 + blinkPh + (sg > 0 ? 0.5 : 2.4)) * 10;
      const asym = sg > 0 ? -16 : 12;
      const hip: [number, number] = [sg * legX, bY + 8];
      const knee: [number, number] = [sg * (legX + 26) + sg * kick * 0.55, bY + 28 * H + asym * 0.8 + kick2 * 0.6];
      const ankle: [number, number] = [sg * (legX + 46) + sg * kick, bY + 74 * H + asym * 1.4 + kick * 0.85];
      legEls.push(drawLeg([hip, knee, ankle], 'leg' + sg));
      legEls.push(drawShoe(ankle[0], ankle[1], sg, 'sh' + sg, sg * (30 + kick * 1.1)));
    }
    // subtle comic tumble motion arcs
    legEls.push(
      <L key="fm1" d={`M${-legX - 72} ${bY + 30}q-18 24 4 46`} w={4} o={0.35} />,
      <L key="fm2" d={`M${legX + 74} ${bY + 12}q18 22 -4 44`} w={4} o={0.35} />,
      <L key="fm3" d={`M${-sw - 28} ${sY + 30}q-16 26 8 44`} w={3.5} o={0.3} />,
    );
  } else if (legs === 'push') {
    // wide staggered bracing stance: right (+1) bent forward, left (-1) braced straight back
    const fHip: [number, number] = [legX, bY + 8];
    const fKnee: [number, number] = [legX + 24, bY + 52 * H];
    const fAnkle: [number, number] = [legX + 14, -18];
    const bHip: [number, number] = [-legX, bY + 8];
    const bKnee: [number, number] = [-legX - 32, bY + 74 * H];
    const bAnkle: [number, number] = [-legX - 58, -18];
    legEls.push(drawLeg([bHip, bKnee, bAnkle], 'leg-1'));
    legEls.push(drawShoe(bAnkle[0], bAnkle[1], -1, 'sh-1', -12));
    legEls.push(drawLeg([fHip, fKnee, fAnkle], 'leg1'));
    legEls.push(drawShoe(fAnkle[0], fAnkle[1], 1, 'sh1', 4));
  } else if (legs === 'climb') {
    for (const sg of [-1, 1]) {
      const cyc = Math.sin(t * 7) * sg;
      const lift = (cyc * 0.5 + 0.5) * 56 * H;
      const hip: [number, number] = [sg * legX, bY + 8];
      const knee: [number, number] = [sg * (legX + 16 + (cyc > 0 ? 10 : 0)), bY + 42 * H - lift * 0.55];
      const ankle: [number, number] = [sg * (legX + 8), -18 - lift * 0.75];
      legEls.push(drawLeg([hip, knee, ankle], 'leg' + sg));
      legEls.push(drawShoe(ankle[0], ankle[1], sg, 'sh' + sg, sg * (cyc > 0 ? 14 : -4)));
    }
  }

  // --- thân (curved C-arc spine silhouette) ---
  const long = look.top === 'robe' || look.top === 'aothe' || g;
  const hemY = long ? (g ? bY + 40 : -40) : bY + 26;
  const hemW = long ? ww + 36 : ww + 4;
  const torso = curvedTorsoPath(-sw, sw, -hemW, hemW, sY, hemY, bendX, belly);
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

  // --- secondary motion: wind hair + lagging head counter-tilt + living micro-acting ---
  const hw = hairWindOffset(t, wind, velX, blinkPh);
  const rawHeadRot =
    legs === 'run' ? -Math.sin(t * 14 - 0.85) * 3.8 :
    legs === 'walk' ? -Math.sin(t * 9 - 0.75) * 2.2 :
    legs === 'jump' ? -Math.cos(t * 7 + blinkPh - 0.6) * 3.2 :
    legs === 'fall' ? Math.sin(t * 16 + blinkPh - 0.6) * 4.0 :
    -(pose.lean ?? 0) * 0.16;
  const baseHeadRot = Math.max(-4.5, Math.min(4.5, rawHeadRot + Math.max(-1.5, Math.min(1.5, hw.rot * 0.08))));
  const headRot = baseHeadRot + idle.headTilt + tg.headTilt;

  // --- đầu ---
  const head = <Head look={look} hy={hyy} R={HR} expr={expr} talk={talk} t={t} gaze={gaze} blinkPh={blinkPh} hw={hw} headRot={headRot} topShift={topShift} browBob={tg.browBob} pupilDx={idle.pupilDx} />;

  // ma: đuôi khói thay cho chân, cơ thể trôi bồng bềnh; người thường: nhịp bước + nhún nhảy + thở nhẹ
  const modeBob =
    legs === 'walk' ? Math.abs(Math.sin(t * 9)) * 7 :
    legs === 'run' ? Math.abs(Math.sin(t * 14)) * 16 :
    legs === 'ride' ? Math.sin(t * 6) * 4 :
    legs === 'jump' ? Math.sin(t * 7 + blinkPh) * 8 :
    legs === 'climb' ? Math.abs(Math.sin(t * 7)) * 6 : 0;
  const bob = g ? Math.sin(t * 2.2 + blinkPh) * 10 : (pose.hop ?? 0) + modeBob;
  const breath = idle.breathe * 0.008 + tg.chestPulse;
  const sq = Math.max(0.5, (pose.squash ?? 1) + breath);
  const sxSq = 1 / Math.sqrt(sq);
  const totalRot = (pose.lean ?? 0) + (pose.pitch ?? 0);
  const tail = g ? (
    <g>
      <path d={`M${-hemW} ${hemY - 4}C${-hemW + 20} ${hemY + 60} ${-30} ${hemY + 40} ${-10 + Math.sin(t * 2) * 14} ${hemY + 130}C${40} ${hemY + 60} ${hemW - 10} ${hemY + 50} ${hemW} ${hemY - 4}Z`} fill={PAL.ghost} stroke={PAL.ink} strokeWidth={LINE} opacity={0.85} />
      <Smoke x={-10} y={hemY + 150} t={t} h={60} w={10} o={0.5} />
    </g>
  ) : null;

  const showFar = layer !== 'near';
  const showNear = layer !== 'far';

  return (
    <g transform={`translate(0 ${(-bob).toFixed(1)}) rotate(${totalRot.toFixed(2)} 0 ${bY.toFixed(1)}) scale(${sxSq.toFixed(4)} ${sq.toFixed(4)})`} opacity={g ? 0.93 : 1}>
      {showFar && g && <ellipse cx={0} cy={hyy} rx={HR * 3.2} ry={HR * 4} fill="url(#glowG)" />}
      {showFar && propBack?.(hands)}
      {showFar && legEls}
      {showFar && tail}
      {showNear && (
        <>
          <S d={torso} f={topC} />
          <clipPath id={`tc-${look.name}`}><path d={torso} /></clipPath>
          <g clipPath={`url(#tc-${look.name})`}>
            {pattern}
            <Sh d={`M${(sw * 0.35 + topShift).toFixed(1)} ${sY - 30}L${(sw + 60 + Math.abs(bendX)).toFixed(1)} ${sY - 30}L${(hemW + 60 + Math.abs(bendX)).toFixed(1)} ${hemY + 14}L${(hemW * 0.45).toFixed(1)} ${hemY + 14}Z`} o={0.55} />
          </g>
          <g transform={`translate(${topShift.toFixed(1)} 0)`}>{collar}</g>
          {/* cổ */}
          <S d={R(-20 + topShift, sY - 44, 40, 34)} f={g ? 'ghost' : 'skinShade'} />
          {head}
          {drawArm(lp, 'la')}
          {drawArm(rp, 'ra')}
          {prop?.(hands)}
          {drawHand(hands.l, 'hl')}
          {drawHand(hands.r, 'hr')}
        </>
      )}
    </g>
  );
};

type HairWind = {dx: number; dy: number; rot: number};

const Head: React.FC<{look: Look; hy: number; R: number; expr: Expr; talk: number; t: number; gaze: number; blinkPh: number; hw: HairWind; headRot: number; topShift: number; browBob?: number; pupilDx?: number}> = ({look, hy, R: r, expr, talk, t, gaze, blinkPh, hw, headRot, topShift, browBob = 0, pupilDx = 0}) => {
  const g = look.ghost;
  const skin = g ? 'ghost' : look.skin ?? 'skin';
  const hairC = look.hairC ?? 'hair';
  const gx = gaze * r * 0.16;
  const wdx = hw.dx;
  const wdy = hw.dy;
  const els: React.ReactNode[] = [];

  // tóc sau đầu
  if (look.hair === 'bun') {
    els.push(
      <g key="bun" transform={`rotate(${(hw.rot * 0.45).toFixed(2)} 0 ${(hy - r * 0.72).toFixed(1)})`}>
        <S d={E(0, hy - r * 0.95, r * 0.42, r * 0.32)} f={hairC} />
      </g>,
    );
  }
  if (look.hair === 'curly') for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.95 + (i / 8) * 1.1);
    els.push(<S key={'cu' + i} d={E(Math.cos(a) * r * 1.02 + wdx * 0.12, hy + Math.sin(a) * r * 1.0 + r * 0.1 + wdy * 0.12, r * 0.36, r * 0.36)} f={hairC} />);
  }
  if (look.hair === 'long') {
    els.push(
      <S
        key="lg"
        d={`M${(-r * 1.04).toFixed(1)} ${(hy - r * 0.2).toFixed(1)}C${(-r * 1.16 + wdx * 0.45).toFixed(1)} ${(hy + r * 0.9 + wdy * 0.3).toFixed(1)} ${(-r * 1.04 + wdx * 0.8).toFixed(1)} ${(hy + r * 1.4 + wdy * 0.5).toFixed(1)} ${(-r * 0.72 + wdx * 0.95).toFixed(1)} ${(hy + r * 1.5 + wdy * 0.55).toFixed(1)}L${(r * 0.72 + wdx * 0.95).toFixed(1)} ${(hy + r * 1.5 + wdy * 0.55).toFixed(1)}C${(r * 1.04 + wdx * 0.8).toFixed(1)} ${(hy + r * 1.4 + wdy * 0.5).toFixed(1)} ${(r * 1.16 + wdx * 0.45).toFixed(1)} ${(hy + r * 0.9 + wdy * 0.3).toFixed(1)} ${(r * 1.04).toFixed(1)} ${(hy - r * 0.2).toFixed(1)}Z`}
        f={hairC}
      />,
    );
  }

  // tai + mặt: mặt bầu (rộng ở má, cằm tròn) — không phải hình elip đứng
  els.push(<S key="ea1" d={E(-r * 0.92, hy + r * 0.2, r * 0.14, r * 0.19)} f={skin} />);
  els.push(<S key="ea2" d={E(r * 0.92, hy + r * 0.2, r * 0.14, r * 0.19)} f={skin} />);
  if (look.earrings) els.push(<S key="er1" d={E(-r * 0.93, hy + r * 0.44, 6, 6)} f="gold" />, <S key="er2" d={E(r * 0.93, hy + r * 0.44, 6, 6)} f="gold" />);
  const faceD = `M0 ${hy - r}C${r * 0.62} ${hy - r} ${r * 0.96} ${hy - r * 0.62} ${r * 0.96} ${hy + r * 0.08}C${r * 0.96} ${hy + r * 0.66} ${r * 0.56} ${hy + r * 0.9} 0 ${hy + r * 0.9}C${-r * 0.56} ${hy + r * 0.9} ${-r * 0.96} ${hy + r * 0.66} ${-r * 0.96} ${hy + r * 0.08}C${-r * 0.96} ${hy - r * 0.62} ${-r * 0.62} ${hy - r} 0 ${hy - r}Z`;
  els.push(<S key="face" d={faceD} f={skin} />);
  els.push(<Sh key="fsh" d={`M${r * 0.5} ${hy - r * 0.86}C${r * 0.98} ${hy - r * 0.4} ${r * 1.0} ${hy + r * 0.6} ${r * 0.4} ${hy + r * 0.84}C${r * 0.74} ${hy + r * 0.4} ${r * 0.8} ${hy - r * 0.3} ${r * 0.5} ${hy - r * 0.86}Z`} o={0.35} />);

  // tóc trước
  const hp = (d: string, k: string) => els.push(<S key={k} d={d} f={hairC} />);
  // tóc: mũ tóc phủ kín đỉnh đầu (cao hơn đỉnh mặt), mái tóc là các múi tròn — không đường cắt thẳng
  const cap = (lo: number) => `M${-r * 1.0} ${hy + r * lo}C${-r * 1.1} ${hy - r * 1.46} ${r * 1.1} ${hy - r * 1.46} ${r * 1.0} ${hy + r * lo}`;
  const fringe = (n: number, depth: number, lo: number) => {
    // n múi mái từ thái dương trái sang phải
    let d = cap(lo);
    for (let i = n; i >= 0; i--) {
      const x = -r * 0.98 + (i / n) * r * 1.96;
      const yb = hy - r * 0.42 + depth * (i % 2 ? 1 : 0.55) * r;
      d += i === n ? `L${x} ${hy - r * 0.3}` : `Q${x + r * 0.98 / n} ${yb + r * 0.12} ${x} ${hy - r * 0.42 + (i === 0 ? r * (lo + 0.3) : 0)}`;
    }
    return d + 'Z';
  };
  switch (look.hair) {
    case 'bald':
      hp(`M${-r * 0.95} ${hy + r * 0.12}C${-r * 1.0} ${hy - r * 0.35} ${-r * 0.82} ${hy - r * 0.55} ${-r * 0.62} ${hy - r * 0.52}C${-r * 0.7} ${hy - r * 0.2} ${-r * 0.72} ${hy} ${-r * 0.74} ${hy + r * 0.14}Z`, 'h1');
      hp(`M${r * 0.95} ${hy + r * 0.12}C${r * 1.0} ${hy - r * 0.35} ${r * 0.82} ${hy - r * 0.55} ${r * 0.62} ${hy - r * 0.52}C${r * 0.7} ${hy - r * 0.2} ${r * 0.72} ${hy} ${r * 0.74} ${hy + r * 0.14}Z`, 'h2');
      els.push(<path key="shine" d={`M${-r * 0.3} ${hy - r * 0.8}q${r * 0.2} ${-r * 0.1} ${r * 0.4} ${-r * 0.02}`} stroke={PAL.white} strokeWidth={8} strokeLinecap="round" fill="none" />);
      break;
    case 'side':
    case 'neat':
      // rẽ ngôi, mái hất sang một bên thành một khối cong
      hp(`${cap(0.02)}C${r * 0.9} ${hy - r * 0.42} ${r * 0.3} ${hy - r * 0.46} ${-r * 0.1} ${hy - r * 0.62}C${-r * 0.3} ${hy - r * 0.34} ${-r * 0.7} ${hy - r * 0.3} ${-r * 1.0} ${hy + r * 0.02}Z`, 'h');
      els.push(<L key="hl" d={`M${-r * 0.5} ${hy - r * 0.86}q${r * 0.3} ${-r * 0.14} ${r * 0.6} ${-r * 0.06}`} w={6} c="white" o={0.35} />);
      break;
    case 'short':
    case 'kid':
      hp(fringe(6, 0.16, 0.06), 'h');
      if (look.hair === 'kid') {
        els.push(
          <g key="cwl" transform={`rotate(${(hw.rot * 0.45).toFixed(2)} ${(r * 0.06).toFixed(1)} ${(hy - r * 1.04).toFixed(1)})`}>
            <S d={`M${(-r * 0.04).toFixed(1)} ${(hy - r * 1.02).toFixed(1)}Q${(r * 0.06).toFixed(1)} ${(hy - r * 1.38).toFixed(1)} ${(r * 0.26).toFixed(1)} ${(hy - r * 1.28).toFixed(1)}Q${(r * 0.12).toFixed(1)} ${(hy - r * 1.14).toFixed(1)} ${(r * 0.12).toFixed(1)} ${(hy - r * 1.0).toFixed(1)}Z`} f={hairC} />
          </g>,
        );
      }
      break;
    case 'bun':
      hp(`${cap(0.12)}C${r * 0.82} ${hy - r * 0.42} ${r * 0.3} ${hy - r * 0.58} 0 ${hy - r * 0.6}C${-r * 0.3} ${hy - r * 0.58} ${-r * 0.82} ${hy - r * 0.42} ${-r * 1.0} ${hy + r * 0.12}Z`, 'h');
      break;
    case 'long':
      // mái thưa chia đôi + hai lọn tóc ôm mặt xuống quá cằm (sways smoothly in wind)
      hp(`${cap(0.3)}C${r * 0.8} ${hy - r * 0.3} ${r * 0.34} ${hy - r * 0.44} ${r * 0.06} ${hy - r * 0.66}C${-r * 0.2} ${hy - r * 0.34} ${-r * 0.7} ${hy - r * 0.36} ${-r * 1.0} ${hy + r * 0.3}Z`, 'h');
      for (const sg of [-1, 1]) {
        hp(
          `M${(sg * r * 0.98).toFixed(1)} ${(hy - r * 0.1).toFixed(1)}C${(sg * r * 1.06 + wdx * 0.35).toFixed(1)} ${(hy + r * 0.6 + wdy * 0.25).toFixed(1)} ${(sg * r * 1.0 + wdx * 0.6).toFixed(1)} ${(hy + r * 1.1 + wdy * 0.4).toFixed(1)} ${(sg * r * 0.84 + wdx * 0.78).toFixed(1)} ${(hy + r * 1.36 + wdy * 0.48).toFixed(1)}C${(sg * r * 0.8 + wdx * 0.45).toFixed(1)} ${(hy + r * 1.0 + wdy * 0.3).toFixed(1)} ${(sg * r * 0.8 + wdx * 0.2).toFixed(1)} ${(hy + r * 0.4 + wdy * 0.15).toFixed(1)} ${(sg * r * 0.82).toFixed(1)} ${(hy - r * 0.1).toFixed(1)}Z`,
          'lk' + sg,
        );
      }
      els.push(<L key="hl" d={`M${-r * 0.56} ${hy - r * 0.84}q${r * 0.24} ${-r * 0.14} ${r * 0.5} ${-r * 0.1}`} w={6} c="white" o={0.35} />);
      break;
    case 'curly':
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.08 + (i / 6) * 0.84);
        els.push(<S key={'cf' + i} d={E(Math.cos(a) * r * 0.8 + wdx * 0.08, hy + Math.sin(a) * r * 0.84 + wdy * 0.08, r * 0.32, r * 0.28)} f={hairC} />);
      }
      break;
    case 'thin':
      hp(`M${-r * 0.95} ${hy + r * 0.05}C${-r * 0.98} ${hy - r * 0.5} ${-r * 0.7} ${hy - r * 0.66} ${-r * 0.48} ${hy - r * 0.64}C${-r * 0.6} ${hy - r * 0.3} ${-r * 0.68} ${hy - r * 0.05} ${-r * 0.72} ${hy + r * 0.1}Z`, 'h1');
      hp(`M${r * 0.95} ${hy + r * 0.05}C${r * 0.98} ${hy - r * 0.5} ${r * 0.7} ${hy - r * 0.66} ${r * 0.48} ${hy - r * 0.64}C${r * 0.6} ${hy - r * 0.3} ${r * 0.68} ${hy - r * 0.05} ${r * 0.72} ${hy + r * 0.1}Z`, 'h2');
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

  // biểu cảm — luật mặt dễ thương: mắt to có 2 điểm sáng, đặt thấp (dưới giữa mặt); mày ngắn bo tròn;
  // miệng NHỎ và gần mắt; KHÔNG vẽ răng (miệng mở = khoang tối + lưỡi hồng); má hồng to, mềm.
  const blink = ((t * 1000 + blinkPh * 700) % 3700) < 120;
  const ex = r * 0.34;
  const ey = hy + r * 0.2;
  const er = r * 0.12;
  const browC = look.brows ?? (g ? 'white' : 'hair');
  const pxOff = pupilDx + (expr === 'shock' ? Math.sin(t * 32) * 1.4 : 0);
  const brow = (dl: number, dr: number, lift = 0) => {
    const by = ey - r * 0.32 - lift + browBob;
    els.push(<L key="bl" d={`M${-ex - r * 0.12 + gx} ${by + dl}Q${-ex + gx} ${by - r * 0.05} ${-ex + r * 0.12 + gx} ${by - dl}`} w={7} c={browC} />);
    els.push(<L key="br" d={`M${ex + r * 0.12 + gx} ${by + dr}Q${ex + gx} ${by - r * 0.05} ${ex - r * 0.12 + gx} ${by - dr}`} w={7} c={browC} />);
  };
  const shine = (x: number, y: number, k: string, s = 1) => els.push(
    <circle key={k + 'a'} cx={x + er * 0.38} cy={y - er * 0.42} r={er * 0.34 * s} fill={PAL.white} />,
    <circle key={k + 'b'} cx={x - er * 0.36} cy={y + er * 0.4} r={er * 0.15 * s} fill={PAL.white} />);
  const eyesDot = (k = 1) => {
    if (blink) {
      els.push(<L key="e1" d={`M${-ex - er + gx} ${ey}q${er} ${er * 0.6} ${2 * er} 0`} w={5.5} />, <L key="e2" d={`M${ex - er + gx} ${ey}q${er} ${er * 0.6} ${2 * er} 0`} w={5.5} />);
    } else for (const sg of [-1, 1]) {
      els.push(<ellipse key={'e' + sg} cx={sg * ex + gx + pxOff} cy={ey} rx={er * k} ry={er * 1.18 * k} fill={PAL.ink} />);
      shine(sg * ex + gx + pxOff, ey, 'eh' + sg, k);
    }
  };
  const eyesArc = (up = true) => {
    const s = up ? -1 : 1;
    for (const sg of [-1, 1]) els.push(<L key={'e' + sg} d={`M${sg * ex - er * 1.1 + gx} ${ey + 3}q${er * 1.1} ${s * er * 1.2} ${er * 2.2} 0`} w={6} />);
  };
  const eyesWide = () => {
    for (const sg of [-1, 1]) {
      els.push(<S key={'ew' + sg} d={E(sg * ex + gx, ey, er * 1.45, er * 1.6)} f="white" sw={4} />);
      els.push(<circle key={'ep' + sg} cx={sg * ex + gx + pxOff} cy={ey + 2} r={er * 0.7} fill={PAL.ink} />);
      shine(sg * ex + gx + pxOff, ey + 2, 'ws' + sg, 0.6);
    }
  };
  const eyesNarrow = () => {
    // mí trên phẳng che nửa mắt
    for (const sg of [-1, 1]) {
      els.push(<ellipse key={'e' + sg} cx={sg * ex + gx + pxOff} cy={ey + er * 0.25} rx={er} ry={er * 0.8} fill={PAL.ink} />);
      els.push(<L key={'lid' + sg} d={`M${sg * ex - er * 1.3 + gx} ${ey - er * 0.2}h${er * 2.6}`} w={6} />);
      els.push(<circle key={'s' + sg} cx={sg * ex + gx + pxOff + er * 0.35} cy={ey + er * 0.25} r={er * 0.22} fill={PAL.white} />);
    }
  };

  const my = hy + r * 0.52;
  const lipC = look.lips ? 'red' : 'ink';
  const lipW = look.lips ? 7 : 5;
  const cavity = look.lips ? PAL.red : PAL.ink;
  const openMouth = (w: number, h: number, k: string) => {
    // miệng mở: hình chữ D, khoang tối, lưỡi hồng ở đáy — không răng
    const d = `M${-w + gx} ${my - 2}Q${gx} ${my + 2} ${w + gx} ${my - 2}Q${w * 0.9 + gx} ${my + h} ${gx} ${my + h}Q${-w * 0.9 + gx} ${my + h} ${-w + gx} ${my - 2}Z`;
    const cid = `mc-${look.name ?? 'x'}-${k}`;
    els.push(<clipPath key={k + 'c'} id={cid}><path d={d} /></clipPath>,
      <path key={k + 'f'} d={d} fill={PAL.redDark} />,
      <ellipse key={k + 't'} cx={gx} cy={my + h} rx={w * 0.6} ry={h * 0.45} fill={PAL.pink} clipPath={`url(#${cid})`} />,
      <path key={k + 'l'} d={d} fill="none" stroke={cavity} strokeWidth={look.lips ? 5.5 : 4.5} strokeLinejoin="round" />);
  };
  const mouth = (kind: string) => {
    if (talk > 0.05 && kind !== 'wail' && kind !== 'O') { openMouth(r * 0.13, 6 + talk * r * 0.16, 'tk'); return; }
    switch (kind) {
      case 'flat': els.push(<L key="m" d={`M${-r * 0.09 + gx} ${my}q${r * 0.09} ${r * 0.03} ${r * 0.18} 0`} w={lipW} c={lipC} />); break;
      case 'smile': els.push(<L key="m" d={`M${-r * 0.14 + gx} ${my - 3}q${r * 0.14} ${r * 0.14} ${r * 0.28} 0`} w={lipW} c={lipC} />); break;
      case 'grin': openMouth(r * 0.17, r * 0.2, 'gr'); break;
      case 'frown': els.push(<L key="m" d={`M${-r * 0.13 + gx} ${my + 5}q${r * 0.13} ${-r * 0.12} ${r * 0.26} 0`} w={lipW} c={lipC} />); break;
      case 'smirk': els.push(<L key="m" d={`M${-r * 0.1 + gx} ${my + 2}q${r * 0.14} ${r * 0.04} ${r * 0.24} ${-r * 0.1}`} w={lipW} c={lipC} />); break;
      case 'O': els.push(<S key="m" d={E(gx, my + 5, r * 0.08, r * 0.11)} f="redDark" sw={4} lc={look.lips ? PAL.red : undefined} />); break;
      case 'wail': openMouth(r * 0.2, r * 0.24, 'wl'); break;
      case 'shh': els.push(<S key="m" d={E(gx, my + 2, r * 0.05, r * 0.05)} f="redDark" sw={4} />); break;
    }
  };

  switch (expr) {
    case 'neutral': brow(0, 0); eyesDot(); mouth('flat'); break;
    case 'deadpan': brow(0, 0, -5); eyesDot(0.9); for (const sg of [-1, 1]) els.push(<L key={'lid' + sg} d={`M${sg * ex - er * 1.2 + gx} ${ey - er * 0.3}h${er * 2.4}`} w={6} />); mouth('flat'); break;
    case 'stern': brow(6, 6, -2); eyesDot(0.9); mouth('frown'); break;
    case 'angry': brow(10, 10, -3); eyesNarrow(); mouth(talk > 0.05 ? 'flat' : 'frown'); break;
    case 'smug': brow(-3, 5); eyesArc(false); mouth('smirk'); break;
    case 'sly': brow(5, -3); eyesNarrow(); mouth('smirk'); break;
    case 'shock': brow(-5, -5, 10); eyesWide(); mouth('O'); break;
    case 'sad': brow(-8, -8, 3); eyesDot(0.95); mouth('frown'); break;
    case 'cry': brow(-9, -9, 5); eyesArc(true); mouth('wail');
      for (const sg of [-1, 1]) els.push(<path key={'tr' + sg} d={`M${sg * ex + gx} ${ey + 8}q${sg * 6} ${r * 0.25 + Math.sin(t * 12) * 5} 0 ${r * 0.5}`} stroke={PAL.blue} strokeWidth={8} fill="none" strokeLinecap="round" />);
      break;
    case 'joy': brow(-3, -3, 6); eyesArc(true); mouth('grin'); break;
    case 'eager': brow(-4, -4, 8); eyesDot(1.1); mouth('grin'); break;
    case 'shh': brow(3, 3); eyesWide(); mouth('shh'); break;
  }

  // má hồng to, mềm, ngay dưới mắt; mũi chỉ là một nét nhỏ
  if (!g) for (const sg of [-1, 1]) els.push(<ellipse key={'bl' + sg} cx={sg * r * 0.6 + gx} cy={ey + r * 0.22} rx={r * 0.15} ry={r * 0.09} fill={PAL.blush} opacity={0.42} />);
  els.push(<L key="nose" d={`M${gx * 1.2 - r * 0.03} ${hy + r * 0.36}q${r * 0.04} ${r * 0.04} ${r * 0.07} 0`} w={4.5} c={g ? 'ghostDeep' : 'skinShade'} />);

  if (look.mustache) els.push(<S key="mu" d={`M${-r * 0.34 + gx} ${my - 8}q${r * 0.34} ${-r * 0.2} ${r * 0.68} 0q${-r * 0.1} ${r * 0.1} ${-r * 0.34} ${r * 0.02}q${-r * 0.24} ${r * 0.08} ${-r * 0.34} ${-r * 0.02}Z`} f={look.beardC ?? hairC} />);
  if (look.beard === 'goatee' || look.beard === 'long') {
    const bl = look.beard === 'long' ? r * 0.9 : r * 0.4;
    const bSway = look.beard === 'long' ? wdx * 0.35 + Math.sin(t * 2) * 3 : Math.sin(t * 2) * 2;
    els.push(<S key="bd" d={`M${(-r * 0.16 + gx).toFixed(1)} ${(my + r * 0.2).toFixed(1)}Q${(gx + bSway).toFixed(1)} ${(my + r * 0.24 + bl).toFixed(1)} ${(r * 0.16 + gx + bSway * 0.35).toFixed(1)} ${(my + r * 0.2).toFixed(1)}Z`} f={look.beardC ?? hairC} />);
  }

  if (look.glasses === 'round' || look.glasses === 'square') {
    const gr = look.glasses === 'round';
    for (const sg of [-1, 1]) els.push(gr ? <circle key={'gl' + sg} cx={sg * ex + gx} cy={ey} r={r * 0.22} fill={PAL.white} fillOpacity={0.25} stroke={PAL.ink} strokeWidth={5} /> : <rect key={'gl' + sg} x={sg * ex + gx - r * 0.26} y={ey - r * 0.18} width={r * 0.52} height={r * 0.36} rx={6} fill={PAL.white} fillOpacity={0.25} stroke={PAL.ink} strokeWidth={5} />);
    els.push(<L key="glb" d={`M${-ex + r * 0.22 + gx} ${ey}h${2 * ex - r * 0.44}`} w={4} />);
  } else if (look.glasses === 'sun') {
    // kính râm cài trên đầu
    els.push(<S key="sg1" d={Rr(-r * 0.62, hy - r * 0.86, r * 0.52, r * 0.26, 10)} f="ink" sw={3} />, <S key="sg2" d={Rr(r * 0.1, hy - r * 0.86, r * 0.52, r * 0.26, 10)} f="ink" sw={3} />);
    els.push(<rect key="sgh" x={-r * 0.56} y={hy - r * 0.83} width={r * 0.18} height={5} fill={PAL.yellow} />);
  }
  return <g transform={`translate(${topShift.toFixed(1)} 0) rotate(${headRot.toFixed(2)} 0 ${(hy + r * 0.85).toFixed(1)})`}>{els}</g>;
};
