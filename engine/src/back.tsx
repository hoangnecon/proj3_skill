// Rig nhân vật 2D nhìn từ phía sau (back view), style riso: đầu to, viền mực, bóng chấm.
// Gốc toạ độ = điểm giữa hai bàn chân. Trục y âm là đi lên. Dùng cho OTS & nhân vật đi/nhìn vào không gian.
import React from 'react';
import {E, L, PAL, R, Rr, S, Sh, col, LINE, Smoke} from './kit';
import {TaperLimb, curvedTorsoPath, hairWindOffset, livingIdle, talkGesture} from './anim';
import {furBandD, furCollarD, furSashNodes, type Arm, type Look, type Pose} from './chars';

const rad = (d: number) => (d * Math.PI) / 180;

type Hands = {l: [number, number]; r: [number, number]};

export type BackProps = {
  look: Look;
  pose: Pose;
  t: number;
  gaze?: number; // -1..1 nghiêng đầu nhẹ hé má / gọng kính
  blinkPh?: number;
  lean?: number; // độ nghiêng thêm (độ)
  wind?: number; // luồng gió thổi ngang/lùa tóc (mặc định 0)
  velX?: number; // vận tốc ngang thế giới px/s (mặc định 0)
  layer?: 'all' | 'far' | 'near'; // tách lớp kẹp vật cưỡi (mặc định 'all')
  prop?: (h: Hands) => React.ReactNode;
  propBack?: (h: Hands) => React.ReactNode;
};

export const PersonBack: React.FC<BackProps> = ({
  look,
  pose,
  t,
  gaze = 0,
  blinkPh = 0,
  lean = 0,
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
  const sw = 78 * W; // nửa vai (khớp tuyệt đối với chars.tsx)
  const ww = (64 + belly * 34) * W; // nửa eo
  const legY = -178 * H; // hông
  const shY = legY - 196 * H; // vai (-374 * H)
  const HR = 100 * (look.head ?? 1); // bán kính đầu
  const hy = shY - 8 - HR * 0.9;
  const legs = g ? 'none' : pose.legs ?? 'stand';
  const idle = livingIdle(t, blinkPh);
  const bodyDrop = legs === 'sit' ? 70 : legs === 'crouch' ? 62 * H : legs === 'ride' ? 72 * H : legs === 'push' ? 24 * H : 0;
  const bY = legY + bodyDrop;
  const sY = shY + bodyDrop - idle.shoulderLift;
  const hyy = hy + bodyDrop - idle.shoulderLift;

  // Độ cong/lắc cột sống hữu cơ theo tư thế nhìn từ phía sau + nhịp thở dồn trọng tâm
  const bendX =
    (legs === 'push' ? 16 :
    legs === 'crouch' ? 8 :
    legs === 'ride' ? 10 + Math.sin(t * 6) * 4 :
    legs === 'run' ? Math.sin(t * 14) * 12 :
    legs === 'fall' ? -18 + Math.sin(t * 18) * 5 :
    legs === 'jump' ? -8 :
    legs === 'climb' ? Math.sin(t * 7) * 8 :
    legs === 'walk' ? Math.sin(t * 9) * 4 : 0) + idle.swayX;
  const shShift = bendX * 0.35;

  // --- tay (hỗ trợ đầy đủ POSES + IK target hướng vào cảnh) ---
  const armW = 30 * Math.min(1.25, W);
  const ua = 104 * H, fa = 96 * H;
  const shoulder = (sg: number): [number, number] => [sg * (sw - 14) + shShift, sY + 18];
  const target = (sg: number, n: string): [number, number] => {
    switch (n) {
      case 'mouth': return [sg * HR * 0.32 + shShift, hyy + HR * 0.6];
      case 'taste': return [sg * HR * 0.32 + 33 + shShift, hyy + HR * 0.6 + 90];
      case 'eye': return [sg * HR * 0.3 + shShift, hyy + HR * 0.2];
      case 'ear': return [sg * HR * 0.95 + shShift, hyy + HR * 0.1];
      case 'head': return [sg * HR * 0.7 + shShift, hyy - HR * 0.6];
      case 'over': return [sg * 40 + shShift, hyy - HR * 1.6];
      case 'chest': return [sg * 10 + shShift * 0.7, sY + 90];
      case 'pray': return [shShift * 0.7, sY + 40];
      case 'crossL': return [sw * 0.45 + shShift * 0.6, sY + 120];
      case 'crossR': return [-sw * 0.45 + shShift * 0.6, sY + 104];
      case 'hip': return [sg * (ww + 8), bY - 10];
      case 'front': return [sg * 26 + shShift * 0.5, sY + 150];
    }
    return [sg * sw + shShift, sY + 200];
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
    let a0 = a[0], a1 = a[1];
    if (legs === 'run') {
      const swRun = Math.sin(t * 14) * sg;
      a0 += swRun * 24;
      a1 -= Math.max(0, swRun) * 14;
    } else if (legs === 'climb') {
      const swClimb = Math.sin(t * 7) * sg;
      a0 += swClimb * 26;
      a1 -= swClimb * 10;
    } else if (legs === 'fall') {
      a0 += Math.sin(t * 20 + (sg > 0 ? 1.8 : 0)) * 16;
    }
    const t1 = rad(a0);
    const t2 = rad(a0 + a1);
    const x1 = x0 + sg * Math.sin(t1) * ua, y1 = y0 + Math.cos(t1) * ua;
    const x2 = x1 + sg * Math.sin(t2) * fa, y2 = y1 + Math.cos(t2) * fa;
    return [[x0, y0], [x1, y1], [x2, y2]];
  };

  const lp = armPts(-1, pose.la);
  const rp = armPts(1, pose.ra);
  const hands: Hands = {l: lp[2], r: rp[2]};
  const sleeveC = look.top === 'tank' ? skin : g ? 'ghostDeep' : look.topC;
  const fullSleeve = ['suit', 'uniform', 'robe', 'chef', 'aothe', 'blouse', 'furCoat'].includes(look.top);

  // Tay đưa ra trước ngực/mặt sẽ khuất sau lưng khi nhìn từ phía sau
  const isOccluded = (p: [number, number][]) =>
    Math.abs(p[2][0] - shShift) < sw * 0.68 && p[2][1] > sY - 30 && p[2][1] < bY + 60;
  const lBehind = isOccluded(lp);
  const rBehind = isOccluded(rp);

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
        dim={dim ? 0.16 : 0}
      />
    </g>
  );
  const drawHand = (p: [number, number], k: string) => <S key={k} d={E(p[0], p[1], 17, 17)} f={skin} />;

  // --- chân khớp gối 2 khúc [hip, knee, ankle] & gót giày nhìn từ sau ---
  const legX = 34 * W + belly * 10;
  const legW = 40 * Math.min(1.2, W);
  const legEls: React.ReactNode[] = [];
  const shoe = look.shoes ?? 'red';
  const drawBackLeg = (pts: [number, number][], sg: number, k: string, shadeRight = true) => (
    <TaperLimb
      key={k}
      pts={pts}
      wTop={legW * 1.18}
      wMid={legW * 0.96}
      wBot={legW * 0.74}
      fill={look.pants}
      jointCrease={true}
      shade={shadeRight && sg > 0}
    />
  );
  const drawBackShoe = (ax: number, ay: number, k: string, rot = 0) => (
    <g key={k} transform={`translate(${ax.toFixed(1)} ${ay.toFixed(1)}) rotate(${rot.toFixed(1)})`}>
      <S d={Rr(-26, -6, 52, 24, 11)} f={shoe} />
      {/* đế giày + đường may gót phía sau */}
      <S d={Rr(-24, 10, 48, 8, 4)} f="ink" sw={2} />
      <L d="M0 -5v14" w={3.5} o={0.55} />
    </g>
  );
  const drawKneeCrease = (kx: number, ky: number, k: string, o = 0.42) => (
    <L key={k} d={`M${(kx - legW * 0.3).toFixed(1)} ${ky.toFixed(1)}q${(legW * 0.3).toFixed(1)} 4.5 ${(legW * 0.6).toFixed(1)} 0`} w={3.5} o={o} />
  );

  if (legs === 'stand') {
    for (const sg of [-1, 1]) {
      const hip: [number, number] = [sg * legX, bY + 10];
      const knee: [number, number] = [sg * (legX + 2), bY * 0.5];
      const ankle: [number, number] = [sg * legX, -18];
      legEls.push(drawBackLeg([hip, knee, ankle], sg, 'leg' + sg));
      legEls.push(drawKneeCrease(knee[0], knee[1], 'kn' + sg, 0.45));
      legEls.push(drawBackShoe(ankle[0], ankle[1], 'sh' + sg));
    }
  } else if (legs === 'walk') {
    for (const sg of [-1, 1]) {
      const stride = Math.sin(t * 9) * sg;
      const lift = Math.max(0, stride) * 20;
      const hip: [number, number] = [sg * legX, bY + 10];
      const knee: [number, number] = [sg * (legX + 5 + Math.max(0, stride) * 8), bY * 0.5 - lift * 0.65];
      const ankle: [number, number] = [sg * (legX + stride * 8), -18 - lift];
      legEls.push(drawBackLeg([hip, knee, ankle], sg, 'leg' + sg));
      legEls.push(drawKneeCrease(knee[0], knee[1], 'kn' + sg, 0.42));
      legEls.push(drawBackShoe(ankle[0], ankle[1], 'sh' + sg, stride > 0 ? sg * stride * 12 : 0));
    }
  } else if (legs === 'run') {
    for (const sg of [-1, 1]) {
      const stride = Math.sin(t * 14) * sg;
      const lift = Math.max(0, stride) * 44;
      const trail = Math.max(0, -stride) * 18;
      const hip: [number, number] = [sg * legX, bY + 10];
      const knee: [number, number] = [sg * (legX + 10 + Math.max(0, stride) * 14), bY * 0.44 - lift * 0.85];
      const ankle: [number, number] = [sg * (legX + stride * 14), -18 - lift - trail * 0.5];
      legEls.push(drawBackLeg([hip, knee, ankle], sg, 'leg' + sg));
      legEls.push(drawKneeCrease(knee[0], knee[1], 'kn' + sg, 0.42));
      legEls.push(drawBackShoe(ankle[0], ankle[1], 'sh' + sg, sg * (stride > 0 ? 16 : -10)));
    }
  } else if (legs === 'sit') {
    for (const sg of [-1, 1]) {
      const fx = sg * (legX + 10);
      legEls.push(drawBackLeg([[sg * legX, bY], [sg * (legX + 14), bY + 20], [fx, -18]], sg, 'leg' + sg));
      legEls.push(drawKneeCrease(fx, legY * 0.4, 'kn' + sg, 0.38));
      legEls.push(drawBackShoe(fx, -18, 'sh' + sg));
    }
  } else if (legs === 'crouch') {
    for (const sg of [-1, 1]) {
      const hip: [number, number] = [sg * legX, bY + 6];
      const knee: [number, number] = [sg * (legX + 24), bY + 46 * H];
      const ankle: [number, number] = [sg * (legX + 16), -18];
      legEls.push(drawBackLeg([hip, knee, ankle], sg, 'leg' + sg));
      legEls.push(drawKneeCrease(knee[0], knee[1], 'kn' + sg, 0.42));
      legEls.push(drawBackShoe(ankle[0], ankle[1], 'sh' + sg, sg * 6));
    }
  } else if (legs === 'ride') {
    // straddling knees clearly visible from behind
    for (const sg of [-1, 1]) {
      const hip: [number, number] = [sg * legX, bY + 6];
      const knee: [number, number] = [sg * (legX + 36), bY + 34 * H];
      const ankle: [number, number] = [sg * (legX + 20), bY + 92 * H];
      legEls.push(drawBackLeg([hip, knee, ankle], sg, 'leg' + sg));
      legEls.push(drawKneeCrease(knee[0], knee[1], 'kn' + sg, 0.42));
      legEls.push(drawBackShoe(ankle[0], ankle[1], 'sh' + sg, sg * 16));
    }
  } else if (legs === 'jump') {
    for (const sg of [-1, 1]) {
      const hip: [number, number] = [sg * legX, bY + 8];
      const knee: [number, number] = [sg * (legX + 18), bY + 26 * H];
      const ankle: [number, number] = [sg * (legX + 8), bY + 76 * H];
      legEls.push(drawBackLeg([hip, knee, ankle], sg, 'leg' + sg));
      legEls.push(drawKneeCrease(knee[0], knee[1], 'kn' + sg, 0.4));
      legEls.push(drawBackShoe(ankle[0], ankle[1], 'sh' + sg, sg * 18));
    }
  } else if (legs === 'fall') {
    for (const sg of [-1, 1]) {
      const kick = Math.sin(t * 18 + (sg > 0 ? 1.4 : 0)) * 14;
      const asym = sg > 0 ? -16 : 12;
      const hip: [number, number] = [sg * legX, bY + 8];
      const knee: [number, number] = [sg * (legX + 26) + sg * kick * 0.5, bY + 28 * H + asym * 0.8 + kick * 0.4];
      const ankle: [number, number] = [sg * (legX + 46) + sg * kick, bY + 74 * H + asym * 1.4 + kick];
      legEls.push(drawBackLeg([hip, knee, ankle], sg, 'leg' + sg));
      legEls.push(drawKneeCrease(knee[0], knee[1], 'kn' + sg, 0.38));
      legEls.push(drawBackShoe(ankle[0], ankle[1], 'sh' + sg, sg * (28 + kick)));
    }
    legEls.push(
      <L key="fm1" d={`M${-legX - 72} ${bY + 30}q-18 24 4 46`} w={4} o={0.35} />,
      <L key="fm2" d={`M${legX + 74} ${bY + 12}q18 22 -4 44`} w={4} o={0.35} />,
    );
  } else if (legs === 'push') {
    const fHip: [number, number] = [legX, bY + 8];
    const fKnee: [number, number] = [legX + 24, bY + 52 * H];
    const fAnkle: [number, number] = [legX + 14, -18];
    const bHip: [number, number] = [-legX, bY + 8];
    const bKnee: [number, number] = [-legX - 32, bY + 74 * H];
    const bAnkle: [number, number] = [-legX - 58, -18];
    legEls.push(drawBackLeg([bHip, bKnee, bAnkle], -1, 'leg-1'));
    legEls.push(drawKneeCrease(bKnee[0], bKnee[1], 'kn-1', 0.38));
    legEls.push(drawBackShoe(bAnkle[0], bAnkle[1], 'sh-1', -12));
    legEls.push(drawBackLeg([fHip, fKnee, fAnkle], 1, 'leg1'));
    legEls.push(drawKneeCrease(fKnee[0], fKnee[1], 'kn1', 0.42));
    legEls.push(drawBackShoe(fAnkle[0], fAnkle[1], 'sh1', 4));
  } else if (legs === 'climb') {
    for (const sg of [-1, 1]) {
      const cyc = Math.sin(t * 7) * sg;
      const lift = (cyc * 0.5 + 0.5) * 56 * H;
      const hip: [number, number] = [sg * legX, bY + 8];
      const knee: [number, number] = [sg * (legX + 16 + (cyc > 0 ? 10 : 0)), bY + 42 * H - lift * 0.55];
      const ankle: [number, number] = [sg * (legX + 8), -18 - lift * 0.75];
      legEls.push(drawBackLeg([hip, knee, ankle], sg, 'leg' + sg));
      legEls.push(drawKneeCrease(knee[0], knee[1], 'kn' + sg, 0.42));
      legEls.push(drawBackShoe(ankle[0], ankle[1], 'sh' + sg, sg * (cyc > 0 ? 14 : -4)));
    }
  }

  // --- thân nhìn từ sau với đường cong cột sống hữu cơ ---
  const long = look.top === 'robe' || look.top === 'aothe' || look.top === 'furCoat' || g;
  const hemY = long ? (g ? bY + 40 : -40) : bY + 26;
  const hemW = long ? ww + 36 : ww + 4;
  const torso = curvedTorsoPath(-sw, sw, -hemW, hemW, sY, hemY, bendX, 0);
  const topC = g ? 'ghostDeep' : look.topC;

  const pattern: React.ReactNode[] = [];
  if (look.pattern === 'dots' || look.pattern === 'flowers') {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 6; c++) {
        const px = -sw + shShift * 0.5 + 18 + c * ((2 * sw) / 5.5) + (r % 2) * 14;
        const py = sY + 4 + r * 26;
        if (py > hemY - 12 || Math.abs(px - shShift * 0.5) > sw + belly * 30) continue;
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
  const sx0 = shShift;
  if (look.top === 'shirt' || look.top === 'polo' || look.top === 'uniform') {
    // cổ áo vòng sau gáy + đường cầu vai ngang lưng
    backDet.push(<S key="bc" d={`M${sx0 - 34} ${sY - 22}Q${sx0} ${sY - 12} ${sx0 + 34} ${sY - 22}L${sx0 + 36} ${sY - 6}Q${sx0} ${sY + 6} ${sx0 - 36} ${sY - 6}Z`} f={look.top === 'polo' ? c2 : topC} />);
    backDet.push(<L key="yk" d={`M${-sw + sx0 + 14} ${sY + 26}Q${sx0} ${sY + 34} ${sw + sx0 - 14} ${sY + 26}`} w={3.5} o={0.42} />);
    backDet.push(<L key="pl" d={`M${sx0} ${sY + 30}v22`} w={3.5} o={0.38} />);
    if (look.top === 'uniform') {
      backDet.push(<S key="ep1" d={Rr(-sw + sx0 - 2, sY - 8, 44, 14, 6)} f="gold" />, <S key="ep2" d={Rr(sw + sx0 - 42, sY - 8, 44, 14, 6)} f="gold" />);
    }
  } else if (look.top === 'suit') {
    backDet.push(<S key="bc" d={`M${sx0 - 34} ${sY - 22}Q${sx0} ${sY - 12} ${sx0 + 34} ${sY - 22}L${sx0 + 38} ${sY - 6}Q${sx0} ${sY + 6} ${sx0 - 38} ${sY - 6}Z`} f={topC} />);
    backDet.push(<L key="sm" d={`M${sx0} ${sY + 2}L0 ${hemY - 34}`} w={3.5} o={0.45} />);
    backDet.push(<L key="vt" d={`M0 ${hemY - 34}V${hemY}`} w={LINE} />);
    backDet.push(<L key="d1" d={`M${-sw * 0.42 + sx0} ${sY + 46}Q${-ww * 0.46 + sx0 * 0.4} ${(sY + hemY) * 0.5} ${-ww * 0.42} ${hemY - 16}`} w={3} o={0.3} />);
    backDet.push(<L key="d2" d={`M${sw * 0.42 + sx0} ${sY + 46}Q${ww * 0.46 + sx0 * 0.4} ${(sY + hemY) * 0.5} ${ww * 0.42} ${hemY - 16}`} w={3} o={0.3} />);
  } else if (look.top === 'chef') {
    // nút thắt khăn đỏ sau gáy + 2 đuôi khăn
    backDet.push(<S key="nk" d={Rr(sx0 - 38, sY - 24, 76, 18, 7)} f="red" />);
    backDet.push(<S key="nt1" d={`M${sx0 - 6} ${sY - 8}L${sx0 - 22} ${sY + 34}L${sx0 - 4} ${sY + 28}Z`} f="red" />);
    backDet.push(<S key="nt2" d={`M${sx0 + 6} ${sY - 8}L${sx0 + 24} ${sY + 32}L${sx0 + 6} ${sY + 28}Z`} f="red" />);
    backDet.push(<S key="nk0" d={E(sx0, sY - 10, 12, 10)} f="redDark" />);
  } else if (look.top === 'robe') {
    backDet.push(<S key="bc" d={`M${sx0 - 34} ${sY - 20}Q${sx0} ${sY - 8} ${sx0 + 34} ${sY - 20}L${sx0 + 36} ${sY - 4}Q${sx0} ${sY + 8} ${sx0 - 36} ${sY - 4}Z`} f={c2} />);
    backDet.push(<S key="belt" d={R(-ww - 6, bY - 40, 2 * ww + 12, 22)} f={c2} />);
    backDet.push(<S key="bk1" d={`M-6 ${bY - 20}L-26 ${bY + 32}L-6 ${bY + 26}Z`} f={c2} />);
    backDet.push(<S key="bk2" d={`M6 ${bY - 20}L28 ${bY + 30}L8 ${bY + 26}Z`} f={c2} />);
    backDet.push(<S key="bk0" d={Rr(-14, bY - 42, 28, 26, 8)} f={c2} />);
  } else if (look.top === 'furCoat') {
    const fc = look.topC2 ?? 'gold';
    const colW = sw * 0.74;
    backDet.push(<S key="fc" d={furCollarD(sx0 - colW, sx0 + colW, sx0, sY - 8, sY - 20, 32, 5)} f="paper" sw={4.5} />);
    backDet.push(<L key="fct" d={`M${(sx0 - colW * 0.5).toFixed(1)} ${sY + 2}q8 5 16 0M${(sx0 + colW * 0.3).toFixed(1)} ${sY + 2}q8 5 16 0`} w={3} o={0.34} />);
    backDet.push(<L key="sm" d={`M${sx0} ${sY + 12}L0 ${hemY - 24}`} w={3.5} o={0.35} />);
    const beltL = -(sw + hemW) * 0.5 - 3;
    const beltR = (sw + hemW) * 0.5 + 3;
    backDet.push(...furSashNodes('fs', beltL, beltR, null, bY, fc));
    backDet.push(<S key="bk1" d={`M-6 ${bY - 18}L-24 ${bY + 30}L-6 ${bY + 24}Z`} f={fc} />);
    backDet.push(<S key="bk2" d={`M6 ${bY - 18}L26 ${bY + 28}L8 ${bY + 24}Z`} f={fc} />);
    backDet.push(<S key="bk0" d={Rr(-14, bY - 44, 28, 28, 8)} f={fc} />);
    backDet.push(<S key="fh" d={furBandD(-hemW - 5, hemW + 5, hemY - 26, 34, 7, 6)} f="paper" sw={4.5} />);
  } else if (look.top === 'aothe') {
    backDet.push(<S key="n" d={Rr(sx0 - 30, sY - 30, 60, 20, 8)} f={c2} />);
    backDet.push(<L key="sm" d={`M${sx0} ${sY - 10}L0 ${hemY - 12}`} w={3.5} o={0.35} />);
  } else if (look.top === 'blouse') {
    backDet.push(<S key="v" d={`M${sx0 - 30} ${sY - 18}Q${sx0} ${sY + 10} ${sx0 + 30} ${sY - 18}Z`} f={skin} />);
    backDet.push(<L key="kh" d={`M${sx0} ${sY - 2}v16`} w={4} />);
    backDet.push(<circle key="kb" cx={sx0} cy={sY + 2} r={4} fill={PAL.ink} />);
  } else if (look.top === 'tank') {
    backDet.push(<S key="nk" d={`M${sx0 - 38} ${sY - 18}Q${sx0} ${sY + 34} ${sx0 + 38} ${sY - 18}Z`} f={skin} />);
  } else if (look.top === 'tee') {
    backDet.push(<L key="nk" d={`M${sx0 - 30} ${sY - 16}Q${sx0} ${sY - 2} ${sx0 + 30} ${sY - 16}`} w={4.5} />);
  }
  if (look.chain) backDet.push(<path key="ch" d={`M${sx0 - 24} ${sY - 22}Q${sx0} ${sY - 12} ${sx0 + 24} ${sY - 22}`} fill="none" stroke={PAL.gold} strokeWidth={6} strokeDasharray="2 8" strokeLinecap="round" />);
  if (look.vest) {
    backDet.push(<S key="vb" d={`M${-sw + sx0 + 6} ${sY + 4}L${sx0 - 30} ${sY - 10}L${sx0 + 30} ${sY - 10}L${sw + sx0 - 6} ${sY + 4}L${ww + 4} ${bY + 20}L${-ww - 4} ${bY + 20}Z`} f="orange" />);
    backDet.push(<rect key="v3" x={-ww - 6} y={bY - 70} width={2 * ww + 12} height={16} fill={PAL.trim} stroke={PAL.ink} strokeWidth={3} />);
    backDet.push(<rect key="v4" x={-ww - 6} y={bY - 30} width={2 * ww + 12} height={16} fill={PAL.trim} stroke={PAL.ink} strokeWidth={3} />);
  }

  // --- ma: đuôi khói; người thường: nhịp bước + squash/stretch + pitch + thở nhẹ ---
  const modeBob =
    legs === 'walk' ? Math.abs(Math.sin(t * 9)) * 7 :
    legs === 'run' ? Math.abs(Math.sin(t * 14)) * 16 :
    legs === 'ride' ? Math.sin(t * 6) * 4 :
    legs === 'jump' ? Math.sin(t * 8) * 5 :
    legs === 'climb' ? Math.abs(Math.sin(t * 7)) * 6 : 0;
  const bob = g ? Math.sin(t * 2.2 + blinkPh) * 10 : (pose.hop ?? 0) + modeBob;
  const breath = idle.breathe * 0.008;
  const sq = Math.max(0.5, (pose.squash ?? 1) + breath);
  const sxSq = 1 / Math.sqrt(sq);
  const tail = g ? (
    <g>
      <path d={`M${-hemW} ${hemY - 4}C${-hemW + 20} ${hemY + 60} ${-30} ${hemY + 40} ${-10 + Math.sin(t * 2) * 14} ${hemY + 130}C${40} ${hemY + 60} ${hemW - 10} ${hemY + 50} ${hemW} ${hemY - 4}Z`} fill={PAL.ghost} stroke={PAL.ink} strokeWidth={LINE} opacity={0.85} />
      <Smoke x={-10} y={hemY + 150} t={t} h={60} w={10} o={0.5} />
    </g>
  ) : null;

  const totalLean = (pose.lean ?? 0) + lean + (pose.pitch ?? 0);

  // --- chuyển động thứ cấp: gió tóc + độ trễ lắc đầu nhẹ (cho OTS sống động) ---
  const hw = hairWindOffset(t, wind + (legs === 'run' ? 0.9 : 0), velX, blinkPh);
  const headLag =
    (legs === 'run' ? Math.sin(t * 14 - 0.9) * 3.0 :
    legs === 'walk' ? Math.sin(t * 9 - 0.85) * 1.8 :
    legs === 'ride' ? Math.sin(t * 6 - 0.8) * 2.2 :
    legs === 'fall' ? Math.sin(t * 18 - 0.6) * 4.5 :
    legs === 'climb' ? Math.sin(t * 7 - 0.7) * 2.0 : 0) + idle.headTilt;

  const showFar = layer !== 'near';
  const showNear = layer !== 'far';

  return (
    <g transform={`translate(0 ${(-bob).toFixed(1)}) rotate(${totalLean.toFixed(2)} 0 ${bY.toFixed(1)}) scale(${sxSq.toFixed(4)} ${sq.toFixed(4)})`} opacity={g ? 0.93 : 1}>
      {showNear && g && <ellipse cx={0} cy={hyy} rx={HR * 3.2} ry={HR * 4} fill="url(#glowG)" />}
      {showFar && propBack?.(hands)}
      {showFar && lBehind && drawArm(lp, 'la', true)}
      {showFar && rBehind && drawArm(rp, 'ra', true)}
      {showFar && lBehind && drawHand(hands.l, 'hl')}
      {showFar && rBehind && drawHand(hands.r, 'hr')}
      {showNear && legEls}
      {showNear && tail}
      {showNear && (
        <>
          <S d={torso} f={topC} />
          <clipPath id={`tb-${look.name}`}><path d={torso} /></clipPath>
          <g clipPath={`url(#tb-${look.name})`}>
            {pattern}
            {/* bóng chấm riso cạnh phải + gờ eo tạo khối lưng tròn */}
            <Sh d={`M${sw * 0.34 + sx0} ${sY - 30}L${sw + sx0 + 60} ${sY - 30}L${hemW + 60} ${hemY + 10}L${hemW * 0.42} ${hemY + 10}Z`} o={0.58} />
            <Sh d={`M${-hemW - 20} ${hemY - 34}L${hemW + 20} ${hemY - 34}L${hemW + 20} ${hemY + 10}L${-hemW - 20} ${hemY + 10}Z`} o={0.28} />
          </g>
          {/* gáy cổ */}
          <S d={R(-20 + sx0, sY - 44, 40, 34)} f={g ? 'ghost' : 'skinShade'} />
          {backDet}
          {!lBehind && drawArm(lp, 'la')}
          {!rBehind && drawArm(rp, 'ra')}
          {prop?.(hands)}
          {!lBehind && drawHand(hands.l, 'hl')}
          {!rBehind && drawHand(hands.r, 'hr')}
          {/* đầu sau vẽ sau cùng để tóc dài / gáy phủ tự nhiên lên vai */}
          <HeadBack look={look} hy={hyy} R={HR} gaze={gaze} t={t} wind={wind} velX={velX} hw={hw} headLag={headLag} shShift={sx0} />
        </>
      )}
    </g>
  );
};

const HeadBack: React.FC<{
  look: Look;
  hy: number;
  R: number;
  gaze: number;
  t?: number;
  wind?: number;
  velX?: number;
  hw?: {dx: number; dy: number; rot: number};
  headLag?: number;
  shShift?: number;
}> = ({
  look,
  hy,
  R: r,
  gaze,
  t = 0,
  wind = 0,
  velX = 0,
  hw = {dx: 0, dy: 0, rot: 0},
  headLag = 0,
  shShift = 0,
}) => {
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
    case 'bun': {
      // tóc búi cao gọn gàng + dây buộc tóc có nhịp lắc nhẹ theo gió / chuyển động
      hp(`${domeTop}C${r * 0.9} ${hy + r * 0.6} ${r * 0.52} ${hy + r * 0.76} 0 ${hy + r * 0.76}C${-r * 0.52} ${hy + r * 0.76} ${-r * 0.9} ${hy + r * 0.6} ${-r * 0.98} ${hy + r * 0.18}Z`, 'hd');
      els.push(<L key="up1" d={`M${-r * 0.32} ${hy + r * 0.66}Q${-r * 0.22} ${hy + r * 0.1} ${-r * 0.08} ${hy - r * 0.64}`} w={3.5} c="white" o={0.22} />);
      els.push(<L key="up2" d={`M${r * 0.32} ${hy + r * 0.66}Q${r * 0.22} ${hy + r * 0.1} ${r * 0.08} ${hy - r * 0.64}`} w={3.5} c="white" o={0.22} />);
      const bunCx = gx * 0.4;
      const bunPy = hy - r * 0.74;
      const bunDx = hw.dx * 0.16;
      const bunDy = hw.dy * 0.26 + Math.sin(t * 9.5) * (Math.abs(hw.dx) > 4 ? 2.2 : 0.6);
      const bunRot = hw.rot * 0.45;
      els.push(
        <g key="bunGrp" transform={`translate(${bunDx.toFixed(1)} ${bunDy.toFixed(1)}) rotate(${bunRot.toFixed(1)} ${bunCx.toFixed(1)} ${bunPy.toFixed(1)})`}>
          <S d={E(bunCx, hy - r * 0.96, r * 0.44, r * 0.36)} f={hairC} />
          <S d={Rr(bunCx - r * 0.3, bunPy, r * 0.6, r * 0.14, 7)} f={look.topC2 ?? 'red'} />
        </g>,
      );
      els.push(<Sh key="hsh" d={`M${r * 0.42} ${hy - r * 0.82}C${r * 0.96} ${hy - r * 0.36} ${r * 0.94} ${hy + r * 0.54} ${r * 0.36} ${hy + r * 0.74}C${r * 0.72} ${hy + r * 0.32} ${r * 0.74} ${hy - r * 0.3} ${r * 0.42} ${hy - r * 0.82}Z`} o={0.4} />);
      break;
    }
    case 'long': {
      // mái tóc dài buông phủ lưng vai thành tấm mềm có sóng gió bồng bềnh ở chân tóc
      const swayX = hw.dx * 0.88;
      const liftY = hw.dy * 0.75;
      const wAmp = 3 + Math.min(2.5, Math.abs(wind) + Math.abs(velX) / 260) * 5.2;
      const wave1 = Math.sin(t * 7.5) * wAmp;
      const wave2 = Math.cos(t * 10.2 + 0.9) * wAmp;
      const wave3 = Math.sin(t * 8.8 + 2.1) * wAmp;
      const midX = swayX * 0.52;
      const midY = liftY * 0.48;
      hp(
        `M${(-r * 1.02).toFixed(1)} ${(hy + r * 0.1).toFixed(1)}` +
        `C${(-r * 1.08).toFixed(1)} ${(hy - r * 1.4).toFixed(1)} ${(r * 1.08).toFixed(1)} ${(hy - r * 1.4).toFixed(1)} ${(r * 1.02).toFixed(1)} ${(hy + r * 0.1).toFixed(1)}` +
        `C${(r * 1.14 + midX).toFixed(1)} ${(hy + r * 0.88 + midY).toFixed(1)} ${(r * 1.04 + swayX * 0.85).toFixed(1)} ${(hy + r * 1.38 + liftY).toFixed(1)} ${(r * 0.76 + swayX).toFixed(1)} ${(hy + r * 1.54 + liftY + wave1).toFixed(1)}` +
        `Q${(r * 0.38 + swayX * 0.92).toFixed(1)} ${(hy + r * 1.44 + liftY - wave2 * 0.85).toFixed(1)} ${(swayX * 0.95).toFixed(1)} ${(hy + r * 1.58 + liftY + wave2).toFixed(1)}` +
        `Q${(-r * 0.38 + swayX * 0.92).toFixed(1)} ${(hy + r * 1.44 + liftY - wave3 * 0.85).toFixed(1)} ${(-r * 0.76 + swayX).toFixed(1)} ${(hy + r * 1.54 + liftY + wave3).toFixed(1)}` +
        `C${(-r * 1.04 + swayX * 0.85).toFixed(1)} ${(hy + r * 1.38 + liftY).toFixed(1)} ${(-r * 1.14 + midX).toFixed(1)} ${(hy + r * 0.88 + midY).toFixed(1)} ${(-r * 1.02).toFixed(1)} ${(hy + r * 0.1).toFixed(1)}Z`,
        'hlg',
      );
      els.push(<L key="hl1" d={`M${-r * 0.54} ${hy - r * 0.8}q${r * 0.28} ${-r * 0.14} ${r * 0.56} ${-r * 0.06}`} w={6} c="white" o={0.34} />);
      els.push(<L key="hl2" d={`M${(-r * 0.42).toFixed(1)} ${(hy + r * 0.12).toFixed(1)}C${(-r * 0.46 + midX * 0.5).toFixed(1)} ${(hy + r * 0.65 + midY * 0.5).toFixed(1)} ${(-r * 0.42 + swayX * 0.75).toFixed(1)} ${(hy + r * 1.08 + liftY * 0.75).toFixed(1)} ${(-r * 0.36 + swayX * 0.92).toFixed(1)} ${(hy + r * 1.38 + liftY + wave3 * 0.5).toFixed(1)}`} w={4.5} c="white" o={0.24} />);
      els.push(<L key="hl3" d={`M${(r * 0.24).toFixed(1)} ${(hy + r * 0.18).toFixed(1)}C${(r * 0.28 + midX * 0.5).toFixed(1)} ${(hy + r * 0.65 + midY * 0.5).toFixed(1)} ${(r * 0.26 + swayX * 0.75).toFixed(1)} ${(hy + r * 1.08 + liftY * 0.75).toFixed(1)} ${(r * 0.22 + swayX * 0.92).toFixed(1)} ${(hy + r * 1.38 + liftY + wave1 * 0.5).toFixed(1)}`} w={4} c="white" o={0.2} />);
      els.push(<Sh key="hsh" d={`M${(r * 0.38).toFixed(1)} ${(hy - r * 0.84).toFixed(1)}C${(r * 1.06).toFixed(1)} ${(hy - r * 0.36).toFixed(1)} ${(r * 1.1 + midX).toFixed(1)} ${(hy + r * 0.96 + midY).toFixed(1)} ${(r * 0.72 + swayX).toFixed(1)} ${(hy + r * 1.5 + liftY + wave1).toFixed(1)}L${(r * 0.34 + swayX * 0.92).toFixed(1)} ${(hy + r * 1.48 + liftY + wave2 * 0.5).toFixed(1)}C${(r * 0.68 + midX * 0.7).toFixed(1)} ${(hy + r * 0.94 + midY * 0.7).toFixed(1)} ${(r * 0.7).toFixed(1)} ${(hy - r * 0.26).toFixed(1)} ${(r * 0.38).toFixed(1)} ${(hy - r * 0.84).toFixed(1)}Z`} o={0.44} />);
      break;
    }
    case 'curly':
      // khối tóc xoăn xù đầy đặn phủ trọn sau đầu
      hp(`${domeTop}C${r * 0.94} ${hy + r * 0.68} ${r * 0.56} ${hy + r * 0.84} 0 ${hy + r * 0.84}C${-r * 0.56} ${hy + r * 0.84} ${-r * 0.94} ${hy + r * 0.68} ${-r * 0.98} ${hy + r * 0.18}Z`, 'hcb');
      for (let i = 0; i < 11; i++) {
        const a = Math.PI * (0.72 + (i / 10) * 1.56);
        els.push(<S key={'cu' + i} d={E(Math.cos(a) * r * 0.92 + hw.dx * 0.1, hy + Math.sin(a) * r * 0.88 - r * 0.04 + hw.dy * 0.08, r * 0.34, r * 0.34)} f={hairC} />);
      }
      els.push(<L key="cc1" d={`M${-r * 0.42} ${hy - r * 0.36}a${r * 0.22} ${r * 0.22} 0 1 1 ${r * 0.34} ${r * 0.06}`} w={4} c="white" o={0.22} />);
      els.push(<L key="cc2" d={`M${r * 0.1} ${hy + r * 0.1}a${r * 0.2} ${r * 0.2} 0 1 1 ${r * 0.3} ${r * 0.08}`} w={4} c="white" o={0.2} />);
      els.push(<Sh key="hsh" d={`M${r * 0.36} ${hy - r * 0.74}C${r * 1.0} ${hy - r * 0.3} ${r * 1.0} ${hy + r * 0.62} ${r * 0.32} ${hy + r * 0.86}C${r * 0.68} ${hy + r * 0.44} ${r * 0.72} ${hy - r * 0.22} ${r * 0.36} ${hy - r * 0.74}Z`} o={0.42} />);
      break;
    case 'short':
    case 'kid':
      // mái vòm tròn phủ gáy có răng cưa mềm ở chân tóc + chỏm tóc nhí (kid) đung đưa theo gió
      hp(`${domeTop}C${r * 0.92} ${hy + r * 0.52} ${r * 0.72} ${hy + r * 0.68} ${r * 0.5} ${hy + r * 0.72}Q${r * 0.34} ${hy + r * 0.84} ${r * 0.2} ${hy + r * 0.74}Q0 ${hy + r * 0.88} ${-r * 0.2} ${hy + r * 0.74}Q${-r * 0.34} ${hy + r * 0.84} ${-r * 0.5} ${hy + r * 0.72}C${-r * 0.72} ${hy + r * 0.68} ${-r * 0.92} ${hy + r * 0.52} ${-r * 0.98} ${hy + r * 0.18}Z`, 'hs');
      if (look.hair === 'kid') {
        els.push(
          <g key="cow" transform={`rotate(${(hw.rot * 0.85).toFixed(1)} 0 ${(hy - r * 0.98).toFixed(1)})`}>
            <S d={`M${-r * 0.14} ${hy - r * 1.02}C${-r * 0.04} ${hy - r * 1.32} ${r * 0.18} ${hy - r * 1.32} ${r * 0.24} ${hy - r * 1.14}C${r * 0.12} ${hy - r * 1.12} ${r * 0.08} ${hy - r * 1.0} ${r * 0.06} ${hy - r * 0.96}Z`} f={hairC} />
          </g>,
        );
      }
      els.push(<L key="hl" d={`M${-r * 0.48} ${hy - r * 0.82}q${r * 0.28} ${-r * 0.14} ${r * 0.56} ${-r * 0.04}`} w={6} c="white" o={0.34} />);
      els.push(<Sh key="hsh" d={`M${r * 0.42} ${hy - r * 0.82}C${r * 0.96} ${hy - r * 0.36} ${r * 0.94} ${hy + r * 0.52} ${r * 0.36} ${hy + r * 0.74}C${r * 0.7} ${hy + r * 0.34} ${r * 0.74} ${hy - r * 0.3} ${r * 0.42} ${hy - r * 0.82}Z`} o={0.42} />);
      break;
    case 'spiky':
    case 'spikyUp':
      // tóc Nhím nhìn từ phía sau: chỏm gai nhọn bùng đều hai bên đỉnh & gáy (khi đội mũ chéo, gai bên trái vểnh lộ dưới vành nâng)
      hp(
        look.hat === 'furHatTilted' || look.hat === 'beanieTilted'
          ? `M${-r * 0.98} ${hy + r * 0.22}L${-r * 1.24} ${hy - r * 0.18}L${-r * 1.06} ${hy - r * 0.42}L${-r * 1.32} ${hy - r * 0.86}L${-r * 0.86} ${hy - r * 0.98}L${-r * 0.74} ${hy - r * 1.44}L${-r * 0.3} ${hy - r * 1.18}L${-r * 0.06} ${hy - r * 1.42}C${r * 0.54} ${hy - r * 1.22} ${r * 1.08} ${hy - r * 0.72} ${r * 0.98} ${hy + r * 0.22}C${r * 0.84} ${hy + r * 0.6} ${r * 0.46} ${hy + r * 0.74} 0 ${hy + r * 0.74}C${-r * 0.46} ${hy + r * 0.74} ${-r * 0.84} ${hy + r * 0.6} ${-r * 0.98} ${hy + r * 0.22}Z`
          : `M${-r * 0.98} ${hy + r * 0.22}L${-r * 1.24} ${hy - r * 0.18}L${-r * 1.06} ${hy - r * 0.42}L${-r * 1.32} ${hy - r * 0.86}L${-r * 0.86} ${hy - r * 0.98}L${-r * 0.74} ${hy - r * 1.44}L${-r * 0.3} ${hy - r * 1.18}L0 ${hy - r * 1.56}L${r * 0.3} ${hy - r * 1.18}L${r * 0.74} ${hy - r * 1.44}L${r * 0.86} ${hy - r * 0.98}L${r * 1.32} ${hy - r * 0.86}L${r * 1.06} ${hy - r * 0.42}L${r * 1.24} ${hy - r * 0.18}L${r * 0.98} ${hy + r * 0.22}C${r * 0.84} ${hy + r * 0.6} ${r * 0.46} ${hy + r * 0.74} 0 ${hy + r * 0.74}C${-r * 0.46} ${hy + r * 0.74} ${-r * 0.84} ${hy + r * 0.6} ${-r * 0.98} ${hy + r * 0.22}Z`,
        'hs',
      );
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
  } else if (hat === 'capBack') {
    // mũ đội ngược nhìn từ sau: vành lưỡi trai hướng thẳng về phía người xem
    els.push(<S key="cap" d={`M${-r * 0.92} ${hy - r * 0.36}C${-r * 0.98} ${hy - r * 1.2} ${r * 0.98} ${hy - r * 1.2} ${r * 0.92} ${hy - r * 0.36}Z`} f={hatC} />);
    els.push(<S key="capb" d={`M${-r * 0.94} ${hy - r * 0.38}Q0 ${hy - r * 0.14} ${r * 0.94} ${hy - r * 0.38}L${r * 0.84} ${hy - r * 0.16}Q0 ${hy + r * 0.08} ${-r * 0.84} ${hy - r * 0.16}Z`} f={hatC} />);
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
    const rbX = hw.dx * 0.45;
    const rbY = hw.dy * 0.35;
    els.push(<S key="bd" d={R(-r * 0.96, hy - r * 0.58, r * 1.92, r * 0.24)} f={hatC} />);
    els.push(<S key="bdt1" d={`M-6 ${hy - r * 0.42}L${(-22 + rbX).toFixed(1)} ${(hy - r * 0.04 + rbY).toFixed(1)}L${(-4 + rbX * 0.7).toFixed(1)} ${(hy - r * 0.1 + rbY * 0.7).toFixed(1)}Z`} f={hatC} />);
    els.push(<S key="bdt2" d={`M6 ${hy - r * 0.42}L${(24 + rbX).toFixed(1)} ${(hy - r * 0.06 + rbY).toFixed(1)}L${(6 + rbX * 0.7).toFixed(1)} ${(hy - r * 0.1 + rbY * 0.7).toFixed(1)}Z`} f={hatC} />);
    els.push(<S key="bdk" d={E(0, hy - r * 0.46, 12, 11)} f={hatC} />);
  } else if (hat === 'furHat') {
    for (const sg of [-1, 1]) {
      els.push(
        <S key={'fhe' + sg} d={`M${(sg * r * 0.86).toFixed(1)} ${(hy - r * 0.44).toFixed(1)}C${(sg * r * 1.2).toFixed(1)} ${(hy - r * 0.08).toFixed(1)} ${(sg * r * 1.18).toFixed(1)} ${(hy + r * 0.36).toFixed(1)} ${(sg * r * 1.04).toFixed(1)} ${(hy + r * 0.56).toFixed(1)}C${(sg * r * 0.86).toFixed(1)} ${(hy + r * 0.52).toFixed(1)} ${(sg * r * 0.84).toFixed(1)} ${(hy + r * 0.14).toFixed(1)} ${(sg * r * 0.84).toFixed(1)} ${(hy - r * 0.44).toFixed(1)}Z`} f={hatC} />,
        <S key={'fhp' + sg} d={E(sg * r * 1.0, hy + r * 0.46, r * 0.14, r * 0.17)} f="paper" sw={4} />,
      );
    }
    els.push(
      <S key="fhc" d={`M${(-r * 0.96).toFixed(1)} ${(hy - r * 0.54).toFixed(1)}C${(-r * 0.98).toFixed(1)} ${(hy - r * 1.2).toFixed(1)} ${(-r * 0.36).toFixed(1)} ${(hy - r * 1.46).toFixed(1)} 0 ${(hy - r * 1.5).toFixed(1)}C${(r * 0.36).toFixed(1)} ${(hy - r * 1.46).toFixed(1)} ${(r * 0.98).toFixed(1)} ${(hy - r * 1.2).toFixed(1)} ${(r * 0.96).toFixed(1)} ${(hy - r * 0.54).toFixed(1)}Z`} f={hatC} />,
      <Sh key="fhsh" d={`M${(r * 0.28).toFixed(1)} ${(hy - r * 1.38).toFixed(1)}C${(r * 0.88).toFixed(1)} ${(hy - r * 1.16).toFixed(1)} ${(r * 0.96).toFixed(1)} ${(hy - r * 0.7).toFixed(1)} ${(r * 0.94).toFixed(1)} ${(hy - r * 0.54).toFixed(1)}L${(r * 0.42).toFixed(1)} ${(hy - r * 0.54).toFixed(1)}C${(r * 0.52).toFixed(1)} ${(hy - r * 0.88).toFixed(1)} ${(r * 0.46).toFixed(1)} ${(hy - r * 1.18).toFixed(1)} ${(r * 0.28).toFixed(1)} ${(hy - r * 1.38).toFixed(1)}Z`} o={0.36} />,
      <L key="fhs1" d={`M0 ${(hy - r * 1.46).toFixed(1)}Q${(-r * 0.34).toFixed(1)} ${(hy - r * 1.08).toFixed(1)} ${(-r * 0.42).toFixed(1)} ${(hy - r * 0.62).toFixed(1)}`} w={3.5} o={0.35} />,
      <L key="fhs2" d={`M0 ${(hy - r * 1.46).toFixed(1)}Q${(r * 0.34).toFixed(1)} ${(hy - r * 1.08).toFixed(1)} ${(r * 0.42).toFixed(1)} ${(hy - r * 0.62).toFixed(1)}`} w={3.5} o={0.35} />,
      <S key="fht" d={`M0 ${(hy - r * 1.52).toFixed(1)}Q${(r * 0.24).toFixed(1)} ${(hy - r * 1.54).toFixed(1)} ${(r * 0.3).toFixed(1)} ${(hy - r * 1.32).toFixed(1)}Q${(r * 0.14).toFixed(1)} ${(hy - r * 1.36).toFixed(1)} 0 ${(hy - r * 1.46).toFixed(1)}Z`} f={hatC === 'redDark' || hatC === 'red' ? 'gold' : 'red'} sw={3.5} />,
      <S key="fhf" d={E(0, hy - r * 1.52, r * 0.1, r * 0.09)} f="gold" sw={4} />,
      <S key="fhb" d={furBandD(-r * 1.02, r * 1.02, hy - r * 0.64, r * 0.28, 6, r * 0.05)} f="paper" sw={4.5} />,
      <L key="fhbt" d={`M${(-r * 0.46).toFixed(1)} ${(hy - r * 0.48).toFixed(1)}q8 4 16 0M${(r * 0.26).toFixed(1)} ${(hy - r * 0.48).toFixed(1)}q8 4 16 0`} w={3} o={0.32} />,
    );
  } else if (hat === 'furHatTilted') {
    // nhìn từ phía sau: nghiêng +14° (khớp góc chéo -14° ở chính diện)
    const ftC = look.hatC ?? 'red';
    els.push(
      <g key="fht_grp" transform={`rotate(14 ${(r * 0.04).toFixed(1)} ${(hy - r * 0.74).toFixed(1)})`}>
        <S key="fhteL" d={`M${(-r * 0.86).toFixed(1)} ${(hy - r * 0.56).toFixed(1)}C${(-r * 1.18).toFixed(1)} ${(hy - r * 0.22).toFixed(1)} ${(-r * 1.18).toFixed(1)} ${(hy + r * 0.16).toFixed(1)} ${(-r * 1.02).toFixed(1)} ${(hy + r * 0.34).toFixed(1)}C${(-r * 0.86).toFixed(1)} ${(hy + r * 0.32).toFixed(1)} ${(-r * 0.8).toFixed(1)} ${(hy - r * 0.02).toFixed(1)} ${(-r * 0.78).toFixed(1)} ${(hy - r * 0.52).toFixed(1)}Z`} f={ftC} />
        <S key="fhtpL" d={E(-r * 0.99, hy + r * 0.26, r * 0.14, r * 0.15)} f="paper" sw={4} />
        <L key="fhtcLo" d={`M${(-r * 1.0).toFixed(1)} ${(hy + r * 0.39).toFixed(1)}Q${(-r * 1.06).toFixed(1)} ${(hy + r * 0.54).toFixed(1)} ${(-r * 1.08).toFixed(1)} ${(hy + r * 0.64).toFixed(1)}`} w={6.5} c="ink" />
        <L key="fhtcL" d={`M${(-r * 1.0).toFixed(1)} ${(hy + r * 0.39).toFixed(1)}Q${(-r * 1.06).toFixed(1)} ${(hy + r * 0.54).toFixed(1)} ${(-r * 1.08).toFixed(1)} ${(hy + r * 0.64).toFixed(1)}`} w={3} c="gold" />
        <S key="fhtbL" d={E(-r * 1.09, hy + r * 0.68, r * 0.085, r * 0.085)} f="gold" sw={3.5} />
        <S key="fhteR" d={`M${(r * 0.98).toFixed(1)} ${(hy - r * 0.56).toFixed(1)}C${(r * 1.24).toFixed(1)} ${(hy - r * 0.18).toFixed(1)} ${(r * 1.24).toFixed(1)} ${(hy + r * 0.24).toFixed(1)} ${(r * 1.08).toFixed(1)} ${(hy + r * 0.44).toFixed(1)}C${(r * 0.9).toFixed(1)} ${(hy + r * 0.42).toFixed(1)} ${(r * 0.84).toFixed(1)} ${(hy + r * 0.06).toFixed(1)} ${(r * 0.84).toFixed(1)} ${(hy - r * 0.52).toFixed(1)}Z`} f={ftC} />
        <S key="fhtpR" d={E(r * 1.05, hy + r * 0.36, r * 0.16, r * 0.17)} f="paper" sw={4} />
        <L key="fhtcRo" d={`M${(r * 1.05).toFixed(1)} ${(hy + r * 0.5).toFixed(1)}Q${(r * 0.98).toFixed(1)} ${(hy + r * 0.66).toFixed(1)} ${(r * 0.95).toFixed(1)} ${(hy + r * 0.78).toFixed(1)}`} w={6.5} c="ink" />
        <L key="fhtcR" d={`M${(r * 1.05).toFixed(1)} ${(hy + r * 0.5).toFixed(1)}Q${(r * 0.98).toFixed(1)} ${(hy + r * 0.66).toFixed(1)} ${(r * 0.95).toFixed(1)} ${(hy + r * 0.78).toFixed(1)}`} w={3} c="gold" />
        <S key="fhtbR" d={E(r * 0.94, hy + r * 0.82, r * 0.09, r * 0.09)} f="gold" sw={3.5} />
        <S key="fhtc" d={`M${(-r * 0.98).toFixed(1)} ${(hy - r * 0.66).toFixed(1)}C${(-r * 1.04).toFixed(1)} ${(hy - r * 1.26).toFixed(1)} ${(-r * 0.44).toFixed(1)} ${(hy - r * 1.50).toFixed(1)} 0 ${(hy - r * 1.52).toFixed(1)}C${(r * 0.44).toFixed(1)} ${(hy - r * 1.50).toFixed(1)} ${(r * 1.06).toFixed(1)} ${(hy - r * 1.28).toFixed(1)} ${(r * 1.0).toFixed(1)} ${(hy - r * 0.66).toFixed(1)}Z`} f={ftC} />
        <Sh key="fhtsh" d={`M${(r * 0.28).toFixed(1)} ${(hy - r * 1.44).toFixed(1)}C${(r * 0.9).toFixed(1)} ${(hy - r * 1.22).toFixed(1)} ${(r * 1.0).toFixed(1)} ${(hy - r * 0.8).toFixed(1)} ${(r * 0.98).toFixed(1)} ${(hy - r * 0.66).toFixed(1)}L${(r * 0.44).toFixed(1)} ${(hy - r * 0.66).toFixed(1)}C${(r * 0.56).toFixed(1)} ${(hy - r * 0.96).toFixed(1)} ${(r * 0.48).toFixed(1)} ${(hy - r * 1.24).toFixed(1)} ${(r * 0.28).toFixed(1)} ${(hy - r * 1.44).toFixed(1)}Z`} o={0.36} />
        <L key="fhts1" d={`M0 ${(hy - r * 1.48).toFixed(1)}Q${(-r * 0.36).toFixed(1)} ${(hy - r * 1.12).toFixed(1)} ${(-r * 0.44).toFixed(1)} ${(hy - r * 0.72).toFixed(1)}`} w={3.5} o={0.35} />
        <L key="fhts2" d={`M0 ${(hy - r * 1.48).toFixed(1)}Q${(r * 0.36).toFixed(1)} ${(hy - r * 1.12).toFixed(1)} ${(r * 0.44).toFixed(1)} ${(hy - r * 0.72).toFixed(1)}`} w={3.5} o={0.35} />
        <L key="fhthl" d={`M${(-r * 0.62).toFixed(1)} ${(hy - r * 1.16).toFixed(1)}Q${(-r * 0.36).toFixed(1)} ${(hy - r * 1.38).toFixed(1)} ${(-r * 0.08).toFixed(1)} ${(hy - r * 1.4).toFixed(1)}`} w={4.5} c="white" o={0.28} />
        <S key="fhtpom" d={E(0, hy - r * 1.54, r * 0.16, r * 0.13)} f="paper" sw={4} />
        <S key="fhtring" d={E(0, hy - r * 1.46, r * 0.06, r * 0.05)} f="gold" sw={3} />
        <S key="fhtb" d={furBandD(-r * 1.04, r * 1.06, hy - r * 0.84, r * 0.34, 6, r * 0.04)} f="paper" sw={4.5} />
        <L key="fhtbt" d={`M${(-r * 0.48).toFixed(1)} ${(hy - r * 0.66).toFixed(1)}q8 4 16 0M${(r * 0.28).toFixed(1)} ${(hy - r * 0.66).toFixed(1)}q8 4 16 0`} w={3} o={0.32} />
      </g>,
    );
  } else if (hat === 'beanieTilted') {
    // nhìn từ phía sau: nghiêng +14° (khớp góc chéo -14° ở chính diện)
    const btC = look.hatC ?? 'red';
    els.push(
      <g key="bnt_grp" transform={`rotate(14 ${(r * 0.04).toFixed(1)} ${(hy - r * 0.74).toFixed(1)})`}>
        <S key="bntc" d={`M${(-r * 0.98).toFixed(1)} ${(hy - r * 0.66).toFixed(1)}C${(-r * 1.04).toFixed(1)} ${(hy - r * 1.24).toFixed(1)} ${(-r * 0.48).toFixed(1)} ${(hy - r * 1.48).toFixed(1)} 0 ${(hy - r * 1.48).toFixed(1)}C${(r * 0.48).toFixed(1)} ${(hy - r * 1.48).toFixed(1)} ${(r * 1.04).toFixed(1)} ${(hy - r * 1.24).toFixed(1)} ${(r * 0.98).toFixed(1)} ${(hy - r * 0.66).toFixed(1)}Z`} f={btC} />
        <Sh key="bntsh" d={`M${(r * 0.28).toFixed(1)} ${(hy - r * 1.42).toFixed(1)}C${(r * 0.9).toFixed(1)} ${(hy - r * 1.2).toFixed(1)} ${(r * 1.0).toFixed(1)} ${(hy - r * 0.8).toFixed(1)} ${(r * 0.98).toFixed(1)} ${(hy - r * 0.66).toFixed(1)}L${(r * 0.44).toFixed(1)} ${(hy - r * 0.66).toFixed(1)}C${(r * 0.56).toFixed(1)} ${(hy - r * 0.96).toFixed(1)} ${(r * 0.48).toFixed(1)} ${(hy - r * 1.24).toFixed(1)} ${(r * 0.28).toFixed(1)} ${(hy - r * 1.42).toFixed(1)}Z`} o={0.36} />
        {[
          [-0.06, -0.50, -0.62],
          [-0.02, -0.22, -0.24],
          [0.02, 0.22, 0.24],
          [0.06, 0.50, 0.62],
        ].map(([x0, xq, x1], i) => (
          <L key={'bnts' + i} d={`M${(r * x0).toFixed(1)} ${(hy - r * 1.44).toFixed(1)}Q${(r * xq).toFixed(1)} ${(hy - r * 1.16).toFixed(1)} ${(r * x1).toFixed(1)} ${(hy - r * 0.80).toFixed(1)}`} w={3} o={0.32} />
        ))}
        <L key="bnthl" d={`M${(-r * 0.62).toFixed(1)} ${(hy - r * 1.14).toFixed(1)}Q${(-r * 0.36).toFixed(1)} ${(hy - r * 1.36).toFixed(1)} ${(-r * 0.08).toFixed(1)} ${(hy - r * 1.38).toFixed(1)}`} w={4.5} c="white" o={0.28} />
        <S key="bntpom" d={E(0, hy - r * 1.54, r * 0.17, r * 0.15)} f="paper" sw={4.2} />
        <L key="bntpomt" d={`M${(-r * 0.08).toFixed(1)} ${(hy - r * 1.56).toFixed(1)}q${(r * 0.06).toFixed(1)} ${(-r * 0.05).toFixed(1)} ${(r * 0.11).toFixed(1)} 0M${(-r * 0.03).toFixed(1)} ${(hy - r * 1.48).toFixed(1)}q${(r * 0.06).toFixed(1)} ${(r * 0.04).toFixed(1)} ${(r * 0.11).toFixed(1)} 0`} w={2.5} o={0.35} />
        <S key="bntb" d={Rr(-r * 1.03, hy - r * 0.84, r * 2.06, r * 0.32, r * 0.14)} f={btC} sw={4.5} />
        <Sh key="bntbsh" d={Rr(r * 0.50, hy - r * 0.82, r * 0.50, r * 0.28, r * 0.10)} o={0.32} />
        {[-0.84, -0.60, -0.36, -0.12, 0.12, 0.36, 0.60, 0.84].map((rx, i) => (
          <L key={'bntr' + i} d={`M${(r * rx).toFixed(1)} ${(hy - r * 0.80).toFixed(1)}V${(hy - r * 0.56).toFixed(1)}`} w={3} o={0.45} />
        ))}
      </g>,
    );
  }

  const tx = gx + shShift;
  const xf = tx || headLag
    ? `translate(${tx.toFixed(1)} 0) rotate(${headLag.toFixed(2)} 0 ${(hy + r * 0.9).toFixed(1)})`
    : undefined;
  return <g transform={xf}>{els}</g>;
};
void talkGesture;
