// Rig nhân vật 2D nhìn từ phía sau (back view), style riso: đầu to, viền mực, bóng chấm.
// Gốc toạ độ = điểm giữa hai bàn chân. Trục y âm là đi lên. Dùng cho OTS & nhân vật đi/nhìn vào không gian.
import React from 'react';
import {E, L, PAL, R, Rr, S, Sh, col, LINE, Smoke} from './kit';
import type {Arm, Look, Pose} from './chars';

const rad = (d: number) => (d * Math.PI) / 180;

type Hands = {l: [number, number]; r: [number, number]};

export type BackProps = {
  look: Look;
  pose: Pose;
  t: number;
  gaze?: number; // -1..1 nghiêng đầu nhẹ hé má / gọng kính
  lean?: number; // độ nghiêng thêm (độ)
  prop?: (h: Hands) => React.ReactNode;
  propBack?: (h: Hands) => React.ReactNode;
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

export const PersonBack: React.FC<BackProps> = ({look, pose, t, gaze = 0, lean = 0, prop, propBack}) => {
  const g = look.ghost;
  const skin = g ? 'ghost' : look.skin ?? 'skin';
  const W = look.w ?? 1;
  const H = look.h ?? 1;
  const belly = look.belly ?? 0;
  const sw = 78 * W; // nửa vai (khớp tuyệt đối với chars.tsx)
  const ww = (64 + belly * 34) * W; // nửa eo
  const legY = -178 * H; // hông
  const shY = legY - 196 * H; // vai (-374 * H)
  const HR = 100 * (look.head ?? 1); // bán kính đầu
  const hy = shY - 8 - HR * 0.9;
  const legs = g ? 'none' : pose.legs ?? 'stand';
  const sitDrop = legs === 'sit' ? 70 : 0;

  // --- tay (hỗ trợ đầy đủ POSES + IK target hướng vào cảnh) ---
  const armW = 30 * Math.min(1.25, W);
  const ua = 104 * H, fa = 96 * H;
  const shoulder = (sg: number): [number, number] => [sg * (sw - 14), shY + 18 + sitDrop];
  const shY0 = shY, legY0 = legY;
  const target = (sg: number, n: string): [number, number] => {
    const hyy = hy + sitDrop;
    const sY2 = shY0 + sitDrop;
    const lY2 = legY0 + sitDrop;
    switch (n) {
      case 'mouth': return [sg * HR * 0.32, hyy + HR * 0.6];
      case 'taste': return [sg * HR * 0.32 + 33, hyy + HR * 0.6 + 90];
      case 'eye': return [sg * HR * 0.3, hyy + HR * 0.2];
      case 'ear': return [sg * HR * 0.95, hyy + HR * 0.1];
      case 'head': return [sg * HR * 0.7, hyy - HR * 0.6];
      case 'over': return [sg * 40, hyy - HR * 1.6];
      case 'chest': return [sg * 10, sY2 + 90];
      case 'pray': return [0, sY2 + 40];
      case 'crossL': return [sw * 0.45, sY2 + 120];
      case 'crossR': return [-sw * 0.45, sY2 + 104];
      case 'hip': return [sg * (ww + 8), lY2 - 10];
      case 'front': return [sg * 26, sY2 + 150];
    }
    return [sg * sw, sY2 + 200];
  };
  const armPts = (sg: number, a: Arm): [number, number][] => {
    const [x0, y0] = shoulder(sg);
    if (typeof a === 'string' || !Array.isArray(a)) {
      const [tx, ty] = typeof a === 'string' ? target(sg, a) : [a.x, a.y];
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

  const bY = legY + sitDrop;
  const sY = shY + sitDrop;
  // Tay đưa ra trước ngực/mặt sẽ khuất sau lưng khi nhìn từ phía sau
  const isOccluded = (p: [number, number][]) =>
    Math.abs(p[2][0]) < sw * 0.68 && p[2][1] > sY - 30 && p[2][1] < bY + 60;
  const lBehind = isOccluded(lp);
  const rBehind = isOccluded(rp);

  const drawArm = (p: [number, number][], k: string, dim = false) => (
    <g key={k}>
      {limb(p, armW, fullSleeve ? sleeveC : skin, k + 'a')}
      {!fullSleeve && limb([p[0], [p[0][0] + (p[1][0] - p[0][0]) * 0.5, p[0][1] + (p[1][1] - p[0][1]) * 0.5]], armW + 6, sleeveC, k + 's')}
      {dim && <path d={`M${p[0][0]} ${p[0][1]}L${p[1][0]} ${p[1][1]}L${p[2][0]} ${p[2][1]}`} stroke={PAL.ink} strokeWidth={armW} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.14} />}
    </g>
  );
  const drawHand = (p: [number, number], k: string) => <S key={k} d={E(p[0], p[1], 17, 17)} f={skin} />;

  // --- chân & gót giày nhìn từ sau ---
  const legX = 34 * W + belly * 10;
  const legW = 40 * Math.min(1.2, W);
  const legEls: React.ReactNode[] = [];
  const shoe = look.shoes ?? 'red';
  const drawBackShoe = (fx: number, fy: number, k: string) => (
    <g key={k}>
      <S d={Rr(fx - 26, fy - 24, 52, 24, 11)} f={shoe} />
      {/* đế giày + đường may gót phía sau */}
      <S d={Rr(fx - 24, fy - 8, 48, 8, 4)} f="ink" sw={2} />
      <L d={`M${fx} ${fy - 23}v14`} w={3.5} o={0.55} />
    </g>
  );

  if (legs === 'stand' || legs === 'walk') {
    const sw2 = legs === 'walk' ? Math.sin(t * 9) * 14 : 0;
    for (const sg of [-1, 1]) {
      const lift = legs === 'walk' ? Math.max(0, sg * Math.sin(t * 9)) * 12 : 0;
      const fx = sg * legX + sg * sw2 * (sg > 0 ? 0.5 : -0.5);
      const kneeY = legY * 0.52 - lift * 0.4;
      legEls.push(limb([[sg * legX, legY + 10], [fx, -18 - lift]], legW, look.pants, 'leg' + sg));
      // nếp khoeo chân phía sau + bóng chấm halftone
      legEls.push(<L key={'kn' + sg} d={`M${fx - legW * 0.36} ${kneeY}q${legW * 0.36} ${5} ${legW * 0.72} 0`} w={4} o={0.55} />);
      if (sg > 0) {
        legEls.push(<Sh key={'lsh' + sg} d={R(fx - legW * 0.1, legY + 10, legW * 0.62, Math.max(10, -legY - 34 - lift))} o={0.42} />);
      }
      legEls.push(drawBackShoe(fx, -lift, 'sh' + sg));
    }
  } else if (legs === 'sit') {
    for (const sg of [-1, 1]) {
      const fx = sg * (legX + 10);
      legEls.push(limb([[sg * legX, legY + sitDrop], [sg * (legX + 14), legY + sitDrop + 20], [fx, -18]], legW, look.pants, 'leg' + sg));
      legEls.push(<L key={'kn' + sg} d={`M${fx - legW * 0.32} ${legY * 0.4}q${legW * 0.32} 4 ${legW * 0.64} 0`} w={4} o={0.45} />);
      legEls.push(drawBackShoe(fx, 0, 'sh' + sg));
    }
  }

  // --- thân nhìn từ sau ---
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

  // --- chi tiết sau lưng áo (cổ áo, cầu vai, nút khăn, đường xẻ tà) ---
  const backDet: React.ReactNode[] = [];
  const c2 = look.topC2 ?? 'trim';
  if (look.top === 'shirt' || look.top === 'polo' || look.top === 'uniform') {
    // cổ áo vòng sau gáy + đường cầu vai ngang lưng
    backDet.push(<S key="bc" d={`M-34 ${sY - 22}Q0 ${sY - 12} 34 ${sY - 22}L36 ${sY - 6}Q0 ${sY + 6} -36 ${sY - 6}Z`} f={look.top === 'polo' ? c2 : topC} />);
    backDet.push(<L key="yk" d={`M${-sw + 14} ${sY + 26}Q0 ${sY + 34} ${sw - 14} ${sY + 26}`} w={3.5} o={0.42} />);
    backDet.push(<L key="pl" d={`M0 ${sY + 30}v22`} w={3.5} o={0.38} />);
    if (look.top === 'uniform') {
      backDet.push(<S key="ep1" d={Rr(-sw - 2, sY - 8, 44, 14, 6)} f="gold" />, <S key="ep2" d={Rr(sw - 42, sY - 8, 44, 14, 6)} f="gold" />);
    }
  } else if (look.top === 'suit') {
    backDet.push(<S key="bc" d={`M-34 ${sY - 22}Q0 ${sY - 12} 34 ${sY - 22}L38 ${sY - 6}Q0 ${sY + 6} -38 ${sY - 6}Z`} f={topC} />);
    backDet.push(<L key="sm" d={`M0 ${sY + 2}V${hemY - 34}`} w={3.5} o={0.45} />);
    backDet.push(<L key="vt" d={`M0 ${hemY - 34}V${hemY}`} w={LINE} />);
    backDet.push(<L key="d1" d={`M${-sw * 0.42} ${sY + 46}Q${-ww * 0.46} ${(sY + hemY) * 0.5} ${-ww * 0.42} ${hemY - 16}`} w={3} o={0.3} />);
    backDet.push(<L key="d2" d={`M${sw * 0.42} ${sY + 46}Q${ww * 0.46} ${(sY + hemY) * 0.5} ${ww * 0.42} ${hemY - 16}`} w={3} o={0.3} />);
  } else if (look.top === 'chef') {
    // nút thắt khăn đỏ sau gáy + 2 đuôi khăn
    backDet.push(<S key="nk" d={Rr(-38, sY - 24, 76, 18, 7)} f="red" />);
    backDet.push(<S key="nt1" d={`M-6 ${sY - 8}L-22 ${sY + 34}L-4 ${sY + 28}Z`} f="red" />);
    backDet.push(<S key="nt2" d={`M6 ${sY - 8}L24 ${sY + 32}L6 ${sY + 28}Z`} f="red" />);
    backDet.push(<S key="nk0" d={E(0, sY - 10, 12, 10)} f="redDark" />);
  } else if (look.top === 'robe') {
    backDet.push(<S key="bc" d={`M-34 ${sY - 20}Q0 ${sY - 8} 34 ${sY - 20}L36 ${sY - 4}Q0 ${sY + 8} -36 ${sY - 4}Z`} f={c2} />);
    backDet.push(<S key="belt" d={R(-ww - 6, bY - 40, 2 * ww + 12, 22)} f={c2} />);
    backDet.push(<S key="bk1" d={`M-6 ${bY - 20}L-26 ${bY + 32}L-6 ${bY + 26}Z`} f={c2} />);
    backDet.push(<S key="bk2" d={`M6 ${bY - 20}L28 ${bY + 30}L8 ${bY + 26}Z`} f={c2} />);
    backDet.push(<S key="bk0" d={Rr(-14, bY - 42, 28, 26, 8)} f={c2} />);
  } else if (look.top === 'aothe') {
    backDet.push(<S key="n" d={Rr(-30, sY - 30, 60, 20, 8)} f={c2} />);
    backDet.push(<L key="sm" d={`M0 ${sY - 10}V${hemY - 12}`} w={3.5} o={0.35} />);
  } else if (look.top === 'blouse') {
    backDet.push(<S key="v" d={`M-30 ${sY - 18}Q0 ${sY + 10} 30 ${sY - 18}Z`} f={skin} />);
    backDet.push(<L key="kh" d={`M0 ${sY - 2}v16`} w={4} />);
    backDet.push(<circle key="kb" cx={0} cy={sY + 2} r={4} fill={PAL.ink} />);
  } else if (look.top === 'tank') {
    backDet.push(<S key="nk" d={`M-38 ${sY - 18}Q0 ${sY + 34} 38 ${sY - 18}Z`} f={skin} />);
  } else if (look.top === 'tee') {
    backDet.push(<L key="nk" d={`M-30 ${sY - 16}Q0 ${sY - 2} 30 ${sY - 16}`} w={4.5} />);
  }
  if (look.chain) backDet.push(<path key="ch" d={`M-24 ${sY - 22}Q0 ${sY - 12} 24 ${sY - 22}`} fill="none" stroke={PAL.gold} strokeWidth={6} strokeDasharray="2 8" strokeLinecap="round" />);
  if (look.vest) {
    backDet.push(<S key="vb" d={`M${-sw + 6} ${sY + 4}L-30 ${sY - 10}L30 ${sY - 10}L${sw - 6} ${sY + 4}L${ww + 4} ${bY + 20}L${-ww - 4} ${bY + 20}Z`} f="orange" />);
    backDet.push(<rect key="v3" x={-ww - 6} y={bY - 70} width={2 * ww + 12} height={16} fill={PAL.trim} stroke={PAL.ink} strokeWidth={3} />);
    backDet.push(<rect key="v4" x={-ww - 6} y={bY - 30} width={2 * ww + 12} height={16} fill={PAL.trim} stroke={PAL.ink} strokeWidth={3} />);
  }

  // --- ma: đuôi khói ---
  const bob = g ? Math.sin(t * 2.2) * 10 : (pose.hop ?? 0);
  const tail = g ? (
    <g>
      <path d={`M${-hemW} ${hemY - 4}C${-hemW + 20} ${hemY + 60} ${-30} ${hemY + 40} ${-10 + Math.sin(t * 2) * 14} ${hemY + 130}C${40} ${hemY + 60} ${hemW - 10} ${hemY + 50} ${hemW} ${hemY - 4}Z`} fill={PAL.ghost} stroke={PAL.ink} strokeWidth={LINE} opacity={0.85} />
      <Smoke x={-10} y={hemY + 150} t={t} h={60} w={10} o={0.5} />
    </g>
  ) : null;

  const totalLean = (pose.lean ?? 0) + lean;

  return (
    <g transform={`translate(0 ${-bob}) rotate(${totalLean} 0 ${legY})`} opacity={g ? 0.93 : 1}>
      {g && <ellipse cx={0} cy={hy} rx={HR * 3.2} ry={HR * 4} fill="url(#glowG)" />}
      {propBack?.(hands)}
      {lBehind && drawArm(lp, 'la', true)}
      {rBehind && drawArm(rp, 'ra', true)}
      {lBehind && drawHand(hands.l, 'hl')}
      {rBehind && drawHand(hands.r, 'hr')}
      {legEls}
      {tail}
      <S d={torso} f={topC} />
      <clipPath id={`tb-${look.name}`}><path d={torso} /></clipPath>
      <g clipPath={`url(#tb-${look.name})`}>
        {pattern}
        {/* bóng chấm riso cạnh phải + gờ eo tạo khối lưng tròn */}
        <Sh d={`M${sw * 0.34} ${sY - 30}L${sw + 60} ${sY - 30}L${hemW + 60} ${hemY + 10}L${hemW * 0.42} ${hemY + 10}Z`} o={0.58} />
        <Sh d={`M${-hemW - 20} ${hemY - 34}L${hemW + 20} ${hemY - 34}L${hemW + 20} ${hemY + 10}L${-hemW - 20} ${hemY + 10}Z`} o={0.28} />
      </g>
      {backDet}
      {/* gáy cổ */}
      <S d={R(-20, sY - 44, 40, 32)} f={g ? 'ghost' : 'skinShade'} />
      {!lBehind && drawArm(lp, 'la')}
      {!rBehind && drawArm(rp, 'ra')}
      {prop?.(hands)}
      {!lBehind && drawHand(hands.l, 'hl')}
      {!rBehind && drawHand(hands.r, 'hr')}
      {/* đầu sau vẽ sau cùng để tóc dài / gáy phủ tự nhiên lên vai */}
      <HeadBack look={look} hy={hy + sitDrop} R={HR} gaze={gaze} />
    </g>
  );
};

const HeadBack: React.FC<{look: Look; hy: number; R: number; gaze: number}> = ({look, hy, R: r, gaze}) => {
  const g = look.ghost;
  const skin = g ? 'ghost' : look.skin ?? 'skin';
  const hairC = look.hairC ?? 'hair';
  const gx = Math.max(-1, Math.min(1, gaze)) * r * 0.16;
  const turn = Math.abs(gaze);
  const sg = gaze >= 0 ? 1 : -1;
  const els: React.ReactNode[] = [];

  // nếu quay đầu nhẹ (gaze): hé viền má & gọng kính ở mép quay
  if (turn > 0.15) {
    const cx = sg * (r * 0.86 + turn * r * 0.14);
    els.push(<S key="chk" d={E(cx, hy + r * 0.34, r * (0.14 + turn * 0.1), r * 0.32)} f={skin} />);
    if (look.glasses === 'round' || look.glasses === 'square') {
      const rx = sg * (r * 0.96 + turn * r * 0.16);
      els.push(<S key="glr" d={E(rx, hy + r * 0.18, r * 0.1, r * 0.18)} f="white" o={0.55} sw={4.5} />);
      els.push(<L key="gla" d={`M${rx - sg * r * 0.06} ${hy + r * 0.16}L${sg * r * 0.84} ${hy + r * 0.18}`} w={4} />);
    } else if (look.glasses === 'sun') {
      const rx = sg * (r * 0.94 + turn * r * 0.14);
      els.push(<S key="sgr" d={Rr(rx - r * 0.09, hy + r * 0.04, r * 0.18, r * 0.24, 6)} f="ink" sw={3} />);
    }
  }

  // tai hai bên nhìn từ sau
  const earOffset = (side: number) => side * r * 0.92 + gx * 0.25;
  for (const side of [-1, 1]) {
    const ex = earOffset(side);
    els.push(<S key={'ea' + side} d={E(ex, hy + r * 0.2, r * 0.14, r * 0.19)} f={skin} />);
    els.push(<L key={'ec' + side} d={`M${ex - side * r * 0.04} ${hy + r * 0.12}q${side * r * 0.07} ${r * 0.08} 0 ${r * 0.16}`} w={3} o={0.45} />);
    if (look.earrings) els.push(<S key={'er' + side} d={E(ex, hy + r * 0.44, 6, 6)} f="gold" />);
  }

  // khung đầu tròn kiểu mochi (khớp bán kính mặt trước)
  const skullD = `M0 ${hy - r}C${r * 0.62} ${hy - r} ${r * 0.96} ${hy - r * 0.62} ${r * 0.96} ${hy + r * 0.08}C${r * 0.96} ${hy + r * 0.66} ${r * 0.56} ${hy + r * 0.9} 0 ${hy + r * 0.9}C${-r * 0.56} ${hy + r * 0.9} ${-r * 0.96} ${hy + r * 0.66} ${-r * 0.96} ${hy + r * 0.08}C${-r * 0.96} ${hy - r * 0.62} ${-r * 0.62} ${hy - r} 0 ${hy - r}Z`;
  els.push(<S key="skull" d={skullD} f={skin} />);

  // khối tóc sau đầu cho mọi kiểu Hair
  const hp = (d: string, k: string) => els.push(<S key={k} d={d} f={hairC} />);
  const domeTop = `M${-r * 0.98} ${hy + r * 0.18}C${-r * 1.06} ${hy - r * 1.38} ${r * 1.06} ${hy - r * 1.38} ${r * 0.98} ${hy + r * 0.18}`;

  switch (look.hair) {
    case 'bald':
      // vành tóc móng ngựa quanh gáy dưới + vệt bóng đỉnh đầu
      hp(`M${-r * 0.96} ${hy + r * 0.06}C${-r * 0.65} ${hy - r * 0.08} ${r * 0.65} ${hy - r * 0.08} ${r * 0.96} ${hy + r * 0.06}C${r * 0.94} ${hy + r * 0.54} ${r * 0.58} ${hy + r * 0.78} 0 ${hy + r * 0.78}C${-r * 0.58} ${hy + r * 0.78} ${-r * 0.94} ${hy + r * 0.54} ${-r * 0.96} ${hy + r * 0.06}Z`, 'hb');
      els.push(<Sh key="bsh" d={`M${r * 0.42} ${hy - r * 0.88}C${r * 0.96} ${hy - r * 0.44} ${r * 0.98} ${hy + r * 0.5} ${r * 0.38} ${hy + r * 0.82}C${r * 0.72} ${hy + r * 0.38} ${r * 0.76} ${hy - r * 0.34} ${r * 0.42} ${hy - r * 0.88}Z`} o={0.35} />);
      els.push(<path key="shine" d={`M${-r * 0.32} ${hy - r * 0.76}q${r * 0.22} ${-r * 0.12} ${r * 0.44} ${-r * 0.02}`} stroke={PAL.white} strokeWidth={8} strokeLinecap="round" fill="none" />);
      break;
    case 'thin':
      // tóc thưa nửa dưới + vài sợi lơ thơ trên đỉnh
      hp(`M${-r * 0.96} ${hy - r * 0.12}C${-r * 0.55} ${hy - r * 0.28} ${r * 0.55} ${hy - r * 0.28} ${r * 0.96} ${hy - r * 0.12}C${r * 0.94} ${hy + r * 0.54} ${r * 0.56} ${hy + r * 0.78} 0 ${hy + r * 0.78}C${-r * 0.56} ${hy + r * 0.78} ${-r * 0.94} ${hy + r * 0.54} ${-r * 0.96} ${hy - r * 0.12}Z`, 'ht');
      els.push(<L key="st1" d={`M${-r * 0.28} ${hy - r * 0.88}q${r * 0.28} ${-r * 0.08} ${r * 0.54} ${r * 0.08}`} w={4} c={hairC} />);
      els.push(<L key="st2" d={`M${-r * 0.18} ${hy - r * 0.72}q${r * 0.24} ${-r * 0.06} ${r * 0.44} ${r * 0.06}`} w={3.5} c={hairC} />);
      els.push(<Sh key="tsh" d={`M${r * 0.45} ${hy - r * 0.82}C${r * 0.94} ${hy - r * 0.36} ${r * 0.94} ${hy + r * 0.5} ${r * 0.38} ${hy + r * 0.8}C${r * 0.7} ${hy + r * 0.36} ${r * 0.74} ${hy - r * 0.3} ${r * 0.45} ${hy - r * 0.82}Z`} o={0.35} />);
      break;
    case 'bun':
      // tóc búi cao gọn gàng + dây buộc tóc
      hp(`${domeTop}C${r * 0.9} ${hy + r * 0.6} ${r * 0.52} ${hy + r * 0.76} 0 ${hy + r * 0.76}C${-r * 0.52} ${hy + r * 0.76} ${-r * 0.9} ${hy + r * 0.6} ${-r * 0.98} ${hy + r * 0.18}Z`, 'hd');
      els.push(<L key="up1" d={`M${-r * 0.32} ${hy + r * 0.66}Q${-r * 0.22} ${hy + r * 0.1} ${-r * 0.08} ${hy - r * 0.64}`} w={3.5} c="white" o={0.22} />);
      els.push(<L key="up2" d={`M${r * 0.32} ${hy + r * 0.66}Q${r * 0.22} ${hy + r * 0.1} ${r * 0.08} ${hy - r * 0.64}`} w={3.5} c="white" o={0.22} />);
      els.push(<S key="bun" d={E(gx * 0.4, hy - r * 0.96, r * 0.44, r * 0.36)} f={hairC} />);
      els.push(<S key="tie" d={Rr(gx * 0.4 - r * 0.3, hy - r * 0.74, r * 0.6, r * 0.14, 7)} f={look.topC2 ?? 'red'} />);
      els.push(<Sh key="hsh" d={`M${r * 0.42} ${hy - r * 0.82}C${r * 0.96} ${hy - r * 0.36} ${r * 0.94} ${hy + r * 0.54} ${r * 0.36} ${hy + r * 0.74}C${r * 0.72} ${hy + r * 0.32} ${r * 0.74} ${hy - r * 0.3} ${r * 0.42} ${hy - r * 0.82}Z`} o={0.4} />);
      break;
    case 'long':
      // mái tóc dài buông phủ lưng vai thành tấm mềm có lượn sóng
      hp(`M${-r * 1.02} ${hy + r * 0.1}C${-r * 1.08} ${hy - r * 1.4} ${r * 1.08} ${hy - r * 1.4} ${r * 1.02} ${hy + r * 0.1}C${r * 1.14} ${hy + r * 0.88} ${r * 1.04} ${hy + r * 1.38} ${r * 0.76} ${hy + r * 1.54}Q${r * 0.36} ${hy + r * 1.46} 0 ${hy + r * 1.56}Q${-r * 0.36} ${hy + r * 1.46} ${-r * 0.76} ${hy + r * 1.54}C${-r * 1.04} ${hy + r * 1.38} ${-r * 1.14} ${hy + r * 0.88} ${-r * 1.02} ${hy + r * 0.1}Z`, 'hlg');
      els.push(<L key="hl1" d={`M${-r * 0.54} ${hy - r * 0.8}q${r * 0.28} ${-r * 0.14} ${r * 0.56} ${-r * 0.06}`} w={6} c="white" o={0.34} />);
      els.push(<L key="hl2" d={`M${-r * 0.42} ${hy + r * 0.12}C${-r * 0.46} ${hy + r * 0.65} ${-r * 0.42} ${hy + r * 1.08} ${-r * 0.36} ${hy + r * 1.38}`} w={4.5} c="white" o={0.24} />);
      els.push(<L key="hl3" d={`M${r * 0.24} ${hy + r * 0.18}C${r * 0.28} ${hy + r * 0.65} ${r * 0.26} ${hy + r * 1.08} ${r * 0.22} ${hy + r * 1.38}`} w={4} c="white" o={0.2} />);
      els.push(<Sh key="hsh" d={`M${r * 0.38} ${hy - r * 0.84}C${r * 1.06} ${hy - r * 0.36} ${r * 1.1} ${hy + r * 0.96} ${r * 0.72} ${hy + r * 1.5}L${r * 0.34} ${hy + r * 1.48}C${r * 0.68} ${hy + r * 0.94} ${r * 0.7} ${hy - r * 0.26} ${r * 0.38} ${hy - r * 0.84}Z`} o={0.44} />);
      break;
    case 'curly':
      // khối tóc xoăn xù đầy đặn phủ trọn sau đầu
      hp(`${domeTop}C${r * 0.94} ${hy + r * 0.68} ${r * 0.56} ${hy + r * 0.84} 0 ${hy + r * 0.84}C${-r * 0.56} ${hy + r * 0.84} ${-r * 0.94} ${hy + r * 0.68} ${-r * 0.98} ${hy + r * 0.18}Z`, 'hcb');
      for (let i = 0; i < 11; i++) {
        const a = Math.PI * (0.72 + (i / 10) * 1.56);
        els.push(<S key={'cu' + i} d={E(Math.cos(a) * r * 0.92, hy + Math.sin(a) * r * 0.88 - r * 0.04, r * 0.34, r * 0.34)} f={hairC} />);
      }
      els.push(<L key="cc1" d={`M${-r * 0.42} ${hy - r * 0.36}a${r * 0.22} ${r * 0.22} 0 1 1 ${r * 0.34} ${r * 0.06}`} w={4} c="white" o={0.22} />);
      els.push(<L key="cc2" d={`M${r * 0.1} ${hy + r * 0.1}a${r * 0.2} ${r * 0.2} 0 1 1 ${r * 0.3} ${r * 0.08}`} w={4} c="white" o={0.2} />);
      els.push(<Sh key="hsh" d={`M${r * 0.36} ${hy - r * 0.74}C${r * 1.0} ${hy - r * 0.3} ${r * 1.0} ${hy + r * 0.62} ${r * 0.32} ${hy + r * 0.86}C${r * 0.68} ${hy + r * 0.44} ${r * 0.72} ${hy - r * 0.22} ${r * 0.36} ${hy - r * 0.74}Z`} o={0.42} />);
      break;
    case 'short':
    case 'kid':
      // mái vòm tròn phủ gáy có răng cưa mềm ở chân tóc + chỏm tóc nhí (kid)
      hp(`${domeTop}C${r * 0.92} ${hy + r * 0.52} ${r * 0.72} ${hy + r * 0.68} ${r * 0.5} ${hy + r * 0.72}Q${r * 0.34} ${hy + r * 0.84} ${r * 0.2} ${hy + r * 0.74}Q0 ${hy + r * 0.88} ${-r * 0.2} ${hy + r * 0.74}Q${-r * 0.34} ${hy + r * 0.84} ${-r * 0.5} ${hy + r * 0.72}C${-r * 0.72} ${hy + r * 0.68} ${-r * 0.92} ${hy + r * 0.52} ${-r * 0.98} ${hy + r * 0.18}Z`, 'hs');
      if (look.hair === 'kid') {
        hp(`M${-r * 0.14} ${hy - r * 1.02}C${-r * 0.04} ${hy - r * 1.32} ${r * 0.18} ${hy - r * 1.32} ${r * 0.24} ${hy - r * 1.14}C${r * 0.12} ${hy - r * 1.12} ${r * 0.08} ${hy - r * 1.0} ${r * 0.06} ${hy - r * 0.96}Z`, 'cow');
      }
      els.push(<L key="hl" d={`M${-r * 0.48} ${hy - r * 0.82}q${r * 0.28} ${-r * 0.14} ${r * 0.56} ${-r * 0.04}`} w={6} c="white" o={0.34} />);
      els.push(<Sh key="hsh" d={`M${r * 0.42} ${hy - r * 0.82}C${r * 0.96} ${hy - r * 0.36} ${r * 0.94} ${hy + r * 0.52} ${r * 0.36} ${hy + r * 0.74}C${r * 0.7} ${hy + r * 0.34} ${r * 0.74} ${hy - r * 0.3} ${r * 0.42} ${hy - r * 0.82}Z`} o={0.42} />);
      break;
    case 'side':
    case 'neat':
    default:
      // mái vòm chải gọn ôm chân gáy thon
      hp(`${domeTop}C${r * 0.9} ${hy + r * 0.56} ${r * 0.56} ${hy + r * 0.76} 0 ${hy + r * 0.76}C${-r * 0.56} ${hy + r * 0.76} ${-r * 0.9} ${hy + r * 0.56} ${-r * 0.98} ${hy + r * 0.18}Z`, 'hn');
      els.push(<L key="hl" d={`M${-r * 0.5} ${hy - r * 0.84}q${r * 0.3} ${-r * 0.14} ${r * 0.6} ${-r * 0.05}`} w={6} c="white" o={0.35} />);
      els.push(<Sh key="hsh" d={`M${r * 0.42} ${hy - r * 0.82}C${r * 0.96} ${hy - r * 0.36} ${r * 0.94} ${hy + r * 0.54} ${r * 0.36} ${hy + r * 0.74}C${r * 0.7} ${hy + r * 0.34} ${r * 0.74} ${hy - r * 0.3} ${r * 0.42} ${hy - r * 0.82}Z`} o={0.42} />);
      break;
  }

  // --- mũ nhìn từ phía sau ---
  const hat = look.hat ?? 'none';
  const hatC = look.hatC ?? 'navy';
  if (hat === 'khanxep') {
    els.push(<S key="kx" d={`M${-r * 0.98} ${hy - r * 0.38}C${-r * 1.02} ${hy - r * 1.05} ${r * 1.02} ${hy - r * 1.05} ${r * 0.98} ${hy - r * 0.38}C${r * 0.6} ${hy - r * 0.24} ${-r * 0.6} ${hy - r * 0.24} ${-r * 0.98} ${hy - r * 0.38}Z`} f={hatC} />);
    for (let i = 0; i < 4; i++) els.push(<L key={'kxl' + i} d={`M${-r * 0.9} ${hy - r * (0.46 + i * 0.12)}Q0 ${hy - r * (0.36 + i * 0.12)} ${r * 0.9} ${hy - r * (0.46 + i * 0.12)}`} w={3} c="trim" o={0.5} />);
  } else if (hat === 'cap') {
    // mũ lưỡi trai nhìn sau: khoét nửa vòng tròn + quai chỉnh cỡ
    els.push(<S key="cap" d={`M${-r * 0.92} ${hy - r * 0.36}C${-r * 0.98} ${hy - r * 1.2} ${r * 0.98} ${hy - r * 1.2} ${r * 0.92} ${hy - r * 0.36}L${r * 0.34} ${hy - r * 0.36}A${r * 0.34} ${r * 0.28} 0 0 0 ${-r * 0.34} ${hy - r * 0.36}Z`} f={hatC} />);
    els.push(<S key="cstr" d={Rr(-r * 0.38, hy - r * 0.44, r * 0.76, r * 0.13, 5)} f="ink" sw={3} />);
    els.push(<S key="ccl" d={Rr(-r * 0.1, hy - r * 0.46, r * 0.2, r * 0.17, 4)} f="gold" sw={3} />);
  } else if (hat === 'chef') {
    els.push(<S key="ch1" d={`M${-r * 0.7} ${hy - r * 0.55}L${-r * 0.75} ${hy - r * 1.3}C${-r * 1.2} ${hy - r * 1.5} ${-r * 0.8} ${hy - r * 2.1} ${-r * 0.3} ${hy - r * 1.8}C${-r * 0.1} ${hy - r * 2.3} ${r * 0.5} ${hy - r * 2.2} ${r * 0.45} ${hy - r * 1.8}C${r * 1.0} ${hy - r * 2.0} ${r * 1.2} ${hy - r * 1.4} ${r * 0.75} ${hy - r * 1.3}L${r * 0.7} ${hy - r * 0.55}Z`} f="white" />);
    els.push(<S key="ch2" d={R(-r * 0.75, hy - r * 0.8, r * 1.5, r * 0.28)} f="white" />);
  } else if (hat === 'helmet') {
    els.push(<S key="hm" d={`M${-r * 1.02} ${hy - r * 0.26}C${-r * 1.06} ${hy - r * 1.3} ${r * 1.06} ${hy - r * 1.3} ${r * 1.02} ${hy - r * 0.26}Q0 ${hy - r * 0.16} ${-r * 1.02} ${hy - r * 0.26}Z`} f={hatC} />);
    els.push(<Sh key="hmsh" d={`M${r * 0.36} ${hy - r * 1.06}C${r * 0.98} ${hy - r * 0.82} ${r * 1.04} ${hy - r * 0.3} ${r * 0.98} ${hy - r * 0.24}L${r * 0.46} ${hy - r * 0.22}C${r * 0.64} ${hy - r * 0.46} ${r * 0.64} ${hy - r * 0.82} ${r * 0.36} ${hy - r * 1.06}Z`} o={0.38} />);
  } else if (hat === 'band') {
    els.push(<S key="bd" d={R(-r * 0.96, hy - r * 0.58, r * 1.92, r * 0.24)} f={hatC} />);
    els.push(<S key="bdt1" d={`M-6 ${hy - r * 0.42}L-22 ${hy - r * 0.04}L-4 ${hy - r * 0.1}Z`} f={hatC} />);
    els.push(<S key="bdt2" d={`M6 ${hy - r * 0.42}L24 ${hy - r * 0.06}L6 ${hy - r * 0.1}Z`} f={hatC} />);
    els.push(<S key="bdk" d={E(0, hy - r * 0.46, 12, 11)} f={hatC} />);
  }

  return <g transform={gx ? `translate(${gx.toFixed(1)} 0)` : undefined}>{els}</g>;
};
