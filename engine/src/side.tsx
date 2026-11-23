// Rig nhìn nghiêng (profile) để ĐI, LEO CẦU THANG, NGỒI, VỚI TAY BẤM NÚT.
// Gốc = điểm trên mặt đất dưới hông, mặt quay về +x. Cùng tỉ lệ với rig chính diện (chars.tsx).
// Dáng đi: bàn chân trụ dán chặt mặt đất (không trượt) — pha bước = quãng đường / SIDE_CYCLE.
import React from 'react';
import {E, L, PAL, R, Rr, S, Sh, col} from './kit';
import {TaperLimb, curvedTorsoPath, footCycle, gaitHipBob, hairWindOffset} from './anim';
import {clamp} from './math';
import type {FootSample} from './anim';
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
  hasPath?: boolean; // true khi đi/chạy theo path thế giới (dừng hẳn khi v=0 thay vì chạy tại chỗ)
  moving?: boolean; // cờ đang di chuyển (tùy chọn)
  slope?: number; // độ dốc mặt đất dy/dx (âm = đi lên)
  legs?: SideLegs;
  jumpPhase?: number; // 0..1 4-stage jump phase (takeoff crouch -> rising apex -> descending reach -> landing squash)
  seatH?: number;
  arms?: SideArms;
  expr?: Expr;
  talk?: number;
  blinkPh?: number;
  lean?: number;
  look2?: number; // nghiêng đầu: + nhìn lên
  squash?: number;
  pitch?: number;
  wind?: number;
  velX?: number;
  layer?: 'all' | 'far' | 'near';
  prop?: (h: {near: P; far: P}) => React.ReactNode;
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

export const PersonSide: React.FC<SideProps> = ({look, t, phase = 0, speed = 0, hasPath = false, moving, slope = 0, legs = 'walk', jumpPhase, seatH = 120, arms = 'swing', expr = 'neutral', talk = 0, blinkPh = 0, lean = 0, look2 = 0, squash, pitch, wind = 0, velX = 0, layer = 'all', prop}) => {
  const W = look.w ?? 1;
  const H = look.h ?? 1;
  const belly = look.belly ?? 0;
  const skin = look.skin ?? 'skin';
  const thigh = 86 * H, shin = 84 * H; // cùng tỉ lệ với rig chính diện: thân ngắn, đầu to
  const legW = 38 * Math.min(1.2, W);
  const armW = 28 * Math.min(1.25, W);
  const ua = 104 * H, fa = 96 * H;
  const HR = 100 * (look.head ?? 1);
  const ground = (x: number) => x * slope;

  const freeRun = !hasPath && moving !== false;
  const runPhase = freeRun ? (phase !== 0 ? phase : t * 2.1) : phase;
  const runSpd = freeRun ? (speed > 0.05 ? Math.min(1.3, speed) : 1) : Math.min(1.3, Math.max(0, speed));
  const jp =
    jumpPhase !== undefined
      ? Math.max(0, Math.min(1, jumpPhase))
      : 0.38 + Math.sin(t * 5 + blinkPh) * 0.08;

  // ---- chân (4-phase foot-roll biomechanics + 2-segment IK) ----
  const feet: FootSample[] = [];
  let hipY = -178 * H;
  let hipX = 0;
  let autoLean = 0;
  let autoPitch = 0;
  let autoSquash = 1;
  let gaitHeadLag = 0;
  let gaitTwist = 0;

  if (legs === 'walk') {
    const walkStride = SIDE_STRIDE * Math.min(1.15, H);
    for (const i of [0, 1] as const) {
      feet.push(footCycle(phase, i, walkStride, speed, slope, 'walk'));
    }
    const bob = gaitHipBob(phase, speed, 'walk');
    hipY += bob.dy + ground(0) * 0.5;
    gaitHeadLag = bob.headLagDeg;
    gaitTwist = bob.torsoTwist;
    autoLean = 3 * speed;
  } else if (legs === 'run') {
    const runStride = SIDE_STRIDE * 1.45 * Math.min(1.15, H);
    for (const i of [0, 1] as const) {
      feet.push(footCycle(runPhase, i, runStride, runSpd, slope, 'run'));
    }
    const bob = gaitHipBob(runPhase, runSpd, 'run');
    hipY = -178 * H + bob.dy + ground(0) * 0.5;
    gaitHeadLag = bob.headLagDeg;
    gaitTwist = bob.torsoTwist;
    autoLean = 12 * Math.min(1.15, runSpd);
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
    if (jp < 0.14) {
      // Stage 1: Takeoff Crouch Anticipation
      const u = jp / 0.14;
      hipY = -178 * H + 48 * Math.sin(u * Math.PI * 0.5) * H;
      hipX = -14;
      autoLean = 18;
      autoSquash = 0.9;
    } else if (jp < 0.52) {
      // Stage 2: Rising Ascent -> Apex
      const u = (jp - 0.14) / 0.38;
      hipY = -178 * H - 18 * Math.sin(u * Math.PI * 0.85);
      autoLean = 8 - u * 14;
      autoSquash = 1.09 - u * 0.05;
    } else if (jp < 0.86) {
      // Stage 3: Descending Landing Reach
      const u = (jp - 0.52) / 0.34;
      hipY = -178 * H - 12 * (1 - u);
      autoLean = -4 + u * 16;
      autoSquash = 1.02 + u * 0.03;
    } else {
      // Stage 4: Grounded Landing Squash Absorb
      const u = (jp - 0.86) / 0.14;
      const sqWave = Math.sin(u * Math.PI);
      hipY = -178 * H + 52 * sqWave * H;
      hipX = -12 * sqWave;
      autoLean = 18 * sqWave;
      autoSquash = 1 - 0.12 * sqWave;
    }
  } else if (legs === 'fall') {
    hipY = -148 * H;
    autoPitch = -65;
    autoSquash = 0.94;
  } else if (legs === 'push') {
    hipY = -146 * H;
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

  // ---- C-arc spine curvature ----
  const jumpBendX =
    jp < 0.14 ? 16 :
    jp < 0.52 ? -8 :
    jp < 0.86 ? 4 * ((jp - 0.52) / 0.34) :
    18 * Math.sin(((jp - 0.86) / 0.14) * Math.PI);
  const bendX =
    legs === 'run' ? (runSpd > 0.04 ? 18 * runSpd + gaitTwist * 0.8 : Math.sin(t * 2.5 + blinkPh) * 1.2) :
    legs === 'ride' ? 22 :
    legs === 'push' ? 28 :
    legs === 'crouch' ? 16 :
    legs === 'fall' ? -24 :
    legs === 'jump' ? jumpBendX :
    legs === 'climb' ? 10 :
    legs === 'walk' ? 4 * speed + gaitTwist * 0.5 + Math.sin(t * 2.5 + blinkPh) * 1.2 :
    Math.sin(t * 2.5 + blinkPh) * 1.2;
  const topShift = bendX * 0.35;

  const shoe = look.shoes ?? 'red';
  const pants = look.pants;
  const drawLeg = (i: number, shadeO: number) => {
    let knee: P, ankle: P, toeRot = 0;
    if (legs === 'walk' || legs === 'run') {
      const f = feet[i];
      // During stance push-off (lift < 1), lift ankle gently as heel rises so toe stays planted on ground
      const heelOff = f.lift < 1 ? f.heelLift * 0.72 : 0;
      ankle = [f.x, f.y - 14 - heelOff];
      knee = ik(hip, ankle, thigh, shin, +1);
      toeRot = f.toeRot;
    } else if (legs === 'sit') {
      // bàn chân đặt trước; đầu gối tự gập theo độ cao hông (ngồi xuống mượt khi seatH giảm dần)
      ankle = [hip[0] + thigh * 0.95 - i * 12, -14];
      knee = ik(hip, ankle, thigh, shin, +1);
    } else if (legs === 'ride') {
      // thigh forward-down gripping mount, boots angled cleanly along curved stirrup/shell flank
      ankle = [hip[0] + (i === 0 ? 14 : -4) * H, hip[1] + (i === 0 ? 96 : 98) * H];
      knee = ik(hip, ankle, thigh, shin, +1);
      toeRot = i === 0 ? 24 : 20;
    } else if (legs === 'crouch') {
      // feet braced flat on ground, deep athletic knee bend
      ankle = [hip[0] + (i === 0 ? 34 : -10) * H, -14];
      knee = ik(hip, ankle, thigh, shin, +1);
      toeRot = 0;
    } else if (legs === 'jump') {
      if (jp < 0.14) {
        // Stage 1: Takeoff Crouch — feet planted flat on ground, deep athletic knee bend
        ankle = [hip[0] + (i === 0 ? 34 : -14) * H, -14];
        toeRot = 0;
      } else if (jp < 0.52) {
        // Stage 2: Rising Ascent -> Apex
        const u = (jp - 0.14) / 0.38;
        if (i === 0) {
          ankle = [hip[0] + (34 + 14 * u) * H, hip[1] + (88 - 18 * u) * H];
          toeRot = 20 + 14 * u;
        } else {
          ankle = [hip[0] - (58 + 18 * (1 - u)) * H, hip[1] + (122 - 14 * u) * H];
          toeRot = 42 - 10 * u;
        }
      } else if (jp < 0.86) {
        // Stage 3: Descending Landing Reach
        const u = (jp - 0.52) / 0.34;
        if (i === 0) {
          ankle = [hip[0] + (42 - 6 * u) * H, hip[1] + (88 + 68 * u) * H];
          toeRot = 24 - 28 * u;
        } else {
          ankle = [hip[0] - (56 - 40 * u) * H, hip[1] + (116 + 44 * u) * H];
          toeRot = 30 - 24 * u;
        }
      } else {
        // Stage 4: Grounded Landing Squash Absorb — feet planted flat, zero sliding
        ankle = [hip[0] + (i === 0 ? 32 : -18) * H, -14];
        toeRot = 0;
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
        // front shoe planted completely flat with deeply bent driving knee
        ankle = [hip[0] + 48 * H, -14];
        toeRot = 0;
      } else {
        // back shoe angled toe-down (+28°) pushing off toes!
        ankle = [hip[0] - thigh * 0.95, -24];
        toeRot = 28;
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
        <TaperLimb
          pts={[hip, knee, ankle]}
          wTop={legW * 1.12}
          wMid={legW * 0.96}
          wBot={legW * 0.80}
          fill={pants}
          dim={shadeO}
          jointCrease={true}
        />
        <g transform={`translate(${ankle[0].toFixed(1)} ${ankle[1].toFixed(1)}) rotate(${toeRot.toFixed(1)})`}>
          <S d={Rr(-18, -6, 62, 26, 12)} f={shoe} />
          {shadeO > 0 && <path d={Rr(-18, -6, 62, 26, 12)} fill={PAL.ink} opacity={shadeO} />}
        </g>
      </g>
    );
  };

  // ---- tay ----
  const shoulder: P = [hipX + 4 * W + topShift + gaitTwist, shY + 26];
  const stoppedOnPath = !freeRun && speed <= 0.04 && (legs === 'walk' || legs === 'run');
  const resolvedArms =
    stoppedOnPath && (arms === 'swing' || arms === 'run')
      ? 'down'
      : arms === 'swing' && (legs === 'run' || legs === 'ride' || legs === 'crouch' || legs === 'jump' || legs === 'fall' || legs === 'push' || legs === 'climb')
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
      // pumping bent elbows (65°–95° flexion), settling cleanly when decelerating
      const armAmp = clamp(runSpd * 1.25, 0, 1);
      const sw = 48 * armAmp * Math.cos(2 * Math.PI * runPhase) * (near ? -1 : 1);
      a = 6 + sw;
      e = 10 + (65 + Math.max(0, sw) * 0.42) * armAmp;
    } else if (resolvedArms === 'ride') {
      // hands gripping forward-down on reins/shell
      a = near ? 38 : 48;
      e = near ? 56 : 48;
    } else if (resolvedArms === 'crouch') {
      a = near ? 26 : 36;
      e = near ? 68 : 60;
    } else if (resolvedArms === 'jump') {
      if (jp < 0.14) {
        // Stage 1: arms swing BACK winding up
        a = near ? -42 : -34;
        e = near ? -22 : -16;
      } else if (jp < 0.52) {
        // Stage 2: arms drive UP & forward
        const u = (jp - 0.14) / 0.38;
        if (near) {
          a = 52 + 18 * u;
          e = 56;
        } else {
          a = -24 + 45 * u;
          e = 36;
        }
      } else if (jp < 0.86) {
        // Stage 3: arms flare out/forward for balance
        const u = (jp - 0.52) / 0.34;
        if (near) {
          a = 62 - 38 * u;
          e = 44 - 20 * u;
        } else {
          a = -34 - 14 * u;
          e = 24;
        }
      } else {
        // Stage 4: arms swing forward-down to absorb shock
        const sqWave = Math.sin(((jp - 0.86) / 0.14) * Math.PI);
        if (near) {
          a = 28 * sqWave;
          e = 24;
        } else {
          a = -18 * sqWave;
          e = 16;
        }
      }
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
  const hasShortSleeve = !fullSleeve && look.top !== 'tank';
  const drawArm = (p: P[], k: string, dim: boolean) => (
    <g key={k}>
      <TaperLimb
        pts={p}
        wTop={armW * 1.08}
        wMid={armW * 0.92}
        wBot={armW * 0.76}
        fill={fullSleeve ? sleeveC : skin}
        dim={dim ? 0.22 : 0}
        sleeveFrac={hasShortSleeve ? 0.48 : undefined}
        sleeveFill={hasShortSleeve ? sleeveC : undefined}
        jointCrease={true}
      />
      <S d={E(p[2][0], p[2][1], 16, 16)} f={skin} />
      {dim && <path d={E(p[2][0], p[2][1], 16, 16)} fill={PAL.ink} opacity={0.22} />}
    </g>
  );

  // ---- thân (curved C-arc spine silhouette) ----
  const sY = shY;
  const bY = hipY;
  const fr = hipX + 54 * W + belly * 34; // bụng phía trước
  const bk = hipX - 52 * W;
  const long = look.top === 'robe' || look.top === 'aothe';
  const hem = long ? bY + 118 * H : bY + 26;
  const torso = curvedTorsoPath(bk, fr, bk, fr, sY, hem, bendX, belly);
  const pat: React.ReactNode[] = [];
  if (look.pattern === 'dots' || look.pattern === 'flowers') {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 4; c++) pat.push(<circle key={r + '-' + c} cx={bk + 12 + c * 26 + (r % 2) * 12} cy={sY + 4 + r * 26} r={5} fill={col(look.patC ?? 'yellow')} />);
  } else if (look.pattern === 'stripes') {
    for (let i = 0; i < 12; i++) pat.push(<rect key={i} x={bk - 40} y={sY + 12 + i * 22} width={240} height={8} fill={col(look.patC ?? 'trim')} />);
  }
  const det: React.ReactNode[] = [];
  if (look.top === 'shirt' || look.top === 'polo' || look.top === 'uniform') {
    det.push(<S key="col" d={`M${hipX + 8 + topShift} ${sY - 14}L${hipX + 30 * W + topShift} ${sY + 8}L${hipX + 18 + topShift} ${sY + 18}Z`} f={look.top === 'polo' ? look.topC2 ?? 'trim' : look.topC} />);
    for (let i = 0; i < (look.top === 'polo' ? 2 : 5); i++) det.push(<circle key={'b' + i} cx={fr - 14 + topShift * (1 - i * 0.16) + (i > 2 ? belly * 10 : 0)} cy={sY + 40 + i * 34} r={4} fill={PAL.ink} />);
    if (look.top === 'uniform') det.push(<S key="pk" d={Rr(hipX + 4 + topShift * 0.7, sY + 50, 34, 34, 6)} f={look.topC} />);
  } else if (look.top === 'suit') {
    det.push(<S key="tie" d={`M${fr - 22 + topShift} ${sY - 6}l12 0l6 110l-14 18Z`} f={look.topC2 ?? 'red'} />);
    det.push(<S key="lap" d={`M${hipX + 8 + topShift} ${sY - 14}L${fr - 8 + topShift * 0.6} ${sY + 120}L${fr - 30 + topShift * 0.8} ${sY + 20}Z`} f={look.topC} />);
  }
  if (look.vest) det.push(<S key="vs" d={`M${bk + 2 + topShift} ${sY + 4}L${fr - 8 + topShift} ${sY + 4}L${fr - 4} ${bY + 20}L${bk} ${bY + 20}Z`} f="orange" />, <rect key="vs2" x={bk} y={bY - 60} width={fr - bk} height={14} fill={PAL.trim} stroke={PAL.ink} strokeWidth={3} />);
  if (look.chain) det.push(<path key="ch" d={`M${hipX + 6 + topShift} ${sY - 12}Q${fr + topShift * 0.8} ${sY + 40} ${fr - 6 + topShift} ${sY - 2}`} fill="none" stroke={PAL.gold} strokeWidth={7} strokeDasharray="2 9" strokeLinecap="round" />);

  // ---- secondary motion: wind hair + gait head lag ----
  const effWind = wind + (legs === 'run' ? runSpd * 0.9 : legs === 'walk' ? speed * 0.25 : legs === 'jump' && jp >= 0.14 && jp < 0.86 ? 0.65 : 0);
  const hw = hairWindOffset(t, effWind, velX, blinkPh);
  const jumpHeadLag =
    jumpPhase === undefined
      ? Math.cos(t * 7 + blinkPh) * 3
      : jp < 0.14
        ? -4
        : jp < 0.52
          ? 3
          : jp < 0.86
            ? -3
            : 5 * Math.sin(((jp - 0.86) / 0.14) * Math.PI);
  const dynamicHeadLag =
    gaitHeadLag +
    (legs === 'jump' ? jumpHeadLag : legs === 'fall' ? Math.sin(t * 16 + blinkPh) * 4.5 : 0) -
    (lean + autoLean) * 0.14 +
    Math.max(-2, Math.min(2, hw.rot * 0.06));

  // ---- đầu ----
  const hy = sY - 8 - HR * 0.9;
  const hx = hipX + 12 + topShift;
  const head = <HeadSide look={look} x={hx} y={hy} r={HR} expr={expr} talk={talk} t={t} blinkPh={blinkPh} tilt={look2 + dynamicHeadLag} hw={hw} />;

  const legBack = drawLeg(1, 0.18);
  const legFront = drawLeg(0, 0);
  const hands = {near: nearA[2], far: farA[2]};
  const breath = Math.sin(t * 2.5 + blinkPh) * 0.008;
  const sq = Math.max(0.5, (squash ?? autoSquash) + breath);
  const sxSq = 1 / Math.sqrt(sq);
  const totalRot = lean + autoLean + (pitch ?? autoPitch);

  const showFar = layer !== 'near';
  const showNear = layer !== 'far';

  return (
    <g transform={`rotate(${totalRot.toFixed(2)} ${hipX.toFixed(1)} ${hipY.toFixed(1)}) scale(${sxSq.toFixed(4)} ${sq.toFixed(4)})`}>
      {showNear && legs === 'fall' && (
        <g>
          <L d={`M${bk - 26} ${sY + 40}q-20 30 6 54`} w={4} o={0.35} />
          <L d={`M${hipX + 104} ${hipY + 34}q20 18 4 44`} w={4} o={0.35} />
        </g>
      )}
      {showFar && drawArm(farA, 'fa', true)}
      {showFar && legBack}
      {showNear && (
        <>
          <S d={torso} f={look.topC} />
          <clipPath id={`ts-${look.name}`}><path d={torso} /></clipPath>
          <g clipPath={`url(#ts-${look.name})`}>
            {pat}
            <Sh d={`M${(bk - 24 + Math.min(0, bendX * 0.6)).toFixed(1)} ${sY - 30}L${(bk + 28 + Math.max(0, bendX * 0.45)).toFixed(1)} ${sY - 30}L${(bk + 28).toFixed(1)} ${hem + 14}L${(bk - 24).toFixed(1)} ${hem + 14}Z`} o={0.55} />
          </g>
          {det}
          <S d={R(hipX - 4 + topShift, sY - 40, 34, 30)} f="skinShade" />
          {legFront}
          {head}
          {prop?.(hands)}
          {drawArm(nearA, 'na', false)}
        </>
      )}
    </g>
  );
};

type HairWind = {dx: number; dy: number; rot: number};

const HeadSide: React.FC<{look: Look; x: number; y: number; r: number; expr: Expr; talk: number; t: number; blinkPh: number; tilt: number; hw: HairWind}> = ({look, x, y, r, expr, talk, t, blinkPh, tilt, hw}) => {
  const skin = look.skin ?? 'skin';
  const hairC = look.hairC ?? 'hair';
  const wdx = hw.dx;
  const wdy = hw.dy;
  const els: React.ReactNode[] = [];
  // tóc phía sau (with wind & bounce secondary motion)
  if (look.hair === 'bun') {
    els.push(
      <g key="bun" transform={`rotate(${(hw.rot * 0.45).toFixed(2)} ${(-r * 0.68).toFixed(1)} ${(-r * 0.45).toFixed(1)}) translate(0 ${(wdy * 0.35).toFixed(1)})`}>
        <S d={E(-r * 0.85, -r * 0.55, r * 0.36, r * 0.32)} f={hairC} />
      </g>,
    );
  }
  if (look.hair === 'long') {
    els.push(
      <S
        key="lg"
        d={`M${(-r * 0.2).toFixed(1)} ${(-r * 0.9).toFixed(1)}C${(-r * 1.2 + wdx * 0.35).toFixed(1)} ${(-r * 0.8 + wdy * 0.25).toFixed(1)} ${(-r * 1.15 + wdx * 0.85).toFixed(1)} ${(r * 0.85 + wdy * 0.65).toFixed(1)} ${(-r * 0.72 + wdx * 1.25).toFixed(1)} ${(r * 1.42 + wdy * 1.05).toFixed(1)}L${(-r * 0.12 + wdx * 0.85).toFixed(1)} ${(r * 1.18 + wdy * 0.75).toFixed(1)}C${(-r * 0.4 + wdx * 0.4).toFixed(1)} ${(r * 0.58 + wdy * 0.35).toFixed(1)} ${(-r * 0.2).toFixed(1)} 0 0 ${(-r * 0.2).toFixed(1)}Z`}
        f={hairC}
      />,
    );
  }
  if (look.hair === 'curly') for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.75 + (i / 6) * 1.0);
    els.push(<S key={'cu' + i} d={E(Math.cos(a) * r * 0.95 - r * 0.05 + wdx * 0.14, Math.sin(a) * r * 0.95 + wdy * 0.14, r * 0.34, r * 0.34)} f={hairC} />);
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
        els.push(<S key={'cf' + i} d={E(Math.cos(a) * r * 0.78 + wdx * 0.08, Math.sin(a) * r * 0.82 + wdy * 0.08, r * 0.3, r * 0.27)} f={hairC} />);
      }
      break;
    case 'spiky':
      hp(
        `M${-r * 0.88} ${r * 0.28}L${-r * 1.18} ${r * 0.14}Q${-r * 1.02} ${-r * 0.02} ${-r * 1.02} ${-r * 0.14}L${-r * 1.38} ${-r * 0.34}Q${-r * 1.12} ${-r * 0.44} ${-r * 1.04} ${-r * 0.56}L${-r * 1.34} ${-r * 0.98}Q${-r * 0.98} ${-r * 0.92} ${-r * 0.82} ${-r * 1.04}L${-r * 0.62} ${-r * 1.44}Q${-r * 0.3} ${-r * 1.18} ${-r * 0.06} ${-r * 1.18}L${r * 0.28} ${-r * 1.36}Q${r * 0.56} ${-r * 1.04} ${r * 0.78} ${-r * 0.84}L${r * 1.14} ${-r * 0.5}Q${r * 0.86} ${-r * 0.46} ${r * 0.72} ${-r * 0.4}L${r * 0.92} ${-r * 0.16}L${r * 0.54} ${-r * 0.36}L${r * 0.44} ${-r * 0.1}L${r * 0.14} ${-r * 0.32}L${-r * 0.04} ${r * 0.04}L${-r * 0.32} ${-r * 0.06}C${-r * 0.52} ${-r * 0.04} ${-r * 0.72} ${r * 0.12} ${-r * 0.88} ${r * 0.28}Z`,
        'h',
      );
      break;
    case 'spikyUp':
      hp(
        `M${-r * 0.88} ${r * 0.28}L${-r * 1.2} ${r * 0.14}Q${-r * 1.02} ${-r * 0.02} ${-r * 1.02} ${-r * 0.14}L${-r * 1.38} ${-r * 0.34}Q${-r * 1.12} ${-r * 0.44} ${-r * 1.04} ${-r * 0.56}L${-r * 1.34} ${-r * 0.98}Q${-r * 0.98} ${-r * 0.92} ${-r * 0.82} ${-r * 1.04}L${-r * 0.62} ${-r * 1.46}Q${-r * 0.3} ${-r * 1.2} ${-r * 0.04} ${-r * 1.2}L${r * 0.32} ${-r * 1.54}Q${r * 0.46} ${-r * 1.16} ${r * 0.64} ${-r * 1.06}L${r * 1.08} ${-r * 1.14}Q${r * 0.86} ${-r * 0.84} ${r * 0.84} ${-r * 0.68}L${r * 1.12} ${-r * 0.58}Q${r * 0.84} ${-r * 0.48} ${r * 0.62} ${-r * 0.54}C${r * 0.32} ${-r * 0.58} ${r * 0.08} ${-r * 0.46} ${-r * 0.04} ${-r * 0.02}L${-r * 0.32} ${-r * 0.08}C${-r * 0.52} ${-r * 0.04} ${-r * 0.72} ${r * 0.12} ${-r * 0.88} ${r * 0.28}Z`,
        'h',
      );
      break;
    default:
      // side/neat/short/kid/bun/long: mũ tóc phủ đỉnh và gáy, mái chấm trán
      hp(`M${-r * 0.92} ${r * 0.25}C${-r * 1.05} ${-r * 0.9} ${r * 0.3} ${-r * 1.25} ${r * 0.86} ${-r * 0.42}C${r * 0.6} ${-r * 0.5} ${r * 0.35} ${-r * 0.45} ${r * 0.16} ${-r * 0.36}C${0} ${-r * 0.3} ${-r * 0.2} ${-r * 0.1} ${-r * 0.32} ${r * 0.0}C${-r * 0.5} ${-r * 0.06} ${-r * 0.7} ${r * 0.1} ${-r * 0.92} ${r * 0.25}Z`, 'h');
      if (look.hair === 'kid' || look.hair === 'short') {
        els.push(
          <g key="spk" transform={`rotate(${(hw.rot * 0.55).toFixed(2)} ${(r * 0.6).toFixed(1)} ${(-r * 0.52).toFixed(1)})`}>
            <path d={`M${(r * 0.6).toFixed(1)} ${(-r * 0.52).toFixed(1)}l${(r * 0.14).toFixed(1)} ${(-r * 0.1).toFixed(1)}l${(-r * 0.02).toFixed(1)} ${(r * 0.14).toFixed(1)}`} fill={col(hairC)} stroke={PAL.ink} strokeWidth={4} />
          </g>,
        );
      }
  }
  // mũ
  const hat = look.hat ?? 'none';
  const hatC = look.hatC ?? 'navy';
  if (hat === 'cap') {
    els.push(<S key="cap" d={`M${-r * 0.9} ${-r * 0.36}C${-r * 0.9} ${-r * 1.15} ${r * 0.8} ${-r * 1.15} ${r * 0.86} ${-r * 0.42}Z`} f={hatC} />);
    els.push(<S key="capb" d={`M${r * 0.5} ${-r * 0.46}h${r * 0.75}l${-r * 0.06} ${r * 0.14}h${-r * 0.7}Z`} f="ink" />);
  } else if (hat === 'capBack') {
    els.push(
      <S key="cbb" d={`M${-r * 0.8} ${-r * 0.44}L${-r * 1.54} ${-r * 0.16}C${-r * 1.56} ${-r * 0.03} ${-r * 1.42} ${r * 0.04} ${-r * 1.24} ${-r * 0.02}L${-r * 0.7} ${-r * 0.26}Z`} f={hatC} />,
      <S key="cbd" d={`M${-r * 0.94} ${-r * 0.36}C${-r * 1.0} ${-r * 1.12} ${r * 0.34} ${-r * 1.16} ${r * 0.68} ${-r * 0.56}C${r * 0.2} ${-r * 0.6} ${-r * 0.42} ${-r * 0.5} ${-r * 0.94} ${-r * 0.36}Z`} f={hatC} />,
      <S key="cbs" d={`M${r * 0.26} ${-r * 0.62}C${r * 0.4} ${-r * 0.82} ${r * 0.58} ${-r * 0.78} ${r * 0.64} ${-r * 0.57}Z`} f="ink" sw={3.5} />,
      <L key="cbst" d={`M${r * 0.28} ${-r * 0.63}L${r * 0.63} ${-r * 0.58}`} w={6} c={hatC} />,
    );
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
    const bSway = look.beard === 'long' ? wdx * 0.35 : wdx * 0.1;
    els.push(<S key="bd" d={`M${(mx - r * 0.3).toFixed(1)} ${(my + r * 0.18).toFixed(1)}Q${(mx - r * 0.1 + bSway).toFixed(1)} ${(my + r * 0.2 + bl).toFixed(1)} ${(mx + r * 0.05).toFixed(1)} ${(my + r * 0.18).toFixed(1)}Z`} f={look.beardC ?? hairC} />);
  }
  if (look.glasses === 'round' || look.glasses === 'square') {
    els.push(look.glasses === 'round' ? <circle key="gl" cx={ex + 4} cy={ey} r={r * 0.24} fill={PAL.white} fillOpacity={0.25} stroke={PAL.ink} strokeWidth={5} /> : <rect key="gl" x={ex - r * 0.2} y={ey - r * 0.17} width={r * 0.48} height={r * 0.34} rx={6} fill={PAL.white} fillOpacity={0.25} stroke={PAL.ink} strokeWidth={5} />);
    els.push(<L key="ga" d={`M${ex - r * 0.2} ${ey - 2}L${-r * 0.16} ${-r * 0.04}`} w={4} />);
  }
  if (look.glasses === 'sun') {
    els.push(<S key="sg" d={`M${ex - r * 0.22} ${ey - r * 0.14}h${r * 0.5}l${-r * 0.04} ${r * 0.26}q${-r * 0.2} ${r * 0.08} ${-r * 0.42} 0Z`} f="ink" sw={3} />);
    els.push(<L key="sga" d={`M${ex - r * 0.22} ${ey - r * 0.08}L${-r * 0.16} ${-r * 0.04}`} w={5} />);
  }
  return <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(-tilt).toFixed(2)} 0 ${(r * 0.8).toFixed(1)})`}>{els}</g>;
};
