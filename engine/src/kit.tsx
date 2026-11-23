// Bộ nét vẽ dùng chung: style "Mực in risograph" (style B đã chọn ở style-lab).
import React from 'react';
import {loadFont} from '@remotion/google-fonts/BeVietnamPro';

export const {fontFamily: FONT} = loadFont('normal', {weights: ['600', '800', '900'], subsets: ['vietnamese', 'latin']});

export const PAL = {
  sky1: '#ffd65c', sky2: '#fff2b8',
  wallA: '#ffe08a', wallB: '#7fd1c3', wallC: '#ff8fa8', wallD: '#ffcf9e',
  shade: '#2b4f9e', trim: '#fff6df', grille: '#1f2f6e', glass: '#4a8fc9', glassLit: '#ffd65c', dark: '#1f2f6e',
  roof: '#7fd1c3', tank: '#fff6df', ground: '#ffe9b0', floor: '#f6c98a', floorDark: '#e0a964',
  skin: '#ffb59a', skinShade: '#ff7f8a', blush: '#ff5f8a', hair: '#1f2f6e', hairGrey: '#9aa6c9',
  red: '#ff4d5e', redDark: '#c22f52', gold: '#ffc23d', goldDark: '#d9892b', wood: '#c4573a', woodDark: '#8a3434',
  plant: '#2fae8f', plantDark: '#1f6f73', pot: '#ff8f5f',
  ink: '#1f2f6e', paper: '#fff6df', stamp: '#ff4d5e', pole: '#7fd1c3', wire: '#1f2f6e',
  teal: '#2fae8f', blue: '#4a8fc9', pink: '#ff8fa8', yellow: '#ffd65c', orange: '#ff8f5f', navy: '#1f2f6e', white: '#fffaf0',
  ghost: '#bfeee6', ghostDeep: '#7fd1c3',
  steel: '#c3cde3', steelDark: '#7f8fb3', mirror: '#d6eef0', led: '#ff3b3b', lit: '#fff3a8', green: '#7ccf6a',
  concrete: '#cfd6e6', concreteDark: '#8e9bbf', asphalt: '#5a6a96', asphaltDark: '#3f4d7a', lane: '#fff6df',
};
export type PK = keyof typeof PAL;
export const col = (c: string) => (PAL as Record<string, string>)[c] ?? c;

export const LINE = 5;
export const LC = PAL.ink;

type SP = {d: string; f: string; o?: number; nl?: boolean; sw?: number; tr?: string; lc?: string};
/** mảng màu có viền mực */
export const S: React.FC<SP> = ({d, f, o, nl, sw, tr, lc}) => (
  <path d={d} fill={col(f)} opacity={o} transform={tr} stroke={nl ? 'none' : lc ?? LC} strokeWidth={sw ?? LINE} strokeLinejoin="round" strokeLinecap="round" />
);
/** nét mực */
export const L: React.FC<{d: string; w?: number; c?: string; o?: number}> = ({d, w = LINE, c = 'ink', o}) => (
  <path d={d} fill="none" stroke={col(c)} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} />
);
/** bóng đổ: chấm halftone kiểu riso */
export const Sh: React.FC<{d: string; o?: number; dots?: 'dots' | 'dotsR' | 'dotsW'}> = ({d, o = 0.85, dots = 'dots'}) => <path d={d} fill={`url(#${dots})`} opacity={o} />;

export const R = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}Z`;
export const Rr = (x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
};
export const E = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

export const Txt: React.FC<{x: number; y: number; s: number; c?: string; w?: number; a?: 'start' | 'middle' | 'end'; r?: number; o?: number; stroke?: string; sw?: number; ls?: number; children: React.ReactNode}> = ({
  x, y, s, c = 'ink', w = 800, a = 'middle', r = 0, o, stroke, sw = 0, ls = 0, children,
}) => (
  <text x={x} y={y} fontSize={s} fontFamily={FONT} fontWeight={w} textAnchor={a} fill={col(c)} opacity={o} letterSpacing={ls}
    stroke={stroke ? col(stroke) : undefined} strokeWidth={sw} paintOrder="stroke" strokeLinejoin="round"
    transform={r ? `rotate(${r} ${x} ${y})` : undefined}>{children}</text>
);

type GrainSpeck = {x: number; y: number; r: number; w: number; h: number; rect: boolean; fill: string; o: number};
const makeGrainSpeckles = (seed: number, count = 72): GrainSpeck[] => {
  let st = ((Math.abs(Math.floor(seed)) || 1) * 1664525 + 1013904223) >>> 0;
  const next = () => {
    st = (Math.imul(st, 1664525) + 1013904223) >>> 0;
    return st / 4294967296;
  };
  const out: GrainSpeck[] = [];
  for (let i = 0; i < count; i++) {
    const x = +(next() * 94 + 1).toFixed(1);
    const y = +(next() * 94 + 1).toFixed(1);
    const r = +(0.6 + next() * 0.7).toFixed(2);
    const isLight = next() < 0.32;
    const fill = isLight ? PAL.paper : PAL.ink;
    const o = isLight ? +(0.04 + next() * 0.03).toFixed(3) : +(0.04 + next() * 0.07).toFixed(3);
    const rect = next() < 0.35;
    const w = +(r * (1.2 + next() * 0.7)).toFixed(2);
    const h = +(r * (0.9 + next() * 0.6)).toFixed(2);
    out.push({x, y, r, w, h, rect, fill, o});
  }
  return out;
};
const DEFAULT_GRAIN_SPECKLES = makeGrainSpeckles(1, 72);

/** defs dùng chung toàn phim (đặt một lần trong mỗi svg gốc, memo hoá để không render lại mỗi frame) */
export const Defs: React.FC<{seed?: number}> = React.memo(({seed = 1}) => {
  const speckles = seed === 1 ? DEFAULT_GRAIN_SPECKLES : makeGrainSpeckles(seed, 72);
  return (
    <defs>
      <pattern id="dots" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <circle cx="5.5" cy="5.5" r="2.7" fill={PAL.shade} />
      </pattern>
      <pattern id="dotsR" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <circle cx="5.5" cy="5.5" r="2.7" fill={PAL.redDark} />
      </pattern>
      <pattern id="dotsW" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <circle cx="6" cy="6" r="2.4" fill={PAL.white} />
      </pattern>
      <pattern id="dotsBig" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <circle cx="11" cy="11" r="5" fill={PAL.shade} />
      </pattern>
      <pattern id="grainPat" width="96" height="96" patternUnits="userSpaceOnUse">
        {speckles.map((sp, i) =>
          sp.rect ? (
            <rect key={i} x={sp.x} y={sp.y} width={sp.w} height={sp.h} fill={sp.fill} opacity={sp.o} />
          ) : (
            <circle key={i} cx={sp.x} cy={sp.y} r={sp.r} fill={sp.fill} opacity={sp.o} />
          ),
        )}
      </pattern>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} />
        <feColorMatrix type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.18  0 0 0 0 0.43  0 0 0 0.14 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75">
        <stop offset="0.6" stopColor={PAL.navy} stopOpacity={0} />
        <stop offset="1" stopColor={PAL.navy} stopOpacity={0.18} />
      </radialGradient>
      <radialGradient id="glowY">
        <stop offset="0" stopColor="#fff2b8" stopOpacity={0.9} />
        <stop offset="1" stopColor="#fff2b8" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="glowG">
        <stop offset="0" stopColor={PAL.ghost} stopOpacity={0.85} />
        <stop offset="1" stopColor={PAL.ghost} stopOpacity={0} />
      </radialGradient>
      <linearGradient id="moodGolden" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={PAL.yellow} stopOpacity={0.95} />
        <stop offset="0.55" stopColor={PAL.orange} stopOpacity={0.65} />
        <stop offset="1" stopColor={PAL.goldDark} stopOpacity={0.45} />
      </linearGradient>
      <radialGradient id="moodDanger" cx="0.5" cy="0.5" r="0.72">
        <stop offset="0.35" stopColor={PAL.red} stopOpacity={0} />
        <stop offset="0.78" stopColor={PAL.red} stopOpacity={0.55} />
        <stop offset="1" stopColor={PAL.navy} stopOpacity={0.95} />
      </radialGradient>
      <radialGradient id="moodLab" cx="0.5" cy="0.12" r="0.85">
        <stop offset="0" stopColor={PAL.ghost} stopOpacity={0.95} />
        <stop offset="0.55" stopColor={PAL.teal} stopOpacity={0.45} />
        <stop offset="1" stopColor={PAL.navy} stopOpacity={0.25} />
      </radialGradient>
      <linearGradient id="moodMorning" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor={PAL.white} stopOpacity={0.95} />
        <stop offset="0.5" stopColor={PAL.sky2} stopOpacity={0.65} />
        <stop offset="1" stopColor={PAL.sky2} stopOpacity={0} />
      </linearGradient>
      <radialGradient id="moodFlashback" cx="0.5" cy="0.48" r="0.78">
        <stop offset="0.15" stopColor={PAL.paper} stopOpacity={0.35} />
        <stop offset="0.7" stopColor={PAL.goldDark} stopOpacity={0.55} />
        <stop offset="1" stopColor={PAL.goldDark} stopOpacity={0.92} />
      </radialGradient>
      <radialGradient id="moodDramatic" cx="0.5" cy="0.45" r="0.72">
        <stop offset="0" stopColor={PAL.yellow} stopOpacity={0.35} />
        <stop offset="0.48" stopColor={PAL.navy} stopOpacity={0.12} />
        <stop offset="1" stopColor={PAL.navy} stopOpacity={0.95} />
      </radialGradient>
    </defs>
  );
});

const GRAIN_CACHE = new Map<number, string>();
/** Pre-baked 256x256 seamless Risograph ink grain tile (replaces per-frame 2M-px CPU feTurbulence) */
export const getGrainUri = (seed = 1): string => {
  if (typeof document === 'undefined') return '';
  const hit = GRAIN_CACHE.get(seed);
  if (hit !== undefined) return hit;
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = N;
  cv.height = N;
  const ctx = cv.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(N, N);
  const d = img.data;
  const hash = (x: number, y: number, s: number) => {
    let h = Math.imul(x & 255, 374761393) ^ Math.imul(y & 255, 668265263) ^ Math.imul(s, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const o1 = (hash(x, y, seed) + hash(x + 1, y, seed) + hash(x, y + 1, seed) + hash(x + 1, y + 1, seed)) * 0.25;
      const o2 = hash(x, y, seed + 97);
      const aTurb = 0.5 + (o1 - 0.5) * 0.65 + (o2 - 0.5) * 0.35;
      const i = (y * N + x) * 4;
      d[i] = 31;
      d[i + 1] = 46;
      d[i + 2] = 110;
      d[i + 3] = Math.max(0, Math.min(40, Math.round(aTurb * 0.14 * 255)));
    }
  }
  ctx.putImageData(img, 0, 0);
  const uri = cv.toDataURL('image/png');
  GRAIN_CACHE.set(seed, uri);
  return uri;
};

/** GPU-composited static Risograph grain overlay (normal alpha source-over: zero backdrop readback) */
export const GrainOverlay: React.FC<{seed?: number; height?: number | string}> = React.memo(({seed = 1, height = '100%'}) => {
  const uri = getGrainUri(seed);
  if (!uri) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height,
        backgroundImage: `url(${uri})`,
        backgroundRepeat: 'repeat',
        backgroundSize: '256px 256px',
        pointerEvents: 'none',
      }}
    />
  );
});

/** khói hương: một dải cong lượn theo thời gian */
export const Smoke: React.FC<{x: number; y: number; t: number; h?: number; w?: number; o?: number; ph?: number}> = ({x, y, t, h = 220, w = 6, o = 0.75, ph = 0}) => {
  const pts: string[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    const xx = x + Math.sin(u * 5 + t * 1.6 + ph) * (6 + u * 26);
    const yy = y - u * h;
    pts.push(`${i === 0 ? 'M' : 'L'}${xx.toFixed(1)} ${yy.toFixed(1)}`);
  }
  return <path d={pts.join('')} fill="none" stroke={PAL.white} strokeWidth={w} strokeLinecap="round" opacity={o} />;
};

// ---------------- organic riso-ink botanical primitives (PAL tokens only) ----------------
const botRand = (seed: number, i: number) => {
  const v = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export type GrassTuftProps = {
  x: number;
  y: number;
  s?: number;
  lean?: number;
  tone?: 'light' | 'mid' | 'dark';
  seed?: number;
  t?: number;
};

/** Organic 5-7 blade riso-ink grass tuft with asymmetric heights, folded tips, wind sway, and halftone shade. */
export const GrassTuft: React.FC<GrassTuftProps> = ({x, y, s = 1, lean = 0, tone = 'mid', seed = 1, t = 0}) => {
  const count = 5 + (Math.abs(Math.round(seed)) % 3);
  const fills =
    tone === 'light'
      ? {back: PAL.plant, front: PAL.green, accent: PAL.green, shade: 0}
      : tone === 'dark'
        ? {back: PAL.navy, front: PAL.plantDark, accent: PAL.plant, shade: 0.48}
        : {back: PAL.plantDark, front: PAL.plant, accent: PAL.green, shade: 0.3};

  const blades = Array.from({length: count}, (_, i) => {
    const frac = count > 1 ? i / (count - 1) : 0.5;
    const spread = (frac - 0.5) * 2; // -1..+1
    const rH = botRand(seed, i * 3 + 1);
    const rW = botRand(seed, i * 3 + 2);
    const rB = botRand(seed, i * 3 + 3);
    const centerBias = 1 - Math.abs(spread) * 0.38;
    const h = (38 + rH * 46) * centerBias;
    const bw = 4.6 + rW * 4.4;
    const bx = spread * 22 + (rB - 0.5) * 6;
    const sway = Math.sin(t * 2 + seed + i * 0.45) * (3.5 + h * 0.045);
    const tipX = bx + spread * (16 + rB * 24) + lean * (0.65 + rH * 0.5) + sway;
    const tipY = -h;
    const hasFold = h > 58 && botRand(seed, i + 41) > 0.42;
    const foldDir = Math.sign(tipX - bx || spread || 1);
    const crestX = bx + (tipX - bx) * 0.72;
    const crestY = -h * 1.03;
    const foldX = tipX + foldDir * (9 + rW * 7);
    const foldY = tipY + 10 + rB * 9;
    const midX = (bx + (hasFold ? crestX : tipX)) * 0.5 + foldDir * (3 + rW * 4);
    const midY = -h * 0.52;

    const d = hasFold
      ? `M${(bx - bw).toFixed(1)} 0 Q${(midX - bw * 0.65).toFixed(1)} ${midY.toFixed(1)} ${(crestX - bw * 0.25).toFixed(1)} ${crestY.toFixed(1)} Q${(tipX + foldDir * 3).toFixed(1)} ${(tipY - 2).toFixed(1)} ${foldX.toFixed(1)} ${foldY.toFixed(1)} Q${(tipX - foldDir * 2).toFixed(1)} ${(tipY + 7).toFixed(1)} ${(crestX + bw * 0.2).toFixed(1)} ${(crestY + 7).toFixed(1)} Q${(midX + bw * 0.6).toFixed(1)} ${(midY + 4).toFixed(1)} ${(bx + bw).toFixed(1)} 0 Z`
      : `M${(bx - bw).toFixed(1)} 0 Q${(midX - bw * 0.55).toFixed(1)} ${midY.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q${(midX + bw * 0.55).toFixed(1)} ${(midY + 3).toFixed(1)} ${(bx + bw).toFixed(1)} 0 Z`;

    const rib = hasFold
      ? `M${bx.toFixed(1)} -3 Q${midX.toFixed(1)} ${(midY + 2).toFixed(1)} ${crestX.toFixed(1)} ${(crestY + 5).toFixed(1)}`
      : `M${bx.toFixed(1)} -3 Q${midX.toFixed(1)} ${(midY + 2).toFixed(1)} ${(bx + (tipX - bx) * 0.72).toFixed(1)} ${(tipY * 0.72).toFixed(1)}`;

    const layer = i % 2 === 0 ? 0 : 1; // 0 = back, 1 = front
    const fill = layer === 0 ? fills.back : i === Math.floor(count / 2) ? fills.accent : fills.front;
    return {i, d, rib, h, layer, fill};
  }).sort((a, b) => a.layer - b.layer || b.h - a.h);

  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})`}>
      {blades.map((b) => (
        <g key={b.i}>
          <S d={b.d} f={b.fill} sw={3.2} />
          {fills.shade > 0 && b.layer === 0 && <Sh d={b.d} o={fills.shade} />}
          {b.h > 54 && <L d={b.rib} w={1.8} c="ink" o={0.5} />}
        </g>
      ))}
      <L d="M-24 1 Q0 -3 24 1" w={3.2} c="ink" o={0.75} />
    </g>
  );
};

export type FernLeafProps = {
  x: number;
  y: number;
  len?: number;
  angle?: number;
  tone?: 'light' | 'mid' | 'dark';
  flip?: boolean;
  t?: number;
};

/** Arching riso-ink fern frond with tapered organic leaflets along both sides of the rachis. */
export const FernLeaf: React.FC<FernLeafProps> = ({x, y, len = 160, angle = -35, tone = 'mid', flip = false, t = 0}) => {
  const safeLen = Math.max(24, len);
  const sway = Math.sin(t * 1.7 + x * 0.015 + y * 0.01) * 2.4;
  const fill = tone === 'light' ? PAL.green : tone === 'dark' ? PAL.plantDark : PAL.plant;
  const stemC = tone === 'light' ? 'plantDark' : 'ink';
  const shadeO = tone === 'dark' ? 0.42 : tone === 'mid' ? 0.22 : 0;

  // Quadratic arching rachis: P0=(0,0), P1=(0.48*L, -0.28*L), P2=(L, -0.05*L)
  const p1x = safeLen * 0.48;
  const p1y = -safeLen * 0.28;
  const p2x = safeLen;
  const p2y = -safeLen * 0.05;

  const evalQ = (u: number) => {
    const m = 1 - u;
    const px = 2 * m * u * p1x + u * u * p2x;
    const py = 2 * m * u * p1y + u * u * p2y;
    const dtx = 2 * m * p1x + 2 * u * (p2x - p1x);
    const dty = 2 * m * p1y + 2 * u * (p2y - p1y);
    const mag = Math.hypot(dtx, dty) || 1;
    return {px, py, tx: dtx / mag, ty: dty / mag, nx: -dty / mag, ny: dtx / mag};
  };

  const pairs = 8;
  const leaflets: {k: string; d: string; side: number}[] = [];
  for (let i = 0; i < pairs; i++) {
    const u = 0.14 + (i / (pairs - 1)) * 0.76;
    const {px, py, tx, ty, nx, ny} = evalQ(u);
    const env = Math.sin(u * Math.PI) * (1 - 0.16 * u);
    const lLen = safeLen * (0.09 + 0.19 * env);
    const lW = lLen * 0.27;
    for (const side of [-1, 1]) {
      const sweep = 0.42;
      const dx = nx * side * 0.92 + tx * sweep;
      const dy = ny * side * 0.92 + ty * sweep;
      const tipX = px + dx * lLen;
      const tipY = py + dy * lLen;
      const c1x = px + dx * lLen * 0.45 + tx * lW * 0.75;
      const c1y = py + dy * lLen * 0.45 + ty * lW * 0.75;
      const c2x = px + dx * lLen * 0.48 - tx * lW * 0.55;
      const c2y = py + dy * lLen * 0.48 - ty * lW * 0.55;
      const d = `M${px.toFixed(1)} ${py.toFixed(1)} Q${c1x.toFixed(1)} ${c1y.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q${c2x.toFixed(1)} ${c2y.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)} Z`;
      leaflets.push({k: `${i}-${side}`, d, side});
    }
  }

  // Pointed terminal leaflet at frond tip
  const end = evalQ(0.92);
  const tLen = safeLen * 0.13;
  const tW = tLen * 0.28;
  const tTipX = end.px + end.tx * tLen;
  const tTipY = end.py + end.ty * tLen;
  const termD = `M${end.px.toFixed(1)} ${end.py.toFixed(1)} Q${(end.px + end.tx * tLen * 0.45 + end.nx * tW).toFixed(1)} ${(end.py + end.ty * tLen * 0.45 + end.ny * tW).toFixed(1)} ${tTipX.toFixed(1)} ${tTipY.toFixed(1)} Q${(end.px + end.tx * tLen * 0.45 - end.nx * tW).toFixed(1)} ${(end.py + end.ty * tLen * 0.45 - end.ny * tW).toFixed(1)} ${end.px.toFixed(1)} ${end.py.toFixed(1)} Z`;

  const rachisD = `M0 0 Q${p1x.toFixed(1)} ${p1y.toFixed(1)} ${p2x.toFixed(1)} ${p2y.toFixed(1)}`;

  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${flip ? -1 : 1} 1) rotate(${(angle + sway).toFixed(1)})`}>
      {leaflets.map((lf) => (
        <g key={lf.k}>
          <S d={lf.d} f={fill} sw={2.6} />
          {shadeO > 0 && lf.side > 0 && <Sh d={lf.d} o={shadeO} />}
        </g>
      ))}
      <S d={termD} f={fill} sw={2.6} />
      <L d={rachisD} w={3.4} c={stemC} />
    </g>
  );
};

export type WildflowerProps = {
  x: number;
  y: number;
  s?: number;
  kind?: 'daisy' | 'dandelion' | 'bell' | 'clover';
  petalC?: string;
  t?: number;
};

/** Recognizable riso-ink meadow flora: daisy, dandelion puffball, drooping bellflower, or 3/4-leaf clover cluster. */
export const Wildflower: React.FC<WildflowerProps> = ({x, y, s = 1, kind = 'daisy', petalC, t = 0}) => {
  const sway = Math.sin(t * 2.1 + x * 0.025 + y * 0.01) * 4;

  if (kind === 'dandelion') {
    const hx = sway * 1.1;
    const hy = -74;
    const spokes = 10;
    const drift1 = ((t * 14 + x) % 32);
    const drift2 = ((t * 10 + y + 14) % 28);
    return (
      <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})`}>
        <S d="M-2 0 Q-18 -8 -26 -2 Q-14 -1 -2 -6 Z" f="plant" sw={2.6} />
        <S d="M2 0 Q18 -10 24 -3 Q12 -1 2 -7 Z" f="green" sw={2.6} />
        <L d={`M0 0 Q${(hx * 0.45 - 4).toFixed(1)} -36 ${hx.toFixed(1)} ${hy.toFixed(1)}`} w={3.4} c="plantDark" />
        <circle cx={hx} cy={hy} r={22} fill={PAL.white} opacity={0.82} stroke={PAL.ink} strokeWidth={2.4} strokeDasharray="5 4" />
        {Array.from({length: spokes}, (_, i) => {
          const a = (i / spokes) * Math.PI * 2 + 0.18;
          const r1 = 5;
          const r2 = 19;
          const x1 = hx + Math.cos(a) * r1;
          const y1 = hy + Math.sin(a) * r1;
          const x2 = hx + Math.cos(a) * r2;
          const y2 = hy + Math.sin(a) * r2;
          const px = -Math.sin(a) * 3.5;
          const py = Math.cos(a) * 3.5;
          const tip = `M${(x2 - px).toFixed(1)} ${(y2 - py).toFixed(1)} Q${(x2 + Math.cos(a) * 3).toFixed(1)} ${(y2 + Math.sin(a) * 3).toFixed(1)} ${(x2 + px).toFixed(1)} ${(y2 + py).toFixed(1)}`;
          return (
            <g key={i}>
              <L d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`} w={1.6} c="ink" o={0.75} />
              <L d={tip} w={2} c="white" />
            </g>
          );
        })}
        <S d={E(hx, hy, 5.5, 5.5)} f="plantDark" sw={2.4} />
        <g transform={`translate(${(hx + 22 + drift1).toFixed(1)} ${(hy - 10 - drift1 * 0.45).toFixed(1)})`} opacity={Math.max(0.15, 1 - drift1 / 34)}>
          <L d="M0 0 L4 7 M-4 -2 Q0 1 4 -2" w={1.6} c="ink" />
          <circle cx={4} cy={7} r={1.8} fill={PAL.plantDark} />
        </g>
        <g transform={`translate(${(hx + 16 + drift2 * 1.1).toFixed(1)} ${(hy - 22 - drift2 * 0.35).toFixed(1)})`} opacity={Math.max(0.15, 1 - drift2 / 30)}>
          <L d="M0 0 L3 6 M-3 -2 Q0 1 3 -2" w={1.5} c="ink" />
          <circle cx={3} cy={6} r={1.6} fill={PAL.plantDark} />
        </g>
      </g>
    );
  }

  if (kind === 'bell') {
    const bellFill = col(petalC ?? 'blue');
    const b1x = 18 + sway;
    const b1y = -62;
    const b2x = 5 + sway * 0.85;
    const b2y = -72;
    const bellPath = (bx: number, by: number, sc: number, rot: number) => (
      <g transform={`translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(${rot}) scale(${sc})`}>
        <S d="M0 0 C-9 2 -13 13 -16 24 Q-8 20 -3 25 Q2 20 8 25 Q12 20 16 23 C13 13 9 2 0 0 Z" f={bellFill} sw={2.8} />
        <Sh d="M0 0 C-9 2 -13 13 -16 24 Q-8 20 -3 25 L0 2 Z" o={0.22} />
        <S d="M-5 -1 Q0 -6 5 -1 Q0 3 -5 -1 Z" f="plantDark" sw={2.2} />
        <circle cx={0} cy={25} r={3} fill={PAL.gold} stroke={PAL.ink} strokeWidth={1.8} />
      </g>
    );
    return (
      <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})`}>
        <S d="M0 0 Q-16 -22 -24 -42 Q-10 -26 0 -10 Z" f="plant" sw={2.6} />
        <L d={`M0 0 C-8 -30 -10 -78 6 -78 C16 -78 ${b1x.toFixed(1)} -72 ${b1x.toFixed(1)} ${b1y.toFixed(1)}`} w={3.4} c="plantDark" />
        {bellPath(b2x, b2y, 0.76, -12)}
        {bellPath(b1x, b1y, 1, 8)}
      </g>
    );
  }

  if (kind === 'clover') {
    const heartLeaf = (ang: number, fill: string, sc = 1) => (
      <g key={ang} transform={`rotate(${ang}) scale(${sc})`}>
        <S d="M0 0 C-11 -4 -17 -17 -9 -23 C-4 -27 0 -22 0 -18 C0 -22 4 -27 9 -23 C17 -17 11 -4 0 0 Z" f={fill} sw={2.6} />
        <L d="M-5 -10 Q0 -14 5 -10" w={2} c="paper" o={0.8} />
      </g>
    );
    const c1x = -8 + sway * 0.55;
    const c1y = -34;
    const c2x = 15 + sway * 0.45;
    const c2y = -24;
    return (
      <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})`}>
        <L d={`M-2 0 Q${(c1x * 0.6 - 4).toFixed(1)} -16 ${c1x.toFixed(1)} ${c1y.toFixed(1)}`} w={3.2} c="plantDark" />
        <L d={`M3 0 Q${(c2x * 0.6 + 4).toFixed(1)} -12 ${c2x.toFixed(1)} ${c2y.toFixed(1)}`} w={2.8} c="plantDark" />
        {/* 4-leaf lucky clover cluster */}
        <g transform={`translate(${c2x.toFixed(1)} ${c2y.toFixed(1)})`}>
          {[-45, 45, 135, 225].map((a, idx) => heartLeaf(a, idx % 2 === 0 ? PAL.plant : PAL.green, 0.72))}
        </g>
        {/* 3-leaf shamrock cluster */}
        <g transform={`translate(${c1x.toFixed(1)} ${c1y.toFixed(1)})`}>
          {[-90, 30, 150].map((a, idx) => heartLeaf(a, idx === 0 ? PAL.green : PAL.plant, 0.96))}
          {petalC && <S d={E(0, 0, 5, 5)} f={petalC} sw={2.2} />}
        </g>
      </g>
    );
  }

  // default: 'daisy' — 6 rounded petals + gold disc
  const pFill = col(petalC ?? 'white');
  const hx = sway;
  const hy = -66;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})`}>
      <S d="M-1 -12 Q-18 -20 -24 -10 Q-12 -6 -1 -10 Z" f="plant" sw={2.6} />
      <S d="M1 -18 Q18 -28 24 -18 Q12 -14 1 -16 Z" f="green" sw={2.6} />
      <L d={`M0 0 Q${(hx * 0.5 - 3).toFixed(1)} -34 ${hx.toFixed(1)} ${hy.toFixed(1)}`} w={3.4} c="plantDark" />
      <g transform={`translate(${hx.toFixed(1)} ${hy.toFixed(1)})`}>
        {Array.from({length: 6}, (_, i) => {
          const deg = i * 60 + (i % 2 === 0 ? -4 : 5);
          return (
            <g key={i} transform={`rotate(${deg})`}>
              <S d="M0 -5 C-7 -10 -9 -24 0 -27 C9 -24 7 -10 0 -5 Z" f={pFill} sw={2.8} />
            </g>
          );
        })}
        <S d={E(0, 0, 9.5, 9.5)} f="gold" sw={2.8} />
        <S d={E(2, 2, 4.5, 4.5)} f="goldDark" nl o={0.65} />
        <circle cx={-3} cy={-3} r={2} fill={PAL.paper} opacity={0.85} />
      </g>
    </g>
  );
};

export type BotanicalEdgeProps = {
  w: number;
  h: number;
  side?: 'left' | 'right' | 'both';
  t?: number;
};

/** Clean dark-silhouette foreground framing foliage restricted strictly to the outer 12% edges (central 76% open). */
export const BotanicalEdge: React.FC<BotanicalEdgeProps> = ({w, h, side = 'both', t = 0}) => {
  const edgeW = Math.max(24, w * 0.12);
  const renderCluster = (isRight: boolean) => {
    const ph = isRight ? 1.9 : 0.3;
    const sw1 = Math.sin(t * 1.4 + ph) * 2.2;
    const sw2 = Math.cos(t * 1.2 + ph) * 2.0;
    const reach1 = edgeW * 0.92;
    const reach2 = edgeW * 0.78;
    const reach3 = edgeW * 0.86;
    const yOff = isRight ? h * 0.03 : 0;
    const fernLen = Math.min(edgeW * 0.88, h * 0.14);

    // Broad curved silhouette leaves anchored at x = -10, strictly <= edgeW (12% of w)
    const leafLowA = `M-10 ${(h * 0.98).toFixed(1)} Q${(reach1 * 0.52).toFixed(1)} ${(h * 0.88).toFixed(1)} ${(reach1 + sw1).toFixed(1)} ${(h * 0.81).toFixed(1)} Q${(reach1 * 0.45).toFixed(1)} ${(h * 0.97).toFixed(1)} -10 ${(h * 1.02).toFixed(1)} Z`;
    const leafLowB = `M-10 ${(h * 0.88 - yOff).toFixed(1)} Q${(reach2 * 0.58).toFixed(1)} ${(h * 0.77 - yOff).toFixed(1)} ${(reach2 + sw2).toFixed(1)} ${(h * 0.72 - yOff).toFixed(1)} Q${(reach2 * 0.38).toFixed(1)} ${(h * 0.84 - yOff).toFixed(1)} -10 ${(h * 0.92 - yOff).toFixed(1)} Z`;
    const leafTop = `M-10 ${(h * 0.1 + yOff).toFixed(1)} Q${(reach3 * 0.56).toFixed(1)} ${(h * 0.12 + yOff).toFixed(1)} ${(reach3 + sw1 * 0.8).toFixed(1)} ${(h * 0.21 + yOff).toFixed(1)} Q${(reach3 * 0.38).toFixed(1)} ${(h * 0.19 + yOff).toFixed(1)} -10 ${(h * 0.16 + yOff).toFixed(1)} Z`;

    return (
      <g
        key={isRight ? 'r' : 'l'}
        transform={isRight ? `translate(${w.toFixed(1)} 0) scale(-1 1)` : undefined}
        opacity={0.92}
      >
        <S d={leafLowA} f="navy" sw={3.5} />
        <S d={leafLowB} f="plantDark" sw={3.2} />
        <Sh d={leafLowB} o={0.35} />
        <S d={leafTop} f="navy" sw={3.2} />
        <FernLeaf x={-6} y={h * 0.94 - yOff * 0.5} len={fernLen} angle={-22} tone="dark" t={t + ph} />
        <FernLeaf x={-6} y={h * 0.22 + yOff} len={fernLen * 0.82} angle={18} tone="dark" t={t + ph + 1.1} />
      </g>
    );
  };

  return (
    <g pointerEvents="none">
      {(side === 'left' || side === 'both') && renderCluster(false)}
      {(side === 'right' || side === 'both') && renderCluster(true)}
    </g>
  );
};
