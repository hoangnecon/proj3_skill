// STATE BOARD — reference device from "Nước mắt chia đất" (2026-11-16), see sv-short-design sets.md §8.
// Copy into src/episode/sets.tsx, rename the owners/colours/title, register it as an insert set:
//   plot: {title: '…', bed: 'paper', insert: true, render: cast(plotInsert), bounds: [-400, -400, 1480, 2320]}
// Shot: set: 'plot', cam: [540, 930, 1.08], keys: {ca: [[106, 0], [214, 's1@word', 0.6]], ut: …, bo: …}
// Needs in sets.tsx: E, L, PAL, R, Rr, S, Txt from '../kit'; Person, POSES from '../chars'; CAST from './cast'; num/str helpers.
/** bản đồ thửa đất nhìn từ trên xuống (thiết bị kể chuyện của video cũ): ba dải đất co giãn theo số m².
 *  options (số, tween được): ca, ut, bo = m² mỗi nhà (tổng 319) · stamp 0..1 · tag (chữ dưới tiêu đề) · drop 0..1 nước mắt rơi xuống thửa */
const PLOT = {x: 170, y: 450, w: 740, h: 900};
const PLOT_C: Record<string, [string, string, string, string]> = {ca: ['red', 'bacCa', 'smug', 'Bác Cả'], ut: ['yellow', 'coUt', 'sly', 'Cô Út'], bo: ['teal', 'bo', 'sad', 'Bố']};
const plotInsert = (o: SetOpts): SetLayers => {
  const t = o.t;
  const v = {ca: Math.max(0, num(o.ca, 214)), ut: Math.max(0, num(o.ut, 96)), bo: Math.max(0, num(o.bo, 9))};
  const tot = v.ca + v.ut + v.bo || 1;
  const stamp = num(o.stamp, 0);
  const tag = str(o.tag, 'CHIA LẠI MỖI NĂM');
  let x = PLOT.x;
  const strips = (['ca', 'ut', 'bo'] as const).map((k) => {
    const w = (v[k] / tot) * PLOT.w;
    const s = {k, x, w};
    x += w;
    return s;
  });
  const back = (
    <g>
      <rect x={-400} y={-400} width={1880} height={2720} fill={PAL.pink} />
      <rect x={-400} y={-400} width={1880} height={2720} fill="url(#dots)" opacity={0.12} />
      <S d={Rr(90, 170, 900, 1290, 24)} f="paper" />
      <Txt x={540} y={250} s={28} c="redDark" w={900}>GIẤY CHỨNG NHẬN QUYỀN SỬ DỤNG ĐẤT</Txt>
      <Txt x={540} y={318} s={44} c="ink" w={900}>THỬA SỐ 9 · NHÀ ÔNG NỘI</Txt>
      <Txt x={540} y={385} s={32} c="red" w={900}>{tag}</Txt>
      {Array.from({length: 17}).map((_, i) => <L key={'g' + i} d={`M120 ${440 + i * 70}H960`} w={2} c="concrete" o={0.5} />)}
      {Array.from({length: 13}).map((_, i) => <L key={'v' + i} d={`M${120 + i * 70} 420V1560`} w={2} c="concrete" o={0.5} />)}
      {strips.map(({k, x: sx, w}) => {
        const [c, look, expr, name] = PLOT_C[k];
        const cx = sx + w / 2;
        const sc = Math.min(1, w / 210);
        return (
          <g key={k}>
            <rect x={sx} y={PLOT.y} width={Math.max(0, w)} height={PLOT.h} fill={PAL[c as 'red']} stroke={PAL.ink} strokeWidth={6} />
            <rect x={sx} y={PLOT.y} width={Math.max(0, w)} height={PLOT.h} fill="url(#dots)" opacity={0.16} />
            {w > 26 && (
              <g transform={`translate(${cx} ${PLOT.y + PLOT.h * 0.42}) scale(${Math.max(0.32, sc)})`}>
                <clipPath id={`pf-${k}`}><circle r={62} /></clipPath>
                <circle r={66} fill={PAL.white} stroke={PAL.ink} strokeWidth={5} />
                <g clipPath={`url(#pf-${k})`}><g transform="translate(0 378) scale(0.72)"><Person look={CAST[look]} pose={POSES.idle} expr={expr as 'sad'} t={t} /></g></g>
              </g>
            )}
            {w > 70 ? (
              <g transform={`translate(${cx} ${PLOT.y + PLOT.h * 0.42 + 120})`}>
                <S d={Rr(-Math.min(120, w / 2 - 8), -34, Math.min(240, w - 16), 92, 12)} f="white" sw={4} />
                <Txt x={0} y={-2} s={w > 180 ? 26 : 20} c="ink" w={800}>{name}</Txt>
                <Txt x={0} y={40} s={w > 180 ? 40 : 30} c="ink" w={900}>{Math.round(v[k])} m²</Txt>
              </g>
            ) : (
              w > 0.5 && (
                <g>
                  <L d={`M${cx} ${PLOT.y + 40}L${PLOT.x + PLOT.w - 150} ${PLOT.y + 120}`} w={4} />
                  <S d={Rr(PLOT.x + PLOT.w - 330, PLOT.y + 110, 300, 92, 12)} f="white" sw={4} />
                  <Txt x={PLOT.x + PLOT.w - 180} y={PLOT.y + 148} s={26} c="ink" w={800}>{name} · {Math.round(v[k])} m²</Txt>
                  <Txt x={PLOT.x + PLOT.w - 180} y={PLOT.y + 184} s={20} c="red" w={800}>(góc cột điện)</Txt>
                </g>
              )
            )}
          </g>
        );
      })}
      {/* cột điện ở góc dưới phải */}
      <g transform={`translate(${PLOT.x + PLOT.w - 26} ${PLOT.y + PLOT.h - 30})`}>
        <S d={E(0, 0, 22, 22)} f="concrete" />
        <L d="M-15 -15l30 30M15 -15l-30 30" w={5} />
      </g>
      <rect x={PLOT.x} y={PLOT.y} width={PLOT.w} height={PLOT.h} fill="none" stroke={PAL.ink} strokeWidth={10} strokeDasharray="34 14" />
      <Txt x={540} y={1410} s={30} c="ink" w={800}>NGÕ 47 · MẶT TIỀN ↓</Txt>
    </g>
  );
  const fg = stamp > 0.01 ? (
    <g transform={`translate(700 700) rotate(-14) scale(${1 + (1 - Math.min(1, stamp)) * 0.6})`} opacity={Math.min(1, stamp * 1.5)}>
      <S d={Rr(-190, -64, 380, 128, 14)} f="none" sw={0} />
      <rect x={-190} y={-64} width={380} height={128} rx={14} fill="none" stroke={PAL.red} strokeWidth={10} />
      <Txt x={0} y={22} s={64} c="red" w={900}>ĐÃ NẾM</Txt>
    </g>
  ) : undefined;
  return {back, mid: [], fg};
};

