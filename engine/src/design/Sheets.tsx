// Design sheets rendered by scripts/design.mjs into qa/design/. These are the evidence images for gate G4.
//  CastSheet  — every look: front idle + side mid-stride, name, role, Vietnamese description
//  ExprSheet  — one look: 12 expressions (head close-up), 6 poses, 6 walk-cycle phases, sitting
//  SetPlate   — one set at its plate camera, empty, with optional world-coordinate grid
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Defs, FONT, PAL, Txt, S, Rr, L} from '../kit';
import {Person, POSES, Expr, Look} from '../chars';
import {PersonSide} from '../side';
import {SETS} from '../sets';
import {WORLD_PROPS} from '../props';
import {CAST, CAST_ROLES} from '../episode/cast';
import {EX_LOOKS} from '../exemplar/looks';
import {LayerG} from '../Film';
import {FRAME_W, FRAME_H} from '../format';

const ALL: Record<string, Look> = {...EX_LOOKS, ...CAST};
const EXPRS: Expr[] = ['neutral', 'joy', 'smug', 'sly', 'eager', 'shock', 'angry', 'stern', 'sad', 'cry', 'deadpan', 'shh'];
const SHEET_POSES = ['idle', 'confess', 'pointR', 'cross', 'phone', 'argue'];

const Paper: React.FC<{w: number; h: number; children: React.ReactNode}> = ({w, h, children}) => (
  <AbsoluteFill style={{background: PAL.paper}}>
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{display: 'block'}}>
      <Defs />
      <rect width={w} height={h} fill={PAL.paper} />
      <rect width={w} height={h} fill="url(#dots)" opacity={0.06} />
      {children}
    </svg>
  </AbsoluteFill>
);

export const castKeys = (which: 'episode' | 'exemplar') => Object.keys(which === 'episode' ? CAST : EX_LOOKS);
export const CAST_PER_PAGE = 10;

export const CastSheet: React.FC<{which: 'episode' | 'exemplar'; page: number}> = ({which, page}) => {
  const keys = castKeys(which).slice(page * CAST_PER_PAGE, (page + 1) * CAST_PER_PAGE);
  const W = 2000, H = 2300, cw = 400, ch = 1060;
  return (
    <Paper w={W} h={H}>
      <Txt x={40} y={110} s={72} c="ink" w={900} a="start">BẢNG NHÂN VẬT · {which === 'episode' ? 'TẬP NÀY' : 'MẪU (EXEMPLAR)'} · trang {page + 1}</Txt>
      {keys.length === 0 && <Txt x={W / 2} y={H / 2} s={60} c="red" w={900}>CHƯA CÓ NHÂN VẬT — thêm vào src/episode/cast.ts</Txt>}
      {keys.map((k, i) => {
        const look = ALL[k];
        const cx = (i % 5) * cw + cw / 2;
        const top = 160 + Math.floor(i / 5) * ch;
        const role = CAST_ROLES[k];
        const H0 = look.h ?? 1;
        return (
          <g key={k}>
            <S d={Rr(cx - cw / 2 + 12, top, cw - 24, ch - 30, 24)} f="white" sw={4} />
            {/* height ruler: standing height at s=1 is ~610*h px (drawn at sheet scale 0.74) */}
            <L d={`M${cx - cw / 2 + 36} ${top + 700}v${-610 * H0 * 0.74}`} w={4} c="concreteDark" />
            <g transform={`translate(${cx - 72} ${top + 700}) scale(0.74)`}>
              <Person look={look} pose={POSES.idle} expr="neutral" t={0.5} />
            </g>
            <g transform={`translate(${cx + 92} ${top + 700}) scale(0.74)`}>
              <PersonSide look={look} t={0.5} phase={0.3} speed={1} />
            </g>
            <L d={`M${cx - cw / 2 + 30} ${top + 702}h${cw - 60}`} w={4} />
            <Txt x={cx} y={top + 770} s={40} c="ink" w={900}>{k}</Txt>
            <Txt x={cx} y={top + 816} s={28} c={role?.role === 'principal' ? 'red' : role?.role === 'support' ? 'blue' : 'concreteDark'} w={900}>{(role?.role ?? (which === 'exemplar' ? 'exemplar' : 'THIẾU ROLE')).toUpperCase()}</Txt>
            <foreignObject x={cx - cw / 2 + 30} y={top + 840} width={cw - 60} height={170}>
              <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 24, lineHeight: 1.25, color: PAL.ink, textAlign: 'center'}}>{role?.vi ?? ''}</div>
            </foreignObject>
          </g>
        );
      })}
    </Paper>
  );
};

export const ExprSheet: React.FC<{look: string}> = ({look: key}) => {
  const look = ALL[key];
  const W = 2000, H = 2400;
  if (!look) return <Paper w={W} h={H}><Txt x={W / 2} y={H / 2} s={60} c="red" w={900}>không có look {key}</Txt></Paper>;
  const Hh = look.h ?? 1;
  const headY = -((178 + 196) * Hh + 8 + 100 * (look.head ?? 1) * 0.9) + 20; // head centre in rig units
  return (
    <Paper w={W} h={H}>
      <Txt x={40} y={100} s={64} c="ink" w={900} a="start">{key} · biểu cảm · dáng · bước đi · ngồi</Txt>
      {/* 12 expressions, head close-up (clipped) */}
      {EXPRS.map((e, i) => {
        const x = 40 + (i % 6) * 320, y = 150 + Math.floor(i / 6) * 420;
        return (
          <g key={e}>
            <clipPath id={`ex-${i}`}><rect x={x} y={y} width={300} height={360} rx={20} /></clipPath>
            <S d={Rr(x, y, 300, 360, 20)} f="white" sw={4} />
            <g clipPath={`url(#ex-${i})`}>
              <g transform={`translate(${x + 150} ${y + 190 - headY * 1.15}) scale(1.15)`}>
                <Person look={look} pose={POSES.idle} expr={e} t={0.3} />
              </g>
            </g>
            <S d={Rr(x, y, 300, 360, 20)} f="none" sw={4} />
            <Txt x={x + 150} y={y + 400} s={30} c="ink" w={900}>{e}</Txt>
          </g>
        );
      })}
      {/* 6 poses full body */}
      <Txt x={40} y={1040} s={30} c="concreteDark" w={800} a="start">dáng (POSES) — tay phải đọc được ở cỡ khung trung</Txt>
      {SHEET_POSES.map((p, i) => (
        <g key={p} transform={`translate(${200 + i * 320} 1530) scale(0.68)`}>
          <Person look={look} pose={POSES[p]} expr={i % 2 ? 'joy' : 'neutral'} t={0.3} />
        </g>
      ))}
      {SHEET_POSES.map((p, i) => <Txt key={p} x={200 + i * 320} y={1580} s={30} c="ink" w={900}>{p}</Txt>)}
      <L d="M40 1532H1960" w={4} />
      {/* walk cycle: 6 phases + sitting (side view) */}
      <Txt x={40} y={1660} s={30} c="concreteDark" w={800} a="start">bước đi: 6 pha của một chu kỳ — chân trụ phải chạm đường đất, chân bước nhấc lên · cuối: ngồi</Txt>
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <g key={k} transform={`translate(${170 + k * 250} 2200) scale(0.68)`}>
          <PersonSide look={look} t={k * 0.1} phase={k / 6} speed={1} />
        </g>
      ))}
      {[0, 1, 2, 3, 4, 5].map((k) => <Txt key={k} x={170 + k * 250} y={2250} s={28} c="ink" w={900}>pha {k + 1}</Txt>)}
      <g transform="translate(1760 2200) scale(0.68)">
        <S d={Rr(-70, -120, 170, 24, 8)} f="red" />
        <S d="M-60 -96v96M90 -96v96" f="none" sw={6} />
        <PersonSide look={look} t={0} legs="sit" seatH={120} arms="hold" />
      </g>
      <Txt x={1760} y={2250} s={28} c="ink" w={900}>ngồi</Txt>
      <L d="M40 2202H1960" w={4} />
    </Paper>
  );
};

export const SetPlate: React.FC<{id: string; grid?: boolean}> = ({id, grid}) => {
  const def = SETS[id];
  if (!def) return <Paper w={FRAME_W} h={FRAME_H}><Txt x={FRAME_W / 2} y={FRAME_H / 2} s={50} c="red" w={900}>không có set {id}</Txt></Paper>;
  const cam = def.plateCam ?? [FRAME_W / 2, FRAME_H / 2 + 190, 1];
  const layers = def.render({t: 1.0, ...(def.plateOpts ?? {})});
  const [cx, cy, k] = cam;
  const x0 = cx - (FRAME_W / 2) / k, x1 = cx + (FRAME_W / 2) / k, y0 = cy - (FRAME_H / 2) / k, y1 = cy + (FRAME_H / 2) / k;
  const step = k < 0.8 ? 200 : 100;
  return (
    <AbsoluteFill style={{background: PAL.navy}}>
      <svg viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} width={FRAME_W} height={FRAME_H} style={{display: 'block'}}>
        <Defs />
        {layers.far && <LayerG d={0.5} cam={cam}>{layers.far}</LayerG>}
        <LayerG d={1} cam={cam}>{layers.back}</LayerG>
        <LayerG d={1} cam={cam}>{[...layers.mid].sort((a, b) => a.y - b.y).map((m) => <g key={m.key}>{m.node}</g>)}</LayerG>
        {layers.fg && <LayerG d={1.3} cam={cam}>{layers.fg}</LayerG>}
        {grid && (
          <LayerG d={1} cam={cam}>
            {Array.from({length: Math.ceil((x1 - x0) / step) + 1}).map((_, i) => {
              const x = Math.floor(x0 / step) * step + i * step;
              return <g key={'x' + i}><path d={`M${x} ${y0}V${y1}`} stroke={PAL.red} strokeWidth={x % 500 === 0 ? 3 : 1} opacity={0.5} /><text x={x + 4} y={y0 + 30 / k} fontSize={22 / k} fontFamily={FONT} fill={PAL.red}>{x}</text></g>;
            })}
            {Array.from({length: Math.ceil((y1 - y0) / step) + 1}).map((_, i) => {
              const y = Math.floor(y0 / step) * step + i * step;
              return <g key={'y' + i}><path d={`M${x0} ${y}H${x1}`} stroke={PAL.red} strokeWidth={y % 500 === 0 ? 3 : 1} opacity={0.5} /><text x={x0 + 4} y={y - 4} fontSize={22 / k} fontFamily={FONT} fill={PAL.red}>{y}</text></g>;
            })}
          </LayerG>
        )}
        {!grid && <rect width={FRAME_W} height={FRAME_H} filter="url(#grain)" style={{mixBlendMode: 'multiply'}} />}
        {!grid && <rect width={FRAME_W} height={FRAME_H} fill="url(#vig)" />}
        <rect x={0} y={FRAME_H - 120} width={FRAME_W} height={120} fill={PAL.ink} opacity={0.75} />
        <text x={FRAME_W / 2} y={FRAME_H - 44} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={44} fill={PAL.yellow}>{id} · {def.title}</text>
      </svg>
    </AbsoluteFill>
  );
};

export const BUILTIN_WORLD_PROPS = new Set(['stool', 'cone', 'lamp', 'gladiolus', 'cat', 'chicken', 'xoi', 'lobster', 'wagyu', 'tofu']);
export const propKeys = () => Object.keys(WORLD_PROPS).filter((k) => !BUILTIN_WORLD_PROPS.has(k));
export const PROPS_PER_PAGE = 6;
export type PropSize = {w: number; h: number; minX: number; minY: number; maxX: number; maxY: number};

/** Translucent 575 px adult + 435 px child reference silhouettes standing on y = 0 */
const ScaleSilhouettes: React.FC = () => (
  <g opacity={0.26} fill={PAL.shade}>
    {/* 575 px adult at x = 0 */}
    <rect x={-32} y={-178} width={24} height={178} rx={10} />
    <rect x={8} y={-178} width={24} height={178} rx={10} />
    <rect x={-56} y={-374} width={112} height={204} rx={24} />
    <rect x={-16} y={-392} width={32} height={24} />
    <circle cx={0} cy={-482} r={93} />
    {/* 435 px child at x = 148 */}
    <g transform="translate(148 0)">
      <rect x={-24} y={-124} width={18} height={124} rx={8} />
      <rect x={6} y={-124} width={18} height={124} rx={8} />
      <rect x={-42} y={-265} width={84} height={146} rx={18} />
      <rect x={-12} y={-280} width={24} height={20} />
      <circle cx={0} cy={-356} r={79} />
    </g>
  </g>
);

export const PropSheet: React.FC<{page: number; sizes?: Record<string, PropSize>}> = ({page, sizes = {}}) => {
  const keys = propKeys().slice(page * PROPS_PER_PAGE, (page + 1) * PROPS_PER_PAGE);
  const W = 2400, H = 2600, cw = 1140, ch = 780;
  return (
    <Paper w={W} h={H}>
      <Txt x={60} y={102} s={56} c="ink" w={900} a="start">BẢNG ĐẠO CỤ · TẬP NÀY · trang {page + 1}</Txt>
      <Txt x={2340} y={100} s={26} c="concreteDark" w={800} a="end">chuẩn: người lớn 575 px · trẻ em 435 px · vạch 100 px</Txt>
      {keys.length === 0 && <Txt x={W / 2} y={H / 2} s={56} c="concreteDark" w={900}>KHÔNG CÓ WORLD_PROP RIÊNG NGOÀI 5 PROP MẪU</Txt>}
      {keys.map((k, i) => {
        const cx0 = 60 + (i % 2) * 1160;
        const top = 165 + Math.floor(i / 2) * 800;
        const sz = sizes[k];
        const baseSc = 0.56;
        const sc = sz
          ? Math.min(baseSc, 800 / Math.max(800, sz.w), 500 / Math.max(500, -sz.minY + 40))
          : baseSc;
        const baseY = top + ch - 72;
        const rulerX = cx0 + 145;
        const propCenterX = cx0 + 360 + (cw - 380) / 2;
        const propX = sz ? propCenterX - ((sz.minX + sz.maxX) / 2) * sc : propCenterX;
        const fn = WORLD_PROPS[k];
        return (
          <g key={k}>
            <S d={Rr(cx0, top, cw, ch, 24)} f="white" sw={4} />
            <Txt x={cx0 + cw / 2} y={top + 48} s={34} c="ink" w={900}>{k}</Txt>
            <Txt x={cx0 + cw / 2} y={top + 88} s={24} c={sz && Math.abs(sz.maxY) > 60 ? 'red' : 'blue'} w={800}>
              {sz ? `${Math.round(sz.w)} × ${Math.round(sz.h)} px · y=[${Math.round(sz.minY)}..${Math.round(sz.maxY)}]${sc < baseSc ? ` · scale ${sc.toFixed(2)}` : ''}` : 'WORLD_PROP'}
            </Txt>
            <clipPath id={`prop-cell-${k}`}><rect x={cx0 + 6} y={top + 106} width={cw - 12} height={ch - 114} rx={18} /></clipPath>
            <g clipPath={`url(#prop-cell-${k})`}>
              {/* 100 px grid ticks */}
              {[0, 100, 200, 300, 400, 500, 600, 700, 800].map((tick) => {
                const gy = baseY - tick * sc;
                if (gy < top + 114) return null;
                return (
                  <g key={tick}>
                    <line x1={cx0 + 64} y1={gy} x2={cx0 + cw - 20} y2={gy} stroke={tick === 0 ? PAL.ink : PAL.concreteDark} strokeWidth={tick === 0 ? 4 : 1.5} strokeDasharray={tick === 0 ? undefined : '6 6'} opacity={tick === 0 ? 0.9 : 0.45} />
                    <text x={cx0 + 18} y={gy + 6} fontSize={18} fontFamily={FONT} fontWeight={700} fill={PAL.concreteDark}>{tick}</text>
                  </g>
                );
              })}
              {/* 435 px child & 575 px adult height markers */}
              <line x1={cx0 + 64} y1={baseY - 435 * sc} x2={cx0 + 365} y2={baseY - 435 * sc} stroke={PAL.blue} strokeWidth={2} strokeDasharray="4 4" opacity={0.65} />
              <text x={cx0 + 292} y={baseY - 435 * sc - 6} fontSize={17} fontFamily={FONT} fontWeight={800} fill={PAL.blue}>435</text>
              <line x1={cx0 + 64} y1={baseY - 575 * sc} x2={cx0 + 250} y2={baseY - 575 * sc} stroke={PAL.red} strokeWidth={2} strokeDasharray="4 4" opacity={0.65} />
              <text x={cx0 + 145} y={baseY - 575 * sc - 6} fontSize={17} fontFamily={FONT} fontWeight={800} fill={PAL.red}>575</text>
              <g transform={`translate(${rulerX} ${baseY}) scale(${sc})`}>
                <ScaleSilhouettes />
              </g>
              {fn && (
                <g transform={`translate(${propX} ${baseY}) scale(${sc})`}>
                  {fn(undefined, 0.5)}
                </g>
              )}
            </g>
          </g>
        );
      })}
    </Paper>
  );
};
