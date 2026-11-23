// Rig nhân vật 2D góc nghiêng 3/4 (cinematic three-quarter view), style riso: đầu to, viền mực, bóng chấm.
// Gốc toạ độ = điểm giữa hai bàn chân. Trục y âm là đi lên. Chuẩn quay phải-trước (+x), lật mượt bằng scale(face, 1).
import React from 'react';
import {E, L, PAL, R, Rr, S, Sh, col, LINE, Smoke} from './kit';
import {CartoonHand, HandKind, TaperLimb, curvedTorsoPath, hairWindOffset, livingIdle, talkGesture} from './anim';
import {clamp} from './math';
import type {Arm, Expr, Look, Pose} from './chars';

const rad = (d: number) => (d * Math.PI) / 180;

type Hands = {l: [number, number]; r: [number, number]};

export type ThreeQProps = {
  look: Look;
  pose: Pose;
  expr?: Expr;
  talk?: number; // 0..1 độ mở miệng khi nói
  t: number;
  phase?: number; // pha bước theo quãng đường (tùy chọn)
  speed?: number; // biên độ vận tốc bước 0..1.25 (tùy chọn)
  face?: 1 | -1; // 1 = quay phải-trước, -1 = quay trái-trước
  gaze?: number; // -1..1 hướng nhìn bổ sung
  gazeY?: number; // -1..1 hướng nhìn dọc (-1 = lên, +1 = xuống)
  handL?: HandKind;
  handR?: HandKind;
  blinkPh?: number;
  wind?: number; // luồng gió thổi ngược hướng mặt (mặc định 0)
  velX?: number; // vận tốc ngang thế giới px/s (mặc định 0)
  layer?: 'all' | 'far' | 'near'; // tách lớp kẹp vật cưỡi (mặc định 'all')
  prop?: (h: Hands) => React.ReactNode;
  propBack?: (h: Hands) => React.ReactNode;
};

export const Person3Q: React.FC<ThreeQProps> = ({
  look,
  pose,
  expr = 'neutral',
  talk = 0,
  t,
  phase,
  speed,
  face = 1,
  gaze = 0,
  gazeY = 0,
  handL = 'open',
  handR = 'open',
  blinkPh = 0,
  wind = 0,
  velX = 0,
  layer = 'all',
  prop,
  propBack,
}) => {
  const g = look.ghost;
  const skin = g ? 'ghost' : look.skin ?? 'skin';
  const W = look.w ?? 1;
  const H = look.h ?? 1;
  const belly = look.belly ?? 0;

  // Khớp chính xác tỉ lệ dọc của chars.tsx
  const sw = 78 * W;
  const ww = (64 + belly * 34) * W;
  const legY = -178 * H;
  const shY = legY - 196 * H; // -374 * H
  const HR = 100 * (look.head ?? 1);
  const hy = shY - 8 - HR * 0.9;
  const legs = g ? 'none' : pose.legs ?? 'stand';
  const gaitAmp = speed !== undefined ? clamp(speed, 0, 1.25) : 1;
  const walkAng = phase !== undefined ? phase * Math.PI * 2 : t * 9;
  const runAng = phase !== undefined ? phase * Math.PI * 2 : t * 14;
  const idle = livingIdle(t, blinkPh);
  const tg = talkGesture(t, talk, blinkPh);
  const bodyDrop = legs === 'sit' ? 70 : legs === 'crouch' ? 62 * H : legs === 'ride' ? 72 * H : legs === 'push' ? 24 * H : 0;

  // Độ cong cột sống chữ C theo tư thế + nhịp thở / dồn trọng tâm tự nhiên
  const bendX =
    (legs === 'ride' ? 20 :
    legs === 'push' ? 26 :
    legs === 'run' ? 16 * gaitAmp :
    legs === 'crouch' ? 14 :
    legs === 'fall' ? -22 :
    legs === 'jump' ? -8 :
    legs === 'climb' ? 6 :
    legs === 'walk' ? 4 * gaitAmp : 0) + idle.swayX;
  const shShift = bendX * 0.35;

  // Độ lệch phối cảnh 3/4 (hướng mặt +x): vai gần rộng (-x), vai xa thu hẹp (+x), trục ngực lệch +x
  const nearShX = -sw * 0.88;
  const farShX = sw * 0.68;
  const cxT = sw * 0.24 + shShift * 0.85; // đường tâm ngực (khuy áo, cà vạt, cổ áo)
  const nearHemX = -ww * 0.88;
  const farHemX = ww * 0.78 + belly * 24;

  const bY = legY + bodyDrop;
  const sY = shY + bodyDrop - idle.shoulderLift;
  const hyy = hy + bodyDrop - idle.shoulderLift + tg.headNod;

  // --- tay (IK + góc khớp đồng bộ POSES) ---
  const armW = 30 * Math.min(1.25, W);
  const ua = 104 * H, fa = 96 * H;
  const shoulder = (sg: number): [number, number] => [
    (sg < 0 ? nearShX + 14 : farShX - 10) + shShift,
    sY + (sg < 0 ? 18 : 14),
  ];
  const target = (sg: number, n: string): [number, number] => {
    const fcx = HR * 0.22 + shShift;
    switch (n) {
      case 'mouth': return [fcx + sg * HR * 0.16, hyy + HR * 0.58];
      case 'taste': return [fcx + sg * HR * 0.16 + 30, hyy + HR * 0.58 + 88];
      case 'eye': return [fcx + sg * HR * 0.24, hyy + HR * 0.2];
      case 'ear': return [(sg < 0 ? -HR * 0.78 : HR * 0.82) + shShift, hyy + HR * 0.14];
      case 'head': return [sg * HR * 0.55 + HR * 0.1 + shShift, hyy - HR * 0.6];
      case 'over': return [sg * 36 + 10 + shShift, hyy - HR * 1.6];
      case 'chest': return [cxT + sg * 10, sY + 90];
      case 'pray': return [cxT + 6, sY + 42];
      case 'crossL': return [cxT + sw * 0.34, sY + 118];
      case 'crossR': return [cxT - sw * 0.42, sY + 104];
      case 'hip': return [sg < 0 ? nearHemX - 8 : farHemX + 6, bY - 10];
      case 'front': return [cxT + sg * 20, sY + 148];
    }
    return [(sg < 0 ? nearShX : farShX) + shShift, sY + 200];
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
      const ang = base + (sg > 0 ? -off : off) * (dy < 0 ? -1 : 1);
      let ex2 = x0 + Math.cos(ang) * A, ey2 = y0 + Math.sin(ang) * A;
      const alt = base - (sg > 0 ? -off : off) * (dy < 0 ? -1 : 1);
      const ex3 = x0 + Math.cos(alt) * A, ey3 = y0 + Math.sin(alt) * A;
      if (sg * ex3 > sg * ex2) { ex2 = ex3; ey2 = ey3; }
      return [[x0, y0], [ex2, ey2], [tx, ty]];
    }
    // 3/4 forward-facing orientation for athletic riding, pushing, and running arm mechanics
    if (legs === 'ride' && a[0] < 90) {
      const x1 = x0 + (sg < 0 ? ua * 0.24 : ua * 0.56);
      const y1 = y0 + (sg < 0 ? ua * 0.84 : ua * 0.68);
      const x2 = x1 + (sg < 0 ? fa * 0.86 : fa * 0.72);
      const y2 = y1 + (sg < 0 ? fa * 0.20 : fa * 0.28);
      return [[x0, y0], [x1, y1], [x2, y2]];
    }
    if (legs === 'push' && a[0] < 95) {
      const x1 = x0 + (sg < 0 ? ua * 0.72 : ua * 0.80);
      const y1 = y0 + (sg < 0 ? ua * 0.44 : ua * 0.36);
      const x2 = x1 + (sg < 0 ? fa * 0.90 : fa * 0.92);
      const y2 = y1 - (sg < 0 ? fa * 0.14 : fa * 0.18);
      return [[x0, y0], [x1, y1], [x2, y2]];
    }
    if (legs === 'run' && a[0] < 85) {
      const swRun = Math.sin(runAng) * (sg < 0 ? -1 : 1) * gaitAmp;
      const aRun = 6 + 8 * gaitAmp + swRun * 44;
      const eRun = 10 + (64 + Math.max(0, swRun) * 18) * clamp(gaitAmp, 0, 1);
      const t1 = rad(aRun);
      const t2 = rad(aRun + eRun);
      const x1 = x0 + Math.sin(t1) * ua, y1 = y0 + Math.cos(t1) * ua;
      const x2 = x1 + Math.sin(t2) * fa, y2 = y1 + Math.cos(t2) * fa;
      return [[x0, y0], [x1, y1], [x2, y2]];
    }
    if (legs === 'walk' && a[0] < 25 && Math.abs(a[1]) < 25) {
      const swWalk = Math.sin(walkAng) * (sg < 0 ? -1 : 1) * gaitAmp;
      const aWalk = 6 + swWalk * 22;
      const eWalk = 12 + Math.max(0, swWalk) * 14;
      const t1 = rad(aWalk);
      const t2 = rad(aWalk + eWalk);
      const x1 = x0 + Math.sin(t1) * ua, y1 = y0 + Math.cos(t1) * ua;
      const x2 = x1 + Math.sin(t2) * fa, y2 = y1 + Math.cos(t2) * fa;
      return [[x0, y0], [x1, y1], [x2, y2]];
    }
    let a0 = a[0], a1 = a[1];
    if (legs === 'climb') {
      const swClimb = Math.sin(t * 7) * sg;
      a0 += swClimb * 24;
      a1 -= swClimb * 10;
    } else if (legs === 'fall') {
      a0 += Math.sin(t * 20 + (sg > 0 ? 1.8 : 0)) * 16;
    }
    const t1 = rad(a0);
    const t2 = rad(a0 + a1);
    const hBob = talk > 0 ? tg.handBob : 0;
    const x1 = x0 + sg * Math.sin(t1) * ua, y1 = y0 + Math.cos(t1) * ua + hBob * 0.4;
    const x2 = x1 + sg * Math.sin(t2) * fa, y2 = y1 + Math.cos(t2) * fa + hBob * 0.6;
    return [[x0, y0], [x1, y1], [x2, y2]];
  };

  const lp = armPts(-1, pose.la); // tay gần (bên -x)
  const rp = armPts(1, pose.ra); // tay xa (bên +x)
  const hands: Hands = {l: lp[2], r: rp[2]};
  const sleeveC = look.top === 'tank' ? skin : g ? 'ghostDeep' : look.topC;
  const fullSleeve = ['suit', 'uniform', 'robe', 'chef', 'aothe', 'blouse'].includes(look.top);

  const farArmInFront = rp[2][0] < farShX + shShift - 10 || (typeof pose.ra === 'string' && !['hip', 'over'].includes(pose.ra));
  const drawArm = (p: [number, number][], k: string, dim = false) => (
    <g key={k}>
      <TaperLimb
        pts={p}
        wTop={armW * 1.12}
        wMid={armW * 0.94}
        wBot={armW * 0.78}
        fill={fullSleeve ? sleeveC : skin}
        sleeveFrac={!fullSleeve && look.top !== 'tank' ? 0.5 : undefined}
        sleeveFill={sleeveC}
        jointCrease={true}
        dim={dim ? 0.18 : 0}
      />
    </g>
  );
  const drawHand = (p: [number, number][], sg: -1 | 1, kind: HandKind, k: string, dim = false) => {
    const fdx = p[2][0] - p[1][0];
    const fdy = p[2][1] - p[1][1];
    const fl = Math.hypot(fdx, fdy);
    const dx = fl > 0.5 ? fdx / fl : 0;
    const dy = fl > 0.5 ? fdy / fl : 1;
    const thumbSide: -1 | 1 = sg < 0 && dx > 0.35 ? 1 : sg;
    return (
      <CartoonHand
        key={k}
        x={p[2][0]}
        y={p[2][1]}
        ux={dx}
        uy={dy}
        skin={g ? 'ghost' : skin}
        kind={kind}
        side={thumbSide}
        r={16}
        dim={dim ? 0.14 : 0}
      />
    );
  };

  // --- chân & giày khớp gối 2 khúc [hip, knee, ankle] góc 3/4 ---
  const legX = 34 * W + belly * 10;
  const legW = 40 * Math.min(1.2, W);
  const shoe = look.shoes ?? 'red';
  const farHipX = legX * 0.68;
  const nearHipX = -legX * 0.82;
  let farLegNode: React.ReactNode = null;
  let nearLegNode: React.ReactNode = null;
  let motionLines: React.ReactNode = null;

  const draw3QLeg = (pts: [number, number][], isFar: boolean, toeRot = 0) => {
    const w = isFar ? legW * 0.94 : legW;
    const ankle = pts[pts.length - 1];
    const swShoe = isFar ? 58 : 62;
    const shShoe = isFar ? 23 : 24;
    const sxOff = isFar ? -18 : -20;
    const syOff = isFar ? -6 : -8;
    return (
      <g key={isFar ? 'leg-far' : 'leg-near'}>
        <TaperLimb
          pts={pts}
          wTop={w * 1.18}
          wMid={w * 0.96}
          wBot={w * 0.74}
          fill={look.pants}
          dim={isFar ? 0.18 : 0}
          jointCrease={true}
        />
        <g transform={`translate(${ankle[0].toFixed(1)} ${ankle[1].toFixed(1)}) rotate(${toeRot.toFixed(1)})`}>
          <S d={Rr(sxOff, syOff, swShoe, shShoe, 11)} f={shoe} />
          {isFar && <path d={Rr(sxOff, syOff, swShoe, shShoe, 11)} fill={PAL.ink} opacity={0.18} />}
        </g>
      </g>
    );
  };

  if (legs === 'stand') {
    farLegNode = draw3QLeg([[farHipX, bY + 10], [farHipX + 6, bY * 0.5], [farHipX + 10, -22]], true, 0);
    nearLegNode = draw3QLeg([[nearHipX, bY + 10], [nearHipX + 6, bY * 0.5], [nearHipX + 10, -16]], false, 0);
  } else if (legs === 'walk') {
    const ph = Math.sin(walkAng) * gaitAmp;
    const farLift = Math.max(0, -ph) * 18 * H;
    const nearLift = Math.max(0, ph) * 18 * H;
    farLegNode = draw3QLeg(
      [[farHipX, bY + 10], [farHipX + (6 + 10 * gaitAmp - ph * 12) * H, bY * 0.52 - farLift * 0.6], [farHipX + 10 - ph * 22 * H, -22 - farLift]],
      true,
      farLift > 2 ? -10 : 0,
    );
    nearLegNode = draw3QLeg(
      [[nearHipX, bY + 10], [nearHipX + (6 + 10 * gaitAmp + ph * 12) * H, bY * 0.52 - nearLift * 0.6], [nearHipX + 10 + ph * 22 * H, -16 - nearLift]],
      false,
      nearLift > 2 ? -10 : 0,
    );
  } else if (legs === 'run') {
    const ph = Math.sin(runAng) * gaitAmp;
    const farLift = Math.max(0, -ph) * 30 * H;
    const nearLift = Math.max(0, ph) * 30 * H;
    const farTrail = Math.max(0, ph) * 28 * H;
    const nearTrail = Math.max(0, -ph) * 28 * H;
    farLegNode = draw3QLeg(
      [[farHipX, bY + 10], [farHipX + (6 + 16 * gaitAmp - ph * 24) * H, bY * 0.50 - farLift * 0.55], [farHipX + 10 - (6 * gaitAmp + ph * 40) * H - farTrail * 0.55, -22 - farLift * 0.75 - farTrail * 0.85]],
      true,
      farLift > 4 ? -14 : 18 * clamp(gaitAmp, 0, 1),
    );
    nearLegNode = draw3QLeg(
      [[nearHipX, bY + 10], [nearHipX + (6 + 16 * gaitAmp + ph * 24) * H, bY * 0.50 - nearLift * 0.55], [nearHipX + 10 - (6 * gaitAmp - ph * 40) * H - nearTrail * 0.55, -16 - nearLift * 0.75 - nearTrail * 0.85]],
      false,
      nearLift > 4 ? -14 : 18 * clamp(gaitAmp, 0, 1),
    );
  } else if (legs === 'sit') {
    farLegNode = draw3QLeg([[farHipX, bY], [farHipX + 36, bY + 18], [farHipX + 30, -22]], true, 0);
    nearLegNode = draw3QLeg([[nearHipX, bY], [nearHipX + 40, bY + 20], [nearHipX + 34, -16]], false, 0);
  } else if (legs === 'crouch') {
    farLegNode = draw3QLeg([[farHipX, bY + 4], [farHipX + 44, bY + 42 * H], [farHipX + 18, -22]], true, 0);
    nearLegNode = draw3QLeg([[nearHipX, bY + 4], [nearHipX + 38, bY + 46 * H], [nearHipX - 4, -16]], false, 0);
  } else if (legs === 'ride') {
    // true athletic straddle: far thigh forward-down (~97 deg knee bend) with boot tucked behind shell;
    // near hip seated deep, thigh forward-down gripping near flank, shin angled back-down with heel-down boot
    farLegNode = draw3QLeg(
      [[farHipX, bY + 4], [farHipX + 50, bY + 28 * H], [farHipX + 28, bY + 88 * H]],
      true,
      -14,
    );
    nearLegNode = draw3QLeg(
      [[nearHipX, bY + 6], [nearHipX + 46, bY + 34 * H], [nearHipX + 12, bY + 96 * H]],
      false,
      -18,
    );
  } else if (legs === 'jump') {
    farLegNode = draw3QLeg([[farHipX, bY + 6], [farHipX + 46, bY + 26 * H], [farHipX + 12, bY + 78 * H]], true, 24);
    nearLegNode = draw3QLeg([[nearHipX, bY + 6], [nearHipX + 40, bY + 34 * H], [nearHipX - 12, bY + 86 * H]], false, 28);
  } else if (legs === 'fall') {
    const kick = Math.sin(t * 18) * 14;
    farLegNode = draw3QLeg(
      [[farHipX, bY + 6], [farHipX + 54 + kick * 0.5, bY + 20 * H - kick * 0.4], [farHipX + 82 + kick, bY + 58 * H - kick * 0.7]],
      true,
      -22 + kick * 0.6,
    );
    nearLegNode = draw3QLeg(
      [[nearHipX, bY + 6], [nearHipX + 38 - kick * 0.5, bY + 38 * H + kick * 0.4], [nearHipX + 66 - kick, bY + 86 * H + kick * 0.6]],
      false,
      18 - kick * 0.6,
    );
    motionLines = (
      <g>
        <L d={`M${nearShX - 28} ${sY + 36}q-18 28 8 50`} w={4} o={0.35} />
        <L d={`M${farHipX + 100} ${bY + 20}q18 20 2 44`} w={4} o={0.35} />
      </g>
    );
  } else if (legs === 'push') {
    // far (front) leg deeply bent forward, near (back) leg extended straight behind bracing
    farLegNode = draw3QLeg([[farHipX, bY + 8], [farHipX + 46, bY + 48 * H], [farHipX + 32, -22]], true, 0);
    nearLegNode = draw3QLeg([[nearHipX, bY + 8], [nearHipX - 38, bY + 72 * H], [nearHipX - 78, -16]], false, 16);
  } else if (legs === 'climb') {
    const cyc = Math.sin(t * 7);
    const farLift = (cyc * 0.5 + 0.5) * 58 * H;
    const nearLift = (-cyc * 0.5 + 0.5) * 58 * H;
    farLegNode = draw3QLeg(
      [[farHipX, bY + 8], [farHipX + 42, bY + 42 * H - farLift * 0.6], [farHipX + 18, -22 - farLift * 0.75]],
      true,
      cyc > 0 ? -10 : 8,
    );
    nearLegNode = draw3QLeg(
      [[nearHipX, bY + 8], [nearHipX + 38, bY + 42 * H - nearLift * 0.6], [nearHipX + 12, -16 - nearLift * 0.75]],
      false,
      cyc < 0 ? -10 : 8,
    );
  }

  // --- thân 3/4 bất đối xứng với đường cong cột sống chữ C ---
  const long = look.top === 'robe' || look.top === 'aothe' || g;
  const hemY = long ? (g ? bY + 40 : -40) : bY + 26;
  const lHem = long ? nearHemX - 28 : nearHemX;
  const rHem = long ? farHemX + 26 : farHemX;
  const torso = curvedTorsoPath(nearShX, farShX, lHem, rHem, sY, hemY, bendX, belly);
  const topC = g ? 'ghostDeep' : look.topC;

  const pattern: React.ReactNode[] = [];
  if (look.pattern === 'dots' || look.pattern === 'flowers') {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 6; c++) {
        const px = nearShX + shShift * 0.5 + 16 + c * ((farShX - nearShX) / 5.2) + (r % 2) * 13;
        const py = sY + 4 + r * 26;
        if (py > hemY - 12 || px > rHem + 30) continue;
        pattern.push(look.pattern === 'flowers'
          ? <g key={`${r}-${c}`}>{[0, 1, 2, 3].map((k) => <circle key={k} cx={px + Math.cos(k * 1.57) * 5} cy={py + Math.sin(k * 1.57) * 5} r={3.6} fill={col(look.patC ?? 'yellow')} />)}</g>
          : <circle key={`${r}-${c}`} cx={px} cy={py} r={5} fill={col(look.patC ?? 'yellow')} />);
      }
  } else if (look.pattern === 'stripes') {
    for (let i = 0; i < 12; i++) {
      const py = sY + 12 + i * 22;
      if (py > hemY - 6) break;
      pattern.push(<rect key={i} x={nearShX - 40} y={py} width={farShX - nearShX + 120} height={8} fill={col(look.patC ?? 'trim')} />);
    }
  }

  // --- chi tiết cổ áo / khuy / cà vạt / vest xoay theo trục cxT ---
  const collar: React.ReactNode[] = [];
  const c2 = look.topC2 ?? 'trim';
  if (look.top === 'shirt' || look.top === 'polo' || look.top === 'uniform') {
    collar.push(<S key="cl" d={`M${cxT - 34} ${sY - 18}L${cxT} ${sY + 22}L${cxT - 38} ${sY + 14}Z`} f={look.top === 'polo' ? c2 : topC} />);
    collar.push(<S key="cr" d={`M${cxT + 24} ${sY - 18}L${cxT} ${sY + 22}L${cxT + 28} ${sY + 14}Z`} f={look.top === 'polo' ? c2 : topC} />);
    const nb = look.top === 'polo' ? 2 : 5;
    for (let i = 0; i < nb; i++) collar.push(<circle key={'b' + i} cx={cxT + i * 1.6 + (i > 2 ? belly * 8 : 0)} cy={sY + 34 + i * 34} r={4.5} fill={PAL.ink} />);
    if (look.top === 'uniform') {
      collar.push(<S key="p1" d={Rr(nearShX + shShift + 20, sY + 50, 44, 40, 6)} f={topC} />, <S key="p2" d={Rr(cxT + 14, sY + 50, 32, 38, 6)} f={topC} />);
      collar.push(<S key="ep1" d={Rr(nearShX + shShift - 2, sY - 8, 42, 14, 6)} f="gold" />, <S key="ep2" d={Rr(farShX + shShift - 34, sY - 8, 34, 13, 6)} f="gold" />);
      collar.push(<S key="bd" d={E(nearShX + shShift + 42, sY + 30, 11, 11)} f="red" />);
    }
  } else if (look.top === 'suit') {
    collar.push(<S key="sh" d={`M${cxT - 30} ${sY - 18}L${cxT + 22} ${sY - 18}L${cxT + 14} ${sY + 120}L${cxT - 16} ${sY + 120}Z`} f="trim" />);
    collar.push(<S key="tie" d={`M${cxT - 7} ${sY - 8}h16l7 100l-15 22l-15 -22Z`} f={c2} />);
    collar.push(<S key="lp1" d={`M${cxT - 30} ${sY - 18}L${cxT - 4} ${sY + 130}L${cxT - 52} ${sY + 42}Z`} f={topC} />);
    collar.push(<S key="lp2" d={`M${cxT + 22} ${sY - 18}L${cxT + 6} ${sY + 130}L${cxT + 38} ${sY + 40}Z`} f={topC} />);
    collar.push(<circle key="b1" cx={cxT} cy={sY + 170} r={5} fill={PAL.ink} />);
  } else if (look.top === 'chef') {
    for (let i = 0; i < 3; i++) {
      collar.push(<circle key={'l' + i} cx={cxT - 20} cy={sY + 30 + i * 40} r={5} fill={PAL.ink} />);
      collar.push(<circle key={'r' + i} cx={cxT + 18} cy={sY + 30 + i * 40} r={4.5} fill={PAL.ink} />);
    }
    collar.push(<S key="nk" d={Rr(cxT - 42, sY - 26, 76, 22, 8)} f="red" />);
  } else if (look.top === 'robe') {
    collar.push(<S key="v" d={`M${cxT - 34} ${sY - 18}L${cxT + 2} ${sY + 70}L${cxT + 26} ${sY - 18}`} f={c2} />);
    collar.push(<S key="belt" d={R(lHem - 4, bY - 40, rHem - lHem + 8, 22)} f={c2} />);
  } else if (look.top === 'aothe') {
    collar.push(<S key="v" d={`M${cxT - 24} ${sY - 18}C${cxT} ${sY + 10} ${cxT + 18} ${sY + 40} ${farShX + shShift - 4} ${sY + 78}`} f="none" sw={6} />);
    collar.push(<S key="n" d={Rr(cxT - 28, sY - 30, 52, 20, 8)} f={c2} />);
  } else if (look.top === 'blouse') {
    collar.push(<S key="v" d={`M${cxT - 34} ${sY - 18}Q${cxT} ${sY + 50} ${cxT + 26} ${sY - 18}Z`} f={skin} />);
  } else if (look.top === 'tank') {
    collar.push(<S key="nk" d={`M${cxT - 38} ${sY - 18}Q${cxT} ${sY + 50} ${cxT + 30} ${sY - 18}Z`} f={skin} />);
  } else if (look.top === 'tee') {
    collar.push(<S key="nk" d={`M${cxT - 30} ${sY - 18}Q${cxT} ${sY + 18} ${cxT + 24} ${sY - 18}Z`} f={skin} />);
  }
  if (look.chain) collar.push(<path key="ch" d={`M${cxT - 34} ${sY - 10}Q${cxT} ${sY + 60} ${cxT + 28} ${sY - 10}`} fill="none" stroke={PAL.gold} strokeWidth={7} strokeDasharray="2 9" strokeLinecap="round" />);
  if (look.vest) {
    collar.push(<S key="v1" d={`M${nearShX + shShift + 4} ${sY + 6}L${cxT - 28} ${sY - 10}L${cxT - 20} ${bY + 20}L${nearHemX - 4} ${bY + 20}Z`} f="orange" />);
    collar.push(<S key="v2" d={`M${farShX + shShift - 4} ${sY + 6}L${cxT + 22} ${sY - 10}L${cxT + 18} ${bY + 20}L${farHemX + 4} ${bY + 20}Z`} f="orange" />);
    collar.push(<rect key="v3" x={nearHemX - 6} y={bY - 70} width={farHemX - nearHemX + 12} height={16} fill={PAL.trim} stroke={PAL.ink} strokeWidth={3} />);
    collar.push(<rect key="v4" x={nearHemX - 6} y={bY - 30} width={farHemX - nearHemX + 12} height={16} fill={PAL.trim} stroke={PAL.ink} strokeWidth={3} />);
  }

  // --- ma: đuôi khói; người thường: nhịp bước + nhún nhảy + squash/stretch + thở nhẹ ---
  const modeBob =
    legs === 'walk' ? Math.abs(Math.sin(walkAng)) * 7 * gaitAmp :
    legs === 'run' ? Math.abs(Math.sin(runAng)) * 16 * gaitAmp :
    legs === 'ride' ? Math.sin(t * 6) * 4 :
    legs === 'jump' ? Math.sin(t * 8) * 5 :
    legs === 'climb' ? Math.abs(Math.sin(t * 7)) * 6 : 0;
  const bob = g ? Math.sin(t * 2.2 + blinkPh) * 10 : (pose.hop ?? 0) + modeBob;
  const breath = idle.breathe * 0.008 + tg.chestPulse;
  const sq = Math.max(0.5, (pose.squash ?? 1) + breath);
  const sxSq = 1 / Math.sqrt(sq);
  const totalRot = (pose.lean ?? 0) + (pose.pitch ?? 0);
  const tail = g ? (
    <g>
      <path d={`M${lHem} ${hemY - 4}C${lHem + 16} ${hemY + 60} ${-24} ${hemY + 40} ${-6 + Math.sin(t * 2) * 14} ${hemY + 130}C${38} ${hemY + 60} ${rHem - 8} ${hemY + 50} ${rHem} ${hemY - 4}Z`} fill={PAL.ghost} stroke={PAL.ink} strokeWidth={LINE} opacity={0.85} />
      <Smoke x={-6} y={hemY + 150} t={t} h={60} w={10} o={0.5} />
    </g>
  ) : null;

  // --- chuyển động thứ cấp: gió tóc + độ trễ đầu (head lag) + living micro-acting ---
  const hw = hairWindOffset(t, wind + (legs === 'run' ? 0.9 * gaitAmp : 0), velX * face, blinkPh);
  const windTilt = Math.max(-2, Math.min(2, wind)) * 1.6;
  const headLag =
    (legs === 'ride' ? 5.5 + Math.sin(t * 6 - 0.8) * 2.0 + windTilt :
    legs === 'push' ? 6.5 :
    legs === 'run' ? (4.5 + Math.sin(runAng - 0.9) * 3.2) * gaitAmp + windTilt * 0.6 :
    legs === 'walk' ? Math.sin(walkAng - 0.85) * 2.2 * gaitAmp :
    legs === 'crouch' ? 3.5 :
    legs === 'fall' ? -10 + Math.sin(t * 18 - 0.6) * 4.0 :
    legs === 'jump' ? -3.5 :
    legs === 'climb' ? Math.sin(t * 7 - 0.7) * 2.5 :
    windTilt * 0.8) + idle.headTilt + tg.headTilt;

  const head = (
    <g transform={`translate(${shShift.toFixed(1)} 0) rotate(${headLag.toFixed(2)} 0 ${(sY - 22).toFixed(1)})`}>
      <Head3Q look={look} hy={hyy} R={HR} expr={expr} talk={talk} t={t} gaze={gaze} gazeY={gazeY} blinkPh={blinkPh} hw={hw} browBob={tg.browBob} pupilDx={idle.pupilDx} />
    </g>
  );

  const showFar = layer !== 'near';
  const showNear = layer !== 'far';

  return (
    <g transform={`scale(${face} 1)`}>
      <g transform={`translate(0 ${(-bob).toFixed(1)}) rotate(${totalRot.toFixed(2)} 0 ${bY.toFixed(1)}) scale(${sxSq.toFixed(4)} ${sq.toFixed(4)})`} opacity={g ? 0.93 : 1}>
        {showNear && g && <ellipse cx={0} cy={hyy} rx={HR * 3.2} ry={HR * 4} fill="url(#glowG)" />}
        {showNear && motionLines}
        {showFar && propBack?.(hands)}
        {showFar && !farArmInFront && drawArm(rp, 'ra', true)}
        {showFar && !farArmInFront && drawHand(rp, 1, handR, 'hr', true)}
        {showFar && farLegNode}
        {showNear && nearLegNode}
        {showNear && tail}
        {showNear && (
          <>
            <S d={torso} f={topC} />
            <clipPath id={`t3q-${look.name}`}><path d={torso} /></clipPath>
            <g clipPath={`url(#t3q-${look.name})`}>
              {pattern}
              {/* bóng chấm riso sườn lưng (-x) và vai xa thu sâu (+x) */}
              <Sh d={`M${nearShX + shShift - 40} ${sY - 30}L${(nearShX + shShift) * 0.34} ${sY - 30}L${lHem * 0.38} ${hemY + 10}L${lHem - 40} ${hemY + 10}Z`} o={0.55} />
              <Sh d={`M${(farShX + shShift) * 0.62} ${sY - 30}L${farShX + shShift + 50} ${sY - 30}L${rHem + 50} ${hemY + 10}L${rHem * 0.68} ${hemY + 10}Z`} o={0.32} />
            </g>
            {/* cổ */}
            <S d={R(-14 + shShift, sY - 44, 38, 34)} f={g ? 'ghost' : 'skinShade'} />
            {collar}
            {head}
            {farArmInFront && drawArm(rp, 'ra')}
            {drawArm(lp, 'la')}
            {prop?.(hands)}
            {farArmInFront && drawHand(rp, 1, handR, 'hr')}
            {drawHand(lp, -1, handL, 'hl')}
          </>
        )}
      </g>
    </g>
  );
};

const Head3Q: React.FC<{
  look: Look;
  hy: number;
  R: number;
  expr: Expr;
  talk: number;
  t: number;
  gaze: number;
  gazeY?: number;
  blinkPh: number;
  hw?: {dx: number; dy: number; rot: number};
  browBob?: number;
  pupilDx?: number;
}> = ({look, hy, R: r, expr, talk, t, gaze, gazeY = 0, blinkPh, hw = {dx: 0, dy: 0, rot: 0}, browBob = 0, pupilDx = 0}) => {
  const g = look.ghost;
  const skin = g ? 'ghost' : look.skin ?? 'skin';
  const hairC = look.hairC ?? 'hair';
  const gx = Math.max(-1, Math.min(1, gaze)) * r * 0.12;
  const fcx = r * 0.22 + gx; // tâm ngũ quan lệch về phía nhìn (+x)
  const els: React.ReactNode[] = [];

  // tóc phía sau đầu (lệch về phía gáy -x, tung bay theo gió hw)
  if (look.hair === 'bun') {
    const bunBx = -r * 0.44 + hw.dx * 0.22;
    const bunBy = hy - r * 0.88 + hw.dy * 0.32 + Math.sin(t * 10 + blinkPh) * (Math.abs(hw.dx) > 4 ? 2.4 : 0.7);
    const bunRot = hw.rot * 0.52;
    els.push(
      <g key="bun" transform={`rotate(${bunRot.toFixed(1)} ${(-r * 0.36).toFixed(1)} ${(hy - r * 0.72).toFixed(1)})`}>
        <S d={E(bunBx, bunBy, r * 0.4, r * 0.32)} f={hairC} />
      </g>,
    );
  }
  if (look.hair === 'curly') for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.85 + (i / 8) * 1.18);
    els.push(<S key={'cu' + i} d={E(Math.cos(a) * r * 1.0 - r * 0.08 + hw.dx * 0.12, hy + Math.sin(a) * r * 0.98 + r * 0.08 + hw.dy * 0.1, r * 0.35, r * 0.35)} f={hairC} />);
  }
  if (look.hair === 'long') {
    const tx = hw.dx * 1.45;
    const ty = hw.dy * 0.85;
    const mx1 = hw.dx * 0.85;
    const my1 = hw.dy * 0.45;
    const wv = Math.sin(t * 11.5 + blinkPh) * (2.5 + Math.min(2.5, Math.abs(hw.dx) / 14) * 3.5);
    els.push(
      <S
        key="lg"
        d={`M${(-r * 1.04).toFixed(1)} ${(hy - r * 0.22).toFixed(1)}C${(-r * 1.18 + mx1).toFixed(1)} ${(hy + r * 0.88 + my1).toFixed(1)} ${(-r * 1.04 + tx * 0.85).toFixed(1)} ${(hy + r * 1.42 + ty).toFixed(1)} ${(-r * 0.66 + tx).toFixed(1)} ${(hy + r * 1.52 + ty + wv).toFixed(1)}Q${(tx * 0.88).toFixed(1)} ${(hy + r * 1.44 + ty - wv * 0.8).toFixed(1)} ${(r * 0.62 + tx * 0.78).toFixed(1)} ${(hy + r * 1.44 + ty + wv * 0.6).toFixed(1)}C${(r * 0.96 + mx1 * 0.55).toFixed(1)} ${(hy + r * 1.28 + my1).toFixed(1)} ${(r * 1.04 + mx1 * 0.28).toFixed(1)} ${(hy + r * 0.78 + my1 * 0.5).toFixed(1)} ${(r * 0.92).toFixed(1)} ${(hy - r * 0.2).toFixed(1)}Z`}
        f={hairC}
      />,
    );
  }

  // tai xa (hé nhẹ ở rìa +x)
  els.push(<S key="eaF" d={E(r * 0.88, hy + r * 0.2, r * 0.09, r * 0.16)} f={skin} />);

  // khuôn mặt mochi 3/4: sọ sau tròn (-x), má trước đầy đặn (+x), cằm hơi xoay về +x
  const faceD = `M${r * 0.04} ${hy - r}C${r * 0.66} ${hy - r} ${r * 0.96} ${hy - r * 0.56} ${r * 0.94} ${hy + r * 0.08}C${r * 0.94} ${hy + r * 0.62} ${r * 0.6} ${hy + r * 0.9} ${r * 0.08} ${hy + r * 0.9}C${-r * 0.54} ${hy + r * 0.9} ${-r * 0.96} ${hy + r * 0.62} ${-r * 0.96} ${hy + r * 0.04}C${-r * 0.96} ${hy - r * 0.62} ${-r * 0.58} ${hy - r} ${r * 0.04} ${hy - r}Z`;
  els.push(<S key="face" d={faceD} f={skin} />);
  // bóng chấm halftone bên gáy (-x) tạo khối 3/4
  els.push(<Sh key="fsh" d={`M${-r * 0.46} ${hy - r * 0.86}C${-r * 0.96} ${hy - r * 0.4} ${-r * 0.98} ${hy + r * 0.56} ${-r * 0.36} ${hy + r * 0.84}C${-r * 0.7} ${hy + r * 0.42} ${-r * 0.74} ${hy - r * 0.3} ${-r * 0.46} ${hy - r * 0.86}Z`} o={0.38} />);

  // tai gần (-x) + hoa tai
  els.push(<S key="eaN" d={E(-r * 0.82, hy + r * 0.18, r * 0.15, r * 0.21)} f={skin} />);
  els.push(<L key="eaC" d={`M${-r * 0.86} ${hy + r * 0.12}q${r * 0.08} ${r * 0.07} 0 ${r * 0.14}`} w={3} o={0.45} />);
  if (look.earrings) {
    els.push(<S key="erN" d={E(-r * 0.83, hy + r * 0.43, 6.5, 6.5)} f="gold" />);
    els.push(<S key="erF" d={E(r * 0.89, hy + r * 0.39, 5, 5)} f="gold" />);
  }

  // --- ngũ quan 3/4: mắt gần tròn, mắt xa hẹp hơn do phối cảnh ---
  const blink = ((t * 1000 + blinkPh * 700) % 3700) < 120;
  const exN = fcx - r * 0.33; // mắt gần
  const exF = fcx + r * 0.29; // mắt xa (gần rìa mặt phải)
  const ey = hy + r * 0.2;
  const er = r * 0.12;
  const browC = look.brows ?? (g ? 'white' : 'hair');
  const pxOff = pupilDx + (expr === 'shock' ? Math.sin(t * 32) * 1.4 : 0);
  const pyOff = Math.max(-1, Math.min(1, gazeY)) * 4.2 * (r / 100);
  const gazeClamped = Math.max(-1, Math.min(1, gaze));

  const brow = (dl: number, dr: number, lift = 0) => {
    const by = ey - r * 0.32 - lift + browBob + pyOff * 0.35;
    els.push(<L key="bl" d={`M${exN - r * 0.13} ${by + dl}Q${exN} ${by - r * 0.05} ${exN + r * 0.12} ${by - dl}`} w={7} c={browC} />);
    els.push(<L key="br" d={`M${exF + r * 0.1} ${by + dr}Q${exF} ${by - r * 0.05} ${exF - r * 0.1} ${by - dr}`} w={6.5} c={browC} />);
  };
  const shine = (x: number, y: number, k: string, sx = 1, s = 1) => els.push(
    <circle key={k + 'a'} cx={x + er * 0.34 * sx} cy={y - er * 0.42} r={er * 0.33 * s} fill={PAL.white} />,
    <circle key={k + 'b'} cx={x - er * 0.32 * sx} cy={y + er * 0.4} r={er * 0.14 * s} fill={PAL.white} />,
  );
  const eyeSpecs: [number, number, string][] = [
    [exN, 1.0, 'N'],
    [exF, 0.78, 'F'], // mắt xa hẹp hơn theo góc 3/4
  ];

  const eyesDot = (k = 1) => {
    if (blink) {
      for (const [ex, sx, tag] of eyeSpecs) {
        const w = er * sx;
        els.push(<L key={'e' + tag} d={`M${ex - w} ${ey + pyOff * 0.5}q${w} ${er * 0.6} ${2 * w} 0`} w={5.5} />);
      }
    } else {
      for (const [ex, sx, tag] of eyeSpecs) {
        const dx = (pxOff + gazeClamped * 2.5 * (r / 100)) * sx;
        els.push(<ellipse key={'e' + tag} cx={ex + dx} cy={ey + pyOff} rx={er * sx * k} ry={er * 1.18 * k} fill={PAL.ink} />);
        shine(ex + dx, ey + pyOff, 'eh' + tag, sx, k);
      }
    }
  };
  const eyesArc = (up = true) => {
    const s = up ? -1 : 1;
    for (const [ex, sx, tag] of eyeSpecs) {
      const w = er * 1.1 * sx;
      els.push(<L key={'e' + tag} d={`M${ex - w} ${ey + 3 + pyOff * 0.5}q${w} ${s * er * 1.2} ${2 * w} 0`} w={6} />);
    }
  };
  const eyesWide = () => {
    const wPy = Math.max(-er * 0.7, Math.min(er * 0.7, 2 + pyOff));
    for (const [ex, sx, tag] of eyeSpecs) {
      const maxX = er * 0.56 * sx;
      const wPx = Math.max(-maxX, Math.min(maxX, (er * 0.15 + pxOff + gazeClamped * 5 * (r / 100)) * sx));
      els.push(<S key={'ew' + tag} d={E(ex, ey, er * 1.42 * sx, er * 1.58)} f="white" sw={4} />);
      els.push(<circle key={'ep' + tag} cx={ex + wPx} cy={ey + wPy} r={er * 0.68 * Math.min(1, sx + 0.12)} fill={PAL.ink} />);
      shine(ex + wPx, ey + wPy, 'ws' + tag, sx, 0.6);
    }
  };
  const eyesNarrow = () => {
    for (const [ex, sx, tag] of eyeSpecs) {
      const dx = (pxOff + gazeClamped * 2.5 * (r / 100)) * sx;
      els.push(<ellipse key={'e' + tag} cx={ex + dx} cy={ey + er * 0.25 + pyOff * 0.65} rx={er * sx} ry={er * 0.8} fill={PAL.ink} />);
      els.push(<L key={'lid' + tag} d={`M${ex - er * 1.25 * sx} ${ey - er * 0.2 + pyOff * 0.4}h${er * 2.5 * sx}`} w={6} />);
      els.push(<circle key={'s' + tag} cx={ex + dx + er * 0.3 * sx} cy={ey + er * 0.25 + pyOff * 0.65} r={er * 0.21} fill={PAL.white} />);
    }
  };

  // --- miệng 3/4 lệch nhẹ theo hướng mặt ---
  const mx = fcx + r * 0.04;
  const my = hy + r * 0.53;
  const lipC = look.lips ? 'red' : 'ink';
  const lipW = look.lips ? 7 : 5;
  const cavity = look.lips ? PAL.red : PAL.ink;
  const openMouth = (w: number, h: number, k: string) => {
    const wl = w * 1.05, wr = w * 0.88;
    const d = `M${mx - wl} ${my - 2}Q${mx} ${my + 2} ${mx + wr} ${my - 2}Q${mx + wr * 0.9} ${my + h} ${mx} ${my + h}Q${mx - wl * 0.9} ${my + h} ${mx - wl} ${my - 2}Z`;
    const cid = `m3q-${look.name ?? 'x'}-${k}`;
    els.push(
      <clipPath key={k + 'c'} id={cid}><path d={d} /></clipPath>,
      <path key={k + 'f'} d={d} fill={PAL.redDark} />,
      <ellipse key={k + 't'} cx={mx} cy={my + h} rx={w * 0.58} ry={h * 0.45} fill={PAL.pink} clipPath={`url(#${cid})`} />,
      <path key={k + 'l'} d={d} fill="none" stroke={cavity} strokeWidth={look.lips ? 5.5 : 4.5} strokeLinejoin="round" />,
    );
  };
  const mouth = (kind: string) => {
    if (talk > 0.05 && kind !== 'wail' && kind !== 'O') { openMouth(r * 0.13, 6 + talk * r * 0.16, 'tk'); return; }
    switch (kind) {
      case 'flat': els.push(<L key="m" d={`M${mx - r * 0.09} ${my}q${r * 0.09} ${r * 0.03} ${r * 0.17} 0`} w={lipW} c={lipC} />); break;
      case 'smile': els.push(<L key="m" d={`M${mx - r * 0.14} ${my - 3}q${r * 0.13} ${r * 0.14} ${r * 0.26} 0`} w={lipW} c={lipC} />); break;
      case 'grin': openMouth(r * 0.16, r * 0.2, 'gr'); break;
      case 'frown': els.push(<L key="m" d={`M${mx - r * 0.13} ${my + 5}q${r * 0.12} ${-r * 0.12} ${r * 0.24} 0`} w={lipW} c={lipC} />); break;
      case 'smirk': els.push(<L key="m" d={`M${mx - r * 0.1} ${my + 2}q${r * 0.13} ${r * 0.04} ${r * 0.23} ${-r * 0.1}`} w={lipW} c={lipC} />); break;
      case 'O': els.push(<S key="m" d={E(mx, my + 5, r * 0.075, r * 0.11)} f="redDark" sw={4} lc={look.lips ? PAL.red : undefined} />); break;
      case 'wail': openMouth(r * 0.19, r * 0.24, 'wl'); break;
      case 'shh': els.push(<S key="m" d={E(mx, my + 2, r * 0.05, r * 0.05)} f="redDark" sw={4} />); break;
    }
  };

  switch (expr) {
    case 'neutral': brow(0, 0); eyesDot(); mouth('flat'); break;
    case 'deadpan': brow(0, 0, -5); eyesDot(0.9); for (const [ex, sx, tag] of eyeSpecs) els.push(<L key={'lid' + tag} d={`M${ex - er * 1.2 * sx} ${ey - er * 0.3 + pyOff * 0.5}h${er * 2.4 * sx}`} w={6} />); mouth('flat'); break;
    case 'stern': brow(6, 6, -2); eyesDot(0.9); mouth('frown'); break;
    case 'angry': brow(10, 10, -3); eyesNarrow(); mouth(talk > 0.05 ? 'flat' : 'frown'); break;
    case 'smug': brow(-3, 5); eyesArc(false); mouth('smirk'); break;
    case 'sly': brow(5, -3); eyesNarrow(); mouth('smirk'); break;
    case 'shock': brow(-5, -5, 10); eyesWide(); mouth('O'); break;
    case 'sad': brow(-8, -8, 3); eyesDot(0.95); mouth('frown'); break;
    case 'cry': brow(-9, -9, 5); eyesArc(true); mouth('wail');
      for (const [ex, , tag] of eyeSpecs) els.push(<path key={'tr' + tag} d={`M${ex} ${ey + 8}q${tag === 'N' ? -5 : 5} ${r * 0.25 + Math.sin(t * 12) * 5} 0 ${r * 0.5}`} stroke={PAL.blue} strokeWidth={8} fill="none" strokeLinecap="round" />);
      break;
    case 'joy': brow(-3, -3, 6); eyesArc(true); mouth('grin'); break;
    case 'eager': brow(-4, -4, 8); eyesDot(1.1); mouth('grin'); break;
    case 'shh': brow(3, 3); eyesWide(); mouth('shh'); break;
  }

  // má hồng bất đối xứng + mũi nút nhỏ nhích về mép nhìn (+x)
  if (!g) {
    els.push(<ellipse key="blN" cx={fcx - r * 0.56} cy={ey + r * 0.22} rx={r * 0.16} ry={r * 0.09} fill={PAL.blush} opacity={0.42} />);
    els.push(<ellipse key="blF" cx={fcx + r * 0.46} cy={ey + r * 0.22} rx={r * 0.11} ry={r * 0.08} fill={PAL.blush} opacity={0.38} />);
  }
  const nx = fcx + r * 0.08;
  els.push(<L key="nose" d={`M${nx - r * 0.02} ${hy + r * 0.31}q${r * 0.11} ${r * 0.06} ${-r * 0.01} ${r * 0.1}`} w={4.5} c={g ? 'ghostDeep' : 'skinShade'} />);

  // ria mép & râu lệch theo mx
  if (look.mustache) els.push(<S key="mu" d={`M${mx - r * 0.36} ${my - 8}q${r * 0.34} ${-r * 0.2} ${r * 0.64} 0q${-r * 0.08} ${r * 0.1} ${-r * 0.3} ${r * 0.02}q${-r * 0.24} ${r * 0.08} ${-r * 0.34} ${-r * 0.02}Z`} f={look.beardC ?? hairC} />);
  if (look.beard === 'goatee' || look.beard === 'long') {
    const bl = look.beard === 'long' ? r * 0.9 : r * 0.4;
    els.push(<S key="bd" d={`M${mx - r * 0.17} ${my + r * 0.2}Q${mx} ${my + r * 0.24 + bl} ${mx + r * 0.14 + Math.sin(t * 2) * 3} ${my + r * 0.2}Z`} f={look.beardC ?? hairC} />);
  }

  // --- tóc trước / mái / lọn hai bên (góc 3/4) ---
  const hp = (d: string, k: string) => els.push(<S key={k} d={d} f={hairC} />);
  const cap3q = (loL: number, loR: number) => `M${-r * 1.0} ${hy + r * loL}C${-r * 1.08} ${hy - r * 1.44} ${r * 1.04} ${hy - r * 1.42} ${r * 0.96} ${hy + r * loR}`;

  switch (look.hair) {
    case 'bald':
      hp(`M${-r * 0.96} ${hy + r * 0.12}C${-r * 1.0} ${hy - r * 0.38} ${-r * 0.74} ${hy - r * 0.56} ${-r * 0.48} ${hy - r * 0.5}C${-r * 0.58} ${hy - r * 0.2} ${-r * 0.64} ${hy} ${-r * 0.68} ${hy + r * 0.14}Z`, 'h1');
      hp(`M${r * 0.92} ${hy + r * 0.06}C${r * 0.96} ${hy - r * 0.32} ${r * 0.84} ${hy - r * 0.48} ${r * 0.7} ${hy - r * 0.44}C${r * 0.76} ${hy - r * 0.18} ${r * 0.78} ${hy - r * 0.04} ${r * 0.8} ${hy + r * 0.08}Z`, 'h2');
      els.push(<path key="shine" d={`M${-r * 0.14} ${hy - r * 0.8}q${r * 0.24} ${-r * 0.08} ${r * 0.42} ${r * 0.02}`} stroke={PAL.white} strokeWidth={8} strokeLinecap="round" fill="none" />);
      break;
    case 'side':
    case 'neat':
      hp(`${cap3q(0.18, -0.14)}C${r * 0.86} ${hy - r * 0.46} ${r * 0.4} ${hy - r * 0.48} ${r * 0.08} ${hy - r * 0.6}C${-r * 0.24} ${hy - r * 0.34} ${-r * 0.58} ${hy - r * 0.22} ${-r * 0.76} ${hy + r * 0.04}C${-r * 0.86} ${hy + r * 0.1} ${-r * 0.94} ${hy + r * 0.15} ${-r * 1.0} ${hy + r * 0.18}Z`, 'h');
      els.push(<L key="hl" d={`M${-r * 0.42} ${hy - r * 0.86}q${r * 0.3} ${-r * 0.14} ${r * 0.6} ${-r * 0.04}`} w={6} c="white" o={0.35} />);
      break;
    case 'short':
    case 'kid': {
      // mái tỉa nhọn nghiêng theo 3/4 + lọn mai che trước tai gần
      hp(`${cap3q(0.16, -0.16)}L${r * 0.84} ${hy - r * 0.34}Q${r * 0.66} ${hy - r * 0.22} ${r * 0.5} ${hy - r * 0.4}Q${r * 0.3} ${hy - r * 0.18} ${r * 0.12} ${hy - r * 0.4}Q${-r * 0.12} ${hy - r * 0.18} ${-r * 0.32} ${hy - r * 0.36}Q${-r * 0.56} ${hy - r * 0.12} ${-r * 0.74} ${hy + r * 0.04}L${-r * 1.0} ${hy + r * 0.16}Z`, 'h');
      if (look.hair === 'kid') {
        els.push(
          <g key="cow" transform={`rotate(${(hw.rot * 0.95).toFixed(1)} ${(r * 0.08).toFixed(1)} ${(hy - r * 0.96).toFixed(1)})`}>
            <S d={`M${r * 0.04} ${hy - r * 1.0}C${r * 0.22} ${hy - r * 1.3} ${r * 0.44} ${hy - r * 1.24} ${r * 0.46} ${hy - r * 1.06}C${r * 0.32} ${hy - r * 1.06} ${r * 0.22} ${hy - r * 0.98} ${r * 0.18} ${hy - r * 0.94}Z`} f={hairC} />
          </g>,
        );
      }
      els.push(<L key="hl" d={`M${-r * 0.4} ${hy - r * 0.84}q${r * 0.28} ${-r * 0.12} ${r * 0.54} ${-r * 0.04}`} w={6} c="white" o={0.3} />);
      break;
    }
    case 'spiky':
    case 'spikyUp': {
      // tóc Nhím 3/4 dựng gai không mái: trán thoáng cao, chỏm gai nhọn bùng về phía trước-phải & đỉnh đầu
      hp(
        `M${-r * 0.96} ${hy + r * 0.14}C${-r * 1.08} ${hy - r * 0.76} ${-r * 0.48} ${hy - r * 1.28} ${r * 0.08} ${hy - r * 1.12}L${r * 0.38} ${hy - r * 1.56}Q${r * 0.5} ${hy - r * 1.2} ${r * 0.68} ${hy - r * 1.16}L${r * 1.06} ${hy - r * 1.4}Q${r * 0.9} ${hy - r * 1.02} ${r * 0.98} ${hy - r * 0.9}L${r * 1.32} ${hy - r * 0.74}Q${r * 1.02} ${hy - r * 0.58} ${r * 0.98} ${hy - r * 0.44}L${r * 1.12} ${hy - r * 0.18}Q${r * 0.92} ${hy - r * 0.24} ${r * 0.86} ${hy - r * 0.02}C${r * 0.76} ${hy - r * 0.42} ${r * 0.48} ${hy - r * 0.62} ${r * 0.06} ${hy - r * 0.62}C${-r * 0.36} ${hy - r * 0.6} ${-r * 0.74} ${hy - r * 0.38} ${-r * 0.96} ${hy + r * 0.14}Z`,
        'h',
      );
      els.push(<L key="hl" d={`M${-r * 0.32} ${hy - r * 0.92}Q${r * 0.1} ${hy - r * 1.08} ${r * 0.52} ${hy - r * 0.92}`} w={5.5} c="white" o={0.28} />);
      break;
    }
    case 'bun':
      hp(`${cap3q(0.22, -0.1)}C${r * 0.82} ${hy - r * 0.44} ${r * 0.42} ${hy - r * 0.58} ${r * 0.12} ${hy - r * 0.58}C${-r * 0.22} ${hy - r * 0.54} ${-r * 0.68} ${hy - r * 0.3} ${-r * 1.0} ${hy + r * 0.22}Z`, 'h');
      break;
    case 'long': {
      hp(`${cap3q(0.32, -0.06)}C${r * 0.8} ${hy - r * 0.34} ${r * 0.44} ${hy - r * 0.44} ${r * 0.18} ${hy - r * 0.64}C${-r * 0.16} ${hy - r * 0.34} ${-r * 0.64} ${hy - r * 0.3} ${-r * 1.0} ${hy + r * 0.32}Z`, 'h');
      // lọn tóc dài ôm má gần (-x) và lọn mảnh mép mặt xa (+x), tung bay theo gió ngược (-x)
      const lkX = hw.dx * 1.05;
      const lkY = hw.dy * 0.65;
      els.push(
        <g key="lkN" transform={`rotate(${(-hw.rot * 0.22).toFixed(1)} ${(-r * 0.86).toFixed(1)} ${(hy - r * 0.08).toFixed(1)})`}>
          <S
            d={`M${(-r * 0.96).toFixed(1)} ${(hy - r * 0.08).toFixed(1)}C${(-r * 1.08 + lkX * 0.45).toFixed(1)} ${(hy + r * 0.6 + lkY * 0.4).toFixed(1)} ${(-r * 1.02 + lkX * 0.82).toFixed(1)} ${(hy + r * 1.12 + lkY * 0.75).toFixed(1)} ${(-r * 0.8 + lkX).toFixed(1)} ${(hy + r * 1.38 + lkY).toFixed(1)}C${(-r * 0.72 + lkX * 0.65).toFixed(1)} ${(hy + r * 1.0 + lkY * 0.6).toFixed(1)} ${(-r * 0.72 + lkX * 0.28).toFixed(1)} ${(hy + r * 0.42 + lkY * 0.25).toFixed(1)} ${(-r * 0.76).toFixed(1)} ${(hy - r * 0.08).toFixed(1)}Z`}
            f={hairC}
          />
        </g>,
      );
      const lkFX = hw.dx * 0.45;
      const lkFY = hw.dy * 0.4;
      els.push(
        <g key="lkF" transform={`rotate(${(-hw.rot * 0.14).toFixed(1)} ${(r * 0.89).toFixed(1)} ${(hy - r * 0.1).toFixed(1)})`}>
          <S
            d={`M${(r * 0.94).toFixed(1)} ${(hy - r * 0.1).toFixed(1)}C${(r * 1.02 + lkFX * 0.4).toFixed(1)} ${(hy + r * 0.5 + lkFY * 0.4).toFixed(1)} ${(r * 0.96 + lkFX * 0.78).toFixed(1)} ${(hy + r * 0.95 + lkFY * 0.75).toFixed(1)} ${(r * 0.82 + lkFX).toFixed(1)} ${(hy + r * 1.2 + lkFY).toFixed(1)}C${(r * 0.8 + lkFX * 0.6).toFixed(1)} ${(hy + r * 0.86 + lkFY * 0.6).toFixed(1)} ${(r * 0.82 + lkFX * 0.25).toFixed(1)} ${(hy + r * 0.38 + lkFY * 0.25).toFixed(1)} ${(r * 0.84).toFixed(1)} ${(hy - r * 0.1).toFixed(1)}Z`}
            f={hairC}
          />
        </g>,
      );
      els.push(<L key="hl" d={`M${-r * 0.48} ${hy - r * 0.84}q${r * 0.26} ${-r * 0.14} ${r * 0.52} ${-r * 0.08}`} w={6} c="white" o={0.35} />);
      break;
    }
    case 'curly':
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.04 + (i / 6) * 0.82);
        els.push(<S key={'cf' + i} d={E(Math.cos(a) * r * 0.82 - r * 0.04, hy + Math.sin(a) * r * 0.84, r * 0.32, r * 0.28)} f={hairC} />);
      }
      break;
    case 'thin':
      hp(`M${-r * 0.96} ${hy + r * 0.1}C${-r * 1.0} ${hy - r * 0.52} ${-r * 0.62} ${hy - r * 0.68} ${-r * 0.36} ${hy - r * 0.62}C${-r * 0.52} ${hy - r * 0.28} ${-r * 0.62} ${hy - r * 0.04} ${-r * 0.68} ${hy + r * 0.14}Z`, 'h1');
      hp(`M${r * 0.92} ${hy + r * 0.04}C${r * 0.94} ${hy - r * 0.42} ${r * 0.78} ${hy - r * 0.58} ${r * 0.62} ${hy - r * 0.54}C${r * 0.7} ${hy - r * 0.26} ${r * 0.74} ${hy - r * 0.04} ${r * 0.78} ${hy + r * 0.08}Z`, 'h2');
      break;
  }

  // --- kính 3/4 (tròng gần rộng, tròng xa hẹp hơn + gọng nối về tai gần) ---
  if (look.glasses === 'round' || look.glasses === 'square') {
    const gr = look.glasses === 'round';
    if (gr) {
      els.push(<ellipse key="glN" cx={exN} cy={ey} rx={r * 0.22} ry={r * 0.22} fill={PAL.white} fillOpacity={0.25} stroke={PAL.ink} strokeWidth={5} />);
      els.push(<ellipse key="glF" cx={exF} cy={ey} rx={r * 0.17} ry={r * 0.21} fill={PAL.white} fillOpacity={0.25} stroke={PAL.ink} strokeWidth={5} />);
      els.push(<L key="glb" d={`M${exN + r * 0.22} ${ey}H${exF - r * 0.17}`} w={4} />);
      els.push(<L key="gla" d={`M${exN - r * 0.22} ${ey - 2}L${-r * 0.8} ${hy + r * 0.14}`} w={4} />);
    } else {
      els.push(<rect key="glN" x={exN - r * 0.25} y={ey - r * 0.18} width={r * 0.5} height={r * 0.36} rx={6} fill={PAL.white} fillOpacity={0.25} stroke={PAL.ink} strokeWidth={5} />);
      els.push(<rect key="glF" x={exF - r * 0.19} y={ey - r * 0.17} width={r * 0.38} height={r * 0.34} rx={6} fill={PAL.white} fillOpacity={0.25} stroke={PAL.ink} strokeWidth={5} />);
      els.push(<L key="glb" d={`M${exN + r * 0.25} ${ey}H${exF - r * 0.19}`} w={4} />);
      els.push(<L key="gla" d={`M${exN - r * 0.25} ${ey - 4}L${-r * 0.8} ${hy + r * 0.14}`} w={4} />);
    }
  } else if (look.glasses === 'sun') {
    els.push(<S key="sgN" d={Rr(exN - r * 0.24, hy - r * 0.86, r * 0.5, r * 0.25, 9)} f="ink" sw={3} />);
    els.push(<S key="sgF" d={Rr(exF - r * 0.18, hy - r * 0.86, r * 0.4, r * 0.24, 9)} f="ink" sw={3} />);
    els.push(<rect key="sgh" x={exN - r * 0.18} y={hy - r * 0.82} width={r * 0.18} height={5} fill={PAL.yellow} />);
  }

  // --- mũ 3/4 ---
  const hat = look.hat ?? 'none';
  const hatC = look.hatC ?? 'navy';
  if (hat === 'khanxep') {
    els.push(<S key="kx" d={`M${-r * 0.98} ${hy - r * 0.42}C${-r * 1.02} ${hy - r * 1.05} ${r * 1.0} ${hy - r * 1.05} ${r * 0.96} ${hy - r * 0.42}C${r * 0.6} ${hy - r * 0.3} ${-r * 0.6} ${hy - r * 0.3} ${-r * 0.98} ${hy - r * 0.42}Z`} f={hatC} />);
    for (let i = 0; i < 4; i++) els.push(<L key={'kxl' + i} d={`M${-r * 0.9} ${hy - r * (0.5 + i * 0.12)}Q${r * 0.14} ${hy - r * (0.42 + i * 0.12) - r * 0.08} ${r * 0.88} ${hy - r * (0.5 + i * 0.12)}`} w={3} c="trim" o={0.5} />);
  } else if (hat === 'capBack') {
    // mũ lưỡi trai đội ngược góc 3/4: lưỡi trai hướng ra sau-trái (-x), quai snapback phía trước-phải
    els.push(
      <S key="cbb" d={`M${-r * 0.86} ${hy - r * 0.4}L${-r * 1.56} ${hy - r * 0.12}C${-r * 1.58} ${hy + r * 0.02} ${-r * 1.42} ${hy + r * 0.1} ${-r * 1.22} ${hy + r * 0.04}L${-r * 0.72} ${hy - r * 0.22}Z`} f={hatC} />,
      <S key="cbd" d={`M${-r * 0.96} ${hy - r * 0.32}C${-r * 1.06} ${hy - r * 1.14} ${r * 0.3} ${hy - r * 1.24} ${r * 0.64} ${hy - r * 0.64}C${r * 0.16} ${hy - r * 0.66} ${-r * 0.46} ${hy - r * 0.52} ${-r * 0.96} ${hy - r * 0.32}Z`} f={hatC} />,
      <S key="cbs" d={`M${r * 0.16} ${hy - r * 0.72}C${r * 0.32} ${hy - r * 0.92} ${r * 0.52} ${hy - r * 0.88} ${r * 0.6} ${hy - r * 0.66}Z`} f="ink" sw={3.5} />,
      <L key="cbst" d={`M${r * 0.18} ${hy - r * 0.72}L${r * 0.58} ${hy - r * 0.68}`} w={6} c={hatC} />,
    );
  } else if (hat === 'cap') {
    els.push(<S key="cap" d={`M${-r * 0.92} ${hy - r * 0.42}C${-r * 0.96} ${hy - r * 1.18} ${r * 0.92} ${hy - r * 1.18} ${r * 0.88} ${hy - r * 0.42}Z`} f={hatC} />);
    // lưỡi trai nhô ra phía trước-phải (+x)
    els.push(<S key="capb" d={`M${-r * 0.22} ${hy - r * 0.44}h${r * 1.44}l${-r * 0.08} ${r * 0.16}h${-r * 1.32}Z`} f="ink" />);
    els.push(<S key="caps" d={E(r * 0.24, hy - r * 0.76, r * 0.15, r * 0.15)} f="gold" />);
  } else if (hat === 'chef') {
    els.push(<S key="ch1" d={`M${-r * 0.7} ${hy - r * 0.55}L${-r * 0.75} ${hy - r * 1.3}C${-r * 1.2} ${hy - r * 1.5} ${-r * 0.8} ${hy - r * 2.1} ${-r * 0.3} ${hy - r * 1.8}C${-r * 0.1} ${hy - r * 2.3} ${r * 0.5} ${hy - r * 2.2} ${r * 0.45} ${hy - r * 1.8}C${r * 1.0} ${hy - r * 2.0} ${r * 1.2} ${hy - r * 1.4} ${r * 0.75} ${hy - r * 1.3}L${r * 0.7} ${hy - r * 0.55}Z`} f="white" />);
    els.push(<S key="ch2" d={R(-r * 0.75, hy - r * 0.8, r * 1.5, r * 0.28)} f="white" />);
  } else if (hat === 'helmet') {
    els.push(<S key="hm" d={`M${-r * 1.0} ${hy - r * 0.28}C${-r * 1.05} ${hy - r * 1.3} ${r * 1.0} ${hy - r * 1.3} ${r * 0.98} ${hy - r * 0.3}h${r * 0.18}v${r * 0.08}h${-r * 2.16}Z`} f={hatC} />);
  } else if (hat === 'band') {
    els.push(<S key="bd" d={R(-r * 0.95, hy - r * 0.62, r * 1.88, r * 0.24)} f={hatC} />);
  }

  return <g>{els}</g>;
};
