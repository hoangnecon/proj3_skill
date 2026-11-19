// Screen geometry & SVG bounds/text measurement for shots and design lint (no browser render).
// Used by lint.mjs (GE-*, PR-*, SE-14, MO-10), qa.mjs (crops, where), and Sheets.tsx (PropSheet).
// World → screen at depth d follows Film.tsx LayerG:
//   kd = k^d, ox = 540 + (cx - 540)·d, oy = 960 + (cy - 960)·d
//   sx = 540 + (wx - ox)·kd, sy = 960 + (wy - oy)·kd
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

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
export const clip = (b) => {
  const x0 = Math.max(0, b.x0), y0 = Math.max(0, b.y0), x1 = Math.min(W, b.x1), y1 = Math.min(H, b.y1);
  return x1 > x0 && y1 > y0 ? {x0, y0, x1, y1} : {x0: 0, y0: 0, x1: 0, y1: 0};
};

/** looks: {key: {h, head, w}}; returns [{id, look, hc, head, body, hands, feet, all, h}] in screen px */
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
      hc: {x: sx(x), y: sy(headC), r: headR * k},
      head: box(sx(x - headR * 1.3), sy(top - 40 * s), sx(x + headR * 1.3), sy(headC + headR * 1.25)),
      body: box(sx(x - half), sy(headC + headR * 0.8), sx(x + half), sy(y)),
      hands: box(sx(x - 260 * s), sy(y - 400 * hh * s), sx(x + 260 * s), sy(y - 120 * hh * s)),
      feet: box(sx(x - 150 * s), sy(y - 90 * s), sx(x + 150 * s), sy(y + 30 * s)),
      all: box(sx(x - half * 1.2), sy(top), sx(x + half * 1.2), sy(y + 10 * s)),
      h: (y - top) * k,
    };
  });
};

// ======================= SVG TRANSFORM & PATH PARSING =======================
const ID_M = [1, 0, 0, 1, 0, 0];
const mulM = (m1, m2) => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];
const applyM = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const parseTransform = (s) => {
  if (!s) return ID_M;
  let m = ID_M;
  const re = /(translate|scale|rotate|matrix|skewX|skewY)\s*\(([^)]*)\)/g;
  for (const hit of s.matchAll(re)) {
    const fn = hit[1];
    const v = hit[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (fn === 'translate') m = mulM(m, [1, 0, 0, 1, v[0] || 0, v[1] || 0]);
    else if (fn === 'scale') m = mulM(m, [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0]);
    else if (fn === 'rotate') {
      const a = ((v[0] || 0) * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
      const cx = v[1] || 0, cy = v[2] || 0;
      const rot = [c, sn, -sn, c, 0, 0];
      m = cx || cy ? mulM(m, mulM([1, 0, 0, 1, cx, cy], mulM(rot, [1, 0, 0, 1, -cx, -cy]))) : mulM(m, rot);
    } else if (fn === 'matrix' && v.length >= 6) m = mulM(m, v.slice(0, 6));
    else if (fn === 'skewX') m = mulM(m, [1, 0, Math.tan(((v[0] || 0) * Math.PI) / 180), 1, 0, 0]);
    else if (fn === 'skewY') m = mulM(m, [1, Math.tan(((v[0] || 0) * Math.PI) / 180), 0, 1, 0, 0]);
  }
  return m;
};

/** Sample elliptical arc endpoints -> center parameterization (W3C SVG F.6.5/F.6.6) */
const arcPoints = (x1, y1, rx0, ry0, phiDeg, fa, fs, x2, y2, pts) => {
  if (x1 === x2 && y1 === y2) return;
  let rx = Math.abs(rx0), ry = Math.abs(ry0);
  if (rx < 1e-6 || ry < 1e-6) { pts.push([x2, y2]); return; }
  const phi = (phiDeg * Math.PI) / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx2 = (x1 - x2) / 2, dy2 = (y1 - y2) / 2;
  const x1p = cp * dx2 + sp * dy2, y1p = -sp * dx2 + cp * dy2;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const k = Math.sqrt(lam); rx *= k; ry *= k; }
  const rx2 = rx * rx, ry2 = ry * ry, x1p2 = x1p * x1p, y1p2 = y1p * y1p;
  const num = Math.max(0, rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2);
  const den = rx2 * y1p2 + ry2 * x1p2;
  const coef = (fa === fs ? -1 : 1) * Math.sqrt(den > 1e-9 ? num / den : 0);
  const cxp = coef * ((rx * y1p) / ry), cyp = coef * (-(ry * x1p) / rx);
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2;
  const cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const a = Math.acos(Math.max(-1, Math.min(1, len ? dot / len : 1)));
    return ux * vy - uy * vx < 0 ? -a : a;
  };
  const vx = (x1p - cxp) / rx, vy = (y1p - cyp) / ry;
  const wx = (-x1p - cxp) / rx, wy = (-y1p - cyp) / ry;
  const t1 = ang(1, 0, vx, vy);
  let dt = ang(vx, vy, wx, wy);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  if (fs && dt < 0) dt += 2 * Math.PI;
  for (let i = 1; i <= 16; i++) {
    const th = t1 + (dt * i) / 16;
    const ex = rx * Math.cos(th), ey = ry * Math.sin(th);
    pts.push([cp * ex - sp * ey + cx, sp * ex + cp * ey + cy]);
  }
};

const pathPoints = (d) => {
  const pts = [];
  const arcs = [];
  const tokRe = /([a-zA-Z])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  const toks = [];
  for (const m of d.matchAll(tokRe)) toks.push(m[1] ?? parseFloat(m[2]));
  let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0, lx = 0, ly = 0, prevCmd = '';
  const nextN = () => (typeof toks[i] === 'number' ? toks[i++] : 0);
  while (i < toks.length) {
    if (typeof toks[i] === 'string') cmd = toks[i++];
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') { cx = sx; cy = sy; pts.push([cx, cy]); prevCmd = C; if (typeof toks[i] !== 'string') break; continue; }
    if (C === 'M') {
      cx = (rel ? cx : 0) + nextN(); cy = (rel ? cy : 0) + nextN();
      sx = cx; sy = cy; pts.push([cx, cy]);
    } else if (C === 'L') {
      cx = (rel ? cx : 0) + nextN(); cy = (rel ? cy : 0) + nextN();
      pts.push([cx, cy]);
    } else if (C === 'H') {
      cx = (rel ? cx : 0) + nextN(); pts.push([cx, cy]);
    } else if (C === 'V') {
      cy = (rel ? cy : 0) + nextN(); pts.push([cx, cy]);
    } else if (C === 'C') {
      const x0 = cx, y0 = cy;
      const x1 = (rel ? cx : 0) + nextN(), y1 = (rel ? cy : 0) + nextN();
      const x2 = (rel ? cx : 0) + nextN(), y2 = (rel ? cy : 0) + nextN();
      cx = (rel ? cx : 0) + nextN(); cy = (rel ? cy : 0) + nextN();
      lx = x2; ly = y2;
      for (let k = 1; k <= 8; k++) {
        const u = k / 8, v = 1 - u;
        pts.push([v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * cx,
          v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * cy]);
      }
    } else if (C === 'S') {
      const x0 = cx, y0 = cy;
      const x1 = prevCmd === 'C' || prevCmd === 'S' ? 2 * cx - lx : cx;
      const y1 = prevCmd === 'C' || prevCmd === 'S' ? 2 * cy - ly : cy;
      const x2 = (rel ? cx : 0) + nextN(), y2 = (rel ? cy : 0) + nextN();
      cx = (rel ? cx : 0) + nextN(); cy = (rel ? cy : 0) + nextN();
      lx = x2; ly = y2;
      for (let k = 1; k <= 8; k++) {
        const u = k / 8, v = 1 - u;
        pts.push([v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * cx,
          v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * cy]);
      }
    } else if (C === 'Q') {
      const x0 = cx, y0 = cy;
      const x1 = (rel ? cx : 0) + nextN(), y1 = (rel ? cy : 0) + nextN();
      cx = (rel ? cx : 0) + nextN(); cy = (rel ? cy : 0) + nextN();
      lx = x1; ly = y1;
      for (let k = 1; k <= 8; k++) {
        const u = k / 8, v = 1 - u;
        pts.push([v * v * x0 + 2 * v * u * x1 + u * u * cx, v * v * y0 + 2 * v * u * y1 + u * u * cy]);
      }
    } else if (C === 'T') {
      const x0 = cx, y0 = cy;
      const x1 = prevCmd === 'Q' || prevCmd === 'T' ? 2 * cx - lx : cx;
      const y1 = prevCmd === 'Q' || prevCmd === 'T' ? 2 * cy - ly : cy;
      cx = (rel ? cx : 0) + nextN(); cy = (rel ? cy : 0) + nextN();
      lx = x1; ly = y1;
      for (let k = 1; k <= 8; k++) {
        const u = k / 8, v = 1 - u;
        pts.push([v * v * x0 + 2 * v * u * x1 + u * u * cx, v * v * y0 + 2 * v * u * y1 + u * u * cy]);
      }
    } else if (C === 'A') {
      const rx = nextN(), ry = nextN(), rot = nextN(), fa = nextN(), fs = nextN();
      const nx = (rel ? cx : 0) + nextN(), ny = (rel ? cy : 0) + nextN();
      arcs.push({rx, ry});
      arcPoints(cx, cy, rx, ry, rot, fa ? 1 : 0, fs ? 1 : 0, nx, ny, pts);
      cx = nx; cy = ny;
    } else break;
    prevCmd = C;
  }
  return {pts, arcs};
};

const parseAttrs = (str) => {
  const out = {};
  for (const m of str.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
};

const decodeEnt = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, ' ');

const SKIP_TAGS = new Set(['defs', 'clipPath', 'mask', 'pattern', 'radialGradient', 'linearGradient', 'filter']);

const estTextWidth = (content, fs, ls = 0) => {
  let units = 0;
  for (const ch of content) {
    if (/[il1.,:!'|I \u00a0]/.test(ch)) units += 0.30;
    else if (/[MWmw]/.test(ch)) units += 0.78;
    else if (/[A-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(ch) && ch === ch.toUpperCase() && ch !== ch.toLowerCase()) units += 0.62;
    else units += 0.48;
  }
  return units * fs + Math.max(0, content.length - 1) * ls;
};

/** Parse an SVG string into exact geometry bounds, text boxes, and opaque circular shapes (PR-02). */
export const parseSvgBoxes = (svg) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const addPt = (m, x, y) => {
    const [tx, ty] = applyM(m, x, y);
    if (tx < minX) minX = tx;
    if (tx > maxX) maxX = tx;
    if (ty < minY) minY = ty;
    if (ty > maxY) maxY = ty;
  };
  const texts = [], circles = [];
  const stack = [{m: ID_M, op: 1}];
  let skipDepth = 0, order = 0;
  let textState = null;

  const tagRe = /<(\/?)([a-zA-Z0-9:_-]+)([^>]*?)(\/?)>/g;
  let lastIdx = 0;
  for (const hit of svg.matchAll(tagRe)) {
    const [, close, tag, rawAttrs, selfClose] = hit;
    if (textState && close && tag === 'text') {
      textState.raw += svg.slice(lastIdx, hit.index);
      const content = decodeEnt(textState.raw.replace(/<[^>]+>/g, '')).trim();
      if (content) {
        const {m, attrs, op, ord} = textState;
        const x = +(attrs.x ?? 0), y = +(attrs.y ?? 0), fs = +(attrs['font-size'] ?? 16);
        const ls = +(attrs['letter-spacing'] ?? 0);
        const anchor = attrs['text-anchor'] ?? 'start';
        const w = estTextWidth(content, fs, ls);
        const sc = (Math.hypot(m[0], m[1]) + Math.hypot(m[2], m[3])) / 2 || 1;
        const lx0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
        const lx1 = lx0 + w;
        const ly0 = y - fs * 0.85, ly1 = y + fs * 0.2;
        const cs = [applyM(m, lx0, ly0), applyM(m, lx1, ly0), applyM(m, lx1, ly1), applyM(m, lx0, ly1)];
        const xs = cs.map((p) => p[0]), ys = cs.map((p) => p[1]);
        const b = {text: content, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), baselineY: applyM(m, x, y)[1], fontSize: fs * sc, opacity: op, order: ord};
        texts.push(b);
        for (const [px, py] of cs) { if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; }
      }
      textState = null;
      lastIdx = hit.index + hit[0].length;
      continue;
    }
    if (textState) {
      textState.raw += svg.slice(lastIdx, hit.index);
      lastIdx = hit.index + hit[0].length;
      continue;
    }
    lastIdx = hit.index + hit[0].length;

    if (SKIP_TAGS.has(tag)) {
      if (!selfClose) skipDepth += close ? -1 : 1;
      skipDepth = Math.max(0, skipDepth);
      continue;
    }
    if (skipDepth > 0) continue;

    if (close) {
      if (tag === 'g' && stack.length > 1) stack.pop();
      continue;
    }
    const top = stack[stack.length - 1];
    const attrs = parseAttrs(rawAttrs);
    const m = attrs.transform ? mulM(top.m, parseTransform(attrs.transform)) : top.m;
    const op = top.op * (attrs.opacity !== undefined ? +attrs.opacity : 1);
    if (tag === 'g') {
      if (!selfClose) stack.push({m, op});
      continue;
    }
    if (op <= 0.01) continue;
    const fill = attrs.fill ?? '';
    if (fill.startsWith('url(#glow')) continue; // exclude soft ambient glow halos from physical bounds
    const ord = order++;

    if (tag === 'text' && !selfClose) {
      textState = {m, attrs, op, ord, raw: ''};
      continue;
    }
    if (tag === 'rect') {
      const x = +(attrs.x ?? 0), y = +(attrs.y ?? 0), w = +(attrs.width ?? 0), h = +(attrs.height ?? 0);
      addPt(m, x, y); addPt(m, x + w, y); addPt(m, x + w, y + h); addPt(m, x, y + h);
    } else if (tag === 'circle') {
      const cx = +(attrs.cx ?? 0), cy = +(attrs.cy ?? 0), r = +(attrs.r ?? 0);
      addPt(m, cx - r, cy - r); addPt(m, cx + r, cy + r); addPt(m, cx - r, cy + r); addPt(m, cx + r, cy - r);
      const sc = (Math.hypot(m[0], m[1]) + Math.hypot(m[2], m[3])) / 2;
      if (fill && fill !== 'none' && !fill.startsWith('url(') && op > 0.3 && r * sc >= 20) {
        const [tcx, tcy] = applyM(m, cx, cy);
        circles.push({cx: tcx, cy: tcy, r: r * sc, fill, opacity: op, order: ord});
      }
    } else if (tag === 'ellipse') {
      const cx = +(attrs.cx ?? 0), cy = +(attrs.cy ?? 0), rx = +(attrs.rx ?? 0), ry = +(attrs.ry ?? 0);
      addPt(m, cx - rx, cy - ry); addPt(m, cx + rx, cy + ry); addPt(m, cx - rx, cy + ry); addPt(m, cx + rx, cy - ry);
      const sc = (Math.hypot(m[0], m[1]) + Math.hypot(m[2], m[3])) / 2;
      if (fill && fill !== 'none' && !fill.startsWith('url(') && op > 0.3 && Math.min(rx, ry) * sc >= 20 && Math.abs(rx - ry) <= 6) {
        const [tcx, tcy] = applyM(m, cx, cy);
        circles.push({cx: tcx, cy: tcy, r: ((rx + ry) / 2) * sc, fill, opacity: op, order: ord});
      }
    } else if (tag === 'line') {
      addPt(m, +(attrs.x1 ?? 0), +(attrs.y1 ?? 0));
      addPt(m, +(attrs.x2 ?? 0), +(attrs.y2 ?? 0));
    } else if ((tag === 'polygon' || tag === 'polyline') && attrs.points) {
      const nums = attrs.points.trim().split(/[\s,]+/).map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) addPt(m, nums[i], nums[i + 1]);
    } else if (tag === 'path' && attrs.d) {
      const {pts, arcs} = pathPoints(attrs.d);
      if (pts.length) {
        let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
        for (const [px, py] of pts) {
          const [tx, ty] = applyM(m, px, py);
          if (tx < pMinX) pMinX = tx; if (tx > pMaxX) pMaxX = tx;
          if (ty < pMinY) pMinY = ty; if (ty > pMaxY) pMaxY = ty;
        }
        if (pMinX < minX) minX = pMinX; if (pMaxX > maxX) maxX = pMaxX;
        if (pMinY < minY) minY = pMinY; if (pMaxY > maxY) maxY = pMaxY;
        // detect wheel-shaped circular path E(cx, cy, r, r)
        if (fill && fill !== 'none' && !fill.startsWith('url(') && op > 0.3 && arcs.length === 2
          && Math.abs(arcs[0].rx - arcs[0].ry) <= 4 && Math.abs(arcs[0].rx - arcs[1].rx) <= 4) {
          const sc = (Math.hypot(m[0], m[1]) + Math.hypot(m[2], m[3])) / 2;
          const r = arcs[0].rx * sc;
          if (r >= 20) circles.push({cx: (pMinX + pMaxX) / 2, cy: (pMinY + pMaxY) / 2, r, fill, opacity: op, order: ord});
        }
      }
    }
  }
  const valid = Number.isFinite(minX);
  return {
    bounds: valid ? {minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY} : {minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0},
    texts,
    circles,
  };
};

/** Extract <text> bounding boxes from a rendered SVG string. */
export const extractTexts = (svg) => parseSvgBoxes(svg).texts;

// ======================= PROP & SET GEOMETRY HELPERS =======================
const propCache = new Map();
let cachedP = null;

/** Render a WORLD_PROP key to static SVG and return its exact geometry + internal texts/circles. */
export const measurePropBox = (propKey, P = cachedP, c = undefined, t = 0.5) => {
  if (P) cachedP = P;
  if (typeof propKey === 'string' && propKey.trim().startsWith('<')) {
    const p = parseSvgBoxes(propKey);
    return {...p.bounds, texts: p.texts, circles: p.circles};
  }
  const fn = typeof propKey === 'function' ? propKey : P?.WORLD_PROPS?.[propKey];
  if (!fn) throw new Error(`measurePropBox: unknown prop '${propKey}'`);
  const key = typeof propKey === 'string' && t === 0.5 ? `${propKey}:${c ?? ''}` : null;
  if (key && propCache.has(key)) return propCache.get(key);
  const svg = renderToStaticMarkup(React.createElement('svg', null, fn(c, t)));
  const p = parseSvgBoxes(svg);
  const res = {...p.bounds, texts: p.texts, circles: p.circles};
  if (key) propCache.set(key, res);
  return res;
};

/** Project a world box through camera [cx, cy, k] at LayerG depth d into 1080×1920 screen px. */
export const projectBox = (b, cam, d = 1) => {
  const [cx, cy, k] = cam;
  const kd = Math.pow(k, d);
  const ox = 540 + (cx - 540) * d;
  const oy = 960 + (cy - 960) * d;
  return box(540 + (b.x0 - ox) * kd, 960 + (b.y0 - oy) * kd, 540 + (b.x1 - ox) * kd, 960 + (b.y1 - oy) * kd);
};

/** Extract set <text> boxes for a set id at given options, separated by depth layer (back/mid d=1, fg d=1.3). */
export const setTextsAt = (setId, opts, P) => {
  const def = P.SETS?.[setId];
  if (!def) return [];
  const L = def.render(opts);
  const out = [];
  const mainMarkup = renderToStaticMarkup(React.createElement('svg', null, L.back, ...(L.mid ?? []).map((m) => React.createElement('g', {key: m.key}, m.node))));
  for (const tx of extractTexts(mainMarkup)) out.push({...tx, d: 1});
  if (L.fg) {
    const fgMarkup = renderToStaticMarkup(React.createElement('svg', null, L.fg));
    for (const tx of extractTexts(fgMarkup)) out.push({...tx, d: 1.3});
  }
  return out;
};

/** Compute screen-space bounding box of an overlay at time t (returns null if not active at t). */
export const overlayBox = (o, cam, row, P, t) => {
  const t0 = o.at !== undefined ? (typeof o.at === 'number' ? row.t0 + o.at : P.tAt(o.at)) : row.t0 + 0.05;
  if (t < t0) return null;
  if (o.until !== undefined) {
    const t1 = typeof o.until === 'number' ? row.t0 + o.until : P.tAt(o.until);
    if (t > t1) return null;
  }
  const len = (o.text ?? '').length;
  let b;
  switch (o.k) {
    case 'tag': { const w = Math.max(460, len * 80 + 100); b = box(-w / 2, -110, w / 2, o.sub ? 150 : 80); break; }
    case 'stamp': b = box(-300, -80, 300, 80); break;
    case 'bubble': { const w = Math.max(220, len * 40 + 80); b = box(-w / 2, -70, w / 2, 70); break; }
    case 'label': { const w = len * 38 + 80; b = box(-w / 2, -46, w / 2, 46); break; }
    case 'arrow': b = box(-70, -140, 70, 30); break;
    case 'title': b = box(-470, -150, 470, 150); break;
    case 'card': { const w = Math.max(720, len * 38 + 100); b = box(-w / 2, -70, w / 2, 70); break; }
    case 'pin': b = box(-250, -330, 250, 0); break;
    case 'score': b = box(-260, -60, 260, 60); break;
    default: return null;
  }
  const sc = o.s ?? 1;
  if (o.world) {
    const wb = box(o.x + b.x0 * sc, o.y + b.y0 * sc, o.x + b.x1 * sc, o.y + b.y1 * sc);
    return {k: o.k, text: o.text ?? '', world: true, ...projectBox(wb, cam, 1)};
  }
  return {k: o.k, text: o.text ?? '', world: false, ...box(o.x + b.x0 * sc, o.y + b.y0 * sc, o.x + b.x1 * sc, o.y + b.y1 * sc)};
};

const keyedOptsAt = (def, row, P, t) => {
  const o = {};
  for (const [name, track] of Object.entries(def?.keys ?? {})) {
    let v = track[0][0];
    for (let i = 1; i < track.length; i++) {
      const [val, tt, dur] = track[i];
      const T = typeof tt === 'number' ? row.t0 + tt : P.tAt(tt);
      if (t < T) break;
      const prev = track[i - 1][0];
      v = typeof val === 'number' && typeof prev === 'number' ? lerp(prev, val, easeIO(clamp((t - T) / (dur ?? 0.6)))) : val;
    }
    o[name] = v;
  }
  return o;
};

const absTime = (tt, row, P) => (typeof tt === 'number' ? row.t0 + tt : P.tAt(tt));

export const scalarKeyAt = (spec, fallback, row, P, t) => {
  if (spec === undefined) return fallback;
  if (!Array.isArray(spec)) return spec;
  let cur = fallback;
  for (const [val, tt] of spec) {
    if (t >= absTime(tt, row, P)) cur = val;
  }
  return cur;
};

export const actorStateAt = (rowActor, defActor, t, row, P) => {
  const [x, y] = actorPos(rowActor, t);
  let dir = (defActor?.flip ?? rowActor?.flip) ? -1 : 1;
  const p = rowActor?.path;
  if (p && p.length > 1) {
    for (let i = 1; i < p.length; i++) {
      const dx = p[i][0] - p[i - 1][0];
      if (Math.abs(dx) > 2 && t >= p[i - 1][2]) dir = Math.sign(dx);
      if (t <= p[i][2]) break;
    }
  }
  const faceSpec = defActor?.face ?? rowActor?.face;
  if (faceSpec !== undefined) dir = scalarKeyAt(faceSpec, dir, row, P, t);
  const view = scalarKeyAt(defActor?.view ?? rowActor?.view, 'front', row, P, t);
  return {x, y, dir, view};
};

const targetsFixture = (defActor, sign) => {
  if (!defActor || sign.source !== 'set') return false;
  const sCx = (sign.x0 + sign.x1) / 2, sCy = (sign.y0 + sign.y1) / 2;
  for (const rc of defActor.reach ?? []) {
    if (Math.abs(rc.x - sCx) < 220 && Math.abs(rc.y - sCy) < 280) return true;
  }
  const p = defActor.path;
  if (p && p.length >= 2) {
    const first = p[0], last = p[p.length - 1];
    if ((Math.abs(last[1] - first[1]) > 50 || defActor.exit) && Math.abs(last[0] - sCx) < 220) return true;
  }
  return false;
};

/**
 * Compute full 1080×1920 screen-space geometry of shot i (or row) at time t:
 * actors (head, body, hands, feet, all, dir, view), visible set + WORLD_PROP signs (clipped/occluded status),
 * extras (WORLD_PROPS), active overlays, reachIssues, captionIssues, and caption band.
 */
export const shotGeometry = (shotOrIdx, t, P, rowsCache = null) => {
  if (P) cachedP = P;
  const rows = rowsCache ?? P.shotTable();
  const row = typeof shotOrIdx === 'number' ? rows[shotOrIdx] : shotOrIdx;
  const def = P.SHOTS[row.i] ?? row;
  const looks = {...(P.EX_LOOKS ?? {}), ...(P.CAST ?? {})};
  const cam = camAt(row, t);
  const defActors = def.actors ?? [];
  const actors = actorBoxes(row, t, looks).map((ab, idx) => {
    const ra = (row.actors ?? [])[idx];
    const da = defActors.find((q) => q.id === ab.id) ?? defActors[idx];
    const st = actorStateAt(ra ?? da ?? {}, da, t, row, P);
    return {...ab, dir: st.dir, view: st.view, worldY: st.y};
  });

  const dur = Math.max(0.01, row.t1 - row.t0);
  const ts = t - row.t0;
  const u = clamp(ts / dur);
  let dyn = {};
  if (typeof def.of === 'function') {
    try { dyn = def.of(u, ts, t) ?? {}; } catch {}
  }
  const setOpts = {t, bg: def.bg, ...(def.o ?? {}), ...keyedOptsAt(def, row, P, t), ...dyn};
  const rawSetSigns = setTextsAt(row.set, setOpts, P)
    .filter((s) => s.fontSize >= 14)
    .map((s) => ({...s, source: 'set', propKey: null}));

  const overlays = (def.over ?? []).map((o) => overlayBox(o, cam, row, P, t)).filter(Boolean);

  const VEHICLE_RE = /bus|truck|van|train|ambulance|fire.?truck|cab/i;
  const propSigns = [];
  const props = (def.extras ?? []).map((e) => {
    const mb = measurePropBox(e.k, P, e.c, t);
    const sc = e.s ?? 1;
    const wb = box(e.x + mb.minX * sc, e.y + mb.minY * sc, e.x + mb.maxX * sc, e.y + mb.maxY * sc);
    const sb = projectBox(wb, cam, 1);
    const sArea = Math.max(1, area(sb));
    const visArea = area(clip(sb));
    const clippedFrac = visArea > 0 ? 1 - visArea / sArea : 1;
    const foregroundSmall = Math.max(mb.width, mb.height) < 700 && !VEHICLE_RE.test(e.k);
    const edgeClipped = visArea > 0 && foregroundSmall && clippedFrac > 0.15 && clippedFrac < 0.95;
    let dxHint = '';
    if (edgeClipped) {
      const k = cam[2] || 1;
      const parts = [];
      if (sb.x0 < 0) parts.push(`x +${Math.ceil((-sb.x0 + 16) / k)}`);
      if (sb.x1 > W) parts.push(`x -${Math.ceil((sb.x1 - W + 16) / k)}`);
      if (sb.y0 < 0) parts.push(`y +${Math.ceil((-sb.y0 + 16) / k)}`);
      if (sb.y1 > H) parts.push(`y -${Math.ceil((sb.y1 - H + 16) / k)}`);
      dxHint = parts.join(', ');
    }
    for (const tx of mb.texts ?? []) {
      if (tx.fontSize * sc >= 14) {
        propSigns.push({
          text: tx.text,
          x0: e.x + tx.x0 * sc,
          y0: e.y + tx.y0 * sc,
          x1: e.x + tx.x1 * sc,
          y1: e.y + tx.y1 * sc,
          fontSize: tx.fontSize * sc,
          d: 1,
          source: `prop:${e.k}`,
          propKey: e.k,
          propY: e.y,
        });
      }
    }
    return {
      k: e.k,
      x: e.x,
      y: e.y,
      s: sc,
      widthUnscaled: mb.width,
      heightUnscaled: mb.height,
      foregroundSmall,
      worldBox: wb,
      screenBox: sb,
      onScreen: visArea > 0,
      clippedFrac,
      edgeClipped,
      dxHint,
    };
  });

  const signs = [...rawSetSigns, ...propSigns].map((s) => {
    const sb = projectBox({x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1}, cam, s.d);
    const sw = Math.max(1, sb.x1 - sb.x0), sh = Math.max(1, sb.y1 - sb.y0);
    const sArea = Math.max(1, area(sb));
    const visArea = area(clip(sb));
    const onScreen = visArea > 0;
    const inFrameFrac = visArea / sArea;
    const clipW = onScreen ? (Math.max(0, -sb.x0) + Math.max(0, sb.x1 - W)) / sw : 0;
    const clipH = onScreen ? (Math.max(0, -sb.y0) + Math.max(0, sb.y1 - H)) / sh : 0;
    const clipPx = onScreen ? Math.max(0, -sb.x0, sb.x1 - W, -sb.y0, sb.y1 - H) : 0;
    const fullyInFrame = sb.x0 >= 0 && sb.x1 <= W && sb.y0 >= 0 && sb.y1 <= H;
    const screenFontSize = s.fontSize * Math.pow(cam[2], s.d);
    const edgeClipped = onScreen && inFrameFrac >= 0.45 && s.text.trim().length >= 6 && s.fontSize >= 18 && screenFontSize >= 17
      && (clipW >= 0.03 || clipH >= 0.03 || clipPx >= 5);
    let camHint = '';
    if (edgeClipped) {
      const k = cam[2] || 1;
      if (sb.x0 < 0 && sb.x1 <= W) {
        const dx = Math.round((sb.x0 - 16) / k);
        camHint = `shift cam cx by ${dx} (to ${Math.round(cam[0] + dx)})`;
      } else if (sb.x1 > W && sb.x0 >= 0) {
        const dx = Math.round((sb.x1 - (W - 16)) / k);
        camHint = `shift cam cx by +${dx} (to ${Math.round(cam[0] + dx)})`;
      } else if (sb.y0 < 0 && sb.y1 <= H) {
        const dy = Math.round((sb.y0 - 16) / k);
        camHint = `shift cam cy by ${dy} (to ${Math.round(cam[1] + dy)})`;
      } else if (sb.y1 > H && sb.y0 >= 0) {
        const dy = Math.round((sb.y1 - (H - 16)) / k);
        camHint = `shift cam cy by +${dy} (to ${Math.round(cam[1] + dy)})`;
      } else {
        const kNew = +(k * (W / (sw + 32))).toFixed(2);
        camHint = `zoom out k -> ${kNew}`;
      }
    }
    const occludedBy = [];
    const SFX_PROP_RE = /pop|burst|flash|spark|smoke|bang|dust/i;
    if (fullyInFrame && s.fontSize >= 22 && screenFontSize >= 16 && s.text.trim().length >= 3 && !(s.propKey && SFX_PROP_RE.test(s.propKey))) {
      for (const a of actors) {
        const da = defActors.find((q) => q.id === a.id);
        if (targetsFixture(da, s)) continue;
        if (s.source !== 'set' && a.worldY < (s.propY ?? -Infinity) - 1) continue;
        const fh = inter(a.head, sb) / sArea;
        const fb = inter(a.body, sb) / sArea;
        const fhn = inter(a.hands, sb) / sArea;
        if (fh > 0.2 || fb > 0.35 || (s.source !== 'set' && fhn > 0.35)) {
          occludedBy.push({kind: 'actor', id: a.id, frac: Math.max(fh, fb, s.source !== 'set' ? fhn : 0)});
        }
      }
      for (const ov of overlays) {
        if (!ov.world && ov.y0 < 420 && (ov.k === 'title' || ov.k === 'tag' || ov.k === 'label')) continue;
        const frac = inter(ov, sb) / sArea;
        if (frac > 0.2) occludedBy.push({kind: 'overlay', id: `${ov.k}('${ov.text}')`, frac});
      }
      if (s.source === 'set') {
        for (const pr of props) {
          const frac = inter(pr.screenBox, sb) / sArea;
          if (frac > 0.25) occludedBy.push({kind: 'prop', id: pr.k, frac});
        }
      }
    }
    return {
      text: s.text,
      fontSize: s.fontSize,
      screenFontSize,
      source: s.source,
      propKey: s.propKey,
      worldBox: box(s.x0, s.y0, s.x1, s.y1),
      screenBox: sb,
      onScreen,
      fullyInFrame,
      inFrameFrac,
      clippedW: clipW,
      clippedH: clipH,
      clipPx,
      edgeClipped,
      camHint,
      occludedBy,
    };
  });

  const reachIssues = [];
  for (let idx = 0; idx < (row.actors ?? []).length; idx++) {
    const ra = row.actors[idx];
    const da = defActors.find((q) => q.id === ra.id) ?? defActors[idx];
    for (const rc of da?.reach ?? []) {
      const rt = absTime(rc.at, row, P);
      const st = actorStateAt(ra, da, rt, row, P);
      if (st.view === 'side' && (rc.x - st.x) * st.dir < -15) {
        reachIssues.push({id: ra.id, t: rt, x: st.x, rx: rc.x, dir: st.dir});
      }
    }
  }

  const capBox = {x0: 0, y0: CAPTION[0], x1: W, y1: CAPTION[1]};
  const captionIssues = [];
  for (const a of actors) {
    if (inter(a.head, capBox) > 0) captionIssues.push({kind: 'head', id: a.id});
    if (inter(a.hands, capBox) > 0) captionIssues.push({kind: 'hands', id: a.id});
  }
  for (const pr of props) {
    if (pr.foregroundSmall && pr.onScreen && inter(pr.screenBox, capBox) > 0) {
      captionIssues.push({kind: 'prop', id: pr.k});
    }
  }

  return {
    i: row.i,
    name: row.name,
    set: row.set,
    t,
    cam,
    actors,
    signs,
    props,
    overlays,
    reachIssues,
    captionIssues,
    caption: capBox,
  };
};
