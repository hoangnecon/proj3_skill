// Machine checks for design + shots. Writes qa/lint.json and qa/strips_needed.json; exit 1 on any error.
// Usage: node scripts/lint.mjs [design|shots|all]   (default all)
// Every rule here is documented in the skills (rule ids in brackets). Do not weaken a threshold to pass:
// fix the work. If a rule is genuinely wrong for a shot, add `// lint-ok: <rule> <reason>` on that shot's
// line in shotlist.ts — the reviewer must accept each waiver in the gate review.
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadProject} from './load.mjs';
import {actorBoxes, inter, area, clip, CAPTION, W, H, measurePropBox, measureSubjectBox, measureHandPropBox, overlayBoxesAt, setTextsAt, projectBox, shotGeometry, actorStateAt, scalarKeyAt} from './geom.mjs';

const phase = process.argv[2] ?? 'all';
const P = await loadProject();
const errors = [], warns = [];
const report = {};
const err = (rule, msg) => errors.push(`[${rule}] ${msg}`);
const warn = (rule, msg) => warns.push(`[${rule}] ${msg}`);
const src = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
const shotSrc = src('src/episode/shotlist.ts');
const propsSrc = src('src/props.tsx');
const setsSrc = src('src/episode/sets.tsx');
const subjectsSrc = src('src/episode/subjects.tsx');
const waived = (rule, name) => new RegExp(`lint-ok:\\s*${rule}\\b`).test(shotSrc.split('\n').find((l) => l.includes(`'${name}'`)) ?? '');
const lineWaived = (fileSrc, rule, key) => {
  const ls = fileSrc.split('\n');
  const re = new RegExp(`lint-ok:\\s*${rule}\\b`);
  for (let i = 0; i < ls.length; i++) {
    if (new RegExp(`(?:^|\\s)['"]?${key}['"]?\\s*:`).test(ls[i]) || new RegExp(`\\b(?:const|function)\\s+${key}\\b`).test(ls[i])) {
      if (re.test(ls[i]) || re.test(ls[i - 1] ?? '')) return true;
    }
  }
  return false;
};
const propWaived = (rule, key) => {
  if (lineWaived(propsSrc, rule, key)) return true;
  const entry = propsSrc.split('\n').find((l) => new RegExp(`^\\s*['"]?${key}['"]?\\s*:`).test(l)) ?? '';
  const comp = /<([A-Z]\w*)\b/.exec(entry)?.[1];
  return comp ? lineWaived(propsSrc, rule, comp) : false;
};

const PALKEYS = new Set(Object.keys(P.PAL));
const ROLES = new Set(['principal', 'support', 'extra']);
const BEDS = new Set(['room', 'hum', 'quiet', 'echo', 'outdoor', 'fan', 'motor', 'basement', 'paper', 'street', 'market', 'kitchen', 'rain', 'night']);
const VALID_ANGLES = new Set(['wide', 'low', 'high', 'ots', 'reverse', 'closeup', 'pov']);
const VALID_CAMERA_DIRS = new Set(['front', 'reverse', 'left', 'right', 'top', 'low', 'detail']);
const VALID_SHOT_SCALES = new Set(['establishing', 'medium', 'closeup', 'insert']);
const VALID_MOODS = new Set(['default', 'morning', 'golden', 'danger', 'lab', 'flashback', 'dramatic']);
const VALID_TRS = new Set(['cut', 'flash', 'wipe', 'whipL', 'whipR', 'iris']);
const EXPRS = new Set(['neutral', 'smug', 'angry', 'shock', 'sad', 'cry', 'joy', 'stern', 'sly', 'deadpan', 'eager', 'shh']);
const SIDE_ARMS = new Set(['swing', 'down', 'hold', 'phone', 'cane', 'carry', 'ride', 'shh', 'raise', 'pocket', 'run', 'crouch', 'jump', 'fall', 'push', 'climb', 'cheer']);
const VALID_FX = new Set(['dust', 'sweat', 'speed', 'impact', 'stars']);
const OVER = new Set(['tag', 'bubble', 'label', 'stamp', 'score', 'pin', 'title', 'card', 'arrow']);
const TH = {shapes: 60, colours: 8, texts: 2, halftone: 2, glow: 1, insertShapes: 15}; // exemplar median = 60 shapes

const SKIP_SVG_TAGS = new Set(['defs', 'clipPath', 'mask', 'pattern', 'radialGradient', 'linearGradient', 'filter']);
const ROUNDED_RECT_D = /^M[-\d.]+\s+[-\d.]+h[-\d.]+a[-\d.]+\s+[-\d.]+\s+0\s+0\s+1\b/i;
const ELLIPSE_D = /^M[-\d.]+\s+[-\d.]+a[-\d.]+\s+[-\d.]+\s+0\s+1\s+0\s+[-\d.]+\s+0a/i;
const mulSvgMat = (m1, m2) => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];
const parseSvgTransform = (s) => {
  let m = [1, 0, 0, 1, 0, 0];
  if (!s) return m;
  for (const hit of s.matchAll(/(translate|scale|rotate|matrix|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const fn = hit[1];
    const v = hit[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (fn === 'translate') m = mulSvgMat(m, [1, 0, 0, 1, v[0] || 0, v[1] || 0]);
    else if (fn === 'scale') m = mulSvgMat(m, [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0]);
    else if (fn === 'rotate') {
      const a = ((v[0] || 0) * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
      const cx = v[1] || 0, cy = v[2] || 0;
      const rot = [c, sn, -sn, c, 0, 0];
      m = cx || cy ? mulSvgMat(m, mulSvgMat([1, 0, 0, 1, cx, cy], mulSvgMat(rot, [1, 0, 0, 1, -cx, -cy]))) : mulSvgMat(m, rot);
    } else if (fn === 'matrix' && v.length >= 6) m = mulSvgMat(m, v.slice(0, 6));
    else if (fn === 'skewX') m = mulSvgMat(m, [1, 0, Math.tan(((v[0] || 0) * Math.PI) / 180), 1, 0, 0]);
    else if (fn === 'skewY') m = mulSvgMat(m, [1, Math.tan(((v[0] || 0) * Math.PI) / 180), 0, 1, 0, 0]);
  }
  return m;
};
const countCloneStampedPaths = (svg) => {
  const stack = [[1, 0, 0, 1, 0, 0]];
  let skipDepth = 0;
  const exactWorldSeen = new Set();
  const counts = new Map();
  let maxCount = 0;
  for (const hit of svg.matchAll(/<(\/?)([a-zA-Z0-9:_-]+)([^>]*?)(\/?)>/g)) {
    const [, close, tag, rawAttrs, selfClose] = hit;
    if (SKIP_SVG_TAGS.has(tag)) {
      if (!selfClose) skipDepth = Math.max(0, skipDepth + (close ? -1 : 1));
      continue;
    }
    if (skipDepth > 0) continue;
    if (close) {
      if (tag === 'g' && stack.length > 1) stack.pop();
      continue;
    }
    const top = stack[stack.length - 1];
    const trMatch = /\btransform="([^"]*)"/.exec(rawAttrs);
    const m = trMatch ? mulSvgMat(top, parseSvgTransform(trMatch[1])) : top;
    if (tag === 'g') {
      if (!selfClose) stack.push(m);
      continue;
    }
    if (tag !== 'path') continue;
    const fillMatch = /\bfill="([^"]*)"/.exec(rawAttrs);
    if (fillMatch && fillMatch[1].startsWith('url(#')) continue;
    const dMatch = /\bd="([^"]{65,})"/.exec(rawAttrs);
    if (!dMatch) continue;
    const ds = dMatch[1];
    if (!/[CcQqSsTtAa]/.test(ds) || ROUNDED_RECT_D.test(ds) || ELLIPSE_D.test(ds)) continue;
    const worldKey = `${ds}|${m.map((v) => v.toFixed(2)).join(',')}`;
    if (exactWorldSeen.has(worldKey)) continue;
    exactWorldSeen.add(worldKey);
    const linKey = `${ds}|${m[0].toFixed(3)},${m[1].toFixed(3)},${m[2].toFixed(3)},${m[3].toFixed(3)}`;
    const c = (counts.get(linKey) ?? 0) + 1;
    counts.set(linKey, c);
    if (c > maxCount) maxCount = c;
  }
  return maxCount;
};
const scriptMeta = (() => {
  try { return JSON.parse(fs.readFileSync('script.json', 'utf8')); } catch { return {}; }
})();
const isLong16x9 = scriptMeta?.length === 'long_16x9' || scriptMeta?.format === '16:9';
const isLegacyV4Showcase = /\bv4\.[0-9]/.test(scriptMeta?.title ?? '') && !scriptMeta?.length;
const VALID_SCALE_MODES = new Set(['normal', 'tiny']);

const segNum = (segId) => {
  if (typeof segId !== 'string') return NaN;
  const m = /^s(\d+)/i.exec(segId.trim());
  return m ? parseInt(m[1], 10) : NaN;
};

const inSegWindows = (n, windows) => {
  if (!Array.isArray(windows) || windows.length === 0) return true;
  return windows.some((w) => {
    if (!Array.isArray(w) || w.length < 2) return false;
    const lo = segNum(String(w[0]));
    const hi = segNum(String(w[1]));
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return true;
    return n >= Math.min(lo, hi) && n <= Math.max(lo, hi);
  });
};

const shotSegOf = (r, s) => {
  const rawAt = String(r?.at ?? s?.at ?? '');
  const m = /^(s\d+[a-z]?)/i.exec(rawAt);
  if (m) return m[1];
  const tMid = ((r?.t0 ?? 0) + (r?.t1 ?? 0)) * 0.5;
  let best = '';
  let bestT = -Infinity;
  for (const [sid, st] of Object.entries(P.C?.seg_starts ?? {})) {
    if (typeof st === 'number' && st <= tMid + 0.08 && st >= bestT) {
      best = sid;
      bestT = st;
    }
  }
  return best;
};

const segScaleMode = (() => {
  const map = new Map();
  const segArr = Array.isArray(scriptMeta?.segments) ? scriptMeta.segments : [];
  const segIdxById = new Map();
  segArr.forEach((seg, idx) => {
    if (seg && typeof seg === 'object' && typeof seg.id === 'string') segIdxById.set(seg.id, idx);
  });
  if (Array.isArray(scriptMeta?.units)) {
    const unitById = new Map();
    for (const u of scriptMeta.units) {
      if (!u || typeof u !== 'object') continue;
      const sm = u.scale_mode ?? u.scaleMode;
      if (u.id !== undefined) unitById.set(String(u.id), sm);
      if (typeof sm !== 'string') continue;
      let startS = u.seg_start ?? u.segStart ?? u.start_seg ?? u.startSeg ?? u.first_seg ?? u.from ?? null;
      let endS = u.seg_end ?? u.segEnd ?? u.end_seg ?? u.endSeg ?? u.last_seg ?? u.to ?? null;
      if (typeof u.range === 'string') {
        const rm = /^(s\d+[a-z]?)\s*(?:\.\.|-|–|to)\s*(s\d+[a-z]?)$/i.exec(u.range.trim());
        if (rm) { startS = rm[1]; endS = rm[2]; }
      } else if (Array.isArray(u.range) && u.range.length === 2) {
        [startS, endS] = u.range;
      } else if (Array.isArray(u.seg_range) && u.seg_range.length === 2) {
        [startS, endS] = u.seg_range;
      }
      if (startS && endS) {
        const s0 = String(startS).trim(), s1 = String(endS).trim();
        if (segIdxById.has(s0) && segIdxById.has(s1)) {
          const i0 = segIdxById.get(s0), i1 = segIdxById.get(s1);
          for (let idx = Math.min(i0, i1); idx <= Math.max(i0, i1); idx++) {
            const sid = segArr[idx]?.id;
            if (typeof sid === 'string') map.set(sid, sm);
          }
        } else {
          const n0 = segNum(s0), n1 = segNum(s1);
          if (Number.isFinite(n0) && Number.isFinite(n1)) {
            for (let k = Math.min(n0, n1); k <= Math.max(n0, n1); k++) map.set(`s${k}`, sm);
          }
        }
      }
      const segList = Array.isArray(u.segs) ? u.segs : (Array.isArray(u.segments) ? u.segments : null);
      if (segList && segList.length > 0) {
        if (!startS && segList.length === 2 && typeof segList[0] === 'string' && typeof segList[1] === 'string') {
          const n0 = segNum(segList[0]), n1 = segNum(segList[1]);
          if (Number.isFinite(n0) && Number.isFinite(n1) && n1 >= n0) {
            for (let k = n0; k <= n1; k++) map.set(`s${k}`, sm);
          }
        } else {
          for (const item of segList) {
            const sid = typeof item === 'string' ? item : item?.id;
            if (typeof sid === 'string') map.set(sid.trim(), sm);
          }
        }
      }
    }
    for (const seg of scriptMeta?.segments ?? []) {
      if (!seg || typeof seg !== 'object' || typeof seg.id !== 'string') continue;
      const uRef = seg.unit ?? seg.unit_id ?? seg.unitId;
      if (uRef !== undefined && unitById.has(String(uRef))) {
        const sm = unitById.get(String(uRef));
        if (typeof sm === 'string') map.set(seg.id, sm);
      }
    }
  }
  for (const seg of scriptMeta?.segments ?? []) {
    if (!seg || typeof seg !== 'object' || typeof seg.id !== 'string') continue;
    const sm = seg.scale_mode ?? seg.scaleMode;
    if (typeof sm === 'string') map.set(seg.id, sm);
  }
  return map;
})();

const isKidOrShrunkenActor = (a) => {
  const lk = P.CAST?.[a.look] ?? P.EX_LOOKS?.[a.look];
  if (!lk) return false;
  if ((lk.h ?? 1) < 0.88 || lk.hair === 'kid' || lk.hair === 'spikyUp' || (a.s ?? 1) <= 0.45) return true;
  const roleVi = P.CAST_ROLES?.[a.look]?.vi ?? '';
  return /\b(\d+\s*tuổi|học sinh|lớp trưởng|cậu bé|cô bé|tí hon)\b/i.test(roleVi);
};

// =============================== DESIGN ===============================
const traitsOf = (l) => [l.glasses, l.hat && l.hat !== 'none', l.mustache, l.beard, l.pattern, l.earrings, l.chain, l.vest, l.lips,
  (l.belly ?? 0) > 0.05, Math.abs((l.w ?? 1) - 1) > 0.04, Math.abs((l.h ?? 1) - 1) > 0.04, Math.abs((l.head ?? 1) - 1) > 0.03,
  l.hairC && l.hairC !== 'hair', l.topC2].filter(Boolean).length;

const setReport = [];
if (phase !== 'shots') {
  const keys = Object.keys(P.CAST);
  if (!keys.length) err('CH-01', 'src/episode/cast.ts is empty — design the cast before shots');
  const sil = new Map();
  for (const k of keys) {
    const l = P.CAST[k];
    const r = P.CAST_ROLES[k];
    if (l.name !== k) err('CH-02', `${k}: name must equal key (got ${l.name})`);
    if (k.startsWith('ex_')) err('CH-03', `${k}: ex_ prefix is reserved for exemplars`);
    if (!r) { err('CH-04', `${k}: missing CAST_ROLES entry`); continue; }
    if (!ROLES.has(r.role)) err('CH-04', `${k}: bad role ${r.role}`);
    if (!r.vi || r.vi.length < 8) err('CH-05', `${k}: CAST_ROLES.vi must describe who this is (≥ 8 chars)`);
    for (const f of ['topC', 'topC2', 'patC', 'pants', 'shoes', 'hairC', 'hatC', 'beardC', 'brows', 'skin']) {
      if (l[f] && !PALKEYS.has(l[f])) err('TK-01', `${k}.${f} = '${l[f]}' is not a PAL token`);
    }
    const n = traitsOf(l);
    if (r.role === 'principal' && n < 3) err('CH-06', `${k}: principal has ${n} distinguishing traits, needs ≥ 3`);
    if (r.role === 'support' && n < 2) err('CH-06', `${k}: support has ${n} distinguishing traits, needs ≥ 2`);
    const s = `${l.hair}/${l.top}/${l.topC}`;
    if (r.role !== 'extra') {
      if (sil.has(s)) err('CH-07', `${k} and ${sil.get(s)} share the silhouette ${s}`);
      sil.set(s, k);
    }
    const same = keys.find((o) => o !== k && JSON.stringify({...P.CAST[o], name: 0}) === JSON.stringify({...l, name: 0}));
    if (same) err('CH-08', `${k} is identical to ${same}`);
    // CH-11: Canonical New Nhím look (locked v5.7: hair 'spikyUp' no bangs + red backwards snapback cap 'capBack')
    if (/^nhim($|[A-Z_])/.test(k) && !/^nhimCu$/i.test(k)) {
      const castTxt = fs.existsSync('src/episode/cast.ts') ? fs.readFileSync('src/episode/cast.ts', 'utf8') : '';
      const ch11Waived = new RegExp(`lint-ok:\\s*CH-11\\b.*\\b${k}\\b|\\b${k}\\b[^\\n]*lint-ok:\\s*CH-11\\b`).test(castTxt)
        || /lint-ok:\s*CH-11\b/.test(castTxt);
      if (!ch11Waived) {
        if (l.hair !== 'spikyUp') {
          err('CH-11', `${k}: Nhím must use canonical hair: 'spikyUp' (got '${l.hair}') — import NHIM_LOOK from '../chars'`);
        }
        if (l.hat !== 'capBack' || (l.hatC ?? 'navy') !== 'red') {
          warn('CH-11', `${k}: Nhím defaults to canonical hat: 'capBack', hatC: 'red' (got hat='${l.hat ?? 'none'}', hatC='${l.hatC ?? ''}') — waive with // lint-ok: CH-11 <reason> if plot requires bare head or another hat`);
        }
      }
    }
  }
  const princ = keys.filter((k) => P.CAST_ROLES[k]?.role === 'principal');
  if (keys.length && !princ.length) err('CH-09', 'no principal in CAST_ROLES');
  if (!isLong16x9 && princ.length > 4) warn('CH-09', `${princ.length} principals — a 2–3 minute story rarely carries more than 3`);
  if (isLong16x9) {
    if (keys.length < 8) err('CH-09', `long_16x9 episode has only ${keys.length} cast member(s) (minimum 8 required; recommended ≥ 10)`);
    else if (keys.length < 10) warn('CH-09', `long_16x9 episode has ${keys.length} cast members (recommended ≥ 10 for a 10-min cast)`);
  }

  const sets = Object.keys(P.EPISODE_SETS);
  const plateStats = fs.existsSync('qa/design/plate_stats.json') ? JSON.parse(fs.readFileSync('qa/design/plate_stats.json', 'utf8')) : {};
  if (!sets.length) err('SE-01', 'src/episode/sets.tsx registers no sets');
  for (const id of sets) {
    const d = P.EPISODE_SETS[id];
    if (id.startsWith('ex-')) err('SE-02', `${id}: ex- prefix is reserved for exemplars`);
    if (!d.title) err('SE-03', `${id}: missing title`);
    if (!d.insert && !(Array.isArray(d.bounds) && d.bounds.length === 4)) err('SE-11', `${id}: missing bounds [x0, y0, x1, y1] — the world rect your back layer paints edge to edge`);
    if (!BEDS.has(d.bed)) err('SE-04', `${id}: bed '${d.bed}' unknown (${[...BEDS].join(' ')})`);
    let st;
    try { st = P.setStats(id); } catch (e) { err('SE-05', `${id}: render threw ${e.message}`); continue; }
    setReport.push(st);
    if (d.insert) {
      if (st.shapes < TH.insertShapes) err('SE-06', `${id} (insert): ${st.shapes} shapes < ${TH.insertShapes}`);
      if (st.texts < 1) err('SE-07', `${id} (insert): no diegetic text`);
    } else {
      let latestPlateSrcMtime = fs.statSync('src/episode/sets.tsx').mtimeMs;
      const isBakedPlate = Boolean(d.rasterPlate || d.videoPlate);
      const bw = Array.isArray(d.bounds) && d.bounds.length === 4 ? Math.max(1, d.bounds[2] - d.bounds[0]) : W;
      const bh = Array.isArray(d.bounds) && d.bounds.length === 4 ? Math.max(1, d.bounds[3] - d.bounds[1]) : H;
      if (d.videoPlate) {
        const vp = d.videoPlate;
        const rawSrc = String(vp?.src ?? '').trim();
        if (!rawSrc) {
          err('SE-06', `${id} (videoPlate): videoPlate.src is empty`);
        } else if (/^(?:https?:|data:)/i.test(rawSrc)) {
          err('SE-06', `${id} (videoPlate): external or inline URL "${rawSrc}" is forbidden — store baked loop locally under public/`);
        } else if (!/\.(?:mp4|webm)$/i.test(rawSrc.split(/[?#]/)[0])) {
          err('SE-06', `${id} (videoPlate): "${rawSrc}" must be a .mp4 or .webm loop (use rasterPlate: true + <image> for static PNG/JPG/WebP)`);
        } else {
          const cleanRel = decodeURIComponent(rawSrc.split(/[?#]/)[0]).replace(/^\/+/, '').replace(/^public[\\/]+/, '');
          const diskPath = path.resolve('public', cleanRel);
          const pubRoot = path.resolve('public');
          if (!diskPath.startsWith(pubRoot + path.sep) || !fs.existsSync(diskPath) || !fs.statSync(diskPath).isFile()) {
            err('SE-06', `${id} (videoPlate): videoPlate.src "${rawSrc}" missing on disk at public/${cleanRel} — bake the loop before passing design CI`);
          } else {
            const stFile = fs.statSync(diskPath);
            if (stFile.size < 1024) {
              err('SE-06', `${id} (videoPlate): public/${cleanRel} is only ${stFile.size} bytes (< 1024 B placeholder) — bake a real loop MP4/WebM`);
            }
            if (stFile.mtimeMs > latestPlateSrcMtime) latestPlateSrcMtime = stFile.mtimeMs;
          }
        }
        if (!((vp?.width ?? 0) >= bw * 0.85 && (vp?.height ?? 0) >= bh * 0.85)) {
          err('SE-06', `${id} (videoPlate): videoPlate size (${vp?.width ?? 0}x${vp?.height ?? 0}) covers < 85% of set bounds (${Math.round(bw)}x${Math.round(bh)} px)`);
        }
        if (vp?.dur !== undefined && !(Number.isFinite(vp.dur) && vp.dur >= 0.5 && vp.dur <= 30)) {
          err('SE-06', `${id} (videoPlate): videoPlate.dur=${vp.dur} must be between 0.5 and 30 seconds`);
        }
      }
      if (d.rasterPlate && !d.videoPlate) {
        const imgTags = Array.isArray(st.imageTags) ? st.imageTags : [];
        if ((st.images ?? 0) < 1 || imgTags.length < 1) {
          err('SE-06', `${id} (rasterPlate): renders 0 <image> elements — mount the pre-baked plate via <image href={staticFile(...)} /> or remove rasterPlate: true`);
        } else {
          let hasFullBackdrop = false;
          for (const im of imgTags) {
            const rawHref = String(im.href ?? '').trim();
            if (!rawHref) {
              err('SE-06', `${id} (rasterPlate): <image> has empty href`);
              continue;
            }
            if (/^https?:/i.test(rawHref)) {
              err('SE-06', `${id} (rasterPlate): external URL "${rawHref}" is forbidden — bake and store plate locally under public/`);
              continue;
            }
            const cleanBase = rawHref.split(/[?#]/)[0];
            if (/\.(?:mp4|webm|mov)$/i.test(cleanBase)) {
              err('SE-06', `${id} (rasterPlate): SVG <image href="${rawHref}"> cannot play video in Chromium — use SetDef.videoPlate: {src, x, y, width, height, dur} instead`);
              continue;
            }
            if (!/^data:/i.test(rawHref)) {
              const cleanRel = decodeURIComponent(cleanBase).replace(/^\/+/, '').replace(/^public[\\/]+/, '');
              const diskPath = path.resolve('public', cleanRel);
              const pubRoot = path.resolve('public');
              if (!diskPath.startsWith(pubRoot + path.sep) || !fs.existsSync(diskPath) || !fs.statSync(diskPath).isFile()) {
                err('SE-06', `${id} (rasterPlate): <image href="${rawHref}"> missing on disk at public/${cleanRel} — bake the plate before passing design CI`);
              } else {
                const stFile = fs.statSync(diskPath);
                if (stFile.size < 512) {
                  err('SE-06', `${id} (rasterPlate): public/${cleanRel} is only ${stFile.size} bytes (< 512 B placeholder) — bake a real high-res plate`);
                }
                if (stFile.mtimeMs > latestPlateSrcMtime) latestPlateSrcMtime = stFile.mtimeMs;
              }
            } else if (rawHref.length < 600) {
              err('SE-06', `${id} (rasterPlate): inline data: <image> is too small (${rawHref.length} chars) — cannot use a 1x1 pixel stub to bypass SE-06`);
            }
            if ((im.width ?? 0) >= bw * 0.85 && (im.height ?? 0) >= bh * 0.85) {
              hasFullBackdrop = true;
            }
          }
          if (!hasFullBackdrop) {
            err('SE-06', `${id} (rasterPlate): no <image> covers >= 85% of set bounds (${Math.round(bw)}x${Math.round(bh)} px) — a tiny icon cannot substitute for a full stage plate`);
          }
        }
      } else if (!isBakedPlate) {
        if (st.shapes < TH.shapes) err('SE-06', `${id}: ${st.shapes} shapes < ${TH.shapes} (exemplar median). Add fixtures, clutter, wear — see sets.md §Detail budget`);
        if (st.colours < TH.colours) err('SE-08', `${id}: ${st.colours} distinct colours < ${TH.colours}`);
        if (st.texts < TH.texts) err('SE-07', `${id}: ${st.texts} diegetic texts < ${TH.texts} (signs, labels, notices — one must be a gag)`);
        if (st.halftone < TH.halftone) err('SE-09', `${id}: halftone texture used ${st.halftone}× < ${TH.halftone} (walls/floor/shade side)`);
      }
      const pl = plateStats[id];
      if (!pl) err('SE-13', `${id}: plate not measured yet — run node scripts/design.mjs`);
      else if ((pl.measured ?? pl.mtime) * 1000 < latestPlateSrcMtime) err('SE-13', `${id}: plate is older than src/episode/sets.tsx or public/ plate image — re-render with node scripts/design.mjs --only set:${id}`);
      else if (pl.empty_mid > 8) err('SE-13', `${id}: ${pl.empty_mid} empty 180-px cells in the visible middle of the plate (max 8; rows ${pl.rows}) — detail must be IN FRAME, not off-screen. Fill the wall band: notices, fixtures, clutter (sets.md §3)`);
      else if (pl.empty_mid > 5) warn('SE-13', `${id}: ${pl.empty_mid} empty cells in the middle of the plate (rows ${pl.rows}) — look for bare wall`);
      // SE-16: Perceptual Visual Quality Gate from plate_stats.json (v4.3 fields; graceful no-op if absent)
      if (pl && !lineWaived(setsSrc, 'SE-16', id)) {
        if (typeof pl.clutter_max_3x3 === 'number' && Number.isFinite(pl.clutter_max_3x3)) {
          if (pl.clutter_max_3x3 > 22.0) {
            err('SE-16', `${id}: perceptual 3×3 clutter peak ${pl.clutter_max_3x3.toFixed(1)}% > 22.0% — extreme visual noise / chaotic spike walls; simplify background pattern`);
          } else if (pl.clutter_max_3x3 > 16.5) {
            warn('SE-16', `${id}: perceptual 3×3 clutter peak ${pl.clutter_max_3x3.toFixed(1)}% > 16.5% — busy background zone; verify subject readability`);
          }
        }
        if (typeof pl.contrast_std === 'number' && Number.isFinite(pl.contrast_std)) {
          if (pl.contrast_std < 18.0) {
            err('SE-16', `${id}: perceptual luminance contrast_std ${pl.contrast_std.toFixed(1)} < 18.0 — severely flat/muddy plate; strengthen dark/light separation`);
          } else if (pl.contrast_std < 22.0) {
            warn('SE-16', `${id}: perceptual luminance contrast_std ${pl.contrast_std.toFixed(1)} < 22.0 — low-contrast plate; add tonal separation`);
          }
        }
        if (typeof pl.lr_balance_delta === 'number' && Number.isFinite(pl.lr_balance_delta)) {
          if (pl.lr_balance_delta > 9.5) {
            warn('SE-16', `${id}: perceptual left/right balance delta ${pl.lr_balance_delta.toFixed(1)} > 9.5 — lopsided composition weight`);
          }
        }
      }
      // AD-07: Cross-Plate Visual Richness & Anti-Copy-Paste Backdrop Gate (v6.2)
      if (d.rasterPlate && pl && !lineWaived(setsSrc, 'AD-07', id)) {
        if (typeof pl.color_clusters === 'number' && Number.isFinite(pl.color_clusters)) {
          if (pl.color_clusters < 6) {
            err('AD-07', `${id} (rasterPlate): color_clusters=${pl.color_clusters} < 6 — flat/under-detailed placeholder plate; enrich palette, lighting, and layered details`);
          } else if (pl.color_clusters < 10) {
            warn('AD-07', `${id} (rasterPlate): color_clusters=${pl.color_clusters} < 10 — low chromatic richness; verify depth and tonal variety`);
          }
        }
        if (typeof pl.cross_set_max_sim === 'number' && Number.isFinite(pl.cross_set_max_sim)) {
          const simPeer = pl.cross_set_most_similar ? ` with '${pl.cross_set_most_similar}'` : '';
          if (pl.cross_set_max_sim > 0.985) {
            err('AD-07', `${id} (rasterPlate): cross_set_max_sim=${pl.cross_set_max_sim.toFixed(4)} > 0.985 — near-identical copy-paste backdrop${simPeer}; redraw distinct camera angle and staging`);
          } else if (pl.cross_set_max_sim > 0.965) {
            warn('AD-07', `${id} (rasterPlate): cross_set_max_sim=${pl.cross_set_max_sim.toFixed(4)} > 0.965 — very similar backdrop${simPeer}; verify camera angle and framing differentiation`);
          }
        }
      }
      if (!st.moves) warn('SE-12', `${id}: nothing in the set changes over time — add life driven by o.t (LED pulse, fan, smoke, leaves, clock; sets.md §7)`);
      if (!isBakedPlate && st.glow < TH.glow) err('SE-10', `${id}: no light source glow (url(#glowY)) — every location has a visible light source`);
      // SE-14: diegetic sign clipped on set plate camera
      if (!lineWaived(setsSrc, 'SE-14', id)) {
        const cam = d.plateCam ?? [W / 2, H / 2 + 190, 1];
        const txs = setTextsAt(id, {t: 1, ...(d.plateOpts ?? {})}, P).filter((s) => s.fontSize >= 18);
        for (const tx of txs) {
          const sb = projectBox({x0: tx.x0, y0: tx.y0, x1: tx.x1, y1: tx.y1}, cam, tx.d);
          const on = sb.x1 > 0 && sb.x0 < W && sb.y1 > 0 && sb.y0 < H;
          if (!on) continue;
          const cw = (Math.max(0, -sb.x0) + Math.max(0, sb.x1 - W)) / Math.max(1, sb.x1 - sb.x0);
          const ch = (Math.max(0, -sb.y0) + Math.max(0, sb.y1 - H)) / Math.max(1, sb.y1 - sb.y0);
          const mc = Math.max(cw, ch);
          if (mc > 0.03 && mc < 0.95) {
            if (cw > 0.12 || ch > 0.12) err('SE-14', `${id}: plateCam [${cam.join(', ')}] clips sign '${tx.text}' by ${Math.round(mc * 100)}% (> 12%) — adjust plateCam`);
            else warn('SE-14', `${id}: plateCam [${cam.join(', ')}] clips sign '${tx.text}' by ${Math.round(mc * 100)}%`);
          }
        }
      }
      // SE-19: Anti-Clone-Stamp Botanical & Prop Variety Guard
      if (!isBakedPlate && !lineWaived(setsSrc, 'SE-19', id)) {
        const L = d.render({t: 1, ...(d.plateOpts ?? {})});
        const setSvg = renderToStaticMarkup(
          React.createElement('svg', null, L.far, L.back, ...(L.mid ?? []).map((m) => React.createElement('g', {key: m.key}, m.node)), L.fg),
        );
        const maxCount = countCloneStampedPaths(setSvg);
        if (maxCount >= 9) {
          warn('SE-19', `${id}: complex organic/prop silhouette repeats ${maxCount}× verbatim without shape/scale variation — vary species, silhouette, height, and rotation instead of clone-stamping`);
        }
      }
    }
  }
  // SE-15: set count & multi-angle cinematography diversity + LA-01 design scale/sub-scene contract
  if (isLong16x9) {
    for (const id of sets) {
      const d = P.EPISODE_SETS[id];
      if (!d || d.insert || lineWaived(setsSrc, 'LA-01', id)) continue;
      if (!(Array.isArray(d.actorScale) && d.actorScale.length === 2)) {
        err('LA-01', `${id}: missing actorScale [minS, maxS] on long_16x9 set — declare valid actor scale on the main floor plane`);
      }
      if (!(typeof d.shotScale === 'string' && VALID_SHOT_SCALES.has(d.shotScale))) {
        err('LA-01', `${id}: missing or invalid shotScale '${d.shotScale ?? ''}' (must be establishing|medium|closeup|insert)`);
      }
      if (!(typeof d.location === 'string' && d.location.trim().length > 0)) {
        err('LA-01', `${id}: missing location group id (e.g. 'lab', 'yard') for drawn sub-scene grouping`);
      }
    }
    if (sets.length < 15) {
      err('SE-15', `long_16x9 episode has only ${sets.length} set(s) (minimum 15 distinct sets / angle plates required for a 10-min video)`);
    } else if (sets.length < 24) {
      warn('SE-15', `long_16x9 episode has ${sets.length} set(s) (minimum 15; studio target 24–30 drawn sets = 5–6 primary locations × 3–5 redrawn camera angles each)`);
    }
    const angles = new Set(sets.map((id) => P.EPISODE_SETS[id]?.angle).filter((a) => typeof a === 'string' && VALID_ANGLES.has(a)));
    if (angles.size < 3) {
      err('SE-15', `long_16x9 episode declares only ${angles.size} distinct set angle type(s) [${[...angles].join(', ')}] (minimum 3 of wide|low|high|ots|reverse|closeup|pov required; recommended ≥ 4)`);
    } else if (angles.size < 4) {
      warn('SE-15', `long_16x9 episode declares ${angles.size} distinct set angle type(s) [${[...angles].join(', ')}] (recommended ≥ 4 of wide|low|high|ots|reverse|closeup|pov)`);
    }
    if (sets.length >= 15) {
      const byLoc = new Map();
      const byLocCount = new Map();
      const nonInsertWithScale = [];
      for (const id of sets) {
        const d = P.EPISODE_SETS[id];
        if (!d || d.insert) continue;
        if (typeof d.location === 'string' && d.location.trim()) {
          const loc = d.location.trim();
          byLocCount.set(loc, (byLocCount.get(loc) ?? 0) + 1);
          if (typeof d.shotScale === 'string' && VALID_SHOT_SCALES.has(d.shotScale)) {
            if (!byLoc.has(loc)) byLoc.set(loc, new Set());
            byLoc.get(loc).add(d.shotScale);
          }
        }
        if (typeof d.shotScale === 'string' && VALID_SHOT_SCALES.has(d.shotScale)) {
          nonInsertWithScale.push(d);
        }
      }
      const multiScaleLocs = [...byLoc.values()].filter((s) => s.size >= 2).length;
      if (nonInsertWithScale.length > 0 && nonInsertWithScale.every((d) => d.shotScale === 'establishing')) {
        err('SE-15', `long_16x9 episode has only 'establishing' sets and 0 drawn 'medium'/'closeup' sub-scene plates — draw dedicated close-up/medium sub-scenes instead of fake camera zooms`);
      } else if (multiScaleLocs < 3) {
        warn('SE-15', `long_16x9 episode has only ${multiScaleLocs} location(s) with >= 2 drawn shotScale types (recommended >= 3 locations with establishing + medium/closeup sub-scene plates)`);
      }
      const locsWith3Plus = [...byLocCount.values()].filter((n) => n >= 3).length;
      if (locsWith3Plus < 3) {
        warn('SE-15', `long_16x9 episode has only ${locsWith3Plus} primary location(s) with >= 3 redrawn angle plates (recommended >= 3 locations with 3–5 redrawn camera angles each)`);
      }
    }
  } else if (sets.length > 0 && sets.length < 4) {
    warn('SE-15', `short episode has only ${sets.length} set(s) (recommended 4–5 sets for visual variety)`);
  }
  // SE-17: Spatial Location-Pack Continuity Guard (cameraDir, landmarks, multi-angle setup diversity)
  for (const id of sets) {
    const d = P.EPISODE_SETS[id];
    if (!d) continue;
    if (d.cameraDir !== undefined && !(typeof d.cameraDir === 'string' && VALID_CAMERA_DIRS.has(d.cameraDir))) {
      err('SE-17', `${id}: invalid cameraDir '${d.cameraDir}' (expected ${[...VALID_CAMERA_DIRS].join('|')})`);
    }
    if (d.landmarks !== undefined && (!Array.isArray(d.landmarks) || d.landmarks.some((x) => typeof x !== 'string' || !x.trim()))) {
      err('SE-17', `${id}: landmarks must be an array of non-empty spatial anchor strings`);
    }
  }
  if (isLong16x9) {
    const locGroups = new Map();
    for (const id of sets) {
      const d = P.EPISODE_SETS[id];
      if (!d || d.insert) continue;
      if (typeof d.location === 'string' && d.location.trim()) {
        const loc = d.location.trim();
        if (!locGroups.has(loc)) locGroups.set(loc, []);
        locGroups.get(loc).push({id, d});
      }
    }
    for (const [loc, locSets] of locGroups) {
      if (locSets.length < 2) continue;
      const setups = new Set(locSets.map(({d}) => `${d.angle ?? ''}|${d.shotScale ?? ''}|${d.cameraDir ?? ''}`));
      const locWaived = locSets.every(({id}) => lineWaived(setsSrc, 'SE-17', id));
      if (locSets.length >= 3 && setups.size < 2 && !locWaived) {
        err('SE-17', `location '${loc}' has ${locSets.length} sets but only ${setups.size} distinct camera setup (angle/shotScale/cameraDir) — redraw genuinely different camera angles of the space`);
      }
      if (locSets.length >= 3 && !locWaived) {
        const withLm = locSets.filter(({d}) => Array.isArray(d.landmarks) && d.landmarks.length > 0);
        if (withLm.length === 0) {
          warn('SE-17', `location '${loc}' (${locSets.length} redrawn sets) declares no shared landmarks — add landmarks: [...] on each angle plate to anchor spatial continuity`);
        } else if (withLm.length >= 2) {
          const lmCounts = new Map();
          for (const {d} of withLm) {
            const seenInPlate = new Set();
            for (const x of d.landmarks) {
              if (typeof x !== 'string') continue;
              const norm = x.trim().toLowerCase();
              if (!norm || seenInPlate.has(norm)) continue;
              seenInPlate.add(norm);
              lmCounts.set(norm, (lmCounts.get(norm) ?? 0) + 1);
            }
          }
          const sharedCount = [...lmCounts.values()].filter((c) => c >= 2).length;
          if (sharedCount === 0) {
            warn('SE-17', `location '${loc}' has ${withLm.length} plates declaring landmarks with 0 overlapping anchors — share key room landmarks across redrawn angles for spatial continuity`);
          }
        }
      }
    }
    // SE-18: Perspective-Horizon Consistency Guard (design)
    for (const id of sets) {
      const d = P.EPISODE_SETS[id];
      if (!d || d.insert) continue;
      if (d.cameraDir === 'top' && d.angle !== 'high' && !lineWaived(setsSrc, 'SE-18', id)) {
        warn('SE-18', `${id}: cameraDir 'top' should pair with angle 'high' and 3/4 elevated perspective (not a flat 90° floorplan) so horizon-rig characters sit naturally in space`);
      }
    }
    // SE-20: Set scaleMode & Stateless Plate Guard (long_16x9)
    const anySetHasScaleMode = sets.some((id) => VALID_SCALE_MODES.has(P.EPISODE_SETS[id]?.scaleMode));
    if (anySetHasScaleMode) {
      for (const id of sets) {
        const d = P.EPISODE_SETS[id];
        if (!d || d.insert || lineWaived(setsSrc, 'SE-20', id)) continue;
        if (d.scaleMode === undefined) {
          warn('SE-20', `${id}: episode uses scaleMode on other sets, but '${id}' omits scaleMode ('normal' | 'tiny') — declare scaleMode on every stage plate to prevent scale-bleed`);
        }
      }
    }
  }
  for (const id of sets) {
    const d = P.EPISODE_SETS[id];
    if (!d || lineWaived(setsSrc, 'SE-20', id)) continue;
    if (d.scaleMode !== undefined && !VALID_SCALE_MODES.has(d.scaleMode)) {
      err('SE-20', `${id}: invalid scaleMode '${d.scaleMode}' (expected 'normal' | 'tiny')`);
    }
    if (d.stateless !== undefined && typeof d.stateless !== 'boolean') {
      err('SE-20', `${id}: stateless must be a boolean`);
    }
  }
  // AD-08: 1-to-1 Sync between art_direction.json location_matrix and EPISODE_SETS (v6.2)
  if (fs.existsSync('art_direction.json')) {
    let adPlan = null;
    try {
      adPlan = JSON.parse(fs.readFileSync('art_direction.json', 'utf8'));
    } catch (e) {
      err('AD-08', `art_direction.json is not valid JSON (${e.message}) — run sv_cli.py ci art-direction`);
    }
    if (adPlan && Array.isArray(adPlan.location_matrix)) {
      for (const spec of adPlan.location_matrix) {
        if (!spec || typeof spec !== 'object' || typeof spec.id !== 'string' || !spec.id.trim()) continue;
        const sid = spec.id.trim();
        if (lineWaived(setsSrc, 'AD-08', sid)) continue;
        if (!Object.prototype.hasOwnProperty.call(P.EPISODE_SETS, sid)) {
          err('AD-08', `art_direction.json declares sub-scene '${sid}' (location='${spec.location ?? ''}', shotScale='${spec.shotScale ?? ''}') which is missing from EPISODE_SETS in src/episode/sets.tsx`);
          continue;
        }
        const d = P.EPISODE_SETS[sid];
        if (typeof spec.location === 'string' && spec.location.trim() && d.location !== spec.location.trim()) {
          err('AD-08', `${sid}: EPISODE_SETS location '${d.location ?? ''}' does not match art_direction.json '${spec.location.trim()}'`);
        }
        if (typeof spec.shotScale === 'string' && spec.shotScale.trim() && d.shotScale !== spec.shotScale.trim()) {
          err('AD-08', `${sid}: EPISODE_SETS shotScale '${d.shotScale ?? ''}' does not match art_direction.json '${spec.shotScale.trim()}'`);
        }
      }
    }
  }
  // PR-01, PR-02, PR-03 & PR-05: human-scale guard, internal text collision, disembodied head & partial-body continuity check on custom episode WORLD_PROPS
  {
    const BUILTIN_PROPS = new Set(['stool', 'cone', 'lamp', 'gladiolus', 'cat', 'chicken', 'xoi', 'lobster', 'wagyu', 'tofu']);
    const BIG_VEH = /bus|truck|van|train|ambulance|fire.?truck/i;
    const SMALL_VEH = /kart|cart|car|taxi|moto|bike/i;
    const GROUND_PROP = /bus|truck|van|train|ambulance|fire.?truck|kart|cart|car|taxi|moto|bike|table|desk|bench|crib|chair|stool|fence|stand|rack|float|podium|counter|shelf|crate|box|barrel|pot|plant/i;
    const PARTIAL_BODY_PROP = /(shoe|foot|leg|hand|arm|paw|finger)/i;
    const worldPropKeys = Object.keys(P.WORLD_PROPS ?? {});
    const worldPropSet = new Set(worldPropKeys);
    for (const k of worldPropKeys) {
      if (BUILTIN_PROPS.has(k)) continue;
      if (k.endsWith('Head') && k.length > 4 && worldPropSet.has(k.slice(0, -4)) && !propWaived('PR-03', k)) {
        err('PR-03', `${k}: disembodied head prop matching '${k.slice(0, -4)}'; use full-body multi-pose props instead`);
      }
      let b;
      try { b = measurePropBox(k, P); } catch (e) { err('PR-01', `${k}: WORLD_PROP render threw ${e.message}`); continue; }
      if (!propWaived('PR-01', k)) {
        if (BIG_VEH.test(k) && b.height < 480) {
          err('PR-01', `${k}: vehicle height ${Math.round(b.height)} px < 480 px (must tower over 435 px child & rival 575 px adult)`);
        } else if (SMALL_VEH.test(k) && b.height < 180) {
          err('PR-01', `${k}: cart/kart/car height ${Math.round(b.height)} px < 180 px`);
        }
        if (GROUND_PROP.test(k)) {
          if (b.minY > 30 || b.maxY < -100) {
            err('PR-01', `${k}: origin off floor y=0 (y=[${Math.round(b.minY)}..${Math.round(b.maxY)}])`);
          } else if (Math.abs(b.maxY) > 60) {
            err('PR-01', `${k}: bottom maxY=${Math.round(b.maxY)} px not resting near origin y=0 (|maxY| > 60)`);
          }
        }
      }
      if (!propWaived('PR-02', k)) {
        for (const tx of b.texts) {
          const y1 = tx.baselineY + tx.fontSize * 0.08;
          for (const c of b.circles) {
            if (c.order <= tx.order) continue;
            let hits = 0;
            for (let gx = 0; gx < 5; gx++) for (let gy = 0; gy < 5; gy++) {
              const px = tx.x0 + ((gx + 0.5) / 5) * (tx.x1 - tx.x0);
              const py = tx.y0 + ((gy + 0.5) / 5) * Math.max(1, y1 - tx.y0);
              if ((px - c.cx) * (px - c.cx) + (py - c.cy) * (py - c.cy) <= c.r * c.r) hits++;
            }
            if (hits >= 4) {
              err('PR-02', `${k}: opaque circle/wheel (cx=${Math.round(c.cx)}, cy=${Math.round(c.cy)}, r=${Math.round(c.r)}) painted after '${tx.text}' covers ${Math.round((hits / 25) * 100)}% of text`);
              break;
            }
          }
        }
      }
      if (!propWaived('PR-05', k) && PARTIAL_BODY_PROP.test(k) && b.height < 720) {
        warn('PR-05', `${k}: giant partial-body prop is only ${Math.round(b.height)} px tall (< 720 px) — risks floating severed mid-frame; draw leg/arm extending past frame top or stage flush with frame edge (GE-19)`);
      }
    }
    // PR-04: hand grip origin (0,0) distance & size check on custom HAND_PROPS
    const BUILTIN_HAND_PROPS = new Set(['clip', 'phone', 'book', 'money', 'env', 'trash', 'noodle', 'wrench', 'incense', 'seeds', 'paper', 'pen', 'coin', 'card', 'cup', 'bag', 'box', 'key', 'cane']);
    for (const k of Object.keys(P.HAND_PROPS ?? {})) {
      if (BUILTIN_HAND_PROPS.has(k)) continue;
      let hb;
      try { hb = measureHandPropBox(k, P); } catch (e) { err('PR-04', `${k}: HAND_PROP render threw ${e.message}`); continue; }
      if (!propWaived('PR-04', k) && (hb.gripDist > 120 || Math.max(hb.width, hb.height) > 380)) {
        err('PR-04', `${k}: hand grip origin (0,0) too far from prop or oversized (gripDist=${Math.round(hb.gripDist)} px, size=${Math.round(hb.width)}x${Math.round(hb.height)} px; max gripDist 120, max dim 380)`);
      }
    }
    // PR-06: Multi-pose Hero Subject validation (SUBJECTS registry)
    for (const [id, def] of Object.entries(P.SUBJECTS ?? {})) {
      if (lineWaived(subjectsSrc, 'PR-06', id)) continue;
      if (!def?.title) err('PR-06', `${id}: SUBJECT missing title`);
      if (!(Array.isArray(def?.relToActor) && def.relToActor.length === 2)) {
        err('PR-06', `${id}: SUBJECT missing relToActor [minR, maxR]`);
      }
      if (!(Array.isArray(def?.poses) && def.poses.length >= 4)) {
        err('PR-06', `${id}: SUBJECT has only ${def?.poses?.length ?? 0} pose(s) (minimum 4 distinct poses required)`);
      }
      if (Array.isArray(def?.poses) && def.poses.length > 0) {
        const distinctMarkups = new Set();
        const distinctBounds = new Set();
        for (const pose of def.poses) {
          try {
            const svg = renderToStaticMarkup(React.createElement('svg', null, def.render(pose, {t: 0.5})));
            const mb = measureSubjectBox(id, pose, P, {t: 0.5});
            if (svg && svg !== '<svg></svg>') distinctMarkups.add(svg);
            distinctBounds.add(`${Math.round(mb.minX)}:${Math.round(mb.minY)}:${Math.round(mb.maxX)}:${Math.round(mb.maxY)}`);
          } catch (e) {
            err('PR-06', `${id} pose '${pose}': render threw ${e.message}`);
          }
        }
        if (def.poses.length >= 4 && Math.max(distinctMarkups.size, distinctBounds.size) < 3) {
          err('PR-06', `${id}: only ${distinctMarkups.size} of ${def.poses.length} poses produce distinct SVG markup (minimum 3 distinct poses required — no copy-paste poses)`);
        }
      }
    }
    // PR-08: Living Creature Locomotion & Idle Animation Guard
    const renderMarkup = (node) => renderToStaticMarkup(React.createElement('svg', null, node));
    for (const [id, def] of Object.entries(P.SUBJECTS ?? {})) {
      if (def?.kind !== 'creature' || lineWaived(subjectsSrc, 'PR-08', id)) continue;
      const poses = Array.isArray(def.poses) ? def.poses : [];
      if (!poses.length) continue;
      let animatedCount = 0;
      for (const p of poses) {
        try {
          const altitude = p === 'fly' || p === 'hover' ? 180 : 0;
          const svgA = renderMarkup(def.render(p, {t: 0.0, expr: def.exprs?.[0], phase: 0.0, speed: 1.0, moving: true, altitude}));
          const svgB = renderMarkup(def.render(p, {t: 0.23, expr: def.exprs?.[0], phase: 0.37, speed: 1.0, moving: true, altitude}));
          if (svgA !== svgB) animatedCount++;
        } catch {}
      }
      if (poses.length > 0 && animatedCount === 0) {
        err('PR-08', `subject '${id}' (creature) is 100% frozen across time/phase (0/${poses.length} poses animate with opts.t/opts.phase) — animate breathing, tail, wings, or leg stride`);
      } else if (poses.length >= 2 && animatedCount < Math.ceil(poses.length * 0.5)) {
        warn('PR-08', `subject '${id}' (creature) animates in only ${animatedCount}/${poses.length} poses — add t/phase motion (stride, wing-beat, breathing) across active poses`);
      }
    }
  }
  // token discipline in episode code
  for (const f of ['src/episode/sets.tsx', 'src/episode/cast.ts', 'src/episode/geo.ts', 'src/episode/shotlist.ts']) {
    const lines = src(f).split('\n');
    lines.forEach((ln, i) => {
      if (/^\s*\/\//.test(ln)) return;
      const hex = ln.match(/['"`]#[0-9a-fA-F]{3,8}\b/);
      if (hex && !/token-ok/.test(ln)) err('TK-02', `${f}:${i + 1} raw colour ${hex[0].slice(1)} — use a PAL token (add one to kit.tsx if truly missing)`);
      if (/fontFamily=\{?['"]/.test(ln)) err('TK-03', `${f}:${i + 1} literal fontFamily — use <Txt> or FONT`);
    });
  }

  // CH-10: a character drawn by hand outside the <Person> rig (v3.6 hole: a "fading Bình" prop with its own head,
  // hair and face was never on a G4 sheet, so nobody compared it with the cast). A component that draws a face
  // (or calls a face helper) AND a body / skin / hair / talking expression is a character. Draw it with
  // <Person look={CAST.x}> (opacity, clipPath, pose do the effects) or add a look variant in cast.ts (variantOf).
  // When it truly cannot be a Person (an animal, a food-bodied citizen, a printed photo) waive it on its
  // declaration line: `// lint-ok: CH-10 <reason>` — G4 then requires the reviewer to name it in G4.review.md.
  {
    const walkT = (d) => fs.existsSync(d) ? fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => e.isDirectory() ? walkT(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
    // every episode .tsx (a new file is no way around it); the engine rig files and the exemplar are not episode code
    const ENGINE = /^src[\\/](chars|kit|side|back|threeq|subjects|anim|Film|Root|overlays)\.tsx$|^src[\\/](design|exemplar)[\\/]/;
    const files = walkT('src').filter((f) => /\.tsx$/.test(f) && !ENGINE.test(f));
    const DECL = /^(?:export\s+)?(?:const|let|function|type|interface|class)\s+([A-Za-z_$][\w$]*)/;
    const FACE = /\b\w*(eye|pupil|blink|iris|lash|brow|mouth|face|cheek|blush)\w*/i;
    const units = {}; const decl = {};
    for (const f of files) {
      let cur = null; const ls = fs.readFileSync(f, 'utf8').split('\n');
      ls.forEach((l, i) => {
        const m = DECL.exec(l);
        if (m) { cur = m[1]; units[cur] = l.replace(/\/\/.*$/, '') + '\n'; decl[cur] = {f, line: i + 1, text: l + '\n' + (ls[i - 1] ?? ''), type: /^(?:export\s+)?(?:type|interface)\b/.test(l)}; return; }
        if (cur) units[cur] += l.replace(/\/\/.*$/, '') + '\n';
      });
    }
    // drop comments and the <Person …> / <PersonSide …> / <PersonBack …> / <Person3Q …> elements themselves (their expr / look props are the rig, not a drawing)
    for (const k in units) units[k] = units[k].replace(/\/\*[\s\S]*?\*\//g, '').replace(/<Person(Side|Back|3Q)?\b[^>]*?\/>/gs, '<Person />');
    const direct = new Set(Object.keys(units).filter((k) => FACE.test(units[k])));
    report.rigs = [];
    for (const [k, code] of Object.entries(units)) {
      if (decl[k].type) continue; // every component AND helper (a camelCase `binhHead()` is no way around it)
      const face = direct.has(k) || [...direct].some((d) => d !== k && new RegExp(`<${d}\\b|\\b${d}\\(`).test(code));
      const body = /['"]skin\w*['"]|PAL\.skin|['"]hair\w*['"]|PAL\.hair|\bexpr\b|\btalk\b/.test(code);
      // a head drawn with raw shapes: a head-sized skin shape (not E(...) with rx < 30 — a portrait in a frame,
      // a hand) within 4 lines of a hair shape
      const ls = code.split('\n');
      const SKIN = /['"]skin\w*['"]|PAL\.skin/, HAIR = /['"]hair\w*['"]|PAL\.hair/;
      const head = ls.some((l, i) => SKIN.test(l) && !/\bE\(\s*[-\w.]+\s*,\s*[-\w.]+\s*,\s*([12]?\d(\.\d+)?)\s*,/.test(l)
        && !/\b(hand|finger|palm|arm|leg|foot|feet|ear|nose|neck|toe)\w*/i.test(l) && ls.slice(Math.max(0, i - 4), i + 5).some((m) => HAIR.test(m)));
      if (!head && !(face && body)) continue;
      const w = /lint-ok:\s*CH-10\s+(.{4,})/.exec(decl[k].text);
      if (w) report.rigs.push({name: k, file: `${decl[k].f}:${decl[k].line}`, reason: w[1].trim()});
      else err('CH-10', `${decl[k].f}:${decl[k].line} ${k} draws a character by hand (a head: skin + hair, or a face + body) outside <Person> — it is on no G4 sheet. Use <Person look={CAST.x}> (opacity / clipPath / pose for effects) or a cast.ts look variant; only an animal, food-bodied citizen or printed photo may waive: // lint-ok: CH-10 <reason>`);
    }
  }
}

// =============================== SHOTS ===============================
const strips = [];
if (phase !== 'design') {
  const segWords = {};
  for (const w of P.WORDS) (segWords[w.seg] ??= []).push(P.normWord(w.w));
  const anchors = [];
  const visitTT = (tt, where) => { if (typeof tt === 'string') anchors.push([tt, where]); };
  let rows = [];
  try { rows = P.shotTable(); } catch (e) { err('SH-01', 'shot table failed: ' + e.message); }
  // Progressive SHOTS authoring support (matches qa.mjs): when SHOTS ends at a non-final episodic
  // unit boundary U<k>, clamp the trailing shot's t1 to the next unit's segment start (- LEAD 0.06s)
  // instead of stretching across the unauthored remainder of the episode audio.
  let progressivePartialUnits = false;
  if (Array.isArray(scriptMeta?.units) && scriptMeta.units.length > 0 && rows.length > 0) {
    const normSid = (v) => {
      const m = /^(s\d+[a-z]?)/i.exec(String(v ?? '').trim());
      return m ? m[1].toLowerCase() : null;
    };
    const sIds = Array.isArray(scriptMeta?.segments)
      ? scriptMeta.segments.map((s) => normSid(s?.id)).filter(Boolean)
      : [];
    const sMap = new Map(sIds.map((sid, idx) => [sid, idx]));
    const inRange = (sid, a, b) =>
      sid && a && b && sMap.has(sid) && sMap.has(a) && sMap.has(b) &&
      sMap.get(sid) >= sMap.get(a) && sMap.get(sid) <= sMap.get(b);
    const lastR = rows[rows.length - 1];
    const lastSeg = normSid(lastR?.seg) ?? normSid(P.SHOTS?.[lastR?.i]?.at) ?? normSid(lastR?.at);
    const uIdx = scriptMeta.units.findIndex((u) => u && inRange(lastSeg, normSid(u.seg_start), normSid(u.seg_end)));
    if (uIdx >= 0 && uIdx < scriptMeta.units.length - 1) {
      progressivePartialUnits = true;
      const nextSeg = normSid(scriptMeta.units[uIdx + 1]?.seg_start);
      const nextStart = nextSeg ? P.C?.seg_starts?.[nextSeg] : undefined;
      if (typeof nextStart === 'number' && Number.isFinite(nextStart)) {
        const clampedT1 = +(nextStart - 0.06).toFixed(3);
        if (clampedT1 > lastR.t0 + 0.2 && lastR.t1 > clampedT1 + 0.5) {
          lastR.t1 = clampedT1;
        }
      }
    }
  }
  const shots = P.SHOTS;
  if (!shots.length) err('SH-02', 'SHOTS is empty');
  if (shots[0] && shots[0].at !== 's1') err('SH-03', `first shot must start at 's1' (got ${shots[0].at})`);
  const usedLooks = new Set(), usedSets = new Set();
  shots.forEach((s, i) => {
    const tag = `#${i} '${s.name}'`;
    anchors.push([s.at, tag + '.at']);
    if (/^DEMO/.test(s.name)) err('SH-04', `${tag}: demo shot still in the shotlist`);
    if (!P.SETS[s.set]) err('SH-05', `${tag}: unknown set ${s.set}`);
    if (s.set.startsWith('ex-')) err('SH-06', `${tag}: exemplar set ${s.set} used in an episode shot`);
    if (s.mood !== undefined && !VALID_MOODS.has(s.mood)) {
      err('SH-19', `${tag}: unknown mood '${s.mood}' (expected ${[...VALID_MOODS].join('|')})`);
    }
    if (s.tr !== undefined && !VALID_TRS.has(s.tr)) {
      err('SH-13', `${tag}: unknown transition '${s.tr}' (expected ${[...VALID_TRS].join('|')})`);
    }
    if (s.mood === 'danger' && s.night && s.night > 0.7 && !waived('SH-19', s.name)) {
      warn('SH-19', `${tag}: mood 'danger' combined with night=${s.night} (> 0.7) stacks double dark overlays and may crush visibility — lower night <= 0.7 or use mood 'dramatic'`);
    }
    usedSets.add(s.set);
    for (const [k, tr] of Object.entries(s.keys ?? {})) tr.forEach(([, tt]) => visitTT(tt, `${tag}.keys.${k}`));
    if (Array.isArray(s.camKeys)) {
      for (const ck of s.camKeys) {
        if (Array.isArray(ck)) visitTT(ck[3], `${tag}.camKeys`);
      }
    }
    for (const o of s.over ?? []) {
      visitTT(o.at, tag + '.over'); visitTT(o.until, tag + '.over');
      if (!OVER.has(o.k)) err('OV-01', `${tag}: overlay kind ${o.k}`);
      if (o.k === 'bubble' && (o.text ?? '').length > 28) err('OV-02', `${tag}: bubble text > 28 chars: "${o.text}"`);
      if (!o.world && o.y > CAPTION[0] - 90 && o.y < CAPTION[1] + 50) err('OV-03', `${tag}: overlay at y=${o.y} sits in the caption band (${CAPTION[0] - 90}–${CAPTION[1] + 50})`);
    }
    for (const a of s.actors ?? []) {
      const at = `${tag} actor ${a.id}`;
      usedLooks.add(a.look);
      if (a.look.startsWith('ex_')) err('SH-07', `${at}: exemplar look ${a.look}`);
      else if (!P.CAST[a.look]) err('SH-08', `${at}: look ${a.look} not in CAST`);
      if (a.prop && !P.HAND_PROPS[a.prop] && !P.SIDE_PROPS[a.prop]) err('SH-09', `${at}: prop ${a.prop} not registered`);
      const poses = Array.isArray(a.p) ? a.p.map((x) => x[0]) : a.p ? [a.p] : [];
      for (const p of poses) if (!P.POSES[p]) err('SH-10', `${at}: pose ${p} not in POSES`);
      const exprs = Array.isArray(a.e) ? a.e.map((x) => x[0]) : a.e ? [a.e] : [];
      for (const e of exprs) if (!EXPRS.has(e)) err('SH-11', `${at}: expression ${e}`);
      const arms = Array.isArray(a.arms) ? a.arms.map((x) => x[0]) : a.arms ? [a.arms] : [];
      for (const x of arms) if (!SIDE_ARMS.has(x)) err('SH-12', `${at}: side arms '${x}' unknown`);
      for (const k of ['p', 'e', 'view', 'face', 'legs', 'arms']) if (Array.isArray(a[k])) a[k].forEach(([, tt]) => visitTT(tt, `${at}.${k}`));
      for (const [x, y] of a.talk ?? []) { visitTT(x, at + '.talk'); visitTT(y, at + '.talk'); }
      for (const r of a.reach ?? []) visitTT(r.at, at + '.reach');
      for (const lp of a.leap ?? []) visitTT(lp.at, at + '.leap');
      for (const pp of a.pop ?? []) visitTT(pp.at, at + '.pop');
      for (const w of a.path ?? []) visitTT(w[2], at + '.path');
      visitTT(a.enter, at + '.enter'); visitTT(a.exit, at + '.exit');
      if (a.ride && !(s.actors ?? []).some((c) => c.id === a.ride)) err('MO-07', `${at}: rides '${a.ride}' who is not in the shot`);
    }
    for (const ex of s.extras ?? []) {
      const et = `${tag} extra ${ex.k}`;
      const sDef = P.SUBJECTS?.[ex.k];
      if (sDef && Array.isArray(sDef.poses) && sDef.poses.length > 0 && ex.pose !== undefined) {
        const sPoses = Array.isArray(ex.pose) ? ex.pose.map((x) => x[0]) : [ex.pose];
        for (const pv of sPoses) {
          if (!sDef.poses.includes(pv)) err('SH-10', `${et}: subject pose '${pv}' not in SUBJECTS.${ex.k}.poses [${sDef.poses.join(', ')}]`);
        }
      }
      if (sDef && Array.isArray(sDef.exprs) && sDef.exprs.length > 0 && ex.expr !== undefined) {
        const sExprs = Array.isArray(ex.expr) ? ex.expr.map((x) => x[0]) : [ex.expr];
        for (const ev of sExprs) {
          if (!sDef.exprs.includes(ev)) err('SH-11', `${et}: subject expr '${ev}' not in SUBJECTS.${ex.k}.exprs [${sDef.exprs.join(', ')}]`);
        }
      }
      if (Array.isArray(ex.pose)) ex.pose.forEach(([, tt]) => visitTT(tt, `${et}.pose`));
      if (Array.isArray(ex.expr)) ex.expr.forEach(([, tt]) => visitTT(tt, `${et}.expr`));
      for (const w of ex.path ?? []) visitTT(w[2], `${et}.path`);
    }
  });
  // anchors: resolvable + unambiguous
  for (const [spec, where] of anchors) {
    try { P.tAt(spec); } catch (e) { err('AN-01', `${where}: ${e.message}`); continue; }
    const m = /^(s\d+[a-z]?)@([^#+\-]+)(#\d+)?/.exec(spec);
    if (m && !m[3]) {
      const n = (segWords[m[1]] ?? []).filter((w) => w === P.normWord(m[2])).length;
      if (n > 1) err('AN-02', `${where}: '${spec}' — "${m[2]}" occurs ${n}× in ${m[1]}; write #1 or #${n} explicitly`);
    }
  }
  // per resolved shot
  const hot = {};
  const markHot = (i, rule) => { (hot[i] ??= []).push(rule); };
  const keyVals = (v) => (Array.isArray(v) ? v.map((x) => String(x[0])) : v !== undefined && v !== null ? [String(v)] : []);
  const countChoreoEvents = (s, r) => {
    let n = 0;
    const camKeys = Array.isArray(r.camKeys) ? r.camKeys : (Array.isArray(s.camKeys) ? s.camKeys : null);
    if (camKeys && camKeys.length >= 3) {
      n += 2;
    } else if (camKeys && camKeys.length === 2) {
      n += 1;
    } else if (r.cam2 && (Math.hypot((r.cam2[0] ?? 0) - (r.cam[0] ?? 0), (r.cam2[1] ?? 0) - (r.cam[1] ?? 0)) > 10 || Math.abs((r.cam2[2] ?? 1) - (r.cam[2] ?? 1)) > 0.03)) {
      n += 1;
    }
    n += Object.keys(s.keys ?? {}).length;
    if (s.of || s.punch) n += 1;
    for (const A of s.actors ?? []) {
      if (A.path && A.path.length >= 3) n += 2;
      else if (A.path && A.path.length === 2) n += 1;
      if (A.arcH) n += 1;
      if (A.mount) n += 1;
      if (A.pushTarget) n += 1;
      if (A.ride) n += 1;
      if (Array.isArray(A.reach) && A.reach.length) n += A.reach.length;
      if (Array.isArray(A.leap) && A.leap.length) n += A.leap.length;
      if (Array.isArray(A.pop) && A.pop.length) n += A.pop.length;
      for (const k of ['p', 'e', 'view', 'face', 'legs', 'arms']) {
        if (Array.isArray(A[k]) && A[k].length >= 2) n += 1;
      }
      if ((Array.isArray(A.fx) && A.fx.length > 0) || A.wind || A.hop || A.shake) n += 1;
    }
    for (const E of s.extras ?? []) {
      if (E.path && E.path.length > 1) n += 1;
      if (Array.isArray(E.pose) && E.pose.length >= 2) n += 1;
      if (Array.isArray(E.expr) && E.expr.length >= 2) n += 1;
    }
    return n;
  };
  const choreoByShot = new Map();
  rows.forEach((r, i) => {
    const s = shots[i];
    const tag = `#${i} '${r.name}'`;
    const dur = r.t1 - r.t0;
    const choreoEvents = countChoreoEvents(s, r);
    choreoByShot.set(r.i, choreoEvents);
    // animated set state (door opening, counters, lights): the change itself must be seen on a strip
    for (const [k, tr] of Object.entries(s.keys ?? {})) tr.slice(1).forEach(([v, tt, d], j) => {
      const T = typeof tt === 'number' ? r.t0 + tt : P.tAt(tt);
      const D = typeof v === 'number' ? (d ?? 0.6) : 0;
      if (T > r.t1 - 0.1) err('KY-01', `${tag}: key ${k} fires at ${T.toFixed(2)} s, after the shot ends (${r.t1.toFixed(2)} s) — it will never be seen`);
      else strips.push({name: `s${String(i).padStart(2, '0')}_key_${k}${j ? j + 1 : ''}`, t0: +Math.max(r.t0, T - 0.3).toFixed(2), t1: +Math.min(r.t1, T + D + 0.4).toFixed(2), n: 6, why: `set key ${k}`});
    });
    if (i > 0 && r.t0 <= rows[i - 1].t0) err('SH-13', `${tag}: starts before/with the previous shot (anchor order)`);
    if (dur < 0.45 && !waived('SH-14', r.name)) err('SH-14', `${tag}: ${dur.toFixed(2)} s is a flash cut (< 0.45 s)`);
    else if (dur < 0.7) warn('SH-14', `${tag}: ${dur.toFixed(2)} s is very short`);
    const holdWarnS = isLong16x9 ? 8.0 : 6.5;
    if (dur > holdWarnS && !waived('SH-15', r.name)) warn('SH-15', `${tag}: ${dur.toFixed(1)} s — long hold; is something moving/changing?`);
    const k0 = r.cam[2], k1 = r.cam2 ? r.cam2[2] : k0;
    const resolvedCamKeys = Array.isArray(r.camKeys)
      ? r.camKeys
      : (Array.isArray(s.camKeys)
        ? s.camKeys
            .filter((ck) => Array.isArray(ck) && ck.length >= 4 && typeof ck[0] === 'number' && typeof ck[1] === 'number' && typeof ck[2] === 'number')
            .map((ck) => {
              try {
                const tAbs = typeof ck[3] === 'number' ? r.t0 + ck[3] : P.tAt(ck[3]);
                return [ck[0], ck[1], ck[2], tAbs];
              } catch {
                return [ck[0], ck[1], ck[2], NaN];
              }
            })
        : []);
    const validCamKeys = resolvedCamKeys.filter((ck) => Array.isArray(ck) && Number.isFinite(ck[0]) && Number.isFinite(ck[1]) && Number.isFinite(ck[2]));
    const allCams = [r.cam, ...(r.cam2 ? [r.cam2] : []), ...validCamKeys.map((ck) => [ck[0], ck[1], ck[2]])];
    const allZooms = allCams.map((c) => c[2]).filter((z) => Number.isFinite(z));
    const minK = Math.min(...allZooms), maxK = Math.max(...allZooms);
    if (minK < 0.5 || maxK > 4) err('CA-01', `${tag}: zoom ${minK}->${maxK} outside 0.5–4`);
    if (r.cam2 && dur < 1.0 && (Math.abs(r.cam2[0] - r.cam[0]) > 40 || Math.abs(k1 - k0) > 0.1)) warn('CA-02', `${tag}: camera move in a ${dur.toFixed(2)} s shot reads as a jolt`);
    const B = P.SETS[r.set]?.bounds;
    if (B) for (const [cx, cy, k] of allCams) {
      if (!(k > 0)) continue;
      const [x0, y0, x1, y1] = [cx - (W / 2) / k, cy - (H / 2) / k, cx + (W / 2) / k, cy + (H / 2) / k];
      if (x0 < B[0] - 1 || y0 < B[1] - 1 || x1 > B[2] + 1 || y1 > B[3] + 1)
        err('CA-05', `${tag}: camera [${cx}, ${cy}, ${k}] sees [${Math.round(x0)}, ${Math.round(y0)}, ${Math.round(x1)}, ${Math.round(y1)}] — outside the painted set bounds [${B.join(', ')}] (empty void on screen)`);
    }
    if (Math.max(k0, k1) / Math.min(k0, k1) > 2.2) warn('CA-03', `${tag}: zoom ratio ${(Math.max(k0, k1) / Math.min(k0, k1)).toFixed(1)}× inside one shot`);
    // CA-08: Multi-Waypoint Camera Choreography Guard
    if (s.camKeys !== undefined) {
      let camKeysShapeOk = Array.isArray(s.camKeys) && s.camKeys.length >= 2;
      if (!camKeysShapeOk) {
        err('CA-08', `${tag}: camKeys must be an array with >= 2 waypoints of [cx, cy, k, tt]`);
      } else {
        for (let j = 0; j < s.camKeys.length; j++) {
          const ck = s.camKeys[j];
          const ok = Array.isArray(ck) && ck.length >= 4
            && typeof ck[0] === 'number' && Number.isFinite(ck[0])
            && typeof ck[1] === 'number' && Number.isFinite(ck[1])
            && typeof ck[2] === 'number' && Number.isFinite(ck[2])
            && (typeof ck[3] === 'number' ? Number.isFinite(ck[3]) : typeof ck[3] === 'string' && ck[3].length > 0);
          if (!ok) {
            camKeysShapeOk = false;
            err('CA-08', `${tag}: camKeys[${j}] must be [cx, cy, k, tt] with finite numeric cx, cy, k and valid timestamp tt`);
          }
        }
      }
      if (camKeysShapeOk && resolvedCamKeys.length >= 2) {
        for (let j = 0; j < resolvedCamKeys.length; j++) {
          const [, , kj, tj] = resolvedCamKeys[j];
          if (!Number.isFinite(tj)) continue;
          if (tj < r.t0 - 0.15 || tj > r.t1 + 0.15) {
            warn('CA-08', `${tag}: camKeys[${j}] timestamp ${tj.toFixed(2)} s falls outside shot window [${r.t0.toFixed(2)}..${r.t1.toFixed(2)}] s`);
          }
          if (j > 0) {
            const [, , kPrev, tPrev] = resolvedCamKeys[j - 1];
            if (!Number.isFinite(tPrev)) continue;
            if (tj <= tPrev) {
              err('CA-08', `${tag}: camKeys[${j}] timestamp ${tj.toFixed(2)} s must be strictly greater than camKeys[${j - 1}] (${tPrev.toFixed(2)} s)`);
            } else if (kPrev > 0 && kj > 0) {
              const zoomRatio = Math.max(kj, kPrev) / Math.min(kj, kPrev);
              const dt = tj - tPrev;
              if (zoomRatio > 1.9 && dt < 0.5 && !waived('CA-08', r.name)) {
                warn('CA-08', `${tag}: camKeys[${j - 1}->${j}] whip-zoom ${kPrev.toFixed(2)}->${kj.toFixed(2)} (${zoomRatio.toFixed(2)}× in ${dt.toFixed(2)} s < 0.50 s) — lengthen transition or cut instead`);
              }
            }
          }
        }
      }
    }
    // LA-03: ban fake close-up via camera zoom on establishing/wide sets
    const setDef = P.SETS[r.set];
    if ((setDef?.shotScale === 'establishing' || setDef?.angle === 'wide') && !setDef?.insert) {
      if ((allCams[0][2] > 1.35 || allCams.slice(1).some((c) => c[2] > 1.45)) && !waived('LA-03', r.name)) {
        err('LA-03', `${tag}: fake close-up via camera zoom (${maxK.toFixed(2)}×) on establishing/wide set '${r.set}' — draw a dedicated 'medium' or 'closeup' sub-scene plate instead`);
      }
    }
    // SH-22: Scale-Mode Continuity & Set Bleed Error
    const rSeg = shotSegOf(r, s);
    const shotSegNum = segNum(rSeg);
    {
      const segMode = (rSeg && segScaleMode.get(rSeg)) ?? (Number.isFinite(shotSegNum) ? segScaleMode.get(`s${shotSegNum}`) : undefined);
      const plateScaleMode = setDef?.scaleMode;
      if (segMode && plateScaleMode && !setDef?.insert && !waived('SH-22', r.name)) {
        if (segMode === 'normal' && plateScaleMode === 'tiny') {
          err('SH-22', `${tag} (${rSeg}): pre/post-shrink normal-scale segment staged on miniature tiny set '${r.set}'!`);
          markHot(r.i, 'SH-22');
        } else if (segMode === 'tiny' && plateScaleMode === 'normal') {
          const shrunkenKids = (s.actors ?? []).filter((A) =>
            Array.isArray(scriptMeta?.tiny_cast) ? scriptMeta.tiny_cast.includes(A.look) : isKidOrShrunkenActor(A),
          );
          if (shrunkenKids.length > 0) {
            err('SH-22', `${tag} (${rSeg}): shrunken tiny-scale segment staged on normal-scale set '${r.set}' (${shrunkenKids.map((x) => x.id).join(', ')})!`);
            markHot(r.i, 'SH-22');
          }
        }
      }
    }
    // SH-23: Temporal Story-Order & Stateful Pose Bleed Error
    if (Number.isFinite(shotSegNum) && !waived('SH-23', r.name)) {
      for (const ex of s.extras ?? []) {
        const def = (P.SUBJECTS ?? {})[ex.k];
        if (!def || lineWaived(subjectsSrc, 'SH-23', ex.k)) continue;
        if (typeof def.firstSeg === 'string') {
          const minSeg = segNum(def.firstSeg);
          if (Number.isFinite(minSeg) && shotSegNum < minSeg) {
            err('SH-23', `${tag}: premature subject bleed: '${ex.k}' appears at ${rSeg} before firstSeg ${def.firstSeg}!`);
            markHot(r.i, 'SH-23');
          }
        }
        if (Array.isArray(def.appearSegs) && def.appearSegs.length > 0 && !inSegWindows(shotSegNum, def.appearSegs)) {
          err('SH-23', `${tag}: out-of-scene subject bleed: '${ex.k}' at ${rSeg} outside allowed story windows!`);
          markHot(r.i, 'SH-23');
        }
        if (def.poseSegs && typeof def.poseSegs === 'object') {
          const exPoses = ex.pose !== undefined ? [...new Set(keyVals(ex.pose))] : [def.poses?.[0] ?? 'idle'];
          for (const pose of exPoses) {
            const pWins = def.poseSegs[pose];
            if (Array.isArray(pWins) && pWins.length > 0 && !inSegWindows(shotSegNum, pWins)) {
              err('SH-23', `${tag}: stateful pose bleed: '${ex.k}' uses pose '${pose}' at ${rSeg} outside allowed window (e.g. sticky tape already removed)!`);
              markHot(r.i, 'SH-23');
            }
          }
        }
      }
    }
    // PR-09: Anti-Statue Living Creature Motion Guard
    if (dur > 2.2 && !waived('PR-09', r.name)) {
      for (const ex of s.extras ?? []) {
        const def = (P.SUBJECTS ?? {})[ex.k];
        if (def?.kind !== 'creature' || lineWaived(subjectsSrc, 'PR-09', ex.k)) continue;
        const hasExPath = Array.isArray(ex.path) && ex.path.length >= 2 && ex.path.some((w, wi) =>
          wi > 0 && Math.hypot((w[0] ?? 0) - (ex.path[wi - 1][0] ?? 0), (w[1] ?? 0) - (ex.path[wi - 1][1] ?? 0)) > 1,
        );
        const poseKeys = Array.isArray(ex.pose) ? ex.pose : [];
        const exprKeys = Array.isArray(ex.expr) ? ex.expr : [];
        const hasPoseBeats = poseKeys.length >= 2 && new Set(poseKeys.map((x) => String(Array.isArray(x) ? x[0] : x))).size >= 2;
        const hasExprBeats = exprKeys.length >= 2 && new Set(exprKeys.map((x) => String(Array.isArray(x) ? x[0] : x))).size >= 2;
        if (!hasExPath && !hasPoseBeats && !hasExprBeats) {
          const msg = `${tag}: frozen statue creature '${ex.k}' stands in 1 static pose at 1 spot for ${dur.toFixed(1)}s ("đứng như trời trồng") — add path locomotion or >= 2 dynamic pose/action beats!`;
          if (isLegacyV4Showcase) {
            warn('PR-09', msg);
          } else {
            err('PR-09', msg);
            markHot(r.i, 'PR-09');
          }
        }
      }
    }
    // SE-18: Perspective-Horizon Consistency Guard (shots)
    if (setDef?.cameraDir === 'top' && !waived('SE-18', r.name)) {
      const hasHorizonRig = (s.actors ?? []).some((A) => {
        if (A.mount) return false;
        const defV = (A.path && A.path.length > 1) || A.ride ? 'side' : 'front';
        const vs = Array.isArray(A.view) && A.view.length > 0 ? A.view.map(([vv]) => vv) : [A.view ?? defV];
        return vs.some((v) => v === 'side' || v === 'front');
      });
      if (hasHorizonRig) {
        warn('SE-18', `${tag}: horizon-rig actor on cameraDir:'top' set '${r.set}' risks board-game perspective mismatch — draw 3/4 elevated 'high' perspective (cameraDir:'front'|'left'|'right') or use view:'3q'/'back'`);
        markHot(r.i, 'SE-18');
      }
    }
    // first appearance of a set: establish it (unless it's a closeup/POV sub-scene of an already-established location pack)
    const setLoc = typeof setDef?.location === 'string' ? setDef.location.trim() : '';
    const locAlreadyEstablished = !!setLoc && rows.slice(0, i).some((q) => (P.SETS[q.set]?.location ?? '').trim() === setLoc);
    const isDetailSubPlate = setDef?.shotScale === 'closeup' || setDef?.angle === 'closeup' || setDef?.angle === 'pov' || setDef?.cameraDir === 'detail';
    if (!setDef?.insert && r.set !== 'solid' && !(isDetailSubPlate && locAlreadyEstablished) && !rows.slice(0, i).some((q) => q.set === r.set) && Math.min(k0, k1) > 1.2 && !waived('CA-04', r.name))
      err('CA-04', `${tag}: first shot in '${r.set}' is not an establishing frame (zoom ${Math.min(k0, k1)} > 1.2)`);
    // something must change in every shot (actor motion, camera move, set state, talk, expression, overlay)
    const lives = r.cam2 || (Array.isArray(s.camKeys) && s.camKeys.length >= 2) || (s.keys && Object.keys(s.keys).length) || (s.over ?? []).length || s.of || s.punch ||
      (s.actors ?? []).some((A) => A.path || A.reach || (A.leap && A.leap.length) || (A.pop && A.pop.length) || A.talk || A.hop || A.shake || A.pant || A.ride || A.arcH || A.mount || A.pushTarget || (A.fx && A.fx.length) || A.wind || ['p', 'e', 'legs', 'arms', 'view'].some((k) => Array.isArray(A[k]))) ||
      (s.extras ?? []).some((E) => (E.path && E.path.length > 1) || Array.isArray(E.pose) || Array.isArray(E.expr));
    if (!lives && !waived('MO-08', r.name)) warn('MO-08', `${tag}: nothing moves or changes for ${dur.toFixed(1)} s — add a camera drift, an expression key or a gesture`);
    // MO-16: Long-Shot Choreography Density Guard (long_16x9 rich multi-beat shots > 5.0 s)
    if (isLong16x9 && dur > 5.0 && !waived('MO-16', r.name)) {
      if (choreoEvents < 1) {
        err('MO-16', `${tag}: ${dur.toFixed(1)} s long-form shot has 0 choreography events — dead static hold; add camera move + actor path/keyed acting/view/mount/keys`);
      } else if (choreoEvents < 2) {
        warn('MO-16', `${tag}: ${dur.toFixed(1)} s long-form shot has only ${choreoEvents} choreography event (target >= 2 for shots > 5.0 s — combine camera motion with keyed poses/expr/view/path/mount)`);
      } else if (dur > 8.5 && choreoEvents < 3) {
        warn('MO-16', `${tag}: ${dur.toFixed(1)} s extended long-form shot has only ${choreoEvents} choreography events (target >= 3 for shots > 8.5 s)`);
      }
    }
    // overlays visible at once
    const ovs = (s.over ?? []).map((o, j) => ({a: r.over[j].t, b: o.until ? P.tAt(o.until) : r.t1}));
    for (const o of ovs) { const n = ovs.filter((q) => q.a <= o.a + 0.01 && q.b > o.a + 0.01).length; if (n > 2) { err('OV-04', `${tag}: ${n} overlays on screen at once (max 2)`); break; } }
    for (const a of r.actors) {
      const A = s.actors.find((q) => q.id === a.id);
      const look = P.CAST[a.look] ?? P.EX_LOOKS[a.look];
      if (!look) continue;
      const H = look.h ?? 1;
      // readable face when talking: standing height on screen >= 25 % of frame (480 px on 1920p 9:16; 270 px on 1080p 16:9)
      if (a.talks) {
        const px = 610 * H * a.s * Math.min(k0, k1);
        const minTalkPx = isLong16x9 ? 270 : 480;
        const role = P.CAST_ROLES[a.look]?.role;
        if (px < minTalkPx && !waived('SZ-01', r.name)) (role === 'principal' ? err : warn)('SZ-01', `${tag}: ${a.id} talks at ${Math.round(px)} px tall (< ${minTalkPx} = 25 % of frame) — push in or scale up`);
      }
      // walking: must be side view while moving; speed sane
      if (A.path && A.path.length > 1) {
        const P0 = a.path;
        let lastDxDir = 0, warnedRaise = false;
        for (let q = 1; q < P0.length; q++) {
          const [x0, y0, t0] = P0[q - 1], [x1, y1, t1] = P0[q];
          const d = Math.hypot(x1 - x0, y1 - y0), dt = t1 - t0;
          if (dt <= 0) { err('MO-01', `${tag}: ${a.id} path waypoint ${q} arrives before the previous one`); continue; }
          const dx = x1 - x0;
          if (A.face !== undefined && P0.length >= 3 && Math.abs(dx) > 2) {
            const sd = Math.sign(dx);
            if (lastDxDir !== 0 && sd !== lastDxDir && !waived('MO-10', r.name)) {
              err('MO-10', `${tag}: ${a.id} has locked face=${JSON.stringify(A.face)} and path reverses horizontal direction (${lastDxDir > 0 ? '+' : '-'} -> ${sd > 0 ? '+' : '-'} at waypoint ${q}) — Film.tsx triggers horizontal turnaround squash (sx = 0.12); keep path dx monotonic or 0`);
            }
            lastDxDir = sd;
          }
          const v = d / dt / a.s;
          if (d > 30 && v > 560) warn('MO-02', `${tag}: ${a.id} moves ${Math.round(v)} px/s (scaled) — that is running; nominal walk is 230`);
          if (d > 30 && v < 60) warn('MO-03', `${tag}: ${a.id} creeps ${Math.round(v)} px/s — hold still instead or shorten the time`);
          const views = Array.isArray(A.view) ? A.view : A.view ? [[A.view, 0]] : [];
          const frontWhile = views.some(([vv, tt]) => vv === 'front' && (typeof tt === 'number' ? r.t0 + tt : P.tAt(tt)) < t1 - 0.25 && (typeof tt === 'number' ? r.t0 + tt : P.tAt(tt)) >= t0 && d > 30);
          if ((A.view === 'front') || frontWhile) err('MO-04', `${tag}: ${a.id} travels ${Math.round(d)} px in front view — walking is always profile (side)`);
          if (d > 30 && !warnedRaise) {
            const segMid = (t0 + t1) / 2;
            const segView = scalarKeyAt(A.view, 'front', r, P, segMid);
            const segArms = scalarKeyAt(A.arms, 'swing', r, P, segMid);
            if (segView === 'side' && segArms === 'raise' && !waived('MO-11', r.name)) {
              warnedRaise = true;
              warn('MO-11', `${tag}: ${a.id} walks in side view with arms='raise' — arm crosses face/helmet; use 'swing' or 'hold'`);
            }
          }
        }
        const a0 = Math.max(r.t0, P0[0][2] - 0.2), a1 = Math.min(r.t1, P0[P0.length - 1][2] + 0.4);
        if (a1 - a0 > 0.3) strips.push({name: `s${String(i).padStart(2, '0')}_${a.id}_walk`, t0: +a0.toFixed(2), t1: +a1.toFixed(2), n: 10, why: 'walk'});
      }
      // reach: target must be within arm range of where the actor stands at that moment
      for (const rc of A.reach ?? []) {
        const t = typeof rc.at === 'number' ? r.t0 + rc.at : P.tAt(rc.at);
        const st = actorStateAt(a, A, t, r, P);
        const x = st.x, y = st.y;
        if (a.path) {
          const arrive = a.path[a.path.length - 1][2];
          if (t > a.path[0][2] && t < arrive + 0.3) err('MO-06', `${tag}: ${a.id} reaches at ${t.toFixed(2)} s while still walking (arrives ${arrive.toFixed(2)} s) — arrive ≥ 0.3 s before the reach: settle, then reach`);
        }
        if (st.view === 'side' && (rc.x - x) * st.dir < -15 && !waived('MO-11', r.name)) {
          warn('MO-11', `${tag}: ${a.id} reaches to x=${Math.round(rc.x)} behind facing dir=${st.dir > 0 ? '+1' : '-1'} (actor x=${Math.round(x)}) — arm slices across own face`);
        }
        const sh = [x, y - 410 * H * a.s];
        const dist = Math.hypot(rc.x - sh[0], rc.y - sh[1]);
        const reachMax = 225 * H * a.s * 1.05;
        if (dist > reachMax) err('MO-05', `${tag}: ${a.id} reach at ${t.toFixed(2)} s is ${Math.round(dist)} px from the shoulder (max ${Math.round(reachMax)}) — walk closer first`);
        // MO-09: the arm needs room to extend, and the actor must stand at the fixture's depth
        if (Math.abs(rc.x - x) < 100 * a.s) warn('MO-09', `${tag}: ${a.id} stands ${Math.round(Math.abs(rc.x - x))} px beside the target — the arm cannot extend and the reach reads as touching the face; stand 120–180 px away`);
        if (rc.fy === undefined) warn('MO-09', `${tag}: ${a.id} reach has no fy (floor line under the target) — export it with the touch point in geo.ts so depth can be checked`);
        else if (Math.abs(y - rc.fy) > 200 * a.s) err('MO-09', `${tag}: ${a.id} stands at y ${Math.round(y)} but the target's floor line is ${rc.fy} — in front of/behind the fixture, the hand touches air. Stand at y ≈ fy + 0…120`);
        else if (Math.abs(y - rc.fy) > 160 * a.s) warn('MO-09', `${tag}: ${a.id} stands ${Math.round(Math.abs(y - rc.fy))} px off the target's floor line — check the reach strip: does the hand meet the fixture?`);
        // SZ-02: the acting body must be inside the frame at the moment of the reach
        { const u = Math.max(0, Math.min(1, (t - r.t0) / dur)); const c0 = r.cam, c1 = r.cam2 ?? r.cam; const cx = c0[0] + (c1[0] - c0[0]) * u, k = c0[2] + (c1[2] - c0[2]) * u;
          if (Math.abs(x - cx) > (W / 2) / k - 110 * a.s) warn('SZ-02', `${tag}: ${a.id} is cut by the frame edge while reaching (x ${Math.round(x)}, frame ${Math.round(cx - (W / 2) / k)}…${Math.round(cx + (W / 2) / k)})`); }
        strips.push({name: `s${String(i).padStart(2, '0')}_${a.id}_reach`, t0: +Math.max(r.t0, t - 0.7).toFixed(2), t1: +Math.min(r.t1, t + (rc.hold ?? 0.4) + 0.5).toFixed(2), n: 8, why: 'reach'});
      }
      if (A.legs && Array.isArray(A.legs) && A.legs.length > 1) {
        const tt = A.legs.slice(1).map(([, x]) => (typeof x === 'number' ? r.t0 + x : P.tAt(x)));
        for (const t of tt) strips.push({name: `s${String(i).padStart(2, '0')}_${a.id}_legs`, t0: +Math.max(r.t0, t - 0.5).toFixed(2), t1: +Math.min(r.t1, t + 0.9).toFixed(2), n: 8, why: 'sit/stand'});
      }
      if (A.ride) strips.push({name: `s${String(i).padStart(2, '0')}_${a.id}_ride`, t0: r.t0, t1: +Math.min(r.t1, r.t0 + 2.5).toFixed(2), n: 8, why: 'piggyback'});
      if (Array.isArray(A.leap) && A.leap.length > 0) {
        if (A.leap.length > 2 && !waived('MO-17', r.name)) {
          warn('MO-17', `${tag}: actor '${a.id}' has ${A.leap.length} leaps in one ${dur.toFixed(1)}s shot (max 2 recommended) — avoid bouncy slapstick spam`);
          markHot(r.i, 'MO-17');
        }
        const resolvedLeaps = [];
        for (const [li, lp] of A.leap.entries()) {
          let lt = NaN;
          try { lt = typeof lp.at === 'number' ? r.t0 + lp.at : P.tAt(lp.at); } catch {}
          if (!Number.isFinite(lt)) continue;
          const lh = lp.h ?? 70;
          const ldur = lp.dur ?? 0.9;
          if (lt < r.t0 - 0.05 || lt > r.t1 - 0.1) {
            err('KY-01', `${tag}: actor '${a.id}' leap[${li}] fires at ${lt.toFixed(2)}s outside shot window [${r.t0.toFixed(2)}..${r.t1.toFixed(2)}]s`);
          }
          if (!(lh >= 12 && lh <= 220) || !(ldur >= 0.25 && ldur <= 1.8)) {
            err('MO-17', `${tag}: actor '${a.id}' leap[${li}] has out-of-bounds physics (h=${lh}, dur=${ldur}; expected h in 12..220 px, dur in 0.25..1.8 s)`);
          }
          const curExpr = scalarKeyAt(A.e, 'neutral', r, P, lt + 0.1);
          if ((curExpr === 'sad' || curExpr === 'cry' || curExpr === 'deadpan') && !waived('MO-15', r.name)) {
            warn('MO-15', `${tag}: actor '${a.id}' triggers cartoon leap while expression is '${curExpr}' — verify story-motivation restraint (actor-api.md)`);
            markHot(r.i, 'MO-15');
          }
          resolvedLeaps.push({li, lt, ldur});
          strips.push({name: `s${String(i).padStart(2, '0')}_${a.id}_leap${li ? li + 1 : ''}`, t0: +Math.max(r.t0, lt - 0.1).toFixed(2), t1: +Math.min(r.t1, lt + Math.max(0.25, ldur) + 0.15).toFixed(2), n: 8, why: 'leap'});
        }
        resolvedLeaps.sort((p, q) => p.lt - q.lt);
        let prevEnd = -Infinity;
        for (const item of resolvedLeaps) {
          if (item.lt < prevEnd && !waived('MO-17', r.name)) {
            err('MO-17', `${tag}: actor '${a.id}' leap[${item.li}] at ${item.lt.toFixed(2)}s overlaps another leap ending at ${prevEnd.toFixed(2)}s`);
          }
          prevEnd = Math.max(prevEnd, item.lt + Math.max(0.25, item.ldur) * 0.85);
        }
      }
      if (Array.isArray(A.pop) && A.pop.length > 0) {
        if (A.pop.length > 2 && !waived('MO-15', r.name)) {
          warn('MO-15', `${tag}: actor '${a.id}' triggers ${A.pop.length} pop impulses in one ${dur.toFixed(1)}s shot (max 2 recommended) — never bounce calm dialogue`);
          markHot(r.i, 'MO-15');
        }
        for (const [pi, pp] of A.pop.entries()) {
          let pt = NaN;
          try { pt = typeof pp.at === 'number' ? r.t0 + pp.at : P.tAt(pp.at); } catch {}
          if (!Number.isFinite(pt)) continue;
          const pamp = pp.amp ?? 0.12;
          if (pt < r.t0 - 0.05 || pt > r.t1 - 0.1) {
            err('KY-01', `${tag}: actor '${a.id}' pop[${pi}] fires at ${pt.toFixed(2)}s outside shot window [${r.t0.toFixed(2)}..${r.t1.toFixed(2)}]s`);
          }
          if (!(pamp >= 0.02 && pamp <= 0.22)) {
            err('MO-15', `${tag}: actor '${a.id}' pop[${pi}] amp=${pamp} outside restrained range [0.02..0.22] (recommended 0.08..0.14)`);
          }
          const curExpr = scalarKeyAt(A.e, 'neutral', r, P, pt + 0.05);
          if (pamp >= 0.10 && (curExpr === 'sad' || curExpr === 'cry' || curExpr === 'deadpan') && !waived('MO-15', r.name)) {
            warn('MO-15', `${tag}: actor '${a.id}' triggers squash-pop (amp=${pamp}) on '${curExpr}' expression — verify story-motivation restraint`);
            markHot(r.i, 'MO-15');
          }
        }
      }
      if (A.seatH !== undefined && !waived('MO-12', r.name)) {
        const bed = P.SETS[r.set]?.bed;
        const hasSeatProp = (s.extras ?? []).some((e) => /bench|stool|chair|desk/i.test(e.k));
        if (A.seatH > 180) {
          warn('MO-12', `${tag}: ${a.id} has seatH=${A.seatH} (> 180) — floating sit`);
        } else if (A.seatH > 40 && (bed === 'outdoor' || bed === 'street' || bed === 'rain') && !hasSeatProp) {
          warn('MO-12', `${tag}: ${a.id} has seatH=${A.seatH} (> 40) on ${bed} set '${r.set}' without a bench/stool/chair/desk in extras — floating sit`);
        }
      }
      // MO-13: No Air-Pushing / Contact-Lock Guard
      {
        const hasPush = keyVals(A.p).some((v) => v.includes('push')) || keyVals(A.legs).some((v) => v.includes('push'));
        if (A.pushTarget !== undefined) {
          if (!(Array.isArray(A.pushTarget) && A.pushTarget.length === 2 && Number.isFinite(A.pushTarget[0]) && Number.isFinite(A.pushTarget[1]))) {
            err('MO-13', `${tag}: actor '${a.id}' pushTarget must be a 2-element numeric coordinate [tx, ty]`);
          } else if (!waived('MO-13', r.name)) {
            let minDist = Infinity;
            for (const u of [0.15, 0.5, 0.85]) {
              const st = actorStateAt(a, A, r.t0 + dur * u, r, P);
              const d = Math.hypot(A.pushTarget[0] - st.x, A.pushTarget[1] - (st.y - 410 * H * a.s));
              if (d < minDist) minDist = d;
            }
            const maxPushErr = 380 * H * a.s;
            const maxPushWarn = 280 * H * a.s * 1.15;
            if (minDist > maxPushErr) {
              err('MO-13', `${tag}: actor '${a.id}' pushTarget [${A.pushTarget.join(', ')}] is impossibly far (${Math.round(minDist)} px > ${Math.round(maxPushErr)} px) — move actor closer to the target`);
            } else if (minDist > maxPushWarn) {
              warn('MO-13', `${tag}: actor '${a.id}' pushTarget [${A.pushTarget.join(', ')}] exceeds comfortable arm reach (${Math.round(minDist)} px > ${Math.round(maxPushWarn)} px) — verify arm contact`);
              markHot(r.i, 'MO-13');
            }
          }
        }
        if (hasPush) {
          const hasContactLock = (Array.isArray(A.pushTarget) && A.pushTarget.length === 2) || (Array.isArray(A.reach) && A.reach.length > 0);
          if (!hasContactLock && !waived('MO-13', r.name) && isLong16x9) {
            warn('MO-13', `${tag}: actor '${a.id}' uses 'push' without pushTarget [tx, ty] or reach — hands risk pushing empty air; lock hands onto the physical target`);
            markHot(r.i, 'MO-13');
          }
        }
      }
      // MO-15: Living Motion & Secondary Action Guard (actor FX + fall/trip impact weight)
      if (A.fx !== undefined) {
        if (!Array.isArray(A.fx)) {
          err('MO-15', `${tag}: actor '${a.id}' fx must be an array of ActionFx keys (${[...VALID_FX].join('|')})`);
        } else {
          for (const fk of A.fx) {
            if (!VALID_FX.has(fk)) {
              err('MO-15', `${tag}: actor '${a.id}' unknown fx '${fk}' (expected ${[...VALID_FX].join('|')})`);
            }
          }
        }
      }
      {
        const hasFallOrTrip = keyVals(A.p).some((v) => v === 'fall' || v === 'trip') || keyVals(A.legs).some((v) => v === 'fall');
        if (hasFallOrTrip && !(Array.isArray(A.fx) && A.fx.length > 0) && !s.shake && !waived('MO-15', r.name)) {
          warn('MO-15', `${tag}: actor '${a.id}' uses fall/trip with zero fx and zero camera shake — add fx: ['impact', 'stars'] or fx: ['dust'] for physical impact weight`);
        }
      }
      // MO-17: No Mid-Air Walking / Bounded Jump-Arc Guard
      if ((A.arcH ?? 0) > 0 || keyVals(A.legs).includes('jump')) {
        const jumpWindows = [];
        if (Array.isArray(A.legs)) {
          const legKeys = A.legs.map(([mode, tt]) => [String(mode), typeof tt === 'number' ? r.t0 + tt : P.tAt(tt)]);
          for (let li = 0; li < legKeys.length; li++) {
            if (legKeys[li][0] === 'jump') {
              const w0 = legKeys[li][1];
              let nextNonJump = null;
              for (let lj = li + 1; lj < legKeys.length; lj++) {
                if (legKeys[lj][0] !== 'jump') {
                  nextNonJump = legKeys[lj][1];
                  break;
                }
              }
              const w1 = nextNonJump !== null ? nextNonJump : r.t1;
              jumpWindows.push([w0, w1]);
              while (li + 1 < legKeys.length && legKeys[li + 1][0] === 'jump') li++;
            }
          }
        }
        const boundedJump = jumpWindows.find(([w0, w1]) => w1 >= w0 && (w1 - w0) <= 2.2) ?? null;
        if ((A.arcH ?? 0) > 0 && a.path && a.path.length >= 2) {
          const pathDur = a.path[a.path.length - 1][2] - a.path[0][2];
          if (pathDur > 1.85 && !boundedJump && !waived('MO-17', r.name)) {
            err('MO-17', `${tag}: actor '${a.id}' has arcH=${A.arcH} across a ${pathDur.toFixed(1)}s path without a bounded legs:['jump', t0]..['run'|'walk', t1] window (<= 2.2s) — causes moon-floating / mid-air walking`);
            markHot(r.i, 'MO-17');
          } else if (Array.isArray(A.legs)) {
            for (const [w0, w1] of jumpWindows) {
              if ((w1 - w0) > 2.2 && !waived('MO-17', r.name)) {
                warn('MO-17', `${tag}: actor '${a.id}' has 'jump' window ${(w1 - w0).toFixed(2)}s (> 2.2s) — shorten jump arc to prevent moon-floating`);
                markHot(r.i, 'MO-17');
              }
            }
          }
        }
        if (boundedJump) {
          const [w0, w1] = boundedJump;
          const jt0 = Math.max(r.t0, w0 - 0.25);
          const jt1 = Math.min(r.t1, w1 + 0.25);
          strips.push({name: `s${String(i).padStart(2, '0')}_${a.id}_jump`, t0: +jt0.toFixed(2), t1: +Math.max(jt0 + 0.1, jt1).toFixed(2), n: 8, why: 'jump takeoff/apex/land'});
        } else {
          const jt0 = dur > 0.25 ? Math.max(r.t0, r.t0 + 0.1) : r.t0;
          const jt1 = dur > 0.25 ? Math.min(r.t1, r.t1 - 0.1) : r.t1;
          strips.push({name: `s${String(i).padStart(2, '0')}_${a.id}_jump`, t0: +jt0.toFixed(2), t1: +jt1.toFixed(2), n: 8, why: 'jump arc'});
        }
      }
    }
    // MO-14: Straddle Mount & Rider Cohesion Guard
    {
      const tMid = (r.t0 + r.t1) / 2;
      const mountedByTarget = new Map();
      for (const A of s.actors ?? []) {
        if (!A.mount?.target) continue;
        const targetId = A.mount.target;
        const slot = A.mount.slot ?? 0;
        const ex = (s.extras ?? []).find((e) => e.id === targetId);
        if (!ex) {
          if (!waived('MO-14', r.name)) {
            err('MO-14', `${tag}: actor '${A.id}' mounts target '${targetId}' which is not an extra id in this shot`);
          }
          continue;
        }
        const def = (P.SUBJECTS ?? {})[ex.k];
        if (!def) {
          if (!waived('MO-14', r.name)) {
            err('MO-14', `${tag}: actor '${A.id}' mounts '${ex.k}' which is not registered in SUBJECTS (no SubjectSeat available)`);
          }
          continue;
        }
        const exPoses = ex.pose !== undefined ? keyVals(ex.pose) : [def.poses?.[0] ?? 'default'];
        const curPose = scalarKeyAt(ex.pose, def.poses?.[0] ?? 'default', r, P, tMid);
        for (const pose of exPoses) {
          const resolved = def.seats?.[pose]?.[slot] ?? def.seats?.default?.[slot] ?? null;
          if (!resolved && !waived('MO-14', r.name)) {
            err('MO-14', `${tag}: actor '${A.id}' mounts '${ex.k}' (pose '${pose}', slot ${slot}) which has no matching SubjectSeat`);
          }
        }
        const curSeat = def.seats?.[curPose]?.[slot] ?? def.seats?.default?.[slot] ?? null;
        if (!mountedByTarget.has(targetId)) mountedByTarget.set(targetId, {ex, def, riders: []});
        mountedByTarget.get(targetId).riders.push({A, seat: curSeat});
      }
      for (const {ex, def, riders} of mountedByTarget.values()) {
        if (def.kind === 'creature' && riders.length >= 2) {
          const seats = riders.map((rd) => rd.seat).filter(Boolean);
          const hasStraddleOrGrip = seats.length > 0 && seats.every((st) => st.straddle === true || (Array.isArray(st.grip) && st.grip.length === 2));
          if (!hasStraddleOrGrip && !waived('MO-14', r.name) && !lineWaived(subjectsSrc, 'MO-14', ex.k)) {
            warn('MO-14', `${tag}: mounted riders on creature '${ex.k}' lack straddle:true / grip anchors in SubjectSeat — riders risk looking pasted flat on top of the shell`);
            markHot(r.i, 'MO-14');
          }
          const fSign = ex.flip ? -1 : 1;
          const riderFaces = riders.map(({A, seat}) => {
            const seatFace = seat?.face ? seat.face * fSign : fSign;
            const effFace = A.face !== undefined ? scalarKeyAt(A.face, seatFace, r, P, tMid) : seatFace;
            return {id: A.id, dir: effFace < 0 ? -1 : 1};
          });
          const dirs = new Set(riderFaces.map((rf) => rf.dir));
          if (dirs.size > 1 && !waived('MO-14', r.name)) {
            err('MO-14', `${tag}: mounted riders on creature '${ex.k}' face contradictory directions (${riderFaces.map((rf) => `${rf.id}:${rf.dir > 0 ? '+1' : '-1'}`).join(', ')}) — all riders on the same creature must face the travel direction`);
          }
        }
      }
    }
    // MO-15: Flying / hovering extra altitude check (grounding shadow below)
    for (const ex of s.extras ?? []) {
      const poses = keyVals(ex.pose);
      if (poses.some((pv) => pv === 'fly' || pv === 'hover') && ex.altitude === undefined && !waived('MO-15', r.name)) {
        warn('MO-15', `${tag}: extra '${ex.k}' uses pose 'fly'/'hover' without altitude — set altitude: 160..280 so the flying creature casts a grounding shadow below`);
      }
    }
    // GE-20: Mandatory 8-frame flight/action strip for animated or airborne registered SUBJECTS
    {
      const subjStripSeen = new Set();
      for (const ex of s.extras ?? []) {
        if (!P.SUBJECTS?.[ex.k]) continue;
        const poses = keyVals(ex.pose);
        const isMovingOrAirborne = (ex.altitude ?? 0) > 0
          || poses.some((pv) => ['fly', 'hover', 'land', 'pounce'].includes(pv))
          || (ex.path && ex.path.length > 1);
        if (isMovingOrAirborne) {
          const baseName = `s${String(i).padStart(2, '0')}_${ex.id ?? ex.k}_motion`;
          let sName = baseName;
          let suffix = 2;
          while (subjStripSeen.has(sName)) sName = `${baseName}${suffix++}`;
          subjStripSeen.add(sName);
          const padIn = Math.min(0.08, dur * 0.05);
          strips.push({name: sName, t0: +(r.t0 + padIn).toFixed(2), t1: +(r.t1 - padIn).toFixed(2), n: 8, why: 'subject motion/occlusion'});
        }
      }
    }
    // GE-21: General Ground-Plane Contact Invariant for non-airborne SUBJECTS
    // PR-10: General Disembodied Partial-Body Placement Guard in wide/medium shots
    {
      const setDef = P.SETS[s.set];
      const isGroundedStage = Boolean(setDef)
        && !setDef.insert
        && setDef.shotScale !== 'closeup'
        && setDef.shotScale !== 'insert'
        && setDef.angle !== 'closeup'
        && setDef.angle !== 'pov'
        && setDef.angle !== 'high'
        && setDef.cameraDir !== 'top';
      const isWideOrMedium = Boolean(setDef)
        && !setDef.insert
        && setDef.shotScale !== 'closeup'
        && setDef.shotScale !== 'insert'
        && setDef.angle !== 'closeup'
        && setDef.angle !== 'pov';
      const hasFullActor = (s.actors ?? []).some((a) => !a.fg);
      const AIRBORNE_POSE_RE = /^(fly|hover|jump|leap|fall|tumble|soar|float|glide|dive)/i;
      const PARTIAL_BODY_ASSET_RE = /(shoe|foot|leg|hand|arm|paw|finger|bantay|canhtay|ngontay|banchan|tayvay)/i;
      const GROUND_KINDS = new Set(['vehicle', 'creature', 'machine']);

      let floorMinY = H === 1080 ? 740 : 1460;
      if (Array.isArray(setDef?.zones?.mgY) && typeof setDef.zones.mgY[0] === 'number') {
        floorMinY = setDef.zones.mgY[0];
      } else {
        const actorYs = (r.actors ?? [])
          .filter((a) => {
            const da = (s.actors ?? []).find((q) => q.id === a.id);
            return !da?.fg && !da?.mount && Number.isFinite(a.y);
          })
          .map((a) => a.y);
        if (actorYs.length > 0) floorMinY = Math.min(...actorYs) - 80;
      }

      for (const ex of s.extras ?? []) {
        const def = P.SUBJECTS?.[ex.k];
        // GE-21: ground-bound SUBJECT anchored significantly above floor plane without airborne pose/altitude
        if (isGroundedStage && def && GROUND_KINDS.has(def.kind) && !def.airborne && !ex.fg && !((ex.altitude ?? 0) > 0)) {
          const poses = keyVals(ex.pose);
          const isAirbornePose = poses.some((pv) => AIRBORNE_POSE_RE.test(String(pv)));
          if (!isAirbornePose && !waived('GE-21', r.name) && !lineWaived(subjectsSrc, 'GE-21', ex.k)) {
            const ySamples = [];
            if (Number.isFinite(ex.y)) ySamples.push(ex.y);
            if (Array.isArray(ex.path)) {
              for (const wp of ex.path) {
                if (Array.isArray(wp) && Number.isFinite(wp[1])) ySamples.push(wp[1]);
              }
            }
            const minY = ySamples.length ? Math.min(...ySamples) : Infinity;
            if (minY < floorMinY - 90) {
              err(
                'GE-21',
                `${tag}: ground-bound ${def.kind} subject '${ex.k}' at y=${Math.round(minY)} (${Math.round(floorMinY - minY)} px above floor plane y>=${Math.round(floorMinY)}) without airborne pose or altitude — anchor on the floor plane or declare airborne/altitude`,
              );
              markHot(r.i, 'GE-21');
            }
          }
        }
        // PR-10: partial-body asset placed in wide/medium shot alongside full <Person> actor(s)
        const isPartialBody = Boolean(def?.partialOf) || PARTIAL_BODY_ASSET_RE.test(String(ex.k ?? ''));
        if (isPartialBody && isWideOrMedium && hasFullActor && !ex.fg && !waived('PR-10', r.name) && !lineWaived(subjectsSrc, 'PR-10', ex.k)) {
          err(
            'PR-10',
            `${tag}: partial-body asset '${ex.k}' placed in wide/medium set '${s.set}' alongside full <Person> actor(s) — use a dedicated closeup/insert plate or animate the actor's own limb instead of a disembodied body part`,
          );
          markHot(r.i, 'PR-10');
        }
      }
    }
    // MO-18: Anti-Frozen-Statue & Frozen-Attack Guard
    {
      const resolveShotTT = (tt) => {
        if (typeof tt === 'number') return Number.isFinite(tt) ? r.t0 + tt : NaN;
        if (typeof tt === 'string') {
          try { return P.tAt(tt); } catch { return NaN; }
        }
        return NaN;
      };
      // MO-19: Late-ramp set keys guard ([val, atTime, dur] holds previous value until atTime, then ramps)
      if (s.keys && typeof s.keys === 'object' && dur >= 2.0 && !waived('MO-19', r.name)) {
        const LATE_OK_KEYS = new Set(['flash', 'screenAlert', 'impact', 'spark']);
        for (const [kName, kSpec] of Object.entries(s.keys)) {
          if (LATE_OK_KEYS.has(kName)) continue;
          if (!Array.isArray(kSpec) || kSpec.length !== 2) continue;
          const [k0, k1] = kSpec;
          if (!Array.isArray(k0) || !Array.isArray(k1) || k0[0] === k1[0]) continue;
          const tStart = resolveShotTT(k1[1]);
          if (!Number.isFinite(tStart)) continue;
          const idleFrac = (tStart - r.t0) / dur;
          if (idleFrac > 0.72) {
            warn('MO-19', `${tag}: set key '${kName}' holds static for ${Math.round(idleFrac * 100)}% of the shot before starting its ramp at +${(tStart - r.t0).toFixed(2)}s — [val, atTime, dur] starts ramping AT atTime; trigger earlier so motion reads across the shot`);
            markHot(r.i, 'MO-19');
          }
        }
      }
      // 1. Frozen Creature Attack Guard (all formats)
      const ATTACK_POSES = new Set(['pounce', 'charge', 'dive', 'attack']);
      for (const ex of s.extras ?? []) {
        if (!P.SUBJECTS?.[ex.k] || !Array.isArray(ex.pose)) continue;
        const resolvedPoses = ex.pose.map(([pv, tt]) => [String(pv), resolveShotTT(tt)]);
        for (let pi = 0; pi < resolvedPoses.length; pi++) {
          const [pv, tAct] = resolvedPoses[pi];
          if (!ATTACK_POSES.has(pv) || !Number.isFinite(tAct)) continue;
          const hasSubseqPose = resolvedPoses.some(([, t2], pj) => pj !== pi && Number.isFinite(t2) && t2 > tAct + 1e-4);
          const hasPathAfter = Array.isArray(ex.path) && ex.path.length >= 2 && ex.path.some((w) => {
            const tw = Array.isArray(w) ? resolveShotTT(w[2]) : NaN;
            return Number.isFinite(tw) && tw > tAct + 0.4;
          });
          if (!hasSubseqPose && !hasPathAfter && (r.t1 - tAct) > 1.8 && !waived('MO-18', r.name)) {
            err('MO-18', `${tag}: subject '${ex.k}' switches to active attack pose '${pv}' at ${tAct.toFixed(2)}s and freezes in place for ${(r.t1 - tAct).toFixed(1)}s until shot end — add a lunge path, follow-through pose, or cut on impact`);
            markHot(r.i, 'MO-18');
          }
        }
      }
      // 2. Actor Dead-Freeze Window Guard (isLong16x9 && dur > 4.2)
      if (isLong16x9 && dur > 4.2 && !waived('MO-18', r.name)) {
        for (const a of r.actors) {
          const role = P.CAST_ROLES[a.look]?.role;
          if (role !== 'principal' && role !== 'support') continue;
          const A = (s.actors ?? []).find((q) => q.id === a.id);
          if (!A) continue;
          if (A.mount?.target) {
            const targetEx = (s.extras ?? []).find((e) => e.id === A.mount.target);
            if (targetEx && Array.isArray(targetEx.path) && targetEx.path.length >= 2) continue;
          }
          const activeIntervals = [];
          if (Array.isArray(a.path) && a.path.length >= 2) {
            const p0 = a.path[0][2];
            const p1 = a.path[a.path.length - 1][2];
            if (Number.isFinite(p0) && Number.isFinite(p1) && p1 > p0) {
              activeIntervals.push([p0, p1]);
            }
          }
          for (const [ts, te] of A.talk ?? []) {
            try {
              const tStart = typeof ts === 'number' ? r.t0 + ts : P.tAt(ts);
              const tEnd = typeof te === 'number' ? r.t0 + te : P.tAt(te, true);
              if (Number.isFinite(tStart) && Number.isFinite(tEnd) && tEnd > tStart) {
                activeIntervals.push([tStart, tEnd]);
              }
            } catch {}
          }
          const hasValidPushTarget = Array.isArray(A.pushTarget) && A.pushTarget.length === 2
            && Number.isFinite(A.pushTarget[0]) && Number.isFinite(A.pushTarget[1]);
          if (hasValidPushTarget) {
            const collectPushSpans = (spec) => {
              if (spec === undefined || spec === null) return;
              if (!Array.isArray(spec)) {
                if (String(spec).includes('push')) activeIntervals.push([r.t0, r.t1]);
                return;
              }
              const ks = spec.map(([v, tt]) => [String(v), resolveShotTT(tt)]).filter(([, t]) => Number.isFinite(t));
              for (let ki = 0; ki < ks.length; ki++) {
                if (ks[ki][0].includes('push')) {
                  const s0 = ki === 0 ? Math.min(r.t0, ks[0][1]) : ks[ki][1];
                  const s1 = ki + 1 < ks.length ? ks[ki + 1][1] : r.t1;
                  if (s1 > s0) activeIntervals.push([s0, s1]);
                }
              }
            };
            collectPushSpans(A.p);
            collectPushSpans(A.legs);
            collectPushSpans(A.arms);
          }
          const evSet = new Set([+r.t0.toFixed(4), +r.t1.toFixed(4)]);
          const addEv = (t) => {
            if (Number.isFinite(t) && t >= r.t0 && t <= r.t1) evSet.add(+t.toFixed(4));
          };
          for (const k of ['p', 'e', 'view', 'face', 'legs', 'arms']) {
            if (Array.isArray(A[k])) {
              for (const [, tt] of A[k]) addEv(resolveShotTT(tt));
            }
          }
          for (const rc of A.reach ?? []) {
            addEv(resolveShotTT(rc.at));
          }
          const evTimes = [...evSet].sort((x, y) => x - y);
          const merged = [];
          const clipped = activeIntervals
            .map(([x0, x1]) => [Math.max(r.t0, x0), Math.min(r.t1, x1)])
            .filter(([x0, x1]) => Number.isFinite(x0) && Number.isFinite(x1) && x1 > x0)
            .sort((p, q) => p[0] - q[0]);
          for (const [x0, x1] of clipped) {
            if (merged.length && x0 <= merged[merged.length - 1][1] + 1e-6) {
              merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], x1);
            } else {
              merged.push([x0, x1]);
            }
          }
          let maxGap = 0;
          for (let ei = 0; ei + 1 < evTimes.length; ei++) {
            let cur = evTimes[ei];
            const end = evTimes[ei + 1];
            for (const [m0, m1] of merged) {
              if (m1 <= cur) continue;
              if (m0 >= end) break;
              if (m0 > cur) maxGap = Math.max(maxGap, m0 - cur);
              cur = Math.max(cur, m1);
            }
            if (end > cur) maxGap = Math.max(maxGap, end - cur);
          }
          if (maxGap > 3.4) {
            warn('MO-18', `${tag}: actor '${a.id}' holds static for ${maxGap.toFixed(1)}s without a pose/expr/view/talk/path beat — add reaction keyframes or cut to a close-up`);
            markHot(r.i, 'MO-18');
          }
        }
      }
    }
    if (i > 0 && i < rows.length - 1
      && r.cam[2] <= 1.15 && (r.cam2 ? r.cam2[2] <= 1.15 : true)
      && r.actors.length === 0
      && rows[i - 1].set === r.set && rows[i + 1].set === r.set && r.tr === 'cut'
      && rows[i - 1].actors.length > 0 && rows[i + 1].actors.length > 0
      && !waived('GE-18', r.name)) {
      warn('GE-18', `${tag}: cast continuity drop in wide shot (0 actors between #${i - 1} and #${i + 1} in '${r.set}')`);
    }
  });
  // coverage: every look in CAST is used, every episode set is used
  for (const k of Object.keys(P.CAST)) if (!usedLooks.has(k)) warn('CO-01', `look ${k} is designed but never used`);
  for (const id of Object.keys(P.EPISODE_SETS)) if (!usedSets.has(id)) warn('CO-02', `set ${id} is built but never used`);
  // segment coverage: long segments need more than one picture
  const segs = Object.entries(P.C.seg_starts).sort((a, b) => a[1] - b[1]);
  const co03MaxS = isLong16x9 ? 10.5 : 5;
  segs.forEach(([id, t0], j) => {
    const t1 = j + 1 < segs.length ? segs[j + 1][1] : P.C.voice_end;
    const n = rows.filter((r) => r.t0 < t1 - 0.2 && r.t1 > t0 + 0.2).length;
    if (t1 - t0 > co03MaxS && n < 2) warn('CO-03', `${id}: ${(t1 - t0).toFixed(1)} s of narration on a single shot`);
  });
  // pacing (standards/pacing.json): every episode cuts at the same speed (dual-format: short vs long_16x9)
  {
    const pacingDoc = JSON.parse(fs.readFileSync(new URL('../standards/pacing.json', import.meta.url), 'utf8'));
    const PA = (isLong16x9 && pacingDoc.shots_long_16x9) ? pacingDoc.shots_long_16x9 : pacingDoc.shots;
    const durs = rows.map((r) => r.t1 - r.t0).sort((a, b) => a - b);
    const total = rows.length ? rows[rows.length - 1].t1 - rows[0].t0 : 0;
    if (durs.length && total > 30) {
      const mean = durs.reduce((a, b) => a + b, 0) / durs.length;
      const perMin = (durs.length / total) * 60;
      const p10 = durs[Math.floor(durs.length / 10)];
      if (mean < PA.mean_s[0] || mean > PA.mean_s[1]) err('PC-01', `mean shot ${mean.toFixed(2)} s outside ${PA.mean_s[0]}-${PA.mean_s[1]} s (house pacing)`);
      if (perMin < PA.shots_per_min[0] || perMin > PA.shots_per_min[1]) err('PC-02', `${perMin.toFixed(1)} shots/min outside ${PA.shots_per_min[0]}-${PA.shots_per_min[1]}`);
      if (p10 < PA.p10_s_min) err('PC-03', `10 % of shots are shorter than ${p10.toFixed(2)} s (min ${PA.p10_s_min} s): too choppy`);
      const long = rows.filter((r) => r.t1 - r.t0 > PA.max_s && !waived('PC-03', r.name));
      for (const r of long) err('PC-03', `'${r.name}' holds ${(r.t1 - r.t0).toFixed(1)} s (> ${PA.max_s} s)`);
      console.log(`pacing (${isLong16x9 ? 'long_16x9' : 'short'}): ${durs.length} shots, mean ${mean.toFixed(2)} s, ${perMin.toFixed(1)}/min, p10 ${p10.toFixed(2)} s`);
    }
  }
  // SH-16: set-fatigue & unbroken streak guard for long_16x9
  // SH-17: cinematic view diversity & WORLD_PROP reuse diversity for long_16x9
  if (isLong16x9 && rows.length >= 20) {
    const setCounts = new Map();
    let runSet = null, runStart = 0, runLen = 0;
    const flushStreak = (endIdx) => {
      if (runSet === null) return;
      if (runLen > 8) {
        err('SH-16', `set '${runSet}' held for ${runLen} consecutive shots (#${runStart}..#${endIdx}) — switch angle plate or location (max 8)`);
      } else if (runLen > 5) {
        warn('SH-16', `set '${runSet}' held for ${runLen} consecutive shots (#${runStart}..#${endIdx}) — switch angle plate or location (max 8)`);
      }
    };
    for (let i = 0; i < rows.length; i++) {
      const sid = rows[i].set;
      setCounts.set(sid, (setCounts.get(sid) ?? 0) + 1);
      if (sid === runSet) {
        runLen++;
      } else {
        flushStreak(i - 1);
        runSet = sid;
        runStart = i;
        runLen = 1;
      }
    }
    flushStreak(rows.length - 1);
    const totalShots = rows.length;
    for (const [setId, count] of setCounts) {
      const ratio = (count / totalShots) * 100;
      const pct = Number(ratio.toFixed(1));
      if (ratio > 18 && !progressivePartialUnits) {
        err('SH-16', `set '${setId}' occupies ${pct}% of episode (${count}/${totalShots} shots; max 18%)`);
      } else if (ratio > 14) {
        warn('SH-16', `set '${setId}' occupies ${pct}% of ${progressivePartialUnits ? 'authored units so far' : 'episode'} (${count}/${totalShots} shots; full-episode max 18%)`);
      }
    }

    const viewCounts = {front: 0, side: 0, back: 0, '3q': 0};
    let totalActorPlacements = 0;
    const propShots = new Map();
    const propVariants = new Map();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const s = shots[i];
      const tMid = (r.t0 + r.t1) / 2;
      for (const A of s?.actors ?? []) {
        const defView = (A.path && A.path.length > 1) || A.ride ? 'side' : 'front';
        const v = scalarKeyAt(A.view, defView, r, P, tMid);
        viewCounts[v] = (viewCounts[v] ?? 0) + 1;
        totalActorPlacements++;
      }
      for (const e of s?.extras ?? []) {
        if (!e?.k) continue;
        if (!propShots.has(e.k)) {
          propShots.set(e.k, new Set());
          propVariants.set(e.k, new Set());
        }
        propShots.get(e.k).add(i);
        propVariants.get(e.k).add(e.c ?? '');
      }
    }
    if (totalActorPlacements > 0) {
      const frontShare = (viewCounts.front / totalActorPlacements) * 100;
      const angledCount = (viewCounts.back ?? 0) + (viewCounts['3q'] ?? 0);
      const angledShare = (angledCount / totalActorPlacements) * 100;
      if (frontShare > 70) {
        err('SH-17', `front view accounts for ${Number(frontShare.toFixed(1))}% of actor placements (${viewCounts.front}/${totalActorPlacements}; max 70%)`);
      } else if (frontShare > 60) {
        warn('SH-17', `front view accounts for ${Number(frontShare.toFixed(1))}% of actor placements (${viewCounts.front}/${totalActorPlacements}; recommended ≤ 60%)`);
      }
      if (angledShare < 15) {
        err('SH-17', `back + 3q views account for only ${Number(angledShare.toFixed(1))}% of actor placements (${angledCount}/${totalActorPlacements}; minimum 15%, recommended ≥ 25%)`);
      } else if (angledShare < 25) {
        warn('SH-17', `back + 3q views account for ${Number(angledShare.toFixed(1))}% of actor placements (${angledCount}/${totalActorPlacements}; recommended ≥ 25%)`);
      }
    }
    for (const [k, shotSet] of propShots) {
      const variants = propVariants.get(k);
      if (shotSet.size > 15 && variants.size <= 1) {
        warn('SH-17', `WORLD_PROP '${k}' appears in ${shotSet.size} shots with only ${variants.size} variant(s) (c) — add variant diversity or alternate props to prevent copy-paste sticker fatigue`);
      }
    }
    // CA-07: Shot-size progression & variety rhythm for long_16x9
    {
      let estCount = 0, medCount = 0, closeInsertCount = 0;
      for (const r of rows) {
        const sd = P.SETS[r.set];
        const sc = sd?.shotScale;
        if (sc === 'establishing') estCount++;
        else if (sc === 'medium') medCount++;
        else if (sc === 'closeup' || sc === 'insert' || sd?.insert) closeInsertCount++;
      }
      const estPct = (estCount / totalShots) * 100;
      const closeInsertPct = (closeInsertCount / totalShots) * 100;
      const ca07Waived = /lint-ok:\s*CA-07\b/.test(shotSrc);
      if (estPct > 65 && !ca07Waived) {
        err('CA-07', `establishing sets occupy ${estPct.toFixed(1)}% of episode (${estCount}/${totalShots} shots; max 65%) — flat wide-shot monotony; cut to drawn medium/closeup/insert sub-scenes`);
      }
      if (closeInsertPct < 10 && !ca07Waived) {
        warn('CA-07', `closeup + insert sets occupy only ${closeInsertPct.toFixed(1)}% of episode (${closeInsertCount}/${totalShots} shots; target ≥ 10%) — add drawn close-ups/inserts for emotional beats`);
      }
    }
  }
  // SH-18: Multi-pose Hero Creature enforcement
  {
    const HERO_CREATURE_RE = /(cat|dog|ant|bug|ladybug|bird|spider|rat|mouse|monster|robot|dragon|boss)/i;
    const creatureShots = new Map();
    const creaturePoses = new Map();
    for (let i = 0; i < rows.length; i++) {
      const s = shots[i];
      for (const e of s?.extras ?? []) {
        if (!e?.k || !HERO_CREATURE_RE.test(e.k)) continue;
        if (!creatureShots.has(e.k)) {
          creatureShots.set(e.k, new Set());
          creaturePoses.set(e.k, new Set());
        }
        creatureShots.get(e.k).add(i);
        const ps = creaturePoses.get(e.k);
        if (Array.isArray(e.pose)) {
          for (const [pv] of e.pose) ps.add(String(pv));
        } else if (e.pose) {
          ps.add(String(e.pose));
        } else if (e.c) {
          ps.add(String(e.c));
        } else {
          ps.add('default');
        }
      }
    }
    if (isLong16x9 || rows.length >= 6) {
      const minShots = isLong16x9 ? 2 : 3;
      for (const [k, shotSet] of creatureShots) {
        if (shotSet.size < minShots) continue;
        const posesUsed = creaturePoses.get(k);
        const isRegistered = !!(P.SUBJECTS ?? {})[k];
        const isWaived = [...shotSet].every((si) => waived('SH-18', rows[si].name)) || propWaived('SH-18', k) || lineWaived(subjectsSrc, 'SH-18', k);
        if (!isWaived && (!isRegistered || (shotSet.size >= 3 && posesUsed.size <= 1))) {
          err('SH-18', `hero creature '${k}' reused across ${shotSet.size} shots with ${posesUsed.size} pose/state(s)${isRegistered ? '' : ' and not registered in SUBJECTS'} — register in SUBJECTS with >= 4 poses and vary poses across shots`);
        }
      }
    }
  }
  // SH-20: Shot-Scale Alternation & Anti-Dollhouse-Wide Streak Guard
  if (isLong16x9 && rows.length >= 5) {
    const isWideStage = (r) => {
      const sd = P.SETS[r.set];
      if (sd?.insert) return false;
      if (sd?.shotScale === 'closeup' || sd?.shotScale === 'insert') return false;
      if (sd?.angle === 'closeup' || sd?.angle === 'pov') return false;
      const sDef = shots[r.i];
      const cks = Array.isArray(r.camKeys) ? r.camKeys : (Array.isArray(sDef?.camKeys) ? sDef.camKeys : []);
      const zooms = [
        r.cam?.[2],
        ...(r.cam2 ? [r.cam2[2]] : []),
        ...cks.map((ck) => (Array.isArray(ck) ? ck[2] : NaN)),
      ].filter((z) => typeof z === 'number' && Number.isFinite(z));
      const maxZoom = zooms.length ? Math.max(...zooms) : 1;
      if (!(maxZoom <= 1.16)) return false;
      if ((r.actors ?? []).some((a) => a.fg) || (sDef?.actors ?? []).some((a) => a.fg)) return false;
      return true;
    };
    let wStart = -1;
    const flushWideStreak = (endIdx) => {
      if (wStart < 0) return;
      const len = endIdx - wStart + 1;
      if (len >= 3) {
        const s0 = rows[wStart].i;
        const s1 = rows[endIdx].i;
        const streakWaived = rows.slice(wStart, endIdx + 1).some((q) => waived('SH-20', q.name));
        if (!streakWaived) {
          if (len >= 4) {
            err('SH-20', `shots #${s0}..#${s1} (${len} consecutive full-stage wide/medium shots at zoom <= 1.16 with 0 close-up/POV/OTS breaks) — dollhouse stage monotony; intercut drawn 'closeup'/'insert'/'pov' reaction & detail shots`);
          } else {
            warn('SH-20', `shots #${s0}..#${s1} (3 consecutive full-stage wide/medium shots) — consider intercutting a close-up reaction, OTS, or POV detail shot`);
          }
        }
      }
      wStart = -1;
    };
    for (let i = 0; i < rows.length; i++) {
      if (isWideStage(rows[i])) {
        if (wStart < 0) wStart = i;
      } else {
        flushWideStreak(i - 1);
      }
    }
    flushWideStreak(rows.length - 1);
  }
  // SH-21: Multi-Location Cut & Spatial Pack Progression Guard
  if (isLong16x9 && rows.length >= 12) {
    const definedLocs = new Set(
      Object.values(P.EPISODE_SETS ?? {})
        .filter((d) => d && !d.insert && typeof d.location === 'string' && d.location.trim().length > 0)
        .map((d) => d.location.trim()),
    );
    if (definedLocs.size >= 2) {
      const sh21FileWaived = /lint-ok:\s*SH-21\b/.test(shotSrc);
      let runLoc = null, runStart = 0, streak = 0;
      const flushLocStreak = (endIdx) => {
        if (!runLoc) return;
        if (streak > 11) {
          const start = rows[runStart].i;
          const end = rows[endIdx].i;
          const streakWaived = sh21FileWaived || rows.slice(runStart, endIdx + 1).some((q) => waived('SH-21', q.name));
          if (!streakWaived) {
            const msg = `location '${runLoc}' runs unbroken for ${streak} consecutive shots (#${start}..#${end}) — cut to a parallel threat, cutaway, or next Location Pack to prevent single-room claustrophobia`;
            if (streak > 16) err('SH-21', msg);
            else warn('SH-21', msg);
          }
        }
      };
      for (let i = 0; i < rows.length; i++) {
        const rawLoc = P.SETS[rows[i].set]?.location;
        const loc = typeof rawLoc === 'string' && rawLoc.trim() ? rawLoc.trim() : null;
        if (loc && loc === runLoc) {
          streak++;
        } else {
          flushLocStreak(i - 1);
          runLoc = loc;
          runStart = i;
          streak = loc ? 1 : 0;
        }
      }
      flushLocStreak(rows.length - 1);
    }
  }
  // ---- screen geometry (GE-*, LA-*): measured from the shot table, no render. Each hit makes the shot HOT:
  // its review must open the measurement crops (node scripts/qa.mjs crops <i>) — see sv-short-production "review cards".
  const looks = {...(P.EX_LOOKS ?? {}), ...P.CAST};
  const seen = new Set();
  const flag = (r, rule, msg, who = '', makeHot = rule !== 'GE-10') => {
    if (waived(rule, r.name) || seen.has(`${r.i}|${rule}|${who}`)) return; // one warning per shot, rule and actor
    seen.add(`${r.i}|${rule}|${who}`);
    warn(rule, `#${r.i} '${r.name}': ${msg}`);
    if (makeHot) markHot(r.i, rule);
  };
  const lastH = {};
  const DIALOGUE_VIEWS = new Set(['front', '3q', 'side']);
  const isNeutralAxisAngle = (sd) => {
    const ang = sd?.angle;
    return ang === 'high' || ang === 'wide' || ang === 'ots' || sd?.shotScale === 'establishing';
  };
  let prevAxis = null;
  const layoutReport = [];
  const tinyCreatureRatios = new Map();
  for (const r of rows) {
    let worstGrid = null;
    const shotScaleIssues = [];
    const shotScaleSeen = new Set();
    const shotCutoffIssues = [];
    const shotCutoffSeen = new Set();
    const shotDef = shots[r.i] ?? {};
    const rawExtras = shotDef.extras ?? [];
    const isInsertSet = Boolean(P.SETS[r.set]?.insert);
    const setSignOccByKey = new Map();
    const la03SampleByProp = new Map();
    for (const u of [0.15, 0.5, 0.85]) {
      const t = r.t0 + (r.t1 - r.t0) * u;
      const g = shotGeometry(r, t, P, rows);
      const B = g.actors;
      // Collect rendered subject-to-grounded-actor pixel height ratios for LA-03 cross-angle scale lock
      {
        const groundedActors = B.filter((x) => {
          if (x.fg || x.mountedOn || x.h <= 0 || area(clip(x.all)) <= 0) return false;
          const da = (shotDef.actors ?? []).find((q) => q.id === x.id);
          if (da?.fg || da?.mount || da?.ride) return false;
          if (da?.op !== undefined && da.op <= 0.05) return false;
          if (da?.enter !== undefined) {
            try {
              const tEn = typeof da.enter === 'number' ? r.t0 + da.enter : P.tAt(da.enter);
              if (t < tEn + 0.05) return false;
            } catch {}
          }
          if (da?.exit !== undefined) {
            try {
              const tEx = typeof da.exit === 'number' ? r.t0 + da.exit : P.tAt(da.exit);
              if (t > tEx + 0.25) return false;
            } catch {}
          }
          return true;
        });
        if (groundedActors.length >= 1) {
          const tinyGrounded = groundedActors.filter((x) => isKidOrShrunkenActor(x));
          const refActors = tinyGrounded.length > 0 ? tinyGrounded : groundedActors;
          const actorPxH = refActors.reduce((sum, x) => sum + x.h, 0) / refActors.length;
          for (let prIdx = 0; prIdx < g.props.length; prIdx++) {
            const pr = g.props[prIdx];
            if (pr.fg || !pr.onScreen) continue;
            const subjDef = (P.SUBJECTS ?? {})[pr.k];
            if (!subjDef) continue;
            const subjPxH = pr.screenBox.y1 - pr.screenBox.y0;
            if (!(subjPxH > 0)) continue;
            const ratio = subjPxH / Math.max(1, actorPxH);
            const slotKey = `${prIdx}:${pr.id ?? pr.k}`;
            if (!la03SampleByProp.has(slotKey) || u === 0.5) {
              la03SampleByProp.set(slotKey, {pr, subjDef, ratio});
            }
          }
        }
      }
      if (g.gridLayout) {
        if (!worstGrid
          || g.gridLayout.maxCellCount > worstGrid.maxCellCount
          || (g.gridLayout.maxCellCount === worstGrid.maxCellCount && g.gridLayout.occupancyFrac > worstGrid.occupancyFrac)) {
          worstGrid = {
            cells: g.gridLayout.cells,
            maxCellCount: g.gridLayout.maxCellCount,
            crowdedCells: g.gridLayout.crowdedCells,
            overcrowdedCells: g.gridLayout.overcrowdedCells,
            occupancyFrac: g.gridLayout.occupancyFrac,
          };
        }
        if (g.gridLayout.overcrowdedCells.length > 0 || g.gridLayout.occupancyFrac > 0.78) {
          if (!waived('LA-02', r.name) && !seen.has(`${r.i}|LA-02-ERR`)) {
            seen.add(`${r.i}|LA-02-ERR`);
            err('LA-02', `#${r.i} '${r.name}': 3×3 layout overcrowded (cells [${g.gridLayout.overcrowdedCells.join(',')}] >= 4 clusters, occupancy ${Math.round(g.gridLayout.occupancyFrac * 100)}%) at ${t.toFixed(2)} s — declutter or split into 2 shots`);
            markHot(r.i, 'LA-02');
          }
        } else if (g.gridLayout.crowdedCells.length > 0 || g.gridLayout.occupancyFrac > 0.65) {
          if (!waived('LA-02', r.name) && !seen.has(`${r.i}|LA-02-ERR`) && !seen.has(`${r.i}|LA-02-WARN`)) {
            seen.add(`${r.i}|LA-02-WARN`);
            warn('LA-02', `#${r.i} '${r.name}': 3×3 layout crowded (cells [${g.gridLayout.crowdedCells.join(',')}] >= 3 clusters, occupancy ${Math.round(g.gridLayout.occupancyFrac * 100)}%) at ${t.toFixed(2)} s`);
          }
        }
      }
      for (const si of g.scaleIssues ?? []) {
        const sKey = `${si.kind}:${si.id ?? si.k}`;
        if (!shotScaleSeen.has(sKey)) { shotScaleSeen.add(sKey); shotScaleIssues.push(si); }
        if (!waived('LA-01', r.name) && !seen.has(`${r.i}|LA-01|${sKey}`)) {
          seen.add(`${r.i}|LA-01|${sKey}`);
          if (si.kind === 'actor_scale') {
            err('LA-01', `#${r.i} '${r.name}': actor '${si.id}' scale s=${si.s} outside set '${r.set}' actorScale [${si.expected[0]}..${si.expected[1]}] at ${t.toFixed(2)} s`);
          } else {
            err('LA-01', `#${r.i} '${r.name}': subject '${si.k}' height ratio ${si.ratio}× vs actor outside relToActor [${si.expected[0]}..${si.expected[1]}] at ${t.toFixed(2)} s`);
          }
          markHot(r.i, 'LA-01');
        }
      }
      for (let a = 0; a < B.length; a++) for (let b = a + 1; b < B.length; b++) {
        const o = inter(B[a].body, B[b].body) / Math.max(1, Math.min(area(B[a].body), area(B[b].body)));
        if (o > 0.25 && !r.actors[a].ride && !r.actors[b].ride) { flag(r, 'GE-01', `${B[a].id} and ${B[b].id} bodies overlap ${(o * 100).toFixed(0)} % at ${t.toFixed(2)} s — check who is in front and that nothing reads as one blob`, B[a].id + B[b].id); break; }
      }
      for (const x of B) {
        const {x: hx, y: hy, r: hr} = x.hc;
        const onScreen = hx + hr > 0 && hx - hr < W && hy + hr > 0 && hy - hr < H;
        const cut = hy - hr < -0.25 * hr || hx - hr < -0.25 * hr || hx + hr > W + 0.25 * hr; // > ~¼ of the head outside
        if (onScreen && cut && x.h < H * 1.1) flag(r, 'GE-04', `${x.id}'s head is cut by the frame edge at ${t.toFixed(2)} s`, x.id + 'cut');
        if (onScreen && hy + hr * 0.5 > CAPTION[0] && hy - hr * 0.5 < CAPTION[1]) flag(r, 'GE-04', `${x.id}'s face sits in the caption band at ${t.toFixed(2)} s`, x.id + 'cap');
      }
      for (const sg of g.signs) {
        if (sg.edgeClipped) {
          const clipPct = Math.round(Math.max(sg.clippedW, sg.clippedH) * 100);
          flag(r, 'GE-10', `${sg.source !== 'set' ? `[${sg.source}] ` : ''}sign '${sg.text}' clipped ${clipPct}% by frame edge at ${t.toFixed(2)} s — ${sg.camHint}`, `sign:${sg.source}:${sg.text}`);
        }
        if (sg.occludedBy.length > 0) {
          if (sg.source !== 'set' || isInsertSet) {
            for (const occ of sg.occludedBy) {
              flag(r, 'GE-11', `${occ.kind} ${occ.id} covers ${Math.round(occ.frac * 100)}% of sign '${sg.text}'${sg.source !== 'set' ? ` (${sg.source})` : ''} at ${t.toFixed(2)} s`, `occ:${sg.source}:${sg.text}:${occ.id}`, occ.kind !== 'prop');
            }
          } else {
            let entry = setSignOccByKey.get(sg.text);
            if (!entry) {
              entry = {samples: new Set(), hits: []};
              setSignOccByKey.set(sg.text, entry);
            }
            entry.samples.add(u);
            for (const occ of sg.occludedBy) {
              let isStationary = true;
              if (occ.kind === 'actor') {
                const da = (shotDef.actors ?? []).find((q) => q.id === occ.id);
                const ra = (r.actors ?? []).find((q) => q.id === occ.id);
                const hasMotion = Boolean(
                  (Array.isArray(da?.path) && da.path.length >= 2)
                  || (Array.isArray(ra?.path) && ra.path.length >= 2)
                  || da?.mount
                  || ra?.mount
                  || da?.ride
                  || ra?.ride,
                );
                isStationary = !hasMotion;
              } else if (occ.kind === 'prop') {
                const sArea = sg.screenBox ? Math.max(1, area(sg.screenBox)) : 1;
                let matchedAny = false;
                let allMoving = true;
                for (let pi = 0; pi < g.props.length; pi++) {
                  const pr = g.props[pi];
                  if (pr.k !== occ.id) continue;
                  if (sg.screenBox && inter(pr.screenBox, sg.screenBox) / sArea <= 0.25) continue;
                  matchedAny = true;
                  const rawEx = rawExtras[pi];
                  if (!(Array.isArray(rawEx?.path) && rawEx.path.length >= 2)) {
                    allMoving = false;
                    break;
                  }
                }
                if (!matchedAny) {
                  const rawEx = rawExtras.find((e) => e.k === occ.id);
                  allMoving = Boolean(Array.isArray(rawEx?.path) && rawEx.path.length >= 2);
                }
                isStationary = !allMoving;
              }
              entry.hits.push({occ, sgText: sg.text, sgSource: sg.source, t, isStationary});
            }
          }
        }
      }
      const effPropDepth = (prop, idx) => {
        const rawEx = (rawExtras[idx] && rawExtras[idx].k === prop.k && (rawExtras[idx].id ?? null) === (prop.id ?? null))
          ? rawExtras[idx]
          : rawExtras.find((e) => (e.id && e.id === prop.id) || e.k === prop.k);
        return (rawEx?.altitude ?? 0) > 20 ? prop.depthY + (rawEx.altitude ?? 0) + 1200 : prop.depthY;
      };
      for (let prIdx = 0; prIdx < g.props.length; prIdx++) {
        const pr = g.props[prIdx];
        if (pr.edgeClipped) {
          flag(r, 'GE-15', `prop '${pr.k}' clipped ${Math.round(pr.clippedFrac * 100)}% off frame edge at ${t.toFixed(2)} s — ${pr.dxHint}`, `prop:${pr.k}`);
        }
        if (pr.onScreen) {
          for (const x of B) {
            const {x: hx, y: hy, r: hr} = x.hc;
            const onScreen = hx + hr > 0 && hx - hr < W && hy + hr > 0 && hy - hr < H;
            if (!onScreen || (x.mountedOn && x.mountedOn === pr.id) || pr.depthY < x.depthY - 5) continue;
            const frac = inter(pr.screenBox, x.head) / Math.max(1, area(x.head));
            if (frac > 0.35) {
              flag(r, 'GE-17', `prop '${pr.k}' (depthY=${Math.round(pr.depthY)}) covers ${Math.round(frac * 100)}% of ${x.id}'s head (depthY=${Math.round(x.depthY)}) at ${t.toFixed(2)} s`, `${pr.k}:${x.id}`);
            }
          }
          // GE-20: Hero Subject / Flying Creature Occlusion Guard
          if (P.SUBJECTS?.[pr.k]) {
            const prDepth = effPropDepth(pr, prIdx);
            const prArea = Math.max(1, area(pr.screenBox));
            const checkBlocker = (blockerBox, blockerName) => {
              const frac = inter(pr.screenBox, blockerBox) / prArea;
              if (frac > 0.45 && !waived('GE-20', r.name)) {
                if (!seen.has(`${r.i}|GE-20-ERR|${pr.k}:${blockerName}`)) {
                  seen.add(`${r.i}|GE-20-ERR|${pr.k}:${blockerName}`);
                  err('GE-20', `#${r.i} '${r.name}': hero subject '${pr.k}' occluded ${Math.round(frac * 100)}% by ${blockerName} at ${t.toFixed(2)}s`);
                  markHot(r.i, 'GE-20');
                }
              } else if (frac > 0.25 && !waived('GE-20', r.name)) {
                flag(r, 'GE-20', `hero subject '${pr.k}' occluded ${Math.round(frac * 100)}% by ${blockerName} at ${t.toFixed(2)}s`, `ge20:${pr.k}:${blockerName}`);
              }
            };
            for (const x of B) {
              if (x.mountedOn && x.mountedOn === pr.id) continue;
              if (x.depthY > prDepth + 5) checkBlocker(x.all, x.id);
            }
            for (let pr2Idx = 0; pr2Idx < g.props.length; pr2Idx++) {
              const pr2 = g.props[pr2Idx];
              if (pr2 === pr || !pr2.onScreen) continue;
              const pr2Depth = effPropDepth(pr2, pr2Idx);
              if (pr2Depth > prDepth + 5) checkBlocker(pr2.screenBox, pr2.id ?? pr2.k);
            }
          }
        }
      }
      for (const cc of g.creatureCutoffIssues ?? []) {
        if (!shotCutoffSeen.has(cc.k)) { shotCutoffSeen.add(cc.k); shotCutoffIssues.push({k: cc.k, clippedFrac: +cc.clippedFrac.toFixed(3), screenBox: cc.screenBox}); }
        if (!waived('LA-04', r.name) && !seen.has(`${r.i}|LA-04|${cc.k}`)) {
          seen.add(`${r.i}|LA-04|${cc.k}`);
          err('LA-04', `#${r.i} '${r.name}': hero creature '${cc.k}' is awkwardly cut off ${Math.round(cc.clippedFrac * 100)}% at frame edge [${Math.round(cc.screenBox.x0)}, ${Math.round(cc.screenBox.y0)}, ${Math.round(cc.screenBox.x1)}, ${Math.round(cc.screenBox.y1)}] at ${t.toFixed(2)} s — re-frame inside canvas, use a closeup pose, or mark fg: true`);
          markHot(r.i, 'LA-04');
        }
      }
      for (const dl of g.detachedLimbIssues ?? []) {
        if (!waived('GE-19', r.name) && !seen.has(`${r.i}|GE-19|${dl.k}`)) {
          seen.add(`${r.i}|GE-19|${dl.k}`);
          err('GE-19', `#${r.i} '${r.name}': giant partial-body prop '${dl.k}' (screen height ${Math.round(dl.screenH)} px, box [${Math.round(dl.sx0)}, ${Math.round(dl.sy0)}, ${Math.round(dl.sx1)}, ${Math.round(dl.sy1)}]) terminates floating in mid-air inside frame at ${t.toFixed(2)} s — extend limb off top/side edge or waive if standalone item`);
          markHot(r.i, 'GE-19');
        }
      }
      const GE16_KINDS = new Set(['bubble', 'label', 'stamp', 'tag']);
      for (const ov of overlayBoxesAt(r, t, P)) {
        if (!GE16_KINDS.has(ov.k)) continue;
        for (const x of B) {
          const {x: hx, y: hy, r: hr} = x.hc;
          const onScreen = hx + hr > 0 && hx - hr < W && hy + hr > 0 && hy - hr < H;
          if (!onScreen) continue;
          const frac = inter(ov.box, x.head) / Math.max(1, area(x.head));
          if (frac > 0.55) {
            if (!waived('GE-16', r.name) && !seen.has(`${r.i}|GE-16-ERR|${ov.k}:${x.id}`)) {
              seen.add(`${r.i}|GE-16-ERR|${ov.k}:${x.id}`);
              err('GE-16', `#${r.i} '${r.name}': ${ov.k} '${ov.text}' covers ${Math.round(frac * 100)}% of ${x.id}'s head at ${t.toFixed(2)} s (> 55%)`);
              (hot[r.i] ??= []).push('GE-16');
            }
          } else if (frac > 0.20) {
            flag(r, 'GE-16', `${ov.k} '${ov.text}' covers ${Math.round(frac * 100)}% of ${x.id}'s head at ${t.toFixed(2)} s`, `${ov.k}:${x.id}`);
          }
        }
        for (const sg of g.signs) {
          if (!sg.screenBox) continue;
          const sfrac = inter(ov.box, sg.screenBox) / Math.max(1, area(sg.screenBox));
          if (sfrac > 0.15) {
            flag(r, 'GE-16', `${ov.k} '${ov.text}' covers ${Math.round(sfrac * 100)}% of sign '${sg.text}' at ${t.toFixed(2)} s`, `${ov.k}:sign:${sg.text}`);
          }
        }
      }
      if (u === 0.5) {
        for (const x of B) {
          const p = lastH[x.id];
          if (p && p.set === r.set && p.i === r.i - 1 && r.tr === 'cut') {
            const ratio = x.h / Math.max(1, p.h);
            if (ratio > 1.25 && ratio < 1.6) flag(r, 'GE-07', `${x.id} jumps ${ratio.toFixed(2)}× in size from #${p.i} in the same set — a jump cut that is neither a match nor a clear punch-in (make it ≥ 1.6× or ≤ 1.1×)`, x.id);
          }
          lastH[x.id] = {h: x.h, set: r.set, i: r.i};
        }
        // CA-06: 180-degree axis / eyeline continuity guard on consecutive cut shots in the same location/set
        const curDefActors = shots[r.i]?.actors ?? [];
        const curAxisActors = B
          .filter((x) => {
            if (x.fg || x.mountedOn) return false;
            const da = curDefActors.find((q) => q.id === x.id);
            if (da?.fg || da?.mount) return false;
            return x.all.x1 > 0 && x.all.x0 < W && x.all.y1 > 0 && x.all.y0 < H;
          })
          .map((x) => ({id: x.id, sx: x.hc.x, view: x.view}))
          .sort((a, b) => a.id.localeCompare(b.id));
        const curSetDef = P.SETS[r.set];
        const curLoc = typeof curSetDef?.location === 'string' && curSetDef.location.trim() ? curSetDef.location.trim() : null;
        if (prevAxis && prevAxis.i === r.i - 1 && r.tr === 'cut') {
          const sameLoc = (prevAxis.loc && curLoc) ? (prevAxis.loc === curLoc) : (prevAxis.set === r.set);
          if (sameLoc && !prevAxis.neutral && !isNeutralAxisAngle(curSetDef)
            && prevAxis.actors.length === 2 && curAxisActors.length === 2
            && prevAxis.actors[0].id === curAxisActors[0].id && prevAxis.actors[1].id === curAxisActors[1].id) {
            const [pA, pB] = prevAxis.actors;
            const [cA, cB] = curAxisActors;
            if (DIALOGUE_VIEWS.has(pA.view) && DIALOGUE_VIEWS.has(pB.view)
              && DIALOGUE_VIEWS.has(cA.view) && DIALOGUE_VIEWS.has(cB.view)
              && Math.abs(pA.sx - pB.sx) > 8 && Math.abs(cA.sx - cB.sx) > 8
              && (pA.sx < pB.sx) !== (cA.sx < cB.sx)) {
              flag(r, 'CA-06', `180° axis flip between #${prevAxis.i} and #${r.i}: ${cA.id} and ${cB.id} swapped left/right screen order without a neutral bridge shot`, `${cA.id}:${cB.id}`);
            }
          }
        }
        prevAxis = {i: r.i, set: r.set, loc: curLoc, neutral: isNeutralAxisAngle(curSetDef), actors: curAxisActors};
      }
    }
    // LA-03: per-shot scaleWithTinyActor anatomical ratio lock & tiny-set cross-angle sample collection
    {
      const rSetDef = P.SETS[r.set];
      const rSeg = shotSegOf(r, shotDef);
      const rSegNum = segNum(rSeg);
      const rSegMode = (rSeg && segScaleMode.get(rSeg)) ?? (Number.isFinite(rSegNum) ? segScaleMode.get(`s${rSegNum}`) : undefined);
      for (const {pr, subjDef, ratio} of la03SampleByProp.values()) {
        if (Array.isArray(subjDef.scaleWithTinyActor) && subjDef.scaleWithTinyActor.length === 2
          && rSetDef?.scaleMode !== 'normal' && rSegMode !== 'normal') {
          const [minR, maxR] = subjDef.scaleWithTinyActor;
          if ((ratio < minR || ratio > maxR) && !waived('LA-03', r.name) && !lineWaived(subjectsSrc, 'LA-03', pr.k)) {
            const baseKey = subjDef.partialOf ?? pr.k;
            err('LA-03', `#${r.i} '${r.name}': creature '${pr.k}' scale ratio ${ratio.toFixed(2)}x vs actor outside anatomical [${minR}, ${maxR}] — use a partial anatomy subject (${baseKey}Paw / ${baseKey}Head) for tight close-ups instead of shrinking a giant creature!`);
            markHot(r.i, 'LA-03');
          }
        }
        if (subjDef.kind === 'creature' && !subjDef.partialOf && rSetDef?.scaleMode === 'tiny'
          && !waived('LA-03', r.name) && !lineWaived(subjectsSrc, 'LA-03', pr.k)) {
          if (!tinyCreatureRatios.has(pr.k)) tinyCreatureRatios.set(pr.k, []);
          tinyCreatureRatios.get(pr.k).push({shotIdx: r.i, shotName: r.name, set: r.set, ratio});
        }
      }
    }
    for (const {samples, hits} of setSignOccByKey.values()) {
      const persistent = samples.size >= 2;
      for (const h of hits) {
        if (persistent || h.isStationary) {
          flag(r, 'GE-11', `${h.occ.kind} ${h.occ.id} covers ${Math.round(h.occ.frac * 100)}% of sign '${h.sgText}' at ${h.t.toFixed(2)} s`, `occ:${h.sgSource}:${h.sgText}:${h.occ.id}`, h.occ.kind !== 'prop');
        }
      }
    }
    layoutReport.push({
      i: r.i,
      name: r.name,
      set: r.set,
      shotScale: P.SETS[r.set]?.shotScale ?? null,
      choreoEvents: choreoByShot.get(r.i) ?? 0,
      gridLayout: worstGrid,
      scaleIssues: shotScaleIssues,
      creatureCutoffIssues: shotCutoffIssues,
      ...(waived('LA-01', r.name) ? {la01Waived: true} : {}),
      ...(waived('LA-02', r.name) ? {la02Waived: true} : {}),
    });
    if (r.reaches.length) (hot[r.i] ??= []).push('reach');
    if (r.keys.length) (hot[r.i] ??= []).push('key');
  }
  // LA-03: episode-wide cross-angle creature scale spread across tiny sets
  for (const [ck, samples] of tinyCreatureRatios) {
    if (samples.length < 2) continue;
    let minS = samples[0], maxS = samples[0], sum = 0;
    for (const sm of samples) {
      if (sm.ratio < minS.ratio) minS = sm;
      if (sm.ratio > maxS.ratio) maxS = sm;
      sum += sm.ratio;
    }
    const mean = sum / samples.length;
    const variance = samples.reduce((acc, sm) => acc + (sm.ratio - mean) * (sm.ratio - mean), 0) / samples.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    const spread = maxS.ratio / Math.max(0.01, minS.ratio);
    if (spread > 1.85) {
      err('LA-03', `inconsistent cross-angle creature scale across shots for '${ck}' on tiny sets: max/min ratio ${spread.toFixed(2)}x (${maxS.ratio.toFixed(2)}x in #${maxS.shotIdx} '${maxS.shotName}' vs ${minS.ratio.toFixed(2)}x in #${minS.shotIdx} '${minS.shotName}', CV=${(cv * 100).toFixed(1)}% > 1.85x) — use ${ck}Paw / ${ck}Head for tight close-ups instead of shrinking a giant creature!`);
      markHot(minS.shotIdx, 'LA-03');
      markHot(maxS.shotIdx, 'LA-03');
    }
  }
  const mergedStrips = [];
  const stripByName = new Map();
  for (const st of strips) {
    const prev = stripByName.get(st.name);
    if (prev) {
      prev.t0 = Math.round(Math.min(prev.t0, st.t0) * 100) / 100;
      prev.t1 = Math.round(Math.max(prev.t1, st.t1) * 100) / 100;
    } else {
      const copy = {...st};
      stripByName.set(copy.name, copy);
      mergedStrips.push(copy);
    }
  }
  strips.length = 0;
  strips.push(...mergedStrips);
  fs.mkdirSync('qa', {recursive: true});
  fs.writeFileSync('qa/hot.json', JSON.stringify(Object.fromEntries(Object.entries(hot).map(([k, v]) => [k, [...new Set(v)]])), null, 1));
  fs.writeFileSync('qa/strips_needed.json', JSON.stringify(strips, null, 1));
  fs.writeFileSync('qa/layout_report.json', JSON.stringify(layoutReport, null, 1));
}

Object.assign(report, {phase, at: new Date().toISOString(), errors, warns, sets: setReport, strips: strips.length});
fs.mkdirSync('qa', {recursive: true});
fs.writeFileSync('qa/lint.json', JSON.stringify(report, null, 1));
for (const s of setReport) console.log(`set ${s.id}: ${s.shapes} shapes · ${s.colours} colours · ${s.texts} texts · halftone ${s.halftone} · glow ${s.glow} · mid ${s.midItems} · ${s.moves ? "moves" : "STATIC"}`);
for (const w of warns) console.log('WARN ', w);
for (const e of errors) console.log('ERROR', e);
console.log(`lint ${phase}: ${errors.length} errors, ${warns.length} warnings${phase !== 'design' ? `, ${strips.length} motion strips required (qa/strips_needed.json)` : ''}`);
process.exit(errors.length ? 1 : 0);
