// Screen geometry of a shot, from the shot table alone (no render): where each actor's head, body and feet are
// on the 1080×1920 frame at time t. Used by lint.mjs (GE-* rules) and qa.mjs crops (measurement crops).
// It follows Film.tsx: world → screen at depth 1 is  sx = 540 + (wx − cx)·k,  sy = 960 + (wy − cy)·k,
// and the rig in chars.tsx: feet at y, hip −178·h, shoulder −374·h, head centre ≈ −382·h − 90·head, head r = 100·head.
// Camera shake/punch and path easing are ignored — boxes carry a margin, they are for measuring, not drawing.
export const W = 1080, H = 1920;
export const CAPTION = [1570, 1710]; // caption band (Film.tsx Captions y = 1640, 66 px type, stroke)

const lerp = (a, b, u) => a + (b - a) * u;
const clamp = (u) => Math.max(0, Math.min(1, u));
const easeIO = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

export const camAt = (row, t) => {
  const c1 = row.cam, c2 = row.cam2 ?? row.cam;
  const u = easeIO(clamp((t - row.t0) / Math.max(0.01, row.t1 - row.t0)));
  return [lerp(c1[0], c2[0], u), lerp(c1[1], c2[1], u), Math.exp(lerp(Math.log(c1[2]), Math.log(c2[2]), u))];
};

export const actorPos = (a, t) => {
  if (!a.path || a.path.length < 2) return [a.x, a.y];
  const p = a.path;
  if (t <= p[0][2]) return [p[0][0], p[0][1]];
  for (let i = 1; i < p.length; i++) {
    if (t <= p[i][2]) {
      const u = (t - p[i - 1][2]) / Math.max(0.001, p[i][2] - p[i - 1][2]);
      return [lerp(p[i - 1][0], p[i][0], u), lerp(p[i - 1][1], p[i][1], u)];
    }
  }
  const l = p[p.length - 1];
  return [l[0], l[1]];
};

const box = (x0, y0, x1, y1) => ({x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1)});
export const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
export const inter = (a, b) => area(box(Math.max(a.x0, b.x0), Math.max(a.y0, b.y0), Math.min(a.x1, b.x1), Math.min(a.y1, b.y1))) *
  (a.x1 > b.x0 && b.x1 > a.x0 && a.y1 > b.y0 && b.y1 > a.y0 ? 1 : 0);

/** looks: {key: {h, head, w}}; returns [{id, look, head, body, feet, h}] in screen px */
export const actorBoxes = (row, t, looks = {}) => {
  const [cx, cy, k] = camAt(row, t);
  const sx = (wx) => 540 + (wx - cx) * k;
  const sy = (wy) => 960 + (wy - cy) * k;
  return (row.actors ?? []).map((a) => {
    const L = looks[a.look] ?? {};
    const s = a.s ?? 1, hh = L.h ?? 1, hd = L.head ?? 1, ww = L.w ?? 1;
    const [x, y] = actorPos(a, t);
    const headC = y - (382 * hh + 90 * hd) * s, headR = 100 * hd * s;
    const top = headC - headR * 1.15;
    const half = Math.max(headR, 110 * ww * s);
    return {
      id: a.id, look: a.look,
      hc: {x: sx(x), y: sy(headC), r: headR * k}, // the head circle itself (for in-frame tests)
      head: box(sx(x - headR * 1.3), sy(top - 40 * s), sx(x + headR * 1.3), sy(headC + headR * 1.25)),
      body: box(sx(x - half), sy(headC + headR * 0.8), sx(x + half), sy(y)),
      hands: box(sx(x - 260 * s), sy(y - 400 * hh * s), sx(x + 260 * s), sy(y - 120 * hh * s)),
      feet: box(sx(x - 150 * s), sy(y - 90 * s), sx(x + 150 * s), sy(y + 30 * s)),
      all: box(sx(x - half * 1.2), sy(top), sx(x + half * 1.2), sy(y + 10 * s)),
      h: (y - top) * k,
    };
  });
};

export const clip = (b) => box(Math.max(0, b.x0), Math.max(0, b.y0), Math.min(W, b.x1), Math.min(H, b.y1));
