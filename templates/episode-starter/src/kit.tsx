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

/** defs dùng chung toàn phim (đặt một lần trong mỗi svg gốc) */
export const Defs: React.FC<{seed?: number}> = ({seed = 1}) => (
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
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} />
      <feColorMatrix type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.18  0 0 0 0 0.43  0 0 0 0.42 0" />
      <feComposite in2="SourceGraphic" operator="in" />
    </filter>
    <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75">
      <stop offset="0.6" stopColor={PAL.navy} stopOpacity={0} />
      <stop offset="1" stopColor={PAL.navy} stopOpacity={0.35} />
    </radialGradient>
    <radialGradient id="glowY">
      <stop offset="0" stopColor="#fff2b8" stopOpacity={0.9} />
      <stop offset="1" stopColor="#fff2b8" stopOpacity={0} />
    </radialGradient>
    <radialGradient id="glowG">
      <stop offset="0" stopColor={PAL.ghost} stopOpacity={0.85} />
      <stop offset="1" stopColor={PAL.ghost} stopOpacity={0} />
    </radialGradient>
  </defs>
);

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
