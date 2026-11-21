// Rig nhìn nghiêng (profile) để ĐI, LEO CẦU THANG, NGỒI, VỚI TAY BẤM NÚT.
// Gốc = điểm trên mặt đất dưới hông, mặt quay về +x. Cùng tỉ lệ với rig chính diện (chars.tsx).
// Dáng đi: bàn chân trụ dán chặt mặt đất (không trượt) — pha bước = quãng đường / SIDE_CYCLE.
import React from 'react';
import {E, L, PAL, R, Rr, S, Sh, col, LINE} from './kit';
import type {Look, Expr} from './chars';

const rad = (d: number) => (d * Math.PI) / 180;
export const SIDE_STRIDE = 118; // độ dài bàn chân lùi trong pha trụ (đơn vị rig)
const STANCE = 0.6;
/** quãng đường thân đi được sau 1 chu kỳ bước (2 bước) */
export const SIDE_CYCLE = SIDE_STRIDE / STANCE;

type P = [number, number];
type Target = {x: number; y: number};
export type SideLegs = 'walk' | 'run' | 'sit' | 'carried' | 'ride' | 'crouch' | 'jump' | 'fall' | 'push' | 'climb';
export type SideArms =
  | 'swing' | 'down' | 'hold' | 'phone' | 'cane' | 'carry'
  | 'run' | 'ride' | 'crouch' | 'jump' | 'fall' | 'push' | 'climb' | 'cheer'
  | {near?: Target; far?: Target};

export type SideProps = {
  look: Look;
  t: number;
  phase?: number; // số chu kỳ bước (liên tục)
  speed?: number; // 0 đứng .. 1 đi
  slope?: number; // độ dốc mặt đất dy/dx (âm = đi lên)
  legs?: SideLegs;
  seatH?: number;
  arms?: SideArms;
  expr?: Expr;
  talk?: number;
  blinkPh?: number;
  lean?: number;
  look2?: number; // nghiêng đầu: + nhìn lên
  squash?: number;
  pitch?: number;
  prop?: (h: {near: P; far: P}) => React.ReactNode;
};

const limb = (pts: P[], w: number, c: string, k: string) => {
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  return (
    <g key={k}>
      <path d={d} fill="none" stroke={PAL.ink} strokeWidth={w + LINE * 2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={col(c)} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
};

/** IK 2 khúc; bend=+1 khớp giữa lồi về +x (đầu gối), -1 lồi về -x (khuỷu tay) */
const ik = (a: P, b: P, l1: number, l2: number, bend: number): P => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let d = Math.hypot(dx, dy);
  d = Math.min(d, l1 + l2 - 0.5);
  d = Math.max(d, Math.abs(l1 - l2) + 1);
  const base = Math.atan2(dy, dx);
  const off = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const c1 = base + off, c2 = base - off;
  const p1: P = [a[0] + Math.cos(c1) * l1, a[1] + Math.sin(c1) * l1];
  const p2: P = [a[0] + Math.cos(c2) * l1, a[1] + Math.sin(c2) * l1];
  return bend > 0 ? (p1[0] > p2[0] ? p1 : p2) : p1[0] < p2[0] ? p1 : p2;
};

const smooth = (u: number) => u * u * (3 - 2 * u);

export const PersonSide: React.FC<SideProps> = ({look, t, phase = 0, speed = 0, slope = 0, legs = 'walk', seatH = 120, arms = 'swing', expr = 'neutral', talk = 0, blinkPh = 0, lean = 0, look2 = 0, squash, pitch, prop}) => {
  const W = look.w ?? 1;
  const H = look.h ?? 1;
  const belly = look.belly ?? 0;
  const skin = look.skin ?? 'skin';
  const thigh = 86 * H, shin = 84 * H; // cùng tỉ lệ với rig chính diện: thân ngắn, đầu to
  const legW = 38 * Math.min(1.2, W);
  const armW = 28 * Math.min(1.25, W);
  const ua = 104 * H, fa = 96 * H;
  const HR = 100 * (look.head ?? 1);
  const S0 = SIDE_STRIDE * Math.min(1.15, H) * speed;
  const ground = (x: number) => x * slope;

  const runPhase = phase !== 0 ? phase : t * 2.1;
  const runSpd = speed > 0.05 ? Math.min(1.3, speed) : 1;

  // ---- chân (2-segment biomechanical IK) ----
  const feet: {p: P; lift: number; rot: number}[] = [];
  let hipY = -178 * H;
  let hipX = 0;
  let autoLean = 0;
  let autoPitch = 0;
  let autoSquash = 1;

  if (legs === 'walk') {
    for (const i of [0, 1]) {
      const q = (((phase + i * 0.5) % 1) + 1) % 1;
      let x: number, y: number, lift = 0;
      if (q < STANCE) {
        x = S0 * (0.5 - q / STANCE);
        y = ground(x);
      } else {
        const r = (q - STANCE) / (1 - STANCE);
        x = -S0 / 2 + S0 * smooth(r);
        lift = Math.sin(Math.PI * r) * (26 + 30 * Math.abs(slope)) * Math.min(1, speed * 1.4);
        y = ground(x) - lift;
      }
      x += (i ? -1 : 1) * 14 * (1 - Math.min(1, speed * 2));
      y = ground(x) - lift;
      feet.push({p: [x, y], lift, rot: lift > 1 ? -10 : 0});
    }
    // nhún: thấp nhất lúc hai chân chạm đất
    hipY += 7 * speed * Math.cos(4 * Math.PI * phase) + ground(0) * 0.5;
    autoLean = 3 * speed;
  } else if (legs === 'run') {
    const SRun = SIDE_STRIDE * 1.45 * Math.min(1.15, H) * runSpd;
    const runStance = 0.42;
    for (const i of [0, 1]) {
      const q = (((runPhase + i * 0.5) % 1) + 1) % 1;
      let x: number, y: number, lift = 0, rot = 0;
      if (q < runStance) {
        x = SRun * (0.5 - q / runStance);
        y = ground(x);
        rot = (q / runStance) * 16;
      } else {
        const r = (q - runStance) / (1 - runStance);
        x = -SRun / 2 + SRun * smooth(r);
        lift = Math.sin(Math.PI * r) * (54 + 28 * Math.abs(slope)) * Math.min(1.1, runSpd);
        y = ground(x) - lift;
        rot = r < 0.45 ? 18 : -14;
      }
      feet.push({p: [x, y], lift, rot});
    }
    // stronger vertical flight bounce + forward sprint lean
    hipY = -178 * H - 14 * runSpd + 16 * runSpd * Math.cos(4 * Math.PI * runPhase) + ground(0) * 0.5;
    autoLean = 12;
  } else if (legs === 'sit') {
    hipY = -seatH;
    hipX = -10;
  } else if (legs === 'ride') {
    hipY = -112 * H + Math.sin(t * 6) * 4;
    hipX = -8;
    autoLean = 18;
    autoSquash = 0.96;
  } else if (legs === 'crouch') {
    hipY = -118 * H;
    hipX = -16;
    autoLean = 14;
    autoSquash = 0.92;
  } else if (legs === 'jump') {
    hipY = -178 * H - 55 + Math.sin(t * 8) * 5;
    autoLean = 6;
    autoSquash = 1.07;
  } else if (legs === 'fall') {
    hipY = -148 * H;
    autoPitch = -65;
    autoSquash = 0.94;
  } else if (legs === 'push') {
    hipY = -152 * H;
    hipX = -10;
    autoLean = 26;
    autoSquash = 0.95;
  } else if (legs === 'climb') {
    hipY = -168 * H + Math.abs(Math.sin(t * 7)) * 8;
    autoLean = 8;
  } else {
    // 'carried'
    hipY = 0;
  }

  const lowered = hipY - -178 * H; // thân tụt xuống bao nhiêu so với đứng
  const shY = -178 * H - 196 * H + lowered;
  const hip: P = [hipX, hipY];

  const shoe = look.shoes ?? 'red';
  const pants = look.pants;
  const drawLeg = (i: number, shadeO: number) => {
    let knee: P, ankle: P, toeRot = 0;
    if (legs === 'walk' || legs === 'run') {
      const f = feet[i];
      ankle = [f.p[0], f.p[1] - 14];
      knee = ik(hip, ankle, thigh, shin, +1);
      toeRot = f.rot;
    } else if (legs === 'sit') {
      // bàn chân đặt trước; đầu gối tự gập theo độ cao hông (ngồi xuống mượt khi seatH giảm dần)
      ankle = [hip[0] + thigh * 0.95 - i * 12, -14];
      knee = ik(hip, ankle, thigh, shin, +1);
    } else if (legs === 'ride') {
      // thigh forward-down gripping mount, knee bent ~105°, ankle tucked beneath hip
      ankle = [hip[0] + (i === 0 ? 10 : -4) * H, hip[1] + 98 * H];
      knee = ik(hip, ankle, thigh, shin, +1);
      toeRot = 18;
    } else if (legs === 'crouch') {
      // feet braced flat on ground, deep athletic knee bend
      ankle = [hip[0] + (i === 0 ? 34 : -10) * H, -14];
      knee = ik(hip, ankle, thigh, shin, +1);
      toeRot = 0;
    } else if (legs === 'jump') {
      if (i === 0) {
        // front knee tucked high
        ankle = [hip[0] + 24 * H, hip[1] + 94 * H];
        toeRot = 24;
      } else {
        // back leg trailing bent
        ankle = [hip[0] - 66 * H, hip[1] + 116 * H];
        toeRot = 32;
      }
      knee = ik(hip, ankle, thigh, shin, +1);
    } else if (legs === 'fall') {
      // legs kicked up asynchronously during backward tumble
      const kick = Math.sin(t * 18 + i * 2.1) * 18;
      if (i === 0) {
        ankle = [hip[0] + 86 * H + kick, hip[1] + 72 * H - kick * 0.6];
        toeRot = -22 + kick * 0.5;
      } else {
        ankle = [hip[0] + 54 * H - kick, hip[1] + 104 * H + kick * 0.5];
        toeRot = -12 - kick * 0.5;
      }
      knee = ik(hip, ankle, thigh, shin, +1);
    } else if (legs === 'push') {
      if (i === 0) {
        // front foot planted forward with bent knee
        ankle = [hip[0] + 46 * H, -14];
        toeRot = 0;
      } else {
        // back leg braced far behind (-thigh * 0.95)
        ankle = [hip[0] - thigh * 0.95, -14];
        toeRot = 18;
      }
      knee = ik(hip, ankle, thigh, shin, +1);
    } else if (legs === 'climb') {
      const cyc = Math.sin(t * 7 + i * Math.PI);
      const lift = (cyc * 0.5 + 0.5) * 78 * H;
      ankle = [hip[0] + 26 * H + cyc * 14, -16 - lift];
      knee = ik(hip, ankle, thigh, shin, +1);
      toeRot = cyc > 0 ? -12 : 10;
    } else {
      // 'carried'
      knee = [hip[0] + thigh * 0.85, hip[1] + 30];
      ankle = [knee[0] - 10, knee[1] + shin * 0.9];
    }
    const k = 'lg' + i;
    return (
      <g key={k}>
        {limb([hip, knee, ankle], legW, pants, k + 'l')}
        <g transform={`translate(${ankle[0].toFixed(1)} ${ankle[1].toFixed(1)}) rotate(${toeRot.toFixed(1)})`}>
          <S d={Rr(-18, -6, 62, 26, 12)} f={shoe} />
        </g>
        {shadeO > 0 && <path d={`M${hip[0].toFixed(1)} ${hip[1].toFixed(1)}L${knee[0].toFixed(1)} ${knee[1].toFixed(1)}L${ankle[0].toFixed(1)} ${ankle[1].toFixed(1)}`} stroke={PAL.ink} strokeWidth={legW} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={shadeO} />}
      </g>
    );
  };

  // ---- tay ----
  const shoulder: P = [hipX + 4 * W, shY + 26];
  const resolvedArms =
    arms === 'swing' && (legs === 'run' || legs === 'ride' || legs === 'crouch' || legs === 'jump' || legs === 'fall' || legs === 'push' || legs === 'climb')
      ? legs
      : arms;
  const armPts = (near: boolean): P[] => {
    let tgt: Target | undefined;
    if (typeof resolvedArms === 'object') tgt = near ? resolvedArms.near : resolvedArms.far;
    if (tgt) {
      const el = ik(shoulder, [tgt.x, tgt.y], ua, fa, -1);
      return [shoulder, el, [tgt.x, tgt.y]];
    }
    let a = 6, e = 10; // độ: + = về phía trước
    if (resolvedArms === 'swing') {
      const sw = 26 * speed * Math.cos(2 * Math.PI * phase) * (near ? -1 : 1);
      a = 4 + sw;
      e = 14 + Math.max(0, sw) * 0.9;
    } else if (resolvedArms === 'run') {
      // pumping bent elbows (65°–95° flexion)
      const sw = 48 * Math.cos(2 * Math.PI * runPhase) * (near ? -1 : 1);
      a = 6 + sw;
      e = 75 + Math.max(0, sw) * 0.42;
    } else if (resolvedArms === 'ride') {
      // hands gripping forward-down on reins/shell
      a = near ? 38 : 48;
      e = near ? 56 : 48;
    } else if (resolvedArms === 'crouch') {
      a = near ? 26 : 36;
      e = near ? 68 : 60;
    } else if (resolvedArms === 'jump') {
      // arms swept up/forward
      a = near ? 128 : 142;
      e = near ? 26 : 18;
    } else if (resolvedArms === 'fall') {
      // arms flailing up/back
      const fl = Math.sin(t * 20 + (near ? 0 : 2.3)) * 22;
      a = (near ? 132 : 152) + fl;
      e = (near ? 24 : 18) - fl * 0.4;
    } else if (resolvedArms === 'push') {
      // both arms extended forward pushing
      a = near ? 82 : 90;
      e = near ? 14 : 10;
    } else if (resolvedArms === 'climb') {
      // alternating overhead reaching arms
      const cyc = Math.sin(t * 7 + (near ? 0 : Math.PI));
      a = 112 + cyc * 46;
      e = 38 - cyc * 18;
    } else if (resolvedArms === 'cheer') {
      const wave = Math.sin(t * 10) * 10;
      a = (near ? 148 : 138) + (near ? wave : -wave);
      e = near ? 24 : 30;
    } else if (resolvedArms === 'hold') {
      a = 20; e = 80;
    } else if (resolvedArms === 'phone') {
      if (near) { a = 30; e = 150; } else { a = 4; e = 8; }
    } else if (resolvedArms === 'cane') {
      if (near) { a = 28; e = 20; } else { a = 4; e = 8; }
    } else if (resolvedArms === 'carry') {
      a = -30; e = 70; // vòng ra sau đỡ người cõng
    }
    const t1 = rad(a), t2 = rad(a + e);
    const el: P = [shoulder[0] + Math.sin(t1) * ua, shoulder[1] + Math.cos(t1) * ua];
    const hd: P = [el[0] + Math.sin(t2) * fa, el[1] + Math.cos(t2) * fa];
    return [shoulder, el, hd];
  };
  const nearA = armPts(true);
  const farA = armPts(false);
  const sleeveC = look.top === 'tank' ? skin : look.topC;
  const fullSleeve = ['suit', 'uniform', 'robe', 'chef', 'aothe', 'blouse'].includes(look.top);
  const drawArm = (p: P[], k: string, dim: boolean) => (
    <g key={k}>
      {limb(p, armW, fullSleeve ? sleeveC : skin, k + 'a')}
      {!fullSleeve && limb([p[0], [p[0][0] + (p[1][0] - p[0][0]) * 0.5, p[0][1] + (p[1][1] - p[0][1]) * 0.5]], armW + 6, sleeveC, k + 's')}
      <S d={E(p[2][0], p[2][1], 16, 16)} f={skin} />
      {dim && <path d={`M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}L${p[1][0].toFixed(1)} ${p[1][1].toFixed(1)}L${p[2][0].toFixed(1)} ${p[2][1].toFixed(1)}`} stroke={PAL.ink} strokeWidth={armW} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.22} />}
    </g>
  );

  // ---- thân ----
  const sY = shY;
  const bY = hipY;
  const fr = hipX + 54 * W + belly * 34; // bụng phía trước
  const bk = hipX - 52 * W;
  const long = look.top === 'robe' || look.top === 'aothe';
  const hem = long ? bY + 118 * H : bY + 26;
  const torso = `M${bk + 4} ${sY - 10}C${bk - 6} ${sY + 40} ${bk - 4} ${(sY + bY) / 2} ${bk + 2} ${hem}L${fr - 8} ${hem}C${fr + belly * 16} ${hem - 40} ${fr + belly * 20} ${(sY + bY) / 2} ${fr - 6} ${sY + 60}C${fr - 4} ${sY + 10} ${hipX + 30 * W} ${sY - 16} ${hipX + 8} ${sY - 18}C${hipX - 10} ${sY - 18} ${bk + 10} ${sY - 18} ${bk + 4} ${sY - 10}Z`;
  const pat: React.ReactNode[] = [];
  if (look.pattern === 'dots' || look.pattern === 'flowers') {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 4; c++) pat.push(<circle key={r + '-' + c} cx={bk + 12 + c * 26 + (r % 2) * 12} cy={sY + 4 + r * 26} r={5} fill={col(look.patC ?? 'yellow')} />);
  } else if (look.pattern === 'stripes') {
    for (let i = 0; i < 12; i++) pat.push(<rect key={i} x={bk - 20} y={sY + 12 + i * 22} width={200} height={8} fill={col(look.patC ?? 'trim')} />);
  }
  const det: React.ReactNode[] = [];
  if (look.top === 'shirt' || look.top === 'polo' || look.top === 'uniform') {
    det.push(<S key="col" d={`M${hipX + 8} ${sY - 18}L${hipX + 30 * W} ${sY + 4}L${hipX + 18} ${sY + 14}Z`} f={look.top === 'polo' ? look.topC2 ?? 'trim' : look.topC} />);
    for (let i = 0; i < (look.top === 'polo' ? 2 : 5); i++) det.push(<circle key={'b' + i} cx={fr - 14 + (i > 2 ? belly * 10 : 0)} cy={sY + 40 + i * 34} r={4} fill={PAL.ink} />);
    if (look.top === 'uniform') det.push(<S key="pk" d={Rr(hipX + 4, sY + 50, 34, 34, 6)} f={look.topC} />);
  } else if (look.top === 'suit') {
    det.push(<S key="tie" d={`M${fr - 22} ${sY - 6}l12 0l6 110l-14 18Z`} f={look.topC2 ?? 'red'} />);
    det.push(<S key="lap" d={`M${hipX + 8} ${sY - 18}L${fr - 8} ${sY + 120}L${fr - 30} ${sY + 20}Z`} f={look.topC} />);
  }
  if (look.vest) det.push(<S key="vs" d={`M${bk + 2} ${sY + 4}L${fr - 8} ${sY + 4}L${fr - 4} ${bY + 20}L${bk} ${bY + 20}Z`} f="orange" />, <rect key="vs2" x={bk} y={bY - 60} width={fr - bk} height={14} fill={PAL.trim} stroke={PAL.ink} strokeWidth={3} />);
  if (look.chain) det.push(<path key="ch" d={`M${hipX + 6} ${sY - 14}Q${fr} ${sY + 40} ${fr - 6} ${sY - 2}`} fill="none" stroke={PAL.gold} strokeWidth={7} strokeDasharray="2 9" strokeLinecap="round" />);

  // ---- đầu ----
  const hy = sY - 8 - HR * 0.9;
  const hx = hipX + 12;
  const head = <HeadSide look={look} x={hx} y={hy} r={HR} expr={expr} talk={talk} t={t} blinkPh={blinkPh} tilt={look2} />;

  const legBack = drawLeg(1, 0.18);
  const legFront = drawLeg(0, 0);
  const hands = {near: nearA[2], far: farA[2]};
  const breath = Math.sin(t * 2.5 + blinkPh) * 0.008;
  const sq = Math.max(0.5, (squash ?? autoSquash) + breath);
  const sxSq = 1 / Math.sqrt(sq);
  const totalRot = lean + autoLean + (pitch ?? autoPitch);

  return (
    <g transform={`rotate(${totalRot.toFixed(2)} ${hipX.toFixed(1)} ${hipY.toFixed(1)}) scale(${sxSq.toFixed(4)} ${sq.toFixed(4)})`}>
      {legs === 'fall' && (
        <g>
          <L d={`M${bk - 26} ${sY + 40}q-20 30 6 54`} w={4} o={0.35} />
          <L d={`M${hipX + 104} ${hipY + 34}q20 18 4 44`} w={4} o={0.35} />
        </g>
      )}
      {drawArm(farA, 'fa', true)}
      {legBack}
      <S d={torso} f={look.topC} />
      <clipPath id={`ts-${look.name}`}><path d={torso} /></clipPath>
      <g clipPath={`url(#ts-${look.name})`}>
        {pat}
        <Sh d={`M${bk - 10} ${sY - 30}L${bk + 26} ${sY - 30}L${bk + 26} ${hem + 10}L${bk - 10} ${hem + 10}Z`} o={0.55} />
      </g>
      {det}
      <S d={R(hipX - 4, sY - 40, 34, 30)} f="skinShade" />
      {legFront}
      {head}
      {prop?.(hands)}
      {drawArm(nearA, 'na', false)}
    </g>
  );
};

const HeadSide: React.FC<{look: Look; x: number; y: number; r: number; expr: Expr; talk: number; t: number; blinkPh: number; tilt: number}> = ({look, x, y, r, expr, talk, t, blinkPh, tilt}) => {
  const skin = look.skin ?? 'skin';
  const hairC = look.hairC ?? 'hair';
  const els: React.ReactNode[] = [];
  // tóc phía sau
  if (look.hair === 'bun') els.push(<S key="bun" d={E(-r * 0.85, -r * 0.55, r * 0.36, r * 0.32)} f={hairC} />);
  if (look.hair === 'long') els.push(<S key="lg" d={`M${-r * 0.2} ${-r * 0.9}C${-r * 1.2} ${-r * 0.8} ${-r * 1.15} ${r * 0.9} ${-r * 0.7} ${r * 1.45}L${-r * 0.1} ${r * 1.2}C${-r * 0.4} ${r * 0.6} ${-r * 0.2} ${0} ${0} ${-r * 0.2}Z`} f={hairC} />);
  if (look.hair === 'curly') for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.75 + (i / 6) * 1.0);
    els.push(<S key={'cu' + i} d={E(Math.cos(a) * r * 0.95 - r * 0.05, Math.sin(a) * r * 0.95, r * 0.34, r * 0.34)} f={hairC} />);
  }
  // mặt nghiêng: hộp sọ + mũi + cằm
  // mặt nghiêng tròn: má phúng, mũi là một nút nhỏ, cằm tròn — không mũi nhọn
  els.push(<S key="face" d={`M${-r * 0.9} ${-r * 0.05}C${-r * 0.95} ${-r * 1.0} ${r * 0.72} ${-r * 1.05} ${r * 0.88} ${-r * 0.2}C${r * 0.9} ${r * 0.05} ${r * 1.02} ${r * 0.24} ${r * 0.94} ${r * 0.36}C${r * 0.96} ${r * 0.7} ${r * 0.6} ${r * 0.92} ${r * 0.1} ${r * 0.9}C${-r * 0.46} ${r * 0.9} ${-r * 0.86} ${r * 0.6} ${-r * 0.9} ${-r * 0.05}Z`} f={skin} />);
  els.push(<Sh key="fsh" d={`M${-r * 0.88} ${-r * 0.1}C${-r * 0.9} ${-r * 0.6} ${-r * 0.6} ${-r * 0.9} ${-r * 0.3} ${-r * 0.95}L${-r * 0.3} ${r * 0.98}C${-r * 0.6} ${r * 0.9} ${-r * 0.86} ${r * 0.5} ${-r * 0.88} ${-r * 0.1}Z`} o={0.45} />);
  // tai
  els.push(<S key="ear" d={E(-r * 0.18, r * 0.06, r * 0.16, r * 0.23)} f={skin} />);
  if (look.earrings) els.push(<S key="er" d={E(-r * 0.18, r * 0.38, 7, 7)} f="gold" />);
  // tóc trước/đỉnh
  const hp = (d: string, k: string) => els.push(<S key={k} d={d} f={hairC} />);
  switch (look.hair) {
    case 'bald':
      hp(`M${-r * 0.88} ${r * 0.0}C${-r * 0.92} ${-r * 0.36} ${-r * 0.7} ${-r * 0.5} ${-r * 0.4} ${-r * 0.42}L${-r * 0.36} ${-r * 0.1}C${-r * 0.5} ${-r * 0.1} ${-r * 0.7} ${r * 0.1} ${-r * 0.88} ${r * 0.0}Z`, 'h');
      els.push(<path key="sh" d={`M${r * 0.0} ${-r * 0.82}q${r * 0.24} ${-r * 0.06} ${r * 0.4} ${r * 0.06}`} stroke={PAL.white} strokeWidth={8} strokeLinecap="round" fill="none" />);
      break;
    case 'thin':
      hp(`M${-r * 0.88} ${r * 0.0}C${-r * 0.92} ${-r * 0.5} ${-r * 0.5} ${-r * 0.72} ${-r * 0.1} ${-r * 0.7}L${-r * 0.36} ${-r * 0.12}C${-r * 0.5} ${-r * 0.06} ${-r * 0.7} ${r * 0.1} ${-r * 0.88} ${r * 0.0}Z`, 'h');
      break;
    case 'curly':
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (1.15 + (i / 4) * 0.55);
        els.push(<S key={'cf' + i} d={E(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.82, r * 0.3, r * 0.27)} f={hairC} />);
      }
      break;
    default:
      // side/neat/short/kid/bun/long: mũ tóc phủ đỉnh và gáy, mái chấm trán
      hp(`M${-r * 0.92} ${r * 0.25}C${-r * 1.05} ${-r * 0.9} ${r * 0.3} ${-r * 1.25} ${r * 0.86} ${-r * 0.42}C${r * 0.6} ${-r * 0.5} ${r * 0.35} ${-r * 0.45} ${r * 0.16} ${-r * 0.36}C${0} ${-r * 0.3} ${-r * 0.2} ${-r * 0.1} ${-r * 0.32} ${r * 0.0}C${-r * 0.5} ${-r * 0.06} ${-r * 0.7} ${r * 0.1} ${-r * 0.92} ${r * 0.25}Z`, 'h');
      if (look.hair === 'kid' || look.hair === 'short') els.push(<path key="spk" d={`M${r * 0.6} ${-r * 0.52}l${r * 0.14} ${-r * 0.1}l${-r * 0.02} ${r * 0.14}`} fill={col(hairC)} stroke={PAL.ink} strokeWidth={4} />);
  }
  // mũ
  const hat = look.hat ?? 'none';
  const hatC = look.hatC ?? 'navy';
  if (hat === 'cap') {
    els.push(<S key="cap" d={`M${-r * 0.9} ${-r * 0.36}C${-r * 0.9} ${-r * 1.15} ${r * 0.8} ${-r * 1.15} ${r * 0.86} ${-r * 0.42}Z`} f={hatC} />);
    els.push(<S key="capb" d={`M${r * 0.5} ${-r * 0.46}h${r * 0.75}l${-r * 0.06} ${r * 0.14}h${-r * 0.7}Z`} f="ink" />);
  } else if (hat === 'helmet') {
    els.push(<S key="hm" d={`M${-r * 1.0} ${-r * 0.2}C${-r * 1.05} ${-r * 1.25} ${r * 0.95} ${-r * 1.25} ${r * 1.0} ${-r * 0.3}h${r * 0.18}v${r * 0.1}h${-r * 2.2}Z`} f={hatC} />);
  } else if (hat === 'band') {
    els.push(<S key="bd" d={R(-r * 0.9, -r * 0.62, r * 1.75, r * 0.22)} f={hatC} />);
  }
  // mắt, mày, miệng theo biểu cảm
  const ex = r * 0.52, ey = r * 0.16;
  const er = r * 0.12;
  const blink = ((t * 1000 + blinkPh * 700) % 3700) < 120;
  const browC = look.brows ?? 'hair';
  const brow = (ang: number, lift = 0) => els.push(<L key="bw" d={`M${ex - r * 0.12} ${ey - r * 0.32 - lift + ang}Q${ex} ${ey - r * 0.38 - lift} ${ex + r * 0.12} ${ey - r * 0.32 - lift - ang}`} w={7} c={browC} />);
  const eye = (kind: 'dot' | 'arcU' | 'arcD' | 'wide' | 'narrow' | 'shut') => {
    if (blink && kind !== 'shut') kind = 'shut';
    if (kind === 'dot') els.push(<ellipse key="e" cx={ex} cy={ey} rx={er * 0.9} ry={er * 1.15} fill={PAL.ink} />, <circle key="eh" cx={ex + er * 0.3} cy={ey - er * 0.42} r={er * 0.32} fill={PAL.white} />);
    if (kind === 'wide') els.push(<S key="ew" d={E(ex, ey, er * 1.3, er * 1.5)} f="white" sw={4} />, <circle key="e" cx={ex + er * 0.4} cy={ey + 2} r={er * 0.65} fill={PAL.ink} />);
    if (kind === 'narrow') els.push(<ellipse key="e" cx={ex} cy={ey + er * 0.25} rx={er * 0.85} ry={er * 0.75} fill={PAL.ink} />, <L key="ep" d={`M${ex - er * 1.2} ${ey - er * 0.2}h${er * 2.4}`} w={6} />);
    if (kind === 'arcU') els.push(<L key="e" d={`M${ex - er} ${ey + 3}q${er} ${-er * 1.1} ${er * 2} 0`} w={6} />);
    if (kind === 'arcD') els.push(<L key="e" d={`M${ex - er} ${ey}q${er} ${er * 1.1} ${er * 2} 0`} w={6} />);
    if (kind === 'shut') els.push(<L key="e" d={`M${ex - er} ${ey}q${er} ${er * 0.6} ${er * 2} 0`} w={5.5} />);
  };
  const my = r * 0.56, mx = r * 0.72;
  const lc = look.lips ? 'red' : 'ink';
  const mouth = (kind: string) => {
    if (talk > 0.05 && kind !== 'O') {
      const o = 5 + talk * r * 0.14;
      els.push(<S key="m" d={`M${mx - r * 0.12} ${my - 2}L${mx + r * 0.1} ${my - 3}Q${mx + r * 0.06} ${my + o} ${mx - r * 0.08} ${my + o * 0.7}Z`} f="redDark" sw={4} />);
      return;
    }
    if (kind === 'flat') els.push(<L key="m" d={`M${mx - r * 0.1} ${my}h${r * 0.14}`} w={5} c={lc} />);
    if (kind === 'smile') els.push(<L key="m" d={`M${mx - r * 0.12} ${my - 3}q${r * 0.1} ${r * 0.12} ${r * 0.18} ${-r * 0.03}`} w={5} c={lc} />);
    if (kind === 'frown') els.push(<L key="m" d={`M${mx - r * 0.12} ${my + 5}q${r * 0.09} ${-r * 0.1} ${r * 0.17} ${-r * 0.01}`} w={5} c={lc} />);
    if (kind === 'O') els.push(<S key="m" d={E(mx - r * 0.02, my + 4, r * 0.06, r * 0.09)} f="redDark" sw={4} />);
    // cười: khoang tối + lưỡi, không răng
    if (kind === 'grin') els.push(<S key="m" d={`M${mx - r * 0.14} ${my - 4}L${mx + r * 0.12} ${my - 5}Q${mx + r * 0.08} ${my + r * 0.2} ${mx - r * 0.12} ${my + r * 0.1}Z`} f="redDark" sw={4} />);
  };
  switch (expr) {
    case 'neutral': brow(0); eye('dot'); mouth('flat'); break;
    case 'deadpan': brow(0, -5); eye('dot'); els.push(<L key="lid" d={`M${ex - er * 1.1} ${ey - er * 0.3}h${er * 2.2}`} w={6} />); mouth('flat'); break;
    case 'stern': brow(6, -2); eye('dot'); mouth('frown'); break;
    case 'angry': brow(10, -3); eye('narrow'); mouth('frown'); break;
    case 'smug': brow(-3); eye('arcD'); mouth('smile'); break;
    case 'sly': brow(5); eye('narrow'); mouth('smile'); break;
    case 'shock': brow(-5, 10); eye('wide'); mouth('O'); break;
    case 'sad': brow(-8, 3); eye('dot'); mouth('frown'); break;
    case 'cry': brow(-9, 5); eye('arcU'); mouth('O');
      els.push(<path key="tr" d={`M${ex} ${ey + 8}q6 ${r * 0.25 + Math.sin(t * 12) * 5} 0 ${r * 0.5}`} stroke={PAL.blue} strokeWidth={8} fill="none" strokeLinecap="round" />); break;
    case 'joy': brow(-3, 6); eye('arcU'); mouth('grin'); break;
    case 'eager': brow(-4, 8); eye('dot'); mouth('grin'); break;
    case 'shh': brow(3); eye('wide'); mouth('flat'); break;
  }
  els.push(<ellipse key="bl" cx={r * 0.44} cy={r * 0.42} rx={r * 0.16} ry={r * 0.1} fill={PAL.blush} opacity={0.42} />);
  if (look.mustache) els.push(<S key="mu" d={`M${mx - r * 0.24} ${my - 10}q${r * 0.24} ${-r * 0.16} ${r * 0.4} ${-r * 0.02}q${-r * 0.16} ${r * 0.12} ${-r * 0.4} ${r * 0.08}Z`} f={look.beardC ?? hairC} />);
  if (look.beard) {
    const bl = look.beard === 'long' ? r * 0.9 : r * 0.4;
    els.push(<S key="bd" d={`M${mx - r * 0.3} ${my + r * 0.18}Q${mx - r * 0.1} ${my + r * 0.2 + bl} ${mx + r * 0.05} ${my + r * 0.18}Z`} f={look.beardC ?? hairC} />);
  }
  if (look.glasses === 'round' || look.glasses === 'square') {
    els.push(look.glasses === 'round' ? <circle key="gl" cx={ex + 4} cy={ey} r={r * 0.24} fill={PAL.white} fillOpacity={0.25} stroke={PAL.ink} strokeWidth={5} /> : <rect key="gl" x={ex - r * 0.2} y={ey - r * 0.17} width={r * 0.48} height={r * 0.34} rx={6} fill={PAL.white} fillOpacity={0.25} stroke={PAL.ink} strokeWidth={5} />);
    els.push(<L key="ga" d={`M${ex - r * 0.2} ${ey - 2}L${-r * 0.16} ${-r * 0.04}`} w={4} />);
  }
  if (look.glasses === 'sun') {
    els.push(<S key="sg" d={`M${ex - r * 0.22} ${ey - r * 0.14}h${r * 0.5}l${-r * 0.04} ${r * 0.26}q${-r * 0.2} ${r * 0.08} ${-r * 0.42} 0Z`} f="ink" sw={3} />);
    els.push(<L key="sga" d={`M${ex - r * 0.22} ${ey - r * 0.08}L${-r * 0.16} ${-r * 0.04}`} w={5} />);
  }
  return <g transform={`translate(${x} ${y}) rotate(${-tilt} 0 ${r * 0.8})`}>{els}</g>;
};
