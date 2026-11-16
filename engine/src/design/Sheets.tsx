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
import {CAST, CAST_ROLES} from '../episode/cast';
import {EX_LOOKS} from '../exemplar/looks';
import {LayerG} from '../Film';

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
  if (!def) return <Paper w={1080} h={1920}><Txt x={540} y={960} s={50} c="red" w={900}>không có set {id}</Txt></Paper>;
  const cam = def.plateCam ?? [540, 1150, 1];
  const layers = def.render({t: 1.0, ...(def.plateOpts ?? {})});
  const [cx, cy, k] = cam;
  const x0 = cx - 540 / k, x1 = cx + 540 / k, y0 = cy - 960 / k, y1 = cy + 960 / k;
  const step = k < 0.8 ? 200 : 100;
  return (
    <AbsoluteFill style={{background: PAL.navy}}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{display: 'block'}}>
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
        {!grid && <rect width={1080} height={1920} filter="url(#grain)" style={{mixBlendMode: 'multiply'}} />}
        {!grid && <rect width={1080} height={1920} fill="url(#vig)" />}
        <rect x={0} y={1800} width={1080} height={120} fill={PAL.ink} opacity={0.75} />
        <text x={540} y={1876} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={44} fill={PAL.yellow}>{id} · {def.title}</text>
      </svg>
    </AbsoluteFill>
  );
};
