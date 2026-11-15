// Screen graphics on top of the picture. Allowed kinds and when to use each: sv-22-shots-camera/references/shot-grammar.md §Overlays.
// Never add a new kind for one gag — draw diegetic text in the set instead.
import React from 'react';
import {E, L, PAL, R, Rr, S, Txt, FONT} from './kit';
import {Over} from './engine';
import {clamp, easeOut} from './math';

const pop = (a: number) => {
  // bật ra rồi nảy nhẹ
  const u = clamp(a / 0.22);
  return u < 1 ? easeOut(u) * 1.12 : 1.12 - 0.12 * clamp((a - 0.22) / 0.12);
};

export const OverView: React.FC<{o: Over; age: number; t: number}> = ({o, age, t}) => {
  if (age < 0) return null;
  const sc = (o.s ?? 1) * pop(age);
  const tr = `translate(${o.x} ${o.y}) rotate(${o.r ?? 0}) scale(${sc})`;
  switch (o.k) {
    case 'tag': // time jump / chapter: 'THÁNG ĐẦU', '6:45 SÁNG'
      return (
        <g transform={tr}>
          <S d={Rr(-Math.max(230, (o.text ?? '').length * 40 + 50), -110, Math.max(460, (o.text ?? '').length * 80 + 100), 190, 26)} f={o.c ?? 'red'} sw={8} />
          <Txt x={0} y={40} s={130} c="white" w={900} ls={4}>{o.text}</Txt>
          {o.sub && <Txt x={0} y={130} s={40} c="ink" w={900} stroke="white" sw={10}>{o.sub}</Txt>}
        </g>
      );
    case 'stamp': {
      const u = clamp(age / 0.16);
      return (
        <g transform={`translate(${o.x} ${o.y}) rotate(${o.r ?? -10}) scale(${(o.s ?? 1) * (1 + (1 - u) * 1.6)})`} opacity={u}>
          <rect x={-300} y={-80} width={600} height={160} rx={18} fill="none" stroke={PAL.stamp} strokeWidth={14} />
          <Txt x={0} y={30} s={84} c="stamp" w={900} ls={4}>{o.text}</Txt>
        </g>
      );
    }
    case 'bubble': {
      const w = Math.max(220, (o.text ?? '').length * (o.s ? 40 : 40) + 80);
      const [tx, ty] = o.tail ?? [-60, 120];
      return (
        <g transform={tr}>
          <S d={`M${-w / 2 + 40} 60L${tx} ${ty}L${-w / 2 + 120} 60Z`} f="white" sw={6} />
          <S d={Rr(-w / 2, -70, w, 140, 60)} f="white" sw={6} />
          <path d={`M${-w / 2 + 44} 58L${-w / 2 + 116} 58`} stroke={PAL.white} strokeWidth={10} />
          <Txt x={0} y={22} s={64} c="ink" w={900}>{o.text}</Txt>
        </g>
      );
    }
    case 'label':
      return (
        <g transform={tr}>
          <S d={Rr(-((o.text ?? '').length * 19 + 40), -46, (o.text ?? '').length * 38 + 80, 92, 18)} f={o.c ?? 'yellow'} sw={6} />
          <Txt x={0} y={20} s={56} c="ink" w={900}>{o.text}</Txt>
        </g>
      );
    case 'arrow':
      return (
        <g transform={tr}>
          <S d="M-20 -140h40v90h50l-70 80l-70 -80h50Z" f={o.c ?? 'yellow'} sw={6} />
        </g>
      );
    case 'title':
      return (
        <g transform={tr}>
          <S d={Rr(-470, -150, 940, 300, 30)} f="red" sw={10} />
          <Txt x={0} y={30} s={Math.min(150, 1500 / Math.max(1, (o.text ?? '').length))} c="yellow" w={900} ls={4} stroke="ink" sw={10}>{o.text}</Txt>
          {o.sub && <Txt x={0} y={120} s={40} c="white" w={800}>{o.sub}</Txt>}
        </g>
      );
    case 'card':
      return (
        <g transform={tr}>
          <S d={Rr(-Math.max(360, (o.text ?? '').length * 19 + 50), -70, Math.max(720, (o.text ?? '').length * 38 + 100), 140, 20)} f={o.c ?? 'ink'} sw={6} />
          <Txt x={0} y={22} s={60} c="yellow" w={900}>{o.text}</Txt>
        </g>
      );
    case 'pin':
      return (
        <g transform={tr}>
          <S d="M0 0C-60 -80 -70 -120 -70 -150A70 70 0 1 1 70 -150C70 -120 60 -80 0 0Z" f="red" sw={6} />
          <S d={E(0, -150, 28, 28)} f="white" sw={5} />
          <S d={Rr(-250, -330, 500, 90, 16)} f="white" sw={6} />
          <Txt x={0} y={-270} s={44} c="ink" w={900}>{o.text}</Txt>
        </g>
      );
    case 'score':
      return (
        <g transform={tr}>
          <S d={Rr(-260, -60, 520, 120, 20)} f="ink" sw={6} />
          <Txt x={0} y={20} s={56} c="yellow" w={900}>{o.text}</Txt>
        </g>
      );
  }
  void R; void FONT; void t;
  return null;
};
