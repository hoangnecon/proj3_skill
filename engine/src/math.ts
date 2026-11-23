export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (x: number) => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};
export const easeIO = (x: number) => {
  const c = clamp(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

/** Exact CSS / Remotion cubic-bezier solver */
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x: number) => {
    const u = clamp(x);
    if (u <= 0 || u >= 1) return u;
    let t = u;
    for (let i = 0; i < 6; i++) {
      const dx = sampleX(t) - u;
      if (Math.abs(dx) < 1e-5) break;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    return sampleY(clamp(t));
  };
};

/** Remotion expo-out bezier (0.16, 1, 0.3, 1): fast snap, silky settle */
const BEZ_OUT = cubicBezier(0.16, 1, 0.3, 1);
/** Remotion cinematic cubic ease-in-out (0.65, 0, 0.35, 1) */
const BEZ_IO = cubicBezier(0.65, 0, 0.35, 1);
export const bezierOut = (x: number) => BEZ_OUT(clamp(x));
export const bezierIO = (x: number) => BEZ_IO(clamp(x));

export const SPRING_PRESETS = {
  snappy: {damping: 15, stiffness: 240, mass: 0.7},
  bouncy: {damping: 10, stiffness: 220, mass: 0.8},
  gentle: {damping: 20, stiffness: 140, mass: 0.9},
  heavy: {damping: 18, stiffness: 300, mass: 1.2},
  noBounce: {damping: 200, stiffness: 120, mass: 1},
} as const;
export type SpringPreset = keyof typeof SPRING_PRESETS;

/** Exact analytical 2nd-order damped harmonic oscillator matching Remotion's spring({damping, stiffness, mass}) */
export const springAt = (
  t: number,
  t0: number,
  preset: SpringPreset | {damping?: number; stiffness?: number; mass?: number} = 'snappy',
  _fps = 30,
) => {
  const dt = t - t0;
  if (dt <= 0) return 0;
  const cfg = typeof preset === 'string' ? SPRING_PRESETS[preset] : preset;
  const c = cfg.damping ?? 15;
  const k = cfg.stiffness ?? 200;
  const m = Math.max(0.05, cfg.mass ?? 1);
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  if (zeta < 1 - 1e-4) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * dt) * (Math.cos(wd * dt) + ((zeta * w0) / wd) * Math.sin(wd * dt));
  }
  if (Math.abs(zeta - 1) <= 1e-4) {
    return 1 - Math.exp(-w0 * dt) * (1 + w0 * dt);
  }
  const s = w0 * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * w0 + s;
  const r2 = -zeta * w0 - s;
  return 1 - (r2 * Math.exp(r1 * dt) - r1 * Math.exp(r2 * dt)) / (r2 - r1);
};

/** Perceptual (logarithmic) zoom/scale interpolation — uniform apparent speed across zoom ranges */
export const perceptualScale = (s0: number, s1: number, u: number) =>
  Math.exp(lerp(Math.log(Math.max(0.001, s0)), Math.log(Math.max(0.001, s1)), clamp(u)));

/** Clamped multi-keyframe `interpolate()` helper (never overshoots endpoints unless easing does) */
export const remap = (v: number, inRange: number[], outRange: number[], easing?: (x: number) => number) => {
  if (v <= inRange[0]) return outRange[0];
  const last = inRange.length - 1;
  if (v >= inRange[last]) return outRange[last];
  for (let i = 1; i <= last; i++) {
    if (v <= inRange[i]) {
      const u = clamp((v - inRange[i - 1]) / Math.max(1e-6, inRange[i] - inRange[i - 1]));
      return lerp(outRange[i - 1], outRange[i], easing ? easing(u) : u);
    }
  }
  return outRange[last];
};

export const range = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
/** nửa sóng sin trong [a,b], 0 ngoài khoảng */
export const pulse = (t: number, a: number, b: number) =>
  t < a || t > b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a));
/** nội suy từng đoạn giữa các khoá [thời gian, giá trị] bằng smoothstep */
export const kf = (t: number, pts: [number, number][]) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, v0] = pts[i - 1];
      const [t1, v1] = pts[i];
      return lerp(v0, v1, bezierIO((t - t0) / (t1 - t0)));
    }
  }
  return pts[pts.length - 1][1];
};
export type V3 = [number, number, number];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
