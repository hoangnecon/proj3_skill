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
      return lerp(v0, v1, smooth((t - t0) / (t1 - t0)));
    }
  }
  return pts[pts.length - 1][1];
};
export type V3 = [number, number, number];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
