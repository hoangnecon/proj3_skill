// PROP LIBRARY. Origin = bottom centre of the object, y up is negative. Same ink line (LINE) and
// halftone shade (Sh) as everything else. Rules: sv-short-design/references/props-overlays.md.
// Register a prop in HAND_PROPS / SIDE_PROPS / WORLD_PROPS at the bottom so shots can name it.
import React from 'react';
import {E, L, PAL, R, Rr, S, Sh, Smoke, Txt} from './kit';

const Plate: React.FC<{w: number; c?: string}> = ({w, c = 'white'}) => (
  <g>
    <S d={E(0, -6, w, w * 0.24)} f={c} />
    <path d={`M${-w * 0.8} ${-6}a${w * 0.8} ${w * 0.18} 0 0 0 ${w * 1.6} 0`} fill="none" stroke={PAL.blue} strokeWidth={4} />
  </g>
);

export const Chicken: React.FC = () => (
  <g>
    <Plate w={120} />
    <S d="M-90 -20C-100 -90 -40 -130 20 -120C80 -110 110 -60 90 -20Z" f="yellow" />
    <Sh d="M30 -118C80 -108 108 -60 90 -20L40 -20C60 -50 56 -90 30 -118Z" />
    <S d="M-80 -60C-120 -80 -130 -120 -110 -140C-100 -150 -84 -140 -88 -120C-90 -100 -76 -84 -60 -78Z" f="yellow" />
    <S d="M-112 -142l-6 -18l12 4l4 -12l8 16Z" f="red" />
    <S d="M60 -40c20 -20 60 -10 60 20c-20 10 -50 6 -60 -20Z" f="yellow" />
    <S d={E(-60, -112, 4, 4)} f="ink" nl />
  </g>
);

export const Xoi: React.FC = () => (
  <g>
    <Plate w={90} />
    <S d="M-70 -14C-70 -70 70 -70 70 -14Z" f="red" />
    {[[-40, -30], [-10, -46], [20, -34], [40, -22], [-20, -22], [0, -30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill={PAL.white} opacity={0.6} />)}
    <Sh d="M20 -50C50 -46 70 -30 70 -14L30 -14C34 -30 30 -40 20 -50Z" o={0.6} dots="dotsR" />
  </g>
);

export const Lobster: React.FC<{t?: number}> = ({t = 0}) => (
  <g>
    <Plate w={190} c="trim" />
    {/* thân */}
    <S d="M-150 -40C-140 -110 120 -120 150 -50C120 -20 -120 -14 -150 -40Z" f="red" />
    {[-90, -40, 10, 60].map((x) => <L key={x} d={`M${x} -104q10 30 0 64`} w={4} c="redDark" />)}
    <Sh d="M-150 -40C-120 -20 120 -20 150 -50L120 -40C40 -30 -60 -30 -150 -40Z" o={0.7} dots="dotsR" />
    {/* đuôi */}
    <S d="M150 -60l60 -40l14 30l-20 30l20 30l-20 10Z" f="red" />
    {/* càng */}
    <S d={`M-140 -70C-200 -120 -230 -${170 + Math.sin(t * 5) * 6} -190 -200C-160 -220 -130 -190 -150 -160C-170 -140 -150 -100 -120 -90Z`} f="red" />
    <S d="M-190 -200l-30 -40l30 6l10 -26l14 40Z" f="red" />
    <S d="M-100 -96C-130 -170 -100 -230 -60 -230C-30 -230 -30 -190 -60 -180C-80 -170 -76 -130 -60 -110Z" f="red" />
    <S d="M-60 -230l-10 -36l24 18l14 -20l2 36Z" f="red" />
    {/* râu */}
    <L d={`M-150 -60C-260 -80 -300 -${150 + Math.sin(t * 3) * 20} -330 -250`} w={4} c="redDark" />
    <L d={`M-150 -70C-240 -110 -260 -${200 + Math.cos(t * 3) * 20} -250 -300`} w={4} c="redDark" />
    <circle cx={-128} cy={-84} r={8} fill={PAL.ink} />
    <circle cx={-125} cy={-87} r={2.5} fill={PAL.white} />
  </g>
);

export const Wagyu: React.FC = () => (
  <g>
    <S d={Rr(-150, -40, 300, 40, 12)} f="wood" />
    <S d="M-120 -40C-130 -110 120 -120 126 -40Z" f="pink" />
    {Array.from({length: 22}).map((_, i) => {
      const x = -100 + ((i * 53) % 210);
      const y = -50 - ((i * 37) % 55);
      return <path key={i} d={`M${x} ${y}q${10 + (i % 3) * 6} ${-6 + (i % 2) * 12} ${22} ${0}`} stroke={PAL.white} strokeWidth={5} fill="none" strokeLinecap="round" />;
    })}
    <Sh d="M30 -110C90 -100 126 -70 126 -40L60 -40C70 -60 60 -90 30 -110Z" o={0.6} dots="dotsR" />
    {/* cờ Nhật cắm */}
    <L d="M70 -100v-80" w={4} />
    <S d={R(70, -180, 60, 40)} f="white" sw={3} />
    <circle cx={100} cy={-160} r={11} fill={PAL.red} />
  </g>
);

export const Tofu: React.FC = () => (
  <g>
    <Plate w={70} />
    {[[-30, -18], [8, -22], [-10, -36]].map(([x, y], i) => (
      <g key={i}>
        <S d={Rr(x - 18, y - 16, 40, 30, 6)} f="gold" />
        <Sh d={R(x + 6, y - 16, 16, 30)} o={0.5} />
      </g>
    ))}
  </g>
);

export const Egg: React.FC = () => (
  <g>
    <S d={E(0, -8, 32, 8)} f="white" />
    <S d={E(0, -40, 26, 34)} f="white" />
    <Sh d="M8 -70C30 -60 30 -20 8 -8C18 -30 18 -50 8 -70Z" o={0.5} />
  </g>
);

export const Nem: React.FC = () => (
  <g>
    <Plate w={110} />
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i} transform={`translate(${-70 + i * 34} ${-26 - (i % 2) * 10}) rotate(${-14 + i * 3})`}>
        <S d={Rr(-14, -36, 28, 72, 14)} f="orange" />
        <L d="M-8 -20l14 6M-8 0l14 6M-8 20l14 6" w={3} c="goldDark" />
      </g>
    ))}
  </g>
);

export const Fruit: React.FC = () => (
  <g>
    <S d="M-90 0h180l-20 -26h-140Z" f="gold" />
    {[[-50, -50, 'orange'], [0, -56, 'yellow'], [50, -50, 'orange'], [-26, -96, 'teal'], [26, -96, 'orange'], [0, -134, 'red']].map(([x, y, c], i) => (
      <S key={i} d={E(x as number, y as number, 28, 26)} f={c as string} />
    ))}
    <S d="M-80 -40C-80 -100 -40 -140 -10 -150C-40 -120 -54 -80 -50 -40Z" f="yellow" />
    <S d="M-10 -170l6 -20l10 16Z" f="plant" />
  </g>
);

/** mâm ba tầng */
export const Tray3: React.FC = () => (
  <g>
    {[0, 1, 2].map((i) => {
      const w = 170 - i * 46;
      const y = -i * 70;
      return (
        <g key={i}>
          <L d={`M${-w * 0.6} ${y}v-40M${w * 0.6} ${y}v-40`} w={6} c="goldDark" />
          <S d={E(0, y - 46, w, w * 0.2)} f="gold" />
          {[-0.5, 0, 0.5].map((k, j) => <S key={j} d={E(k * w, y - 60, w * 0.18, 16)} f={['red', 'pink', 'orange'][(i + j) % 3]} />)}
        </g>
      );
    })}
  </g>
);

/** bát hương + 3 nén hương có khói */
export const Incense: React.FC<{t: number; burn?: number; smoke?: boolean}> = ({t, burn = 0, smoke = true}) => (
  <g>
    <S d="M-60 -60h120l-10 50h-100Z" f="gold" />
    <S d={E(0, -60, 60, 12)} f="goldDark" />
    <S d={R(-50, -14, 100, 14)} f="goldDark" />
    {[-14, 0, 14].map((x, i) => {
      const h = 150 * (1 - burn);
      return (
        <g key={i}>
          <L d={`M${x} -62L${x * 2} ${-62 - 170}`} w={4} c="redDark" />
          <L d={`M${x * 1.2} -100L${x * 1.2 + (x * 0.8) * (h / 150)} ${-100 - h * 0.95}`} w={8} c="goldDark" />
          <circle cx={x * 1.2 + x * 0.8 * (h / 150)} cy={-100 - h * 0.95} r={6} fill={PAL.red} />
          {smoke && <Smoke x={x * 1.2 + x * 0.8 * (h / 150)} y={-108 - h * 0.95} t={t} h={160} w={5} o={0.7} ph={i * 2} />}
        </g>
      );
    })}
  </g>
);

export const Clipboard: React.FC = () => (
  <g>
    <S d={Rr(-60, -80, 120, 160, 8)} f="wood" />
    <S d={R(-48, -64, 96, 136)} f="paper" />
    <S d={Rr(-24, -92, 48, 22, 6)} f="concreteDark" />
    {[0, 1, 2, 3, 4].map((i) => <L key={i} d={`M-36 ${-40 + i * 22}h${60 - (i % 2) * 20}`} w={4} o={0.6} />)}
  </g>
);

export const Book: React.FC<{c?: string; label?: string}> = ({c = 'red', label}) => (
  <g>
    <S d={Rr(-62, -84, 124, 168, 6)} f={c} />
    <S d={R(-50, -70, 100, 30)} f="gold" sw={3} />
    {label && <Txt x={0} y={-48} s={16} c="ink" w={900}>{label}</Txt>}
    <S d={E(0, 10, 26, 26)} f="gold" sw={3} />
    <Txt x={0} y={18} s={20} c="redDark" w={900}>★</Txt>
  </g>
);

export const Phone: React.FC = () => (
  <g>
    <S d={Rr(-24, -44, 48, 88, 8)} f="ink" />
    <S d={Rr(-18, -36, 36, 66, 4)} f="glass" nl />
  </g>
);

export const Chili: React.FC<{t: number}> = ({t}) => (
  <g>
    <S d="M-14 -30C-30 0 -10 30 14 40C10 10 20 -20 6 -30Z" f="red" />
    <S d="M-6 -30l-4 -18l14 4Z" f="plant" />
    {[0, 1, 2, 3, 4, 5].map((i) => {
      const u = ((t * 1.8 + i * 0.17) % 1);
      return <circle key={i} cx={10 + Math.sin(i * 7) * 14} cy={40 + u * 120} r={4} fill={PAL.red} opacity={1 - u} />;
    })}
  </g>
);

export const Seeds: React.FC = () => (
  <g>
    <S d="M-34 -50h68l-8 70h-52Z" f="white" />
    <Txt x={0} y={0} s={18} c="red" w={900}>HẠT</Txt>
    {[-16, 0, 16].map((x) => <S key={x} d={E(x, -50, 8, 12)} f="ink" sw={2} />)}
  </g>
);

export const Wok: React.FC<{t: number}> = ({t}) => (
  <g>
    {/* bếp gas */}
    <S d={Rr(-110, -60, 220, 60, 8)} f="concreteDark" />
    <S d={R(-80, -40, 30, 20)} f="ink" nl />
    {/* lửa */}
    {[0, 1, 2, 3, 4].map((i) => {
      const h = 120 + Math.sin(t * 13 + i * 1.7) * 40;
      const x = -60 + i * 30;
      return <S key={i} d={`M${x - 20} -60Q${x - 26} ${-60 - h * 0.6} ${x + Math.sin(t * 9 + i) * 10} ${-60 - h}Q${x + 26} ${-60 - h * 0.6} ${x + 20} -60Z`} f={i % 2 ? 'orange' : 'yellow'} sw={4} />;
    })}
    {/* chảo */}
    <g transform={`rotate(${Math.sin(t * 6) * 8} 0 -90)`}>
      <S d="M-120 -110Q0 -40 120 -110Z" f="ink" />
      <L d="M120 -110l90 -20" w={14} c="wood" />
      {[0, 1, 2, 3].map((i) => <S key={i} d={E(-60 + i * 40 + Math.sin(t * 8 + i) * 10, -130 - Math.abs(Math.sin(t * 8 + i)) * 40, 14, 10)} f={['plant', 'red', 'orange', 'yellow'][i]} sw={3} />)}
    </g>
  </g>
);

/** thước dây kéo giữa 2 tay */
export const Tape: React.FC<{a: [number, number]; b: [number, number]}> = ({a, b}) => (
  <g>
    <path d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`} stroke={PAL.ink} strokeWidth={16} strokeLinecap="round" />
    <path d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`} stroke={PAL.yellow} strokeWidth={10} strokeDasharray="3 13" strokeLinecap="butt" />
    <path d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`} stroke={PAL.yellow} strokeWidth={10} strokeOpacity={0.6} />
    <S d={Rr(a[0] - 34, a[1] - 34, 52, 52, 12)} f="yellow" />
    <S d={E(a[0] - 8, a[1] - 8, 10, 10)} f="ink" nl />
  </g>
);

/** xe Mẹc bằng giấy vàng mã */
export const PaperCar: React.FC<{t: number; burn?: number}> = ({t, burn = 0}) => (
  <g>
    <S d="M-200 -40C-200 -80 -170 -96 -120 -100L-60 -150C-20 -170 60 -170 100 -150L150 -104C190 -100 210 -80 210 -40Z" f="gold" />
    <S d="M-50 -140h60v40h-90ZM30 -140c30 0 50 10 76 38h-76Z" f="glass" sw={4} />
    <Sh d="M-200 -60L210 -60L210 -40L-200 -40Z" o={0.6} />
    {[-120, 130].map((x) => (
      <g key={x}>
        <S d={E(x, -34, 40, 40)} f="ink" />
        <S d={E(x, -34, 18, 18)} f="concrete" />
      </g>
    ))}
    {/* logo ngôi sao */}
    <circle cx={190} cy={-74} r={14} fill="none" stroke={PAL.ink} strokeWidth={4} />
    <L d="M190 -86v12M190 -74l-10 8M190 -74l10 8" w={3} />
    <Txt x={0} y={-56} s={22} c="red" w={900}>VÀNG MÃ</Txt>
    {burn > 0 && [0, 1, 2, 3, 4, 5].map((i) => {
      const x = -160 + i * 64;
      const h = (60 + Math.sin(t * 11 + i * 2) * 26) * burn;
      return <S key={i} d={`M${x - 26} -100Q${x} ${-100 - h * 2} ${x + 26} -100Z`} f={i % 2 ? 'orange' : 'yellow'} sw={4} />;
    })}
  </g>
);

export const Cone: React.FC = () => (
  <g>
    <S d={R(-40, -10, 80, 10)} f="orange" />
    <S d="M-26 -10L-8 -100h16L26 -10Z" f="orange" />
    <S d="M-20 -40h40l-4 -16h-32Z" f="white" sw={3} />
  </g>
);

export const Stool: React.FC<{c?: string}> = ({c = 'red'}) => (
  <g>
    <S d="M-50 -100h100l-10 100h-18l-6 -70h-42l-6 70h-18Z" f={c} />
    <S d={Rr(-56, -112, 112, 18, 6)} f={c} />
  </g>
);

export const Gladiolus: React.FC<{c?: string}> = ({c = 'pink'}) => (
  <g>
    <S d="M-26 0h52l-8 -110h-36Z" f="blue" />
    {[-14, 0, 14].map((x, i) => (
      <g key={i}>
        <L d={`M${x * 0.5} -110Q${x} -200 ${x * 2.4} -330`} w={6} c="plantDark" />
        {[0, 1, 2, 3, 4, 5].map((k) => <S key={k} d={E(x * 0.5 + (x * 1.9) * (k / 6) + (k % 2 ? 12 : -12), -160 - k * 30, 14, 12)} f={i === 1 ? 'red' : c} sw={3} />)}
      </g>
    ))}
  </g>
);

export const Lamp: React.FC = () => (
  <g>
    <S d="M-20 0h40l-6 -30h-28Z" f="gold" />
    <L d="M0 -30v-120" w={8} c="goldDark" />
    <S d="M-36 -150h72l-10 -80h-52Z" f="red" />
    <ellipse cx={0} cy={-190} rx={60} ry={70} fill="url(#glowY)" />
  </g>
);

export const Scoreboard: React.FC<{lines: string[]; w?: number}> = ({lines, w = 520}) => (
  <g>
    <S d={Rr(-w / 2, -40 - lines.length * 64, w, 40 + lines.length * 64, 18)} f="ink" />
    {lines.map((l, i) => <Txt key={i} x={0} y={-lines.length * 64 + i * 64 + 18} s={42} c={i === 0 ? 'yellow' : 'white'} w={900}>{l}</Txt>)}
  </g>
);

/** con mèo (front) */
export const Cat: React.FC<{t: number; proud?: boolean}> = ({t, proud}) => (
  <g>
    <path d={`M-60 -10C-100 -20 -${110 + Math.sin(t * 3) * 10} -70 -86 -96`} stroke={PAL.ink} strokeWidth={22} fill="none" strokeLinecap="round" />
    <path d={`M-60 -10C-100 -20 -${110 + Math.sin(t * 3) * 10} -70 -86 -96`} stroke={PAL.orange} strokeWidth={12} fill="none" strokeLinecap="round" />
    <S d="M-70 0C-76 -60 -40 -90 0 -90C40 -90 70 -60 64 0Z" f="orange" />
    <Sh d="M10 -88C40 -86 70 -60 64 0L24 0C40 -30 36 -66 10 -88Z" />
    <S d="M-44 -122l8 -42l28 26ZM44 -122l-8 -42l-28 26Z" f="orange" />
    <S d={E(0, -110, 56, 46)} f="orange" />
    {proud ? (
      <>
        <L d="M-30 -112q10 -10 20 0M10 -112q10 -10 20 0" w={5} />
      </>
    ) : (
      <>
        <ellipse cx={-20} cy={-112} rx={6} ry={9} fill={PAL.ink} />
        <ellipse cx={20} cy={-112} rx={6} ry={9} fill={PAL.ink} />
      </>
    )}
    <S d="M-6 -96h12l-6 7Z" f="pink" sw={3} />
    <L d="M0 -89q-8 10 -16 4M0 -89q8 10 16 4" w={4} />
    <L d="M-30 -96h-30M-30 -88l-28 6M30 -96h30M30 -88l28 6" w={3} />
    <S d="M-40 -20h80" f="none" />
    {[-22, 22].map((x) => <S key={x} d={E(x, -4, 18, 10)} f="white" />)}
  </g>
);

// ======================= ANIMATED TOOLS & CUTAWAY HELPERS (v5.7) =======================
type P2 = [number, number];

/** Articulated tailor/shadow scissors: u < 0 opens blades wide (anticipation), u > 0 snaps shut with glint. */
export const ScissorsTool: React.FC<{u?: number; s?: number}> = ({u = 0, s = 1}) => {
  const halfAng = u < 0 ? 12 + (-u) * 24 : u > 0 ? Math.max(1.5, 12 * (1 - u)) : 12;
  return (
    <g transform={`scale(${s})`}>
      <g transform={`rotate(${-halfAng} 24 0)`}>
        <S d="M18 -5L136 -14L120 3L18 4Z" f="steel" sw={4} />
        <L d="M-16 -14L24 0" w={9} c="ink" />
        <S d={E(-24, -18, 16, 12)} f="navy" sw={4} />
        <S d={E(-24, -18, 7, 5)} f="paper" sw={3} />
      </g>
      <g transform={`rotate(${halfAng} 24 0)`}>
        <S d="M18 5L136 14L120 -3L18 -4Z" f="steelDark" sw={4} />
        <L d="M-16 14L24 0" w={9} c="ink" />
        <S d={E(-24, 18, 16, 12)} f="navy" sw={4} />
        <S d={E(-24, 18, 7, 5)} f="paper" sw={3} />
      </g>
      <S d={E(24, 0, 6, 6)} f="gold" sw={3} />
      {u > 0.35 && <L d="M118 -26l16 52M102 0h48" w={4} c="yellow" />}
    </g>
  );
};

export const HandLantern: React.FC<{t?: number; c?: string}> = ({t = 0, c = 'orange'}) => (
  <g transform={`rotate(${Math.sin(t * 2.8) * 5} 0 0)`}>
    <L d="M0 0v22" w={5} c="goldDark" />
    <S d={Rr(-22, 20, 44, 10, 4)} f="woodDark" sw={4} />
    <ellipse cx={0} cy={56} rx={72} ry={66} fill="url(#glowY)" opacity={0.8} />
    <S d="M-26 30C-38 48 -38 72 -24 88L24 88C38 72 38 48 26 30Z" f={c} sw={4} />
    <S d={E(0, 59, 14, 20)} f="yellow" nl />
    <L d="M-12 30C-18 50 -18 70 -12 88M12 30C18 50 18 70 12 88" w={3} c="woodDark" />
    <S d={Rr(-20, 86, 40, 10, 4)} f="woodDark" sw={4} />
  </g>
);

export type HandInsertProps = {
  from?: 'right' | 'left' | 'top' | 'bottom';
  x: number;
  y: number;
  u?: number;
  cutU?: number;
  tool?: 'scissors' | 'needle' | 'lantern' | 'knife' | 'pen' | 'grab' | 'point';
  sleeve?: string;
  skin?: string;
  s?: number;
  angle?: number;
  t?: number;
};

// lint-ok: CH-10 close-up forearm+hand cutaway helper (no head/face)
export const HandInsert: React.FC<HandInsertProps> = ({from = 'right', x, y, u = 1, cutU = 0, tool = 'scissors', sleeve = 'navy', skin = 'skin', s = 1, angle, t = 0}) => {
  const cl = Math.max(0, Math.min(1, u));
  const slide = (1 - cl) * 320;
  const dirAngle = angle ?? (from === 'right' ? 162 : from === 'left' ? 18 : from === 'top' ? 96 : -84);
  const dx = from === 'right' ? slide : from === 'left' ? -slide : 0;
  const dy = from === 'top' ? -slide : from === 'bottom' ? slide : slide * 0.22;
  const tipOff = tool === 'scissors' ? 128 : tool === 'knife' ? 110 : tool === 'needle' ? 76 : tool === 'pen' ? 68 : 34;
  return (
    <g transform={`translate(${x + dx} ${y + dy}) rotate(${dirAngle}) scale(${s}) translate(${-tipOff} 0)`}>
      <S d="M-320 -34L-74 -26L-74 26L-320 38Z" f={sleeve} sw={5} />
      <Sh d="M-320 6L-74 6L-74 26L-320 38Z" o={0.5} />
      <S d={Rr(-82, -30, 24, 60, 8)} f="white" sw={4} />
      <S d={E(-28, 0, 34, 28)} f={skin} sw={5} />
      {tool === 'scissors' && <ScissorsTool u={cutU} s={1.05} />}
      {tool === 'knife' && (
        <g transform={`rotate(${cutU * 14} 0 0)`}>
          <S d={Rr(-26, -9, 40, 18, 6)} f="woodDark" sw={4} />
          <S d="M14 -10L116 -2L92 14L14 10Z" f="steel" sw={4} />
        </g>
      )}
      {tool === 'needle' && (
        <g transform={`translate(${cutU * 18} 0)`}>
          <L d="M-40 16Q-90 46 -150 22" w={4} c="red" />
          <L d="M-6 0L80 -4" w={5} c="steel" />
          <S d={E(-4, 0, 5, 3)} f="gold" sw={2} />
        </g>
      )}
      {tool === 'pen' && (
        <g transform="rotate(18 0 0)">
          <S d={Rr(-30, -7, 88, 14, 5)} f="yellow" sw={4} />
          <S d="M58 -7L76 0L58 7Z" f="ink" sw={3} />
        </g>
      )}
      {tool === 'lantern' && <HandLantern t={t} />}
      {tool === 'point' ? (
        <S d={Rr(-12, -11, 52, 20, 9)} f={skin} sw={4} />
      ) : (
        <>
          <S d={E(-8, -14 - (cutU < 0 ? 4 : 0), 15, 10)} f={skin} sw={4} />
          <S d={E(-4, 2, 16, 10)} f={skin} sw={4} />
          <S d={E(-10, 16 + (cutU < 0 ? 4 : 0), 14, 9)} f={skin} sw={4} />
        </>
      )}
    </g>
  );
};

// ======================= REGISTRIES (names used in shotlist.ts) =======================
/** front view: drawn between the body and the hands; h.l / h.r = hand centres; u = animated use pulse (-1..+1) */
export const HAND_PROPS: Record<string, (h: {l: P2; r: P2}, t: number, u?: number) => React.ReactNode> = {
  clip: (h) => <g transform={`translate(${h.r[0] - 10} ${h.r[1] - 40}) rotate(-8) scale(0.8)`}><Clipboard /></g>,
  phone: (h) => <g transform={`translate(${h.r[0]} ${h.r[1] - 10})`}><Phone /></g>,
  book: (h) => <g transform={`translate(${(h.l[0] + h.r[0]) / 2} ${h.l[1] - 30}) scale(0.8)`}><Book c="teal" label="SỔ" /></g>,
  money: (h) => <g transform={`translate(${h.r[0]} ${h.r[1] - 16}) rotate(-12)`}><S d="M-40 -24h80v48h-80Z" f="green" sw={4} /><S d="M-34 -30h80v48h-80Z" f="green" sw={4} /><S d={E(6, -6, 12, 12)} f="plant" sw={3} /></g>,
  env: (h) => <g transform={`translate(${h.r[0]} ${h.r[1] - 14}) rotate(-8)`}><S d="M-46 -30h92v60h-92Z" f="paper" sw={4} /><L d="M-46 -30l46 34l46 -34" w={4} /></g>,
  trash: (h) => <g transform={`translate(${h.r[0]} ${h.r[1] + 70})`}><S d="M-50 0C-64 -44 -50 -92 -14 -100L-8 -120L8 -120L14 -100C50 -92 64 -44 50 0Z" f="ink" /></g>,
  noodle: (h) => <g transform={`translate(${(h.l[0] + h.r[0]) / 2} ${(h.l[1] + h.r[1]) / 2})`}><S d="M-56 -20h112l-14 60h-84Z" f="white" sw={4} /><L d="M-30 -20q10 -40 0 -80M10 -20q10 -40 0 -80" w={4} c="white" o={0.6} /></g>,
  wrench: (h, t) => <g transform={`translate(${h.r[0]} ${h.r[1]}) rotate(${-40 + Math.sin(t * 9) * 25})`}><L d="M0 0l0 -110" w={16} c="steelDark" /><S d="M-22 -110a22 22 0 1 1 44 0l-12 0l0 -12l-20 0l0 12Z" f="steel" sw={4} /></g>,
  incense: (h, t) => <g transform={`translate(${(h.l[0] + h.r[0]) / 2} ${h.l[1]})`}><Incense t={t} /></g>,
  seeds: (h) => <g transform={`translate(${h.l[0]} ${h.l[1]})`}><Seeds /></g>,
  scissors: (h, _t, u = 0) => <g transform={`translate(${h.r[0]} ${h.r[1]}) rotate(28)`}><ScissorsTool u={u} s={0.92} /></g>,
  lantern: (h, t) => <g transform={`translate(${h.r[0]} ${h.r[1]})`}><HandLantern t={t} /></g>,
  flashlight: (h, _t, u = 0) => <g transform={`translate(${h.r[0]} ${h.r[1]}) rotate(16)`}>{u >= 0 && <polygon points="34,-10 220,-64 220,64 34,10" fill={PAL.yellow} opacity={0.28} />}<S d={Rr(-22, -12, 58, 24, 6)} f="steelDark" sw={4} /><S d={Rr(30, -15, 12, 30, 4)} f="yellow" sw={3} /></g>,
  needle: (h, _t, u = 0) => <g><path d={`M${h.l[0]} ${h.l[1]}Q${(h.l[0] + h.r[0]) / 2} ${Math.max(h.l[1], h.r[1]) + 34 - u * 16} ${h.r[0]} ${h.r[1]}`} fill="none" stroke={PAL.red} strokeWidth={4} /><g transform={`translate(${h.r[0]} ${h.r[1]}) rotate(-24)`}><L d="M-8 0L58 0" w={5} c="steel" /></g></g>,
  knife: (h, _t, u = 0) => <g transform={`translate(${h.r[0]} ${h.r[1]}) rotate(${18 + u * 16})`}><S d={Rr(-24, -8, 36, 16, 5)} f="woodDark" sw={4} /><S d="M12 -9L98 -2L80 12L12 9Z" f="steel" sw={4} /></g>,
  pen: (h, _t, u = 0) => <g transform={`translate(${h.r[0]} ${h.r[1]}) rotate(${32 + u * 10})`}><S d={Rr(-24, -6, 68, 12, 4)} f="yellow" sw={4} /><S d="M44 -6L58 0L44 6Z" f="ink" sw={3} /></g>,
  broom: (h, t, u = 0) => <g transform={`translate(${h.r[0]} ${h.r[1]}) rotate(${12 + Math.sin(t * 6) * 6 + u * 14})`}><L d="M0 -80L18 120" w={10} c="wood" /><S d="M-12 116L48 112L64 176L-24 180Z" f="gold" sw={4} /></g>,
  magnifying: (h) => <g transform={`translate(${h.r[0]} ${h.r[1]}) rotate(-28)`}><L d="M0 0L44 0" w={10} c="woodDark" /><S d={E(74, 0, 30, 30)} f="glass" sw={5} /></g>,
};
/** side view: h.near = hand nearest the camera */
export const SIDE_PROPS: Record<string, (h: {near: P2; far: P2; nearAng?: number; farAng?: number}, t: number, u?: number) => React.ReactNode> = {
  toolbox: ({near: [x, y]}) => <g transform={`translate(${x} ${y})`}><L d="M-20 0v-10h40v10" w={6} /><S d="M-60 0h120v70h-120Z" f="red" /><L d="M-60 22h120" w={4} /></g>,
  trash: ({near: [x, y]}) => <g transform={`translate(${x} ${y + 76})`}><S d="M-50 0C-64 -44 -50 -92 -14 -100L-8 -120L8 -120L14 -100C50 -92 64 -44 50 0Z" f="ink" /></g>,
  cane: ({near: [x, y]}) => <L d={`M${x + 4} ${y}L${x + 30} ${y + 200}`} w={10} c="woodDark" />,
  box: ({near: [x, y]}) => <g transform={`translate(${x - 10} ${y - 30})`}><S d="M-60 -50h120v90h-120Z" f="wood" /><L d="M-60 -10h120" w={4} /></g>,
  bag: ({near: [x, y]}) => <g transform={`translate(${x} ${y})`}><S d="M-40 10h80l-8 90h-64Z" f="pink" /><L d="M-20 10q20 -40 40 0" w={5} /></g>,
  phone: ({near: [x, y]}) => <g transform={`translate(${x + 6} ${y - 6}) rotate(-10)`}><Phone /></g>,
  scissors: ({near: [x, y], nearAng = 22}, _t, u = 0) => <g transform={`translate(${x} ${y}) rotate(${nearAng})`}><ScissorsTool u={u} s={0.95} /></g>,
  lantern: ({near: [x, y]}, t) => <g transform={`translate(${x} ${y})`}><HandLantern t={t} /></g>,
  flashlight: ({near: [x, y], nearAng = 10}, _t, u = 0) => <g transform={`translate(${x} ${y}) rotate(${nearAng})`}><g>{u >= 0 && <polygon points="34,-10 240,-68 240,68 34,10" fill={PAL.yellow} opacity={0.28} />}<S d={Rr(-22, -12, 58, 24, 6)} f="steelDark" sw={4} /><S d={Rr(30, -15, 12, 30, 4)} f="yellow" sw={3} /></g></g>,
  needle: ({near, far, nearAng = 14}, _t, u = 0) => <g><path d={`M${far[0]} ${far[1]}Q${(far[0] + near[0]) / 2} ${Math.max(far[1], near[1]) + 32 - u * 16} ${near[0]} ${near[1]}`} fill="none" stroke={PAL.red} strokeWidth={4} /><g transform={`translate(${near[0]} ${near[1]}) rotate(${nearAng})`}><L d="M-8 0L58 0" w={5} c="steel" /></g></g>,
  knife: ({near: [x, y], nearAng = 14}, _t, u = 0) => <g transform={`translate(${x} ${y}) rotate(${nearAng + u * 18})`}><S d={Rr(-24, -8, 36, 16, 5)} f="woodDark" sw={4} /><S d="M12 -9L98 -2L80 12L12 9Z" f="steel" sw={4} /></g>,
  pen: ({near: [x, y], nearAng = 26}, _t, u = 0) => <g transform={`translate(${x} ${y}) rotate(${nearAng + u * 10})`}><S d={Rr(-24, -6, 68, 12, 4)} f="yellow" sw={4} /><S d="M44 -6L58 0L44 6Z" f="ink" sw={3} /></g>,
  broom: ({near: [x, y]}, t, u = 0) => <g transform={`translate(${x} ${y}) rotate(${14 + Math.sin(t * 6) * 6 + u * 16})`}><L d="M0 -80L22 120" w={10} c="wood" /><S d="M-10 116L52 112L68 176L-22 180Z" f="gold" sw={4} /></g>,
  magnifying: ({near: [x, y], nearAng = -18}) => <g transform={`translate(${x} ${y}) rotate(${nearAng - 24})`}><L d="M0 0L44 0" w={10} c="woodDark" /><S d={E(74, 0, 30, 30)} f="glass" sw={5} /></g>,
};
/** floor-standing props placed with ShotDef.extras */
export const WORLD_PROPS: Record<string, (c: string | undefined, t: number) => React.ReactNode> = {
  stool: (c) => <Stool c={c ?? 'red'} />,
  cone: () => <Cone />,
  lamp: () => <Lamp />,
  gladiolus: (c) => <Gladiolus c={c ?? 'pink'} />,
  cat: (_c, t) => <Cat t={t} />,
};
