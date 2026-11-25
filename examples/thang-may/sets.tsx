// EXEMPLAR sets from "Thang máy ăn bí mật" — the detail benchmark for every new set (see sv-short-design/references/sets.md).
// Registered as ex-* ids so the design sheet can render them next to your sets. Episode shots must not use ex-* sets.
// Layers: far (depth 0.5) · back (1) · mid (1, depth-sorted with actors by y) · fg (1.3).
import React from 'react';
import {E, FONT, L, PAL, R, Rr, S, Sh, Txt, col} from '../kit';
import type {Item, SetLayers, SetDef} from '../sets/types';

import {wallTop, wallBot, onWall, carBtn, CORR_Y, STAIR, stairY, FLH, BLD, floorY} from './geo';
export {carBtn, CORR_Y, STAIR, stairY, FLH, BLD, floorY};

type SetOpts = {
  t: number;
  door?: number; // 0 đóng .. 1 mở (cửa thang)
  disp?: string; // số trên bảng LED
  arrow?: 'up' | 'down' | '';
  lit?: number[]; // nút tầng đang sáng (0 = hầm)
  call?: boolean; // nút gọi thang ở sảnh sáng
  flicker?: number; // 0..1 đèn chớp
  dark?: number; // 0..1 tắt đèn
  kiosk?: boolean;
  poster?: boolean;
  floorNo?: number; // hành lang / cầu thang: số tầng
  door902?: number; // 0..1 cửa phòng 902 mở
  trash?: boolean;
  carFloor?: number; // mặt cắt: vị trí buồng thang
  hl?: {f: number; c: string}[]; // mặt cắt: tô sáng tầng
  hallView?: 'stage' | 'audience';
  chairs?: number;
};

const LED: React.FC<{x: number; y: number; w: number; h: number; text: string; arrow?: string; t: number}> = ({x, y, w, h, text, arrow, t}) => (
  <g>
    <S d={Rr(x, y, w, h, 10)} f="ink" />
    <rect x={x + 8} y={y + 8} width={w - 16} height={h - 16} rx={6} fill="#14183a" />
    {arrow && <Txt x={x + w * 0.24} y={y + h * 0.7} s={h * 0.52} c="led" w={900} o={0.6 + 0.4 * Math.abs(Math.sin(t * 4))}>{arrow === 'up' ? '▲' : arrow === 'down' ? '▼' : ''}</Txt>}
    <Txt x={x + w * (arrow ? 0.64 : 0.5)} y={y + h * 0.72} s={h * 0.62} c="led" w={900}>{text}</Txt>
  </g>
);

// ======================= SẢNH =======================
export const LOBBY_DOOR = {x0: 360, x1: 720, top: 900, bot: 1560};

const CarInside: React.FC<{x: number; y: number; w: number; h: number; dark?: number}> = ({x, y, w, h, dark = 0}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} fill={PAL.steel} />
    <rect x={x + w * 0.12} y={y + h * 0.08} width={w * 0.76} height={h * 0.55} fill={PAL.mirror} stroke={PAL.ink} strokeWidth={4} />
    <L d={`M${x + w * 0.2} ${y + h * 0.5}l${w * 0.25} ${-h * 0.35}M${x + w * 0.35} ${y + h * 0.56}l${w * 0.2} ${-h * 0.28}`} w={8} c="white" o={0.7} />
    <L d={`M${x + w * 0.1} ${y + h * 0.72}h${w * 0.8}`} w={10} c="steelDark" />
    <rect x={x} y={y + h * 0.88} width={w} height={h * 0.12} fill={PAL.steelDark} />
    <rect x={x} y={y} width={w} height={h} fill="url(#glowY)" opacity={0.5} />
    {dark > 0 && <rect x={x} y={y} width={w} height={h} fill={PAL.ink} opacity={dark * 0.85} />}
  </g>
);

const SlideDoors: React.FC<{x0: number; x1: number; top: number; bot: number; open: number; id: string}> = ({x0, x1, top, bot, open, id}) => {
  const hw = (x1 - x0) / 2;
  const off = hw * 0.96 * open;
  return (
    <g>
      <clipPath id={id}><rect x={x0} y={top} width={x1 - x0} height={bot - top} /></clipPath>
      <g clipPath={`url(#${id})`}>
        {[0, 1].map((i) => {
          const px = i ? x0 + hw + off : x0 - off;
          return (
            <g key={i}>
              <S d={R(px, top, hw, bot - top)} f="steel" sw={4} />
              <rect x={px} y={top} width={hw} height={bot - top} fill="url(#dotsW)" opacity={0.35} />
              <L d={`M${px + hw * 0.25} ${top + 60}l${hw * 0.4} ${(bot - top) * 0.3}`} w={6} c="white" o={0.6} />
            </g>
          );
        })}
      </g>
      <L d={`M${x0 + hw} ${top}v${bot - top}`} w={open > 0.02 ? 0 : 4} />
    </g>
  );
};

export const lobbySet = (o: SetOpts): SetLayers => {
  const t = o.t;
  const D = LOBBY_DOOR;
  const back = (
    <g>
      {/* trần + đèn tuýp */}
      <rect x={-400} y={-400} width={1880} height={1040} fill={PAL.trim} />
      {[-120, 300, 720, 1140].map((x, i) => (
        <g key={i}>
          <S d={Rr(x, 420, 260, 40, 14)} f="white" sw={4} />
          <rect x={x - 40} y={460} width={340} height={260} fill="url(#glowY)" opacity={0.5} />
        </g>
      ))}
      {/* tường */}
      <rect x={-400} y={640} width={1880} height={920} fill={PAL.wallD} />
      <rect x={-400} y={640} width={1880} height={920} fill="url(#dots)" opacity={0.1} />
      <rect x={-400} y={1330} width={1880} height={230} fill={PAL.wallB} />
      <L d="M-400 1330H1480" w={6} />
      <L d="M-400 640H1480" w={6} />
      {/* biển toà */}
      <S d={Rr(40, 690, 320, 110, 14)} f="navy" />
      <Txt x={200} y={765} s={64} c="yellow" w={900} ls={4}>TOÀ B5</Txt>
      {/* bảng nội quy */}
      <S d={R(30, 860, 280, 330)} f="wood" />
      <S d={R(46, 876, 248, 298)} f="paper" sw={3} />
      <Txt x={170} y={928} s={34} c="red" w={900}>NỘI QUY</Txt>
      {Array.from({length: 9}).map((_, i) => <L key={i} d={`M66 ${960 + i * 22}h${190 - (i % 3) * 40}`} w={4} o={0.4} />)}
      <Txt x={170} y={1166} s={18} c="ink" w={700}>(27 điều · 4 trang)</Txt>
      {/* hòm thư */}
      <S d={R(-200, 1210, 500, 120)} f="steelDark" />
      {Array.from({length: 10}).map((_, i) => <S key={i} d={Rr(-190 + (i % 10) * 49, 1222, 42, 44, 4)} f="steel" sw={3} />)}
      {Array.from({length: 10}).map((_, i) => <S key={'b' + i} d={Rr(-190 + (i % 10) * 49, 1274, 42, 44, 4)} f="steel" sw={3} />)}
      {/* khung cửa thang */}
      <S d={R(D.x0 - 40, D.top - 40, D.x1 - D.x0 + 80, D.bot - D.top + 40)} f="steelDark" />
      <CarInside x={D.x0} y={D.top} w={D.x1 - D.x0} h={D.bot - D.top} />
      <LED x={470} y={770} w={140} h={90} text={o.disp ?? 'G'} arrow={o.arrow} t={t} />
      {/* nút gọi */}
      <S d={Rr(770, 1150, 64, 150, 10)} f="steel" />
      <S d={E(802, 1195, 18, 18)} f={o.call ? 'lit' : 'white'} />
      <Txt x={802} y={1204} s={22} c="ink" w={900}>▲</Txt>
      <S d={E(802, 1255, 18, 18)} f="white" />
      <Txt x={802} y={1264} s={22} c="ink" w={900}>▼</Txt>
      {o.call && <circle cx={802} cy={1195} r={44} fill="url(#glowY)" />}
      {/* giấy dán tay của cư dân */}
      {o.poster !== false && (
        <g transform="translate(860 950) rotate(4)">
          <S d={R(0, 0, 170, 220)} f="white" sw={4} />
          <Txt x={85} y={52} s={26} c="red" w={900}>THANG MÁY</Txt>
          <Txt x={85} y={96} s={24} c="ink" w={800}>NÓI THẬT</Txt>
          <Txt x={85} y={130} s={24} c="ink" w={800}>MỚI CHẠY!</Txt>
          <Txt x={85} y={180} s={18} c="ink" w={700}>— BQT —</Txt>
          <rect x={60} y={-12} width={50} height={22} fill={PAL.yellow} opacity={0.85} />
        </g>
      )}
      {/* sàn */}
      <rect x={-400} y={1560} width={1880} height={700} fill={PAL.floor} />
      {Array.from({length: 15}).map((_, i) => <L key={'fl' + i} d={`M${540 + (i - 7) * 90} 1560L${540 + (i - 7) * 330} 2300`} w={3} o={0.35} />)}
      {[1640, 1760, 1930, 2150].map((y) => <L key={y} d={`M-400 ${y}H1480`} w={3} o={0.35} />)}
      <L d="M-400 1560H1480" w={6} />
      {/* chậu cây */}
      <g transform="translate(1000 1560)">
        <S d="M-50 0l10 -110h80l10 110Z" f="pot" />
        {[-40, -10, 20, 45].map((x, i) => <S key={i} d={`M0 -110C${x} -200 ${x * 1.6} -260 ${x * 1.2} -330C${x * 0.6} -250 ${x * 0.3} -190 0 -110Z`} f={i % 2 ? 'plant' : 'plantDark'} />)}
      </g>
    </g>
  );
  const mid: Item[] = [];
  // cánh cửa thang ở lớp giữa: người đã vào buồng (y < 1556) bị cửa che khi đóng
  mid.push({y: 1556, key: 'ldoor', node: <SlideDoors x0={D.x0} x1={D.x1} top={D.top} bot={D.bot} open={o.door ?? 0} id="lobbyDoor" />});
  // bàn bảo vệ
  mid.push({
    y: 1700, key: 'desk', node: (
      <g>
        <S d={R(860, 1440, 380, 260)} f="wood" />
        <S d={R(840, 1420, 420, 40)} f="woodDark" />
        <rect x={860} y={1460} width={380} height={240} fill="url(#dots)" opacity={0.25} />
        <S d={Rr(900, 1500, 200, 70, 8)} f="paper" sw={4} />
        <Txt x={1000} y={1548} s={36} c="ink" w={900}>BẢO VỆ</Txt>
        <S d={Rr(1130, 1340, 40, 80, 8)} f="red" />
        <S d={R(1040, 1386, 80, 34)} f="paper" />
      </g>
    ),
  });
  if (o.kiosk) {
    mid.push({
      y: 1760, key: 'kiosk', node: (
        <g>
          <L d="M150 1760V790M470 1760V790" w={12} c="woodDark" />
          <S d={Rr(100, 760, 420, 360, 14)} f="navy" />
          <Txt x={310} y={830} s={46} c="yellow" w={900}>QUẦY BÍ MẬT</Txt>
          <L d="M130 852h360" w={4} c="yellow" />
          {[['TẦNG 5', '20.000đ'], ['TẦNG 10', '200.000đ'], ['TẦNG 15', '1 CHỈ VÀNG']].map(([a, b], i) => (
            <g key={i}>
              <Txt x={140} y={912 + i * 62} s={34} c="white" w={800} a="start">{a}</Txt>
              <Txt x={490} y={912 + i * 62} s={34} c={i === 2 ? 'gold' : 'pink'} w={900} a="end">{b}</Txt>
            </g>
          ))}
          <Txt x={310} y={1098} s={22} c="white" w={700}>bảo hành 1 lần dùng</Txt>
          <S d={R(80, 1560, 460, 40)} f="red" />
          <S d={R(100, 1600, 420, 160)} f="red" />
          <rect x={100} y={1600} width={420} height={160} fill="url(#dotsR)" opacity={0.4} />
          {[0, 1, 2, 3, 4].map((i) => <S key={i} d={`M${140 + i * 72} 1560l${-6} -50h60l-6 50Z`} f="paper" sw={3} />)}
          {[0, 1, 2, 3, 4].map((i) => <S key={'s' + i} d={`M${142 + i * 72} 1520l24 16l24 -16`} f="none" sw={3} />)}
        </g>
      ),
    });
  }
  return {back, mid};
};

// ======================= BUỒNG THANG =======================

export const carSet = (o: SetOpts): SetLayers => {
  const t = o.t;
  const lit = new Set(o.lit ?? []);
  const back = (
    <g>
      <rect x={-400} y={-400} width={1880} height={2720} fill={PAL.steelDark} />
      {/* trần */}
      <S d="M-300 300H1380L830 560H250Z" f="steel" />
      <S d={Rr(380, 380, 320, 90, 12)} f="lit" />
      <rect x={300} y={330} width={480} height={300} fill="url(#glowY)" />
      {/* tường sau: gương + tay vịn */}
      <S d={R(250, 560, 580, 940)} f="steel" />
      <S d={R(300, 610, 480, 600)} f="mirror" />
      <L d="M340 1120l200 -420M440 1160l170 -360M620 1190l130 -280" w={10} c="white" o={0.6} />
      <rect x={300} y={610} width={480} height={600} fill="url(#dotsW)" opacity={0.25} />
      <L d="M270 1260H810" w={14} c="steelDark" />
      <L d="M290 1260v30M790 1260v30" w={8} />
      {/* tường bên */}
      <S d="M-300 300L250 560V1500L-300 2160Z" f="steel" />
      <rect x={-300} y={300} width={550} height={1860} fill="url(#dots)" opacity={0.12} />
      <S d="M1380 300L830 560V1500L1380 2160Z" f="steel" />
      <rect x={830} y={300} width={550} height={1860} fill="url(#dots)" opacity={0.18} />
      {/* biển tải trọng */}
      <g transform="translate(60 900) skewY(25)">
        <S d={R(0, 0, 140, 90)} f="paper" sw={3} />
        <Txt x={70} y={40} s={22} c="ink" w={900}>TẢI TRỌNG</Txt>
        <Txt x={70} y={72} s={24} c="red" w={900}>630 KG</Txt>
      </g>
      {/* bảng nút */}
      {(() => {
        const a = onWall(875, 0.26), b = onWall(965, 0.26), c = onWall(965, 0.8), d = onWall(875, 0.8);
        return <S d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}L${c[0]} ${c[1]}L${d[0]} ${d[1]}Z`} f="steelDark" />;
      })()}
      {(() => {
        const p = onWall(890, 0.275);
        return <g transform={`translate(${p[0]} ${p[1]}) skewY(-40)`}><LED x={0} y={0} w={64} h={42} text={o.disp ?? 'G'} arrow={o.arrow} t={t} /></g>;
      })()}
      {Array.from({length: 18}).map((_, n) => {
        const [x, y] = carBtn(n);
        const on = lit.has(n);
        return (
          <g key={n}>
            {on && <circle cx={x} cy={y} r={34} fill="url(#glowY)" />}
            <S d={E(x, y, 13, 15)} f={on ? 'lit' : 'white'} sw={3} />
            <text x={x} y={y + 6} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={15} fill={PAL.ink}>{n === 0 ? 'G' : n}</text>
          </g>
        );
      })}
      {/* sàn */}
      <S d="M250 1500H830L1380 2160H-300Z" f="concreteDark" />
      <path d="M250 1500H830L1380 2160H-300Z" fill="url(#dotsBig)" opacity={0.3} />
    </g>
  );
  const shut = 1 - (o.door ?? 1);
  const fg = (
    <g>
      {o.flicker ? <rect x={-400} y={-400} width={1880} height={2800} fill={PAL.ink} opacity={o.flicker * (Math.sin(t * 31) > 0.1 ? 0.6 : 0.05)} /> : null}
      {o.dark ? (
        <g>
          <rect x={-400} y={-400} width={1880} height={2800} fill="#0d1030" opacity={o.dark * 0.88} />
          <circle cx={540} cy={420} r={260} fill={PAL.led} opacity={o.dark * 0.12 * (0.6 + 0.4 * Math.sin(t * 5))} />
        </g>
      ) : null}
    </g>
  );
  return {back, mid: [], fg};
};

// ======================= HÀNH LANG (nhìn ngang) =======================
export const corridorSet = (o: SetOpts): SetLayers => {
  const t = o.t;
  const f = o.floorNo ?? 9;
  const doors = [0, 1, 2, 3, 4];
  const back = (
    <g>
      <rect x={-600} y={-400} width={3800} height={2800} fill={PAL.wallA} />
      <rect x={-600} y={-400} width={3800} height={560} fill={PAL.trim} />
      <L d="M-600 160H3200" w={6} />
      {/* ống kỹ thuật trên trần */}
      <L d="M-600 220H3200" w={22} c="steelDark" />
      <L d="M-600 220H3200" w={10} c="steel" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <L key={i} d={`M${-400 + i * 520} 200v40`} w={8} />)}
      {/* đèn tường */}
      {[100, 520, 940, 1360, 1780, 2200].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={520} r={150} fill="url(#glowY)" opacity={0.7} />
          <S d={Rr(x - 26, 490, 52, 60, 20)} f="lit" sw={4} />
        </g>
      ))}
      <rect x={-600} y={1300} width={3800} height={350} fill={PAL.wallC} />
      <rect x={-600} y={1300} width={3800} height={350} fill="url(#dotsR)" opacity={0.18} />
      <L d="M-600 1300H3200" w={6} />
      {/* số tầng sơn tường */}
      <Txt x={-300} y={860} s={260} c="wallC" w={900} o={0.85}>{String(f)}</Txt>
      <Txt x={-300} y={950} s={56} c="ink" w={900}>TẦNG {f}</Txt>
      {/* cửa căn hộ */}
      {doors.map((i) => {
        const x = 300 + i * 420;
        const num = `${f}${String(i + 1).padStart(2, '0')}`;
        const open = num === `${f}02` ? o.door902 ?? 0 : 0;
        return (
          <g key={i}>
            <S d={R(x - 20, 820, 260, CORR_Y - 820)} f="woodDark" />
            <rect x={x} y={840} width={220} height={CORR_Y - 840} fill="#2a2140" />
            <g transform={`translate(${x} 0) scale(${1 - open * 0.82} 1)`}>
              <S d={R(0, 840, 220, CORR_Y - 840)} f={['red', 'teal', 'wood', 'blue', 'pink'][i]} />
              <rect x={0} y={840} width={220} height={CORR_Y - 840} fill="url(#dots)" opacity={0.18} />
              <S d={Rr(30, 880, 160, 300, 8)} f="none" sw={4} />
              <S d={Rr(30, 1220, 160, 360, 8)} f="none" sw={4} />
              <S d={E(190, 1260, 12, 12)} f="gold" />
              <S d={E(110, 960, 9, 9)} f="ink" />
            </g>
            <S d={Rr(x + 50, 760, 120, 50, 8)} f="paper" sw={4} />
            <Txt x={x + 110} y={798} s={36} c="ink" w={900}>{num}</Txt>
            {/* thảm chùi chân */}
            <S d={Rr(x + 10, CORR_Y - 8, 200, 18, 6)} f={i % 2 ? 'yellow' : 'teal'} sw={3} />
            {/* giá giày */}
            {i % 2 === 0 && (
              <g transform={`translate(${x + 260} ${CORR_Y})`}>
                <S d={R(0, -150, 110, 150)} f="steelDark" />
                {[0, 1, 2].map((r) => <L key={r} d={`M0 ${-50 * r - 2}h110`} w={4} />)}
                {[0, 1, 2, 3].map((k) => <S key={k} d={Rr(8 + (k % 2) * 50, -40 - Math.floor(k / 2) * 50, 44, 18, 8)} f={['red', 'blue', 'yellow', 'pink'][k]} sw={3} />)}
              </g>
            )}
          </g>
        );
      })}
      {/* cửa thang cuối hành lang */}
      <S d={R(2420, 780, 420, CORR_Y - 740)} f="steelDark" />
      <CarInside x={2460} y={820} w={340} h={CORR_Y - 820} />
      <SlideDoors x0={2460} x1={2800} top={820} bot={CORR_Y} open={o.door ?? 0} id="corrDoor" />
      <LED x={2560} y={660} w={140} h={90} text={o.disp ?? String(f)} arrow={o.arrow} t={t} />
      {/* sàn */}
      <rect x={-600} y={CORR_Y} width={3800} height={700} fill={PAL.floorDark} />
      {Array.from({length: 40}).map((_, i) => <L key={i} d={`M${-600 + i * 100} ${CORR_Y}l-60 300`} w={3} o={0.3} />)}
      <L d={`M-600 ${CORR_Y}H3200`} w={6} />
    </g>
  );
  const mid: Item[] = [];
  if (o.trash) {
    mid.push({
      y: CORR_Y + 4, key: 'trash', node: (
        <g transform={`translate(690 ${CORR_Y})`}>
          <S d="M-70 0C-90 -60 -70 -130 -20 -140L-10 -170L10 -170L20 -140C70 -130 90 -60 70 0Z" f="ink" />
          <L d="M-30 -110q20 10 50 -6" w={4} c="white" o={0.5} />
          <path d="M-14 -170l-14 -26M10 -170l16 -24" stroke={PAL.ink} strokeWidth={8} strokeLinecap="round" />
          {[0, 1, 2].map((i) => <path key={i} d={`M${-30 + i * 30} ${-170 - ((t * 40 + i * 20) % 60)}q6 -8 0 -16`} stroke={PAL.teal} strokeWidth={4} fill="none" opacity={0.7} />)}
        </g>
      ),
    });
  }
  return {back, mid};
};

// ======================= CẦU THANG BỘ (nhìn ngang) =======================
export const stairsSet = (o: SetOpts): SetLayers => {
  const f = o.floorNo ?? 11;
  const n = 16;
  const sw = (STAIR.x1 - STAIR.x0) / n, sh = (STAIR.y0 - STAIR.y1) / n;
  let steps = `M${STAIR.x0 - 400} ${STAIR.y0}H${STAIR.x0}`;
  for (let i = 0; i < n; i++) steps += `v${-sh}h${sw}`;
  steps += `H1600V2400H${STAIR.x0 - 400}Z`;
  const back = (
    <g>
      <rect x={-500} y={-400} width={2200} height={2800} fill={PAL.concrete} />
      <rect x={-500} y={-400} width={2200} height={2800} fill="url(#dots)" opacity={0.12} />
      {/* cửa sổ thông gió */}
      <S d={R(660, 300, 300, 380)} f="sky2" />
      {[0, 1, 2, 3, 4].map((i) => <L key={i} d={`M660 ${330 + i * 72}h300`} w={10} c="steelDark" />)}
      <circle cx={810} cy={490} r={300} fill="url(#glowY)" opacity={0.6} />
      {/* số tầng sơn tường */}
      <Txt x={470} y={1000} s={420} c="wallB" w={900} o={0.9}>{String(f)}</Txt>
      <S d={Rr(180, 1060, 260, 70, 10)} f="navy" />
      <Txt x={310} y={1110} s={40} c="yellow" w={900}>↑ TẦNG {f + 1}</Txt>
      {/* vệt bẩn, ổ điện, bình cứu hoả */}
      <S d={Rr(1200, 1100, 70, 140, 30)} f="red" />
      <S d={R(1190, 1080, 90, 30)} f="ink" />
      <Txt x={1235} y={1290} s={20} c="ink" w={800}>PCCC</Txt>
      {/* bậc thang */}
      <S d={steps} f="concreteDark" />
      <path d={steps} fill="url(#dotsBig)" opacity={0.2} />
      {Array.from({length: n}).map((_, i) => <L key={i} d={`M${STAIR.x0 + i * sw} ${STAIR.y0 - (i + 1) * sh}h${sw}`} w={7} c="yellow" o={0.7} />)}
      {/* tay vịn */}
      <L d={`M${STAIR.x0 - 20} ${STAIR.y0 - 190}L${STAIR.x1 + 10} ${STAIR.y1 - 190}H1500`} w={14} c="wood" />
      {Array.from({length: 9}).map((_, i) => {
        const x = STAIR.x0 + i * ((STAIR.x1 - STAIR.x0) / 8);
        return <L key={i} d={`M${x} ${stairY(x) - 190}V${stairY(x)}`} w={6} c="steelDark" />;
      })}
    </g>
  );
  return {back, mid: []};
};

// ======================= MẶT CẮT TOÀ NHÀ =======================
export const buildingSet = (o: SetOpts): SetLayers => {
  const t = o.t;
  const hl = new Map((o.hl ?? []).map((h) => [h.f, h.c]));
  const far = (
    <g>
      <rect x={-800} y={-1400} width={2700} height={3800} fill={PAL.sky2} />
      <rect x={-800} y={-1400} width={2700} height={1400} fill={PAL.sky1} opacity={0.6} />
      {[[-300, 600, 300, 1200], [1000, 400, 260, 1400], [1300, 800, 240, 1000], [-600, 900, 280, 900]].map(([x, y, w, h], i) => (
        <g key={i}><S d={R(x, y, w, h)} f="concrete" /><rect x={x} y={y} width={w} height={h} fill="url(#dots)" opacity={0.3} /></g>
      ))}
    </g>
  );
  const rows: React.ReactNode[] = [];
  for (let f = -1; f <= 16; f++) {
    const y = floorY(f);
    const isB = f === -1;
    rows.push(
      <g key={f}>
        <rect x={BLD.x0} y={y} width={BLD.x1 - BLD.x0} height={FLH} fill={hl.has(f) ? col(hl.get(f)!) : isB ? PAL.concreteDark : f % 2 ? PAL.wallD : PAL.wallA} />
        {!isB && [0, 1, 2, 3, 4, 5].map((k) => {
          const wx = k < 3 ? BLD.x0 + 22 + k * 88 : BLD.shaft1 + 22 + (k - 3) * 88;
          const on = ((f * 7 + k * 3) % 5) > 1;
          return <S key={k} d={R(wx, y + 22, 58, 48)} f={on ? 'glassLit' : 'glass'} sw={3} />;
        })}
        <L d={`M${BLD.x0} ${y + FLH}H${BLD.x1}`} w={5} />
        <Txt x={BLD.x0 - 46} y={y + 60} s={34} c={hl.has(f) ? 'red' : 'ink'} w={900}>{isB ? 'B' : f === 0 ? 'G' : String(f)}</Txt>
      </g>,
    );
  }
  const cf = o.carFloor ?? 0;
  const carY = BLD.ground - (cf + 1) * FLH;
  const back = (
    <g>
      {/* đất + tầng hầm */}
      <rect x={-800} y={BLD.ground} width={2700} height={900} fill={PAL.floorDark} />
      <rect x={-800} y={BLD.ground} width={2700} height={900} fill="url(#dots)" opacity={0.3} />
      <L d={`M-800 ${BLD.ground}H1900`} w={6} />
      <S d={R(BLD.x0 - 10, floorY(16) - 10, BLD.x1 - BLD.x0 + 20, BLD.ground + FLH - floorY(16) + 20)} f="ink" />
      {rows}
      {/* phòng máy trên mái */}
      <S d={R(BLD.shaft0 - 70, floorY(17), 220, FLH)} f="wallB" />
      <Txt x={BLD.shaft0 + 40} y={floorY(17) + 58} s={28} c="ink" w={900}>17</Txt>
      <L d={`M${BLD.x0 - 10} ${floorY(16)}H${BLD.x1 + 10}`} w={8} />
      {/* giếng thang */}
      <rect x={BLD.shaft0} y={floorY(16)} width={BLD.shaft1 - BLD.shaft0} height={BLD.ground + FLH - floorY(16)} fill="#2a2140" />
      <L d={`M${(BLD.shaft0 + BLD.shaft1) / 2} ${floorY(17) + FLH}V${carY}`} w={3} c="steel" />
      <g>
        <circle cx={(BLD.shaft0 + BLD.shaft1) / 2} cy={carY + FLH / 2} r={70} fill="url(#glowY)" opacity={0.8} />
        <S d={R(BLD.shaft0 + 6, carY + 6, BLD.shaft1 - BLD.shaft0 - 12, FLH - 12)} f="lit" sw={4} />
      </g>
      {/* biển toà */}
      <S d={Rr(BLD.x1 - 200, floorY(16) - 90, 200, 70, 10)} f="navy" />
      <Txt x={BLD.x1 - 100} y={floorY(16) - 40} s={40} c="yellow" w={900}>B5</Txt>
    </g>
  );
  void t;
  return {far, back, mid: []};
};

// ======================= HỘI TRƯỜNG PHƯỜNG =======================
export const HALL_ROWS = [1380, 1580, 1800];
export const hallSet = (o: SetOpts): SetLayers => {
  const t = o.t;
  const stage = o.hallView !== 'audience';
  const back = stage ? (
    <g>
      <rect x={-400} y={-400} width={1880} height={2800} fill={PAL.wallA} />
      <rect x={-400} y={-400} width={1880} height={2800} fill="url(#dots)" opacity={0.1} />
      <S d={R(-100, 300, 1280, 240)} f="red" />
      <Txt x={540} y={400} s={54} c="yellow" w={900}>HỘI NGHỊ CƯ DÂN TOÀ B5</Txt>
      <Txt x={540} y={480} s={36} c="white" w={800}>Chuyên đề: thang máy & hạnh phúc gia đình</Txt>
      {/* biểu đồ ly hôn trên giá */}
      <g transform="translate(830 760)">
        <L d="M0 600L60 0M200 600L140 0" w={8} c="woodDark" />
        <S d={R(-20, 0, 240, 300)} f="paper" />
        <Txt x={100} y={36} s={22} c="ink" w={900}>LY HÔN / QUẬN</Txt>
        {[90, 70, 230].map((h, i) => <S key={i} d={R(10 + i * 72, 280 - h, 50, h)} f={i === 2 ? 'red' : 'concreteDark'} sw={3} />)}
        <Txt x={180} y={44 + 0} s={0} c="ink">.</Txt>
        <Txt x={178} y={290} s={18} c="ink" w={900}>B5</Txt>
      </g>
      <S d={R(-400, 1560, 1880, 900)} f="floor" />
      <L d="M-400 1560H1480" w={6} />
    </g>
  ) : (
    <g>
      <rect x={-400} y={-400} width={1880} height={2800} fill={PAL.wallD} />
      <rect x={-400} y={-400} width={1880} height={2800} fill="url(#dots)" opacity={0.1} />
      {/* đồng hồ, quạt trần, cửa sổ */}
      <S d={E(540, 560, 80, 80)} f="white" />
      <L d={`M540 560l0 -55M540 560l${Math.cos(t) * 40} ${Math.sin(t) * 40}`} w={6} />
      {[180, 900].map((x) => (
        <g key={x}>
          <S d={R(x - 120, 700, 240, 340)} f="sky2" />
          <L d={`M${x} 700v340M${x - 120} 870h240`} w={8} c="woodDark" />
        </g>
      ))}
      <S d={R(-400, 1150, 1880, 1300)} f="floor" />
      <L d="M-400 1150H1480" w={6} />
    </g>
  );
  const mid: Item[] = [];
  if (stage) {
    mid.push({
      y: 1640, key: 'table', node: (
        <g>
          <S d={R(80, 1380, 920, 260)} f="teal" />
          <rect x={80} y={1380} width={920} height={260} fill="url(#dots)" opacity={0.25} />
          <S d={R(60, 1360, 960, 30)} f="plantDark" />
          {[260, 540, 820].map((x, i) => (
            <g key={i}>
              <S d={Rr(x - 70, 1290, 140, 70, 6)} f="white" sw={4} />
              <Txt x={x} y={1336} s={24} c="ink" w={900}>{['THƯ KÝ', 'CÁN BỘ', 'TỔ TRƯỞNG'][i]}</Txt>
              <S d={Rr(x + 80, 1250, 26, 110, 8)} f="glass" sw={3} />
              <L d={`M${x - 100} 1360l-30 -140`} w={6} />
              <S d={E(x - 132, 1210, 16, 22)} f="ink" />
            </g>
          ))}
        </g>
      ),
    });
  } else {
    HALL_ROWS.forEach((ry, r) => {
      if (r >= (o.chairs ?? 3)) return;
      for (let i = 0; i < 5; i++) {
        const x = 130 + i * 205 + (r % 2) * 40;
        mid.push({
          y: ry - 1, key: `ch${r}-${i}`, node: (
            <g transform={`translate(${x} ${ry}) scale(${0.8 + r * 0.08})`}>
              <S d={Rr(-62, -320, 124, 190, 16)} f={['blue', 'red', 'teal'][r]} />
              <S d={R(-66, -130, 132, 26)} f={['blue', 'red', 'teal'][r]} />
              <L d="M-56 -104l-8 104M56 -104l8 104" w={8} c={['blue', 'red', 'teal'][r]} />
            </g>
          ),
        });
      }
    });
  }
  return {back, mid};
};

// ======================= PHÒNG MÁY TẦNG 17 =======================
export const machineSet = (o: SetOpts): SetLayers => {
  const t = o.t;
  const back = (
    <g>
      <rect x={-400} y={-400} width={1880} height={2800} fill={PAL.concrete} />
      <rect x={-400} y={-400} width={1880} height={2800} fill="url(#dots)" opacity={0.18} />
      <S d={R(700, 380, 300, 340)} f="sky1" />
      <circle cx={850} cy={560} r={90} fill={PAL.white} opacity={0.8} />
      <L d="M700 550h300M850 380v340" w={10} c="steelDark" />
      <S d={Rr(80, 400, 420, 90, 10)} f="navy" />
      <Txt x={290} y={462} s={38} c="yellow" w={900}>PHÒNG MÁY · T17</Txt>
      {/* tủ điện */}
      <S d={R(60, 700, 380, 700)} f="steel" />
      <S d={R(80, 720, 340, 660)} f="steelDark" />
      {Array.from({length: 12}).map((_, i) => <S key={i} d={Rr(110 + (i % 4) * 75, 760 + Math.floor(i / 4) * 120, 50, 90, 6)} f={i === 5 ? 'red' : 'white'} sw={3} />)}
      <S d={Rr(110, 1150, 290, 90, 8)} f="yellow" />
      <Txt x={255} y={1185} s={26} c="ink" w={900}>⚡ ĐIỆN 3 PHA</Txt>
      <Txt x={255} y={1222} s={22} c="ink" w={800}>380V · 2019</Txt>
      <S d={Rr(110, 1260, 290, 90, 8)} f="paper" sw={3} />
      <Txt x={255} y={1300} s={22} c="ink" w={900}>BẢO TRÌ ĐỊNH KỲ</Txt>
      <Txt x={255} y={1332} s={20} c="red" w={900}>KHÔNG CÓ MICRO</Txt>
      {/* lịch treo tường 2019 */}
      <g transform="translate(560 800) rotate(-3)">
        <S d={R(0, 0, 160, 210)} f="paper" />
        <S d={R(0, 0, 160, 50)} f="red" />
        <Txt x={80} y={38} s={30} c="white" w={900}>2019</Txt>
        {Array.from({length: 15}).map((_, i) => <rect key={i} x={14 + (i % 5) * 28} y={70 + Math.floor(i / 5) * 40} width={18} height={18} fill={i === 7 ? PAL.red : PAL.concreteDark} />)}
      </g>
      <S d={R(-400, 1560, 1880, 900)} f="concreteDark" />
      <L d="M-400 1560H1480" w={6} />
    </g>
  );
  const rot = t * 120;
  const mid: Item[] = [
    {
      y: 1560, key: 'motor', node: (
        <g transform="translate(830 1560)">
          <L d="M-60 -400V-1600M60 -400V-1600" w={10} c="ink" />
          <S d={R(-200, -200, 400, 200)} f="teal" />
          <rect x={-200} y={-200} width={400} height={200} fill="url(#dots)" opacity={0.3} />
          <g transform={`translate(0 -330) rotate(${rot})`}>
            <S d={E(0, 0, 140, 140)} f="steel" />
            {[0, 60, 120].map((a) => <L key={a} d={`M${Math.cos((a * Math.PI) / 180) * -120} ${Math.sin((a * Math.PI) / 180) * -120}L${Math.cos((a * Math.PI) / 180) * 120} ${Math.sin((a * Math.PI) / 180) * 120}`} w={10} c="steelDark" />)}
            <S d={E(0, 0, 30, 30)} f="ink" />
          </g>
          <S d={Rr(-260, -120, 120, 120, 8)} f="red" />
          <Txt x={-200} y={-50} s={22} c="white" w={900}>MOTOR</Txt>
        </g>
      ),
    },
    {
      y: 1580, key: 'stool', node: (
        <g transform="translate(470 1580)">
          <S d={R(-70, -130, 140, 24)} f="red" />
          <L d="M-60 -106l-10 106M60 -106l10 106" w={10} c="red" />
          <S d={Rr(-140, -210, 60, 80, 10)} f="teal" />
          <S d={R(-136, -226, 52, 18)} f="ink" />
        </g>
      ),
    },
  ];
  return {back, mid};
};

// ======================= TẦNG HẦM =======================
export const basementSet = (o: SetOpts): SetLayers => {
  const t = o.t;
  const sway = Math.sin(t * 1.3) * 6;
  const back = (
    <g>
      <rect x={-500} y={-400} width={2100} height={2800} fill={PAL.concreteDark} />
      <rect x={-500} y={-400} width={2100} height={2800} fill="url(#dotsBig)" opacity={0.25} />
      <S d="M-500 300H1600V380H-500Z" f="concrete" />
      <L d="M-500 420H1600" w={20} c="steelDark" />
      {/* cột */}
      {[-200, 980].map((x) => (
        <g key={x}>
          <S d={R(x, 380, 160, 1200)} f="concrete" />
          <rect x={x} y={1100} width={160} height={180} fill={PAL.yellow} />
          {[0, 1, 2, 3].map((i) => <path key={i} d={`M${x + i * 40} 1100l40 0l-40 180l-40 0Z`} fill={PAL.ink} opacity={0.85} />)}
        </g>
      ))}
      <Txt x={540} y={820} s={300} c="concrete" w={900} o={0.8}>B</Txt>
      <Txt x={540} y={900} s={48} c="yellow" w={900}>TẦNG HẦM · ĐỂ XE</Txt>
      {/* cửa thang hầm */}
      <S d={R(330, 940, 420, 640)} f="steelDark" />
      <S d={R(370, 980, 170, 600)} f="steel" />
      <S d={R(540, 980, 170, 600)} f="steel" />
      <LED x={470} y={950 - 120} w={140} h={90} text={o.disp ?? 'B'} t={t} />
      <S d={R(-500, 1580, 2100, 800)} f="asphalt" />
      {[-300, 100, 500, 900, 1300].map((x) => <L key={x} d={`M${x} 1600l-120 500`} w={10} c="lane" o={0.7} />)}
      <L d="M-500 1580H1600" w={6} />
      {/* bóng đèn treo đung đưa */}
      <L d={`M540 380L${540 + sway} 600`} w={4} />
      <circle cx={540 + sway} cy={640} r={420} fill="url(#glowY)" opacity={0.55} />
      <S d={E(540 + sway, 620, 26, 32)} f="lit" />
    </g>
  );
  return {back, mid: []};
};

// ======================= GIẤY TỜ / BIÊN BẢN =======================
export const Minutes: React.FC<{t: number; write: number; stamp: number}> = ({t, write, stamp}) => (
  <g>
    <rect x={-200} y={-200} width={1480} height={2320} fill={PAL.wood} />
    <rect x={-200} y={-200} width={1480} height={2320} fill="url(#dots)" opacity={0.25} />
    <g transform="rotate(-2 540 960)">
      <S d={R(120, 260, 840, 1380)} f="paper" />
      <Txt x={540} y={360} s={28} c="ink" w={800}>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</Txt>
      <Txt x={540} y={470} s={58} c="red" w={900}>BIÊN BẢN HỌP CƯ DÂN</Txt>
      <Txt x={540} y={530} s={34} c="ink" w={800}>Toà B5 · Quý IV</Txt>
      {['Có mặt: 214 hộ / 220 hộ', 'Vắng: 6 hộ (kẹt thang)', 'Ly hôn trong năm: 31 vụ', 'Cãi nhau hành lang: 412 vụ'].map((s, i) => (
        <Txt key={i} x={200} y={640 + i * 70} s={36} c="ink" w={700} a="start">{s}</Txt>
      ))}
      <L d="M200 940H880" w={4} o={0.4} />
      <Txt x={200} y={1040} s={44} c="ink" w={900} a="start">Nguyên nhân:</Txt>
      <clipPath id="mwrite"><rect x={200} y={1060} width={680 * write} height={160} /></clipPath>
      <g clipPath="url(#mwrite)">
        <text x={220} y={1170} fontFamily={FONT} fontWeight={800} fontStyle="italic" fontSize={92} fill={PAL.blue}>Do thang máy.</text>
      </g>
      {write > 0 && write < 1 && <S d={`M${200 + 680 * write} 1160l40 -120l16 8l-40 120Z`} f="yellow" sw={4} />}
      {[0, 1, 2].map((i) => <L key={i} d={`M200 ${1300 + i * 60}h${520 - i * 120}`} w={5} o={0.3} />)}
      {stamp > 0 && (
        <g transform={`translate(760 1450) scale(${1 + (1 - stamp) * 1.5}) rotate(-12)`} opacity={stamp}>
          <circle r={120} fill="none" stroke={PAL.stamp} strokeWidth={10} />
          <circle r={96} fill="none" stroke={PAL.stamp} strokeWidth={4} />
          <Txt x={0} y={-6} s={34} c="stamp" w={900}>UBND</Txt>
          <Txt x={0} y={36} s={30} c="stamp" w={900}>PHƯỜNG 7</Txt>
        </g>
      )}
    </g>
    {void t}
  </g>
);

/** chèn cận cảnh lòng bàn tay viết bí mật */
export const Palm: React.FC<{lines: string[]; t: number}> = ({lines, t}) => (
  <g transform={`translate(540 1080) rotate(${Math.sin(t * 2) * 1.5})`}>
    <S d="M-260 420C-300 200 -300 -40 -250 -170L-250 -520C-250 -580 -170 -580 -170 -520L-170 -260L-150 -640C-150 -700 -60 -700 -60 -640L-50 -280L-30 -680C-30 -740 60 -740 60 -680L60 -280L90 -600C90 -660 180 -660 180 -600L170 -200C230 -300 300 -320 330 -270C360 -220 270 -100 230 20C200 120 200 300 180 420Z" f="skin" sw={8} />
    <Sh d="M-260 420C-300 200 -300 -40 -250 -170L-200 -170C-230 0 -220 250 -180 420Z" o={0.4} />
    <L d="M-180 -40q120 60 280 -30M-160 60q140 40 260 -10" w={4} c="skinShade" o={0.7} />
    {lines.map((s, i) => (
      <text key={i} x={-40} y={-80 + i * 92} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontStyle="italic" fontSize={56} fill={PAL.blue} transform={`rotate(-6 -40 ${-80 + i * 92})`}>{s}</text>
    ))}
  </g>
);

void Rr;

const solid = (c: string) => <rect x={-400} y={-400} width={1880} height={2720} fill={col(c)} />;
const cast = (f: (o: SetOpts) => SetLayers) => (o: Record<string, unknown>) => f(o as SetOpts);
export const EXEMPLAR_SETS: Record<string, SetDef> = {
  'ex-lobby': {title: 'Sảnh chung cư (exemplar)', bed: 'room', render: cast(lobbySet), bounds: [-400, -400, 1480, 2260]},
  'ex-car': {title: 'Buồng thang máy (exemplar)', bed: 'hum', render: cast(carSet), bounds: [-400, -400, 1480, 2320]},
  'ex-corridor': {title: 'Hành lang tầng (exemplar)', bed: 'quiet', render: cast(corridorSet), plateCam: [1300, 1150, 0.6]},
  'ex-stairs': {title: 'Cầu thang bộ (exemplar)', bed: 'echo', render: cast(stairsSet)},
  'ex-building': {title: 'Mặt cắt toà nhà (exemplar)', bed: 'outdoor', render: cast(buildingSet)},
  'ex-hall': {title: 'Hội trường phường (exemplar)', bed: 'fan', render: cast(hallSet)},
  'ex-machine': {title: 'Phòng máy (exemplar)', bed: 'motor', render: cast(machineSet)},
  'ex-basement': {title: 'Tầng hầm (exemplar)', bed: 'basement', render: cast(basementSet)},
  'ex-minutes': {title: 'Biên bản (insert, exemplar)', bed: 'paper', insert: true, render: (o) => ({back: <Minutes t={o.t} write={Number(o.write ?? 1)} stamp={Number(o.stamp ?? 1)} />, mid: []})},
  'ex-palm': {title: 'Lòng bàn tay (insert, exemplar)', bed: 'paper', insert: true, render: (o) => ({back: <g>{solid('wallB')}<rect x={-400} y={-400} width={1880} height={2720} fill="url(#dots)" opacity={0.15} /><Palm lines={(o.lines as string[]) ?? ['Tôi sợ gián']} t={o.t} /></g>, mid: []})},
};
