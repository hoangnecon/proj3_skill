// Design sheets rendered by scripts/design.mjs into qa/design/. These are the evidence images for gate G4.
//  CastSheet    — every look: front + 3/4 + back views, name, role, Vietnamese description
//  ExprSheet    — one look: 12 expressions, 6 poses, 6 articulated 3/4 physics poses, 6 walk-cycle phases, sitting
//  SetPlate     — one set at its plate camera, empty, with optional world/thirds/depth/scale layout grid
//  PropSheet    — custom WORLD_PROPS against 575 px adult + 435 px child silhouettes
//  SubjectSheet — hero subject multi-pose sheet with height ruler, silhouettes, mount pins & expressions
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Defs, FONT, PAL, Txt, S, Rr, L} from '../kit';
import {Person, POSES, Expr, Look} from '../chars';
import {PersonSide} from '../side';
import {PersonBack} from '../back';
import {Person3Q} from '../threeq';
import {SETS} from '../sets';
import {WORLD_PROPS} from '../props';
import {SUBJECTS} from '../episode/subjects';
import {resolveSeat} from '../subjects';
import {CAST, CAST_ROLES} from '../episode/cast';
import {EX_LOOKS} from '../exemplar/looks';
import {LayerG} from '../Film';
import {FRAME_W, FRAME_H} from '../format';
import {GroundShadow} from '../anim';

const ALL: Record<string, Look> = {...EX_LOOKS, ...CAST};
const EXPRS: Expr[] = ['neutral', 'joy', 'smug', 'sly', 'eager', 'shock', 'angry', 'stern', 'sad', 'cry', 'deadpan', 'shh'];
const SHEET_POSES = ['idle', 'confess', 'pointR', 'cross', 'phone', 'argue'];
const PHYSICS_POSES = ['run', 'ride', 'crouch', 'jump', 'fall', 'push'];

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
            {/* height ruler: standing height at s=1 is ~610*h px (drawn at sheet scale 0.54 for Front + 3/4 + Back) */}
            <L d={`M${cx - cw / 2 + 24} ${top + 676}v${-610 * H0 * 0.54}`} w={4} c="concreteDark" />
            <g transform={`translate(${cx - 114} ${top + 676}) scale(0.54)`}>
              <Person look={look} pose={POSES.idle} expr="neutral" t={0.5} />
            </g>
            <g transform={`translate(${cx} ${top + 676}) scale(0.54)`}>
              <Person3Q look={look} pose={POSES.idle} expr="neutral" t={0.5} face={1} />
            </g>
            <g transform={`translate(${cx + 114} ${top + 676}) scale(0.54)`}>
              <PersonBack look={look} pose={POSES.idle} t={0.5} />
            </g>
            <L d={`M${cx - cw / 2 + 24} ${top + 678}h${cw - 48}`} w={4} />
            <Txt x={cx - 114} y={top + 706} s={18} c="concreteDark" w={800}>FRONT</Txt>
            <Txt x={cx} y={top + 706} s={18} c="concreteDark" w={800}>3/4</Txt>
            <Txt x={cx + 114} y={top + 706} s={18} c="concreteDark" w={800}>BACK</Txt>
            <Txt x={cx} y={top + 766} s={40} c="ink" w={900}>{k}</Txt>
            <Txt x={cx} y={top + 812} s={28} c={role?.role === 'principal' ? 'red' : role?.role === 'support' ? 'blue' : 'concreteDark'} w={900}>{(role?.role ?? (which === 'exemplar' ? 'exemplar' : 'THIẾU ROLE')).toUpperCase()}</Txt>
            <foreignObject x={cx - cw / 2 + 30} y={top + 836} width={cw - 60} height={170}>
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
  const W = 2000, H = 2600;
  if (!look) return <Paper w={W} h={H}><Txt x={W / 2} y={H / 2} s={60} c="red" w={900}>không có look {key}</Txt></Paper>;
  const Hh = look.h ?? 1;
  const headY = -((178 + 196) * Hh + 8 + 100 * (look.head ?? 1) * 0.9) + 20; // head centre in rig units
  const physExpr = (p: string): Expr => (p === 'fall' ? 'shock' : p === 'push' ? 'angry' : p === 'jump' ? 'joy' : 'eager');
  return (
    <Paper w={W} h={H}>
      <Txt x={40} y={82} s={56} c="ink" w={900} a="start">{key} · biểu cảm · dáng · vận động 3/4 · bước đi · ngồi</Txt>
      {/* 12 expressions, head close-up (clipped) */}
      {EXPRS.map((e, i) => {
        const x = 40 + (i % 6) * 320, y = 118 + Math.floor(i / 6) * 370;
        return (
          <g key={e}>
            <clipPath id={`ex-${i}`}><rect x={x} y={y} width={300} height={316} rx={20} /></clipPath>
            <S d={Rr(x, y, 300, 316, 20)} f="white" sw={4} />
            <g clipPath={`url(#ex-${i})`}>
              <g transform={`translate(${x + 150} ${y + 168 - headY * 1.05}) scale(1.05)`}>
                <Person look={look} pose={POSES.idle} expr={e} t={0.3} />
              </g>
            </g>
            <S d={Rr(x, y, 300, 316, 20)} f="none" sw={4} />
            <Txt x={x + 150} y={y + 350} s={28} c="ink" w={900}>{e}</Txt>
          </g>
        );
      })}
      {/* 6 poses full body */}
      <Txt x={40} y={898} s={28} c="concreteDark" w={800} a="start">dáng (POSES) — tay phải đọc được ở cỡ khung trung</Txt>
      {SHEET_POSES.map((p, i) => (
        <g key={p} transform={`translate(${200 + i * 320} 1340) scale(0.62)`}>
          <Person look={look} pose={POSES[p]} expr={i % 2 ? 'joy' : 'neutral'} t={0.3} />
        </g>
      ))}
      {SHEET_POSES.map((p, i) => <Txt key={p} x={200 + i * 320} y={1384} s={28} c="ink" w={900}>{p}</Txt>)}
      <L d="M40 1342H1960" w={4} />
      {/* 6 articulated physics poses in 3/4 view */}
      <Txt x={40} y={1444} s={28} c="concreteDark" w={800} a="start">dáng vận động 3/4 (ARTICULATED PHYSICS) — gập gối, nghiêng thân, squash & stretch</Txt>
      {PHYSICS_POSES.map((p, i) => (
        <g key={p} transform={`translate(${180 + i * 328} 1910) scale(0.62)`}>
          <GroundShadow x={0} y={4} rx={p === 'fall' ? 130 : 82} ry={18} alt={p === 'jump' ? 56 : p === 'fall' ? 24 : 0} opacity={0.24} />
          <Person3Q look={look} pose={POSES[p]} expr={physExpr(p)} t={0.35} face={1} wind={p === 'run' || p === 'ride' ? 1.1 : 0} />
        </g>
      ))}
      {PHYSICS_POSES.map((p, i) => <Txt key={p} x={180 + i * 328} y={1954} s={28} c="blue" w={900}>{p}</Txt>)}
      <L d="M40 1912H1960" w={4} />
      {/* walk cycle: 6 phases + sitting (side view) */}
      <Txt x={40} y={2016} s={28} c="concreteDark" w={800} a="start">bước đi: 6 pha của một chu kỳ — chân trụ phải chạm đường đất, chân bước nhấc lên · cuối: ngồi</Txt>
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <g key={k} transform={`translate(${170 + k * 250} 2490) scale(0.64)`}>
          <PersonSide look={look} t={k * 0.1} phase={k / 6} speed={1} />
        </g>
      ))}
      {[0, 1, 2, 3, 4, 5].map((k) => <Txt key={k} x={170 + k * 250} y={2536} s={26} c="ink" w={900}>pha {k + 1}</Txt>)}
      <g transform="translate(1760 2490) scale(0.64)">
        <S d={Rr(-70, -120, 170, 24, 8)} f="red" />
        <S d="M-60 -96v96M90 -96v96" f="none" sw={6} />
        <PersonSide look={look} t={0} legs="sit" seatH={120} arms="hold" />
      </g>
      <Txt x={1760} y={2536} s={26} c="ink" w={900}>ngồi</Txt>
      <L d="M40 2492H1960" w={4} />
    </Paper>
  );
};

/** Single translucent 575 px adult silhouette with screen-normalized scale badge (used on SetPlate _grid). */
const AdultSilhouette: React.FC<{badge: string; k: number; sc: number}> = ({badge, k, sc}) => {
  const safeSc = Math.max(0.05, sc);
  const sw = 4 / Math.max(0.25, safeSc * k);
  return (
    <g>
      <g opacity={0.3} fill={PAL.shade} stroke={PAL.teal} strokeWidth={sw} strokeDasharray={`${10 / safeSc} ${6 / safeSc}`}>
        <rect x={-32} y={-178} width={24} height={178} rx={10} />
        <rect x={8} y={-178} width={24} height={178} rx={10} />
        <rect x={-56} y={-374} width={112} height={204} rx={24} />
        <rect x={-16} y={-392} width={32} height={24} />
        <circle cx={0} cy={-482} r={93} />
      </g>
      <g transform={`scale(${1 / safeSc})`}>
        <rect x={-96 / k} y={8 / k} width={192 / k} height={36 / k} rx={8 / k} fill={PAL.ink} opacity={0.86} />
        <text x={0} y={33 / k} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={21 / k} fill={PAL.gold}>{badge}</text>
      </g>
    </g>
  );
};

export const SetPlate: React.FC<{id: string; grid?: boolean}> = ({id, grid}) => {
  const def = SETS[id];
  if (!def) return <Paper w={FRAME_W} h={FRAME_H}><Txt x={FRAME_W / 2} y={FRAME_H / 2} s={50} c="red" w={900}>không có set {id}</Txt></Paper>;
  const cam = def.plateCam ?? [FRAME_W / 2, FRAME_H / 2 + 190, 1];
  const layers = def.render({t: 1.0, ...(def.plateOpts ?? {})});
  const [cx, cy, k] = cam;
  const vw = FRAME_W / k, vh = FRAME_H / k;
  const x0 = cx - vw / 2, x1 = cx + vw / 2, y0 = cy - vh / 2, y1 = cy + vh / 2;
  const step = k < 0.8 ? 200 : 100;
  const colNames = ['A', 'B', 'C'];
  const floorY = def.zones?.mgY?.[1] ?? cy + 320 / k;
  const leftThirdX = x0 + vw * 0.22;
  const rightThirdX = x0 + vw * 0.78;
  const metaLine = `loc:${def.location ?? '-'} · scale:${def.shotScale ?? '-'} · angle:${def.angle ?? '-'} · actorScale:${def.actorScale ? def.actorScale.join('–') : '-'}`;
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
            {/* 100 px world coordinate grid (subtle red) */}
            {Array.from({length: Math.ceil((x1 - x0) / step) + 1}).map((_, i) => {
              const x = Math.floor(x0 / step) * step + i * step;
              return <g key={'x' + i}><path d={`M${x} ${y0}V${y1}`} stroke={PAL.red} strokeWidth={x % 500 === 0 ? 3 / k : 1 / k} opacity={0.32} /><text x={x + 4 / k} y={y0 + 30 / k} fontSize={22 / k} fontFamily={FONT} fill={PAL.red} opacity={0.8}>{x}</text></g>;
            })}
            {Array.from({length: Math.ceil((y1 - y0) / step) + 1}).map((_, i) => {
              const y = Math.floor(y0 / step) * step + i * step;
              return <g key={'y' + i}><path d={`M${x0} ${y}H${x1}`} stroke={PAL.red} strokeWidth={y % 500 === 0 ? 3 / k : 1 / k} opacity={0.32} /><text x={x0 + 4 / k} y={y - 4 / k} fontSize={22 / k} fontFamily={FONT} fill={PAL.red} opacity={0.8}>{y}</text></g>;
            })}
            {/* 3x3 Rule-of-Thirds composition grid (teal dashed) + cell labels A1..C3 */}
            {[1, 2].map((n) => {
              const tx = x0 + (vw * n) / 3;
              const ty = y0 + (vh * n) / 3;
              return (
                <g key={'third-' + n}>
                  <line x1={tx} y1={y0} x2={tx} y2={y1} stroke={PAL.teal} strokeWidth={3 / k} strokeDasharray={`${14 / k} ${10 / k}`} opacity={0.88} />
                  <line x1={x0} y1={ty} x2={x1} y2={ty} stroke={PAL.teal} strokeWidth={3 / k} strokeDasharray={`${14 / k} ${10 / k}`} opacity={0.88} />
                </g>
              );
            })}
            {[0, 1, 2].map((ri) =>
              [0, 1, 2].map((ci) => {
                const lx = x0 + (vw * ci) / 3 + 14 / k;
                const ly = y0 + (vh * ri) / 3 + 42 / k;
                return (
                  <g key={`cell-${ri}-${ci}`}>
                    <rect x={lx - 6 / k} y={ly - 26 / k} width={48 / k} height={34 / k} rx={6 / k} fill={PAL.ink} opacity={0.62} />
                    <text x={lx + 18 / k} y={ly - 2 / k} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={22 / k} fill={PAL.teal}>{`${colNames[ci]}${ri + 1}`}</text>
                  </g>
                );
              }),
            )}
            {/* Depth-lane guides (BG / MG / FG) when def.zones is defined */}
            {def.zones && (
              <g>
                {def.zones.bgY !== undefined && (
                  <g>
                    <line x1={x0} y1={def.zones.bgY} x2={x1} y2={def.zones.bgY} stroke={PAL.blue} strokeWidth={3.5 / k} strokeDasharray={`${12 / k} ${8 / k}`} opacity={0.9} />
                    <rect x={x1 - 170 / k} y={def.zones.bgY - 34 / k} width={156 / k} height={30 / k} rx={6 / k} fill={PAL.blue} opacity={0.88} />
                    <text x={x1 - 92 / k} y={def.zones.bgY - 12 / k} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={20 / k} fill={PAL.white}>{`BG y=${def.zones.bgY}`}</text>
                  </g>
                )}
                {def.zones.mgY !== undefined && (
                  <g>
                    <rect x={x0} y={def.zones.mgY[0]} width={vw} height={Math.max(4 / k, def.zones.mgY[1] - def.zones.mgY[0])} fill={PAL.gold} opacity={0.12} />
                    <line x1={x0} y1={def.zones.mgY[0]} x2={x1} y2={def.zones.mgY[0]} stroke={PAL.goldDark} strokeWidth={3.5 / k} strokeDasharray={`${10 / k} ${6 / k}`} opacity={0.92} />
                    <line x1={x0} y1={def.zones.mgY[1]} x2={x1} y2={def.zones.mgY[1]} stroke={PAL.orange} strokeWidth={4 / k} opacity={0.95} />
                    <rect x={x1 - 240 / k} y={def.zones.mgY[1] - 34 / k} width={226 / k} height={30 / k} rx={6 / k} fill={PAL.orange} opacity={0.9} />
                    <text x={x1 - 127 / k} y={def.zones.mgY[1] - 12 / k} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={20 / k} fill={PAL.white}>{`MG [${def.zones.mgY[0]}..${def.zones.mgY[1]}]`}</text>
                  </g>
                )}
                {def.zones.fgY !== undefined && (
                  <g>
                    <line x1={x0} y1={def.zones.fgY} x2={x1} y2={def.zones.fgY} stroke={PAL.red} strokeWidth={3.5 / k} strokeDasharray={`${12 / k} ${8 / k}`} opacity={0.92} />
                    <rect x={x1 - 170 / k} y={def.zones.fgY - 34 / k} width={156 / k} height={30 / k} rx={6 / k} fill={PAL.red} opacity={0.9} />
                    <text x={x1 - 92 / k} y={def.zones.fgY - 12 / k} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={20 / k} fill={PAL.white}>{`FG y=${def.zones.fgY}`}</text>
                  </g>
                )}
              </g>
            )}
            {/* Translucent reference actor silhouettes at minS (left third) and maxS (right third) */}
            {def.actorScale && (
              <g>
                <g transform={`translate(${leftThirdX} ${floorY}) scale(${def.actorScale[0]})`}>
                  <AdultSilhouette badge={`MIN s=${def.actorScale[0].toFixed(2)}`} k={k} sc={def.actorScale[0]} />
                </g>
                <g transform={`translate(${rightThirdX} ${floorY}) scale(${def.actorScale[1]})`}>
                  <AdultSilhouette badge={`MAX s=${def.actorScale[1].toFixed(2)}`} k={k} sc={def.actorScale[1]} />
                </g>
              </g>
            )}
          </LayerG>
        )}
        {!grid && <rect width={FRAME_W} height={FRAME_H} fill="url(#grainPat)" />}
        {!grid && <rect width={FRAME_W} height={FRAME_H} fill="url(#vig)" />}
        <rect x={0} y={FRAME_H - 120} width={FRAME_W} height={120} fill={PAL.ink} opacity={0.75} />
        {grid ? (
          <text x={FRAME_W / 2} y={FRAME_H - 72} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={FRAME_W < 1400 ? 34 : 40} fill={PAL.yellow}>
            <tspan>{id} · {def.title}</tspan>
            <tspan x={FRAME_W / 2} dy={42} fontSize={FRAME_W < 1400 ? 22 : 28} fontWeight={800} fill={PAL.white}>{` | ${metaLine}`}</tspan>
          </text>
        ) : (
          <text x={FRAME_W / 2} y={FRAME_H - 44} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={44} fill={PAL.yellow}>{id} · {def.title}</text>
        )}
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

export const SubjectSheet: React.FC<{id: string; sizes?: Record<string, PropSize>}> = ({id, sizes = {}}) => {
  const W = 2400, H = 2400;
  const def = SUBJECTS[id];
  if (!def) {
    return (
      <Paper w={W} h={H}>
        <Txt x={W / 2} y={H / 2} s={56} c="red" w={900}>không có subject {id}</Txt>
      </Paper>
    );
  }
  const poses = (def.poses ?? []).slice(0, 8);
  const exprs = def.exprs ?? [];
  const hasExprs = exprs.length > 0;
  const cols = poses.length > 6 ? 4 : Math.min(3, Math.max(1, poses.length));
  const rows = Math.max(1, Math.ceil(poses.length / cols));
  const mx = 50, gx = 24, gy = 24;
  const gridTop = 176;
  const gridH = hasExprs ? 1630 : 2170;
  const cw = (W - mx * 2 - gx * (cols - 1)) / cols;
  const ch = (gridH - gy * (rows - 1)) / rows;
  const firstPose = poses[0] ?? 'idle';
  const defaultExpr = exprs[0];

  return (
    <Paper w={W} h={H}>
      <Txt x={50} y={88} s={48} c="ink" w={900} a="start">{`BẢNG CHỦ THỂ (SUBJECT SHEET) · ${id} · ${def.title}`}</Txt>
      <Txt x={50} y={136} s={26} c="blue" w={800} a="start">
        {`${def.kind.toUpperCase()} · tỷ lệ chuẩn: ${def.relToActor[0]}×–${def.relToActor[1]}× người · ${def.poses.length} pose`}
      </Txt>
      <Txt x={W - 50} y={136} s={22} c="concreteDark" w={800} a="end">chuẩn: người lớn 575 px · trẻ em 435 px · vạch 100 px · chốt vàng #n = mount · thoi xanh = grip</Txt>

      {/* Main pose grid */}
      {poses.map((pose, i) => {
        const colIdx = i % cols;
        const rowIdx = Math.floor(i / cols);
        const x0 = mx + colIdx * (cw + gx);
        const y0 = gridTop + rowIdx * (ch + gy);
        const sz = sizes[pose];
        const availW = cw - 210;
        const availH = ch - 156;
        const baseSc = Math.min(0.46, availH / 660);
        const fitW = sz && sz.w > 1 ? availW / (sz.w + 48) : baseSc;
        const fitH = sz && sz.h > 1 ? availH / Math.max(sz.h + 40, -sz.minY + 40) : baseSc;
        const sc = Math.max(0.06, Math.min(baseSc, fitW, fitH));
        const below = sz ? Math.max(0, sz.maxY) * sc : 0;
        const baseY = y0 + ch - 36 - Math.min(below, 72);
        const rulerX = x0 + 96;
        const subjAreaLeft = x0 + 68 + Math.min(180, 230 * sc);
        const subjCenterX = subjAreaLeft + (x0 + cw - 20 - subjAreaLeft) / 2;
        const subjX = sz ? subjCenterX - ((sz.minX + sz.maxX) / 2) * sc : subjCenterX;
        const tickStep = sc < 0.16 ? 200 : 100;
        const maxTick = Math.min(4000, Math.floor((baseY - (y0 + 104)) / (sc * tickStep)) * tickStep);
        const ticks: number[] = [];
        for (let tk = 0; tk <= maxTick; tk += tickStep) ticks.push(tk);
        const seatArr = def.seats?.[pose] ?? def.seats?.default ?? [];

        return (
          <g key={pose}>
            <S d={Rr(x0, y0, cw, ch, 22)} f="white" sw={4} />
            <Txt x={x0 + cw / 2} y={y0 + 42} s={30} c="ink" w={900}>{pose}</Txt>
            <Txt x={x0 + cw / 2} y={y0 + 74} s={20} c={sz && Math.abs(sz.maxY) > 80 ? 'red' : 'blue'} w={800}>
              {sz ? `${Math.round(sz.w)} × ${Math.round(sz.h)} px · y=[${Math.round(sz.minY)}..${Math.round(sz.maxY)}]${sc < baseSc ? ` · s=${sc.toFixed(2)}` : ''}` : 'SUBJECT POSE'}
            </Txt>
            <clipPath id={`subj-${id}-${i}`}><rect x={x0 + 6} y={y0 + 90} width={cw - 12} height={ch - 96} rx={16} /></clipPath>
            <g clipPath={`url(#subj-${id}-${i})`}>
              {/* 100 px dashed height ruler ticks */}
              {ticks.map((tick) => {
                const gyTick = baseY - tick * sc;
                if (gyTick < y0 + 98) return null;
                return (
                  <g key={tick}>
                    <line
                      x1={x0 + 58}
                      y1={gyTick}
                      x2={x0 + cw - 16}
                      y2={gyTick}
                      stroke={tick === 0 ? PAL.ink : PAL.concreteDark}
                      strokeWidth={tick === 0 ? 3.5 : 1.5}
                      strokeDasharray={tick === 0 ? undefined : '6 6'}
                      opacity={tick === 0 ? 0.9 : 0.42}
                    />
                    <text x={x0 + 14} y={gyTick + 5} fontSize={16} fontFamily={FONT} fontWeight={700} fill={PAL.concreteDark}>{tick}</text>
                  </g>
                );
              })}
              {/* 435 px child & 575 px adult reference lines */}
              {435 * sc >= 24 && (
                <g>
                  <line x1={x0 + 58} y1={baseY - 435 * sc} x2={rulerX + 185 * sc} y2={baseY - 435 * sc} stroke={PAL.blue} strokeWidth={2} strokeDasharray="4 4" opacity={0.6} />
                  <text x={rulerX + 140 * sc} y={baseY - 435 * sc - 5} fontSize={15} fontFamily={FONT} fontWeight={800} fill={PAL.blue}>435</text>
                </g>
              )}
              {575 * sc >= 28 && (
                <g>
                  <line x1={x0 + 58} y1={baseY - 575 * sc} x2={rulerX + 100 * sc} y2={baseY - 575 * sc} stroke={PAL.red} strokeWidth={2} strokeDasharray="4 4" opacity={0.6} />
                  <text x={rulerX} y={baseY - 575 * sc - 5} fontSize={15} fontFamily={FONT} fontWeight={800} fill={PAL.red}>575</text>
                </g>
              )}
              <g transform={`translate(${rulerX} ${baseY}) scale(${sc})`}>
                <ScaleSilhouettes />
              </g>
              <g transform={`translate(${subjX} ${baseY}) scale(${sc})`}>
                {def.render(pose, {t: 0.5, expr: defaultExpr})}
              </g>
              {/* Numbered gold target pins (#0, #1...) for mount/seat anchors + teal grip diamonds */}
              {seatArr.map((_, si) => {
                const seat = resolveSeat(def, pose, si);
                if (!seat) return null;
                const px = subjX + seat.dx * sc;
                const py = baseY + seat.dy * sc;
                const gx = seat.grip ? subjX + seat.grip[0] * sc : null;
                const gy = seat.grip ? baseY + seat.grip[1] * sc : null;
                return (
                  <g key={`seat-${si}`}>
                    {gx !== null && gy !== null && (
                      <g>
                        <line x1={px} y1={py} x2={gx} y2={gy} stroke={PAL.teal} strokeWidth={2.5} strokeDasharray="6 4" opacity={0.9} />
                        <polygon
                          points={`${gx},${gy - 10} ${gx + 10},${gy} ${gx},${gy + 10} ${gx - 10},${gy}`}
                          fill={PAL.teal}
                          stroke={PAL.ink}
                          strokeWidth={2.5}
                          strokeLinejoin="round"
                        />
                      </g>
                    )}
                    <line x1={px - 22} y1={py} x2={px + 22} y2={py} stroke={PAL.ink} strokeWidth={2.5} opacity={0.85} />
                    <line x1={px} y1={py - 22} x2={px} y2={py + 22} stroke={PAL.ink} strokeWidth={2.5} opacity={0.85} />
                    <circle cx={px} cy={py} r={14} fill={PAL.gold} stroke={PAL.ink} strokeWidth={3} />
                    <text x={px} y={py + 5} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={15} fill={PAL.ink}>{`#${si}`}</text>
                  </g>
                );
              })}
            </g>
          </g>
        );
      })}

      {/* Bottom expressions strip (if subject defines exprs) */}
      {hasExprs && (() => {
        const stripTop = 1864;
        const stripH = 486;
        const eGap = 20;
        const nE = exprs.length;
        const ecw = Math.min(460, (W - mx * 2 - eGap * (nE - 1)) / nE);
        const totalW = ecw * nE + eGap * (nE - 1);
        const startX = (W - totalW) / 2;
        const sz0 = sizes[firstPose];
        const eAvailW = ecw - 40;
        const eAvailH = stripH - 96;
        const eBaseSc = 0.42;
        const eFitW = sz0 && sz0.w > 1 ? eAvailW / (sz0.w + 36) : eBaseSc;
        const eFitH = sz0 && sz0.h > 1 ? eAvailH / Math.max(sz0.h + 36, -sz0.minY + 36) : eBaseSc;
        const eSc = Math.max(0.06, Math.min(eBaseSc, eFitW, eFitH));
        const eBelow = sz0 ? Math.max(0, sz0.maxY) * eSc : 0;
        const eBaseY = stripTop + stripH - 58 - Math.min(eBelow, 56);
        return (
          <g>
            <Txt x={50} y={1846} s={26} c="concreteDark" w={800} a="start">{`BIỂU CẢM CHỦ THỂ (${nE} exprs · pose: ${firstPose})`}</Txt>
            {exprs.map((expr, ei) => {
              const ex0 = startX + ei * (ecw + eGap);
              const eCx = ex0 + ecw / 2;
              const eSubjX = sz0 ? eCx - ((sz0.minX + sz0.maxX) / 2) * eSc : eCx;
              return (
                <g key={expr}>
                  <S d={Rr(ex0, stripTop, ecw, stripH, 20)} f="white" sw={4} />
                  <clipPath id={`subj-expr-${id}-${ei}`}><rect x={ex0 + 6} y={stripTop + 6} width={ecw - 12} height={stripH - 56} rx={14} /></clipPath>
                  <g clipPath={`url(#subj-expr-${id}-${ei})`}>
                    <line x1={ex0 + 18} y1={eBaseY} x2={ex0 + ecw - 18} y2={eBaseY} stroke={PAL.concreteDark} strokeWidth={2} strokeDasharray="6 6" opacity={0.5} />
                    <g transform={`translate(${eSubjX} ${eBaseY}) scale(${eSc})`}>
                      {def.render(firstPose, {t: 0.5, expr})}
                    </g>
                  </g>
                  <Txt x={eCx} y={stripTop + stripH - 18} s={26} c="ink" w={900}>{expr}</Txt>
                </g>
              );
            })}
          </g>
        );
      })()}
    </Paper>
  );
};
