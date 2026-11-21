// Render the design evidence for gate G4 into qa/design/:
//   cast_episode_p<N>.png      every look in src/episode/cast.ts (front + 3/4 + back, role, description)
//   props_episode_p<N>.png     every custom episode WORLD_PROP next to 575 px adult + 435 px child ruler
//   subject_<id>.png           every hero subject in src/episode/subjects.tsx (poses, ruler, mount pins, exprs)
//   expr_<look>.png            per principal/support: 12 expressions, 6 poses, 6 3/4 physics poses, walk cycle, sitting
//   set_<id>.png / _grid.png   every episode set (clean plate + world/thirds/depth/scale layout grid)
//   every sheet also gets a light <name>_v.jpg to LOOK at (≤ 1600 px, JPEG); every set plate a set_<id>_zoom.jpg
//   (3×3 full-resolution ninths); `--changed` re-renders only changed sheets; `--status` lists stale sheets (G4)
//   --exemplar                 also render the exemplar cast + ex-* plates for side-by-side comparison
// Usage: node scripts/design.mjs [--exemplar] [--only set:<id>|look:<key>|subject:<id>|subjects|props]
import {cachedBundle} from './bundle_cache.mjs';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {loadProject} from './load.mjs';
import {measurePropBox, measureHandPropBox} from './geom.mjs';

const args = process.argv.slice(2);
const PY = process.env.SV_PYTHON || (fs.existsSync('/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python') ? '/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python' : 'python3');
const withEx = args.includes('--exemplar');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
// --changed: render only sheets whose inputs changed since the last run (qa/design/cache.json); default renders all
const CHANGED = args.includes('--changed');
const P = await loadProject();
const castKeys = Object.keys(P.CAST);
const setIds = Object.keys(P.EPISODE_SETS);
const subjectKeys = Object.keys(P.SUBJECTS ?? {});
const BUILTIN_PROPS = new Set(['stool', 'cone', 'lamp', 'gladiolus', 'cat', 'chicken', 'xoi', 'lobster', 'wagyu', 'tofu']);
const propKeys = Object.keys(P.WORLD_PROPS ?? {}).filter((k) => !BUILTIN_PROPS.has(k));
fs.mkdirSync('qa/design', {recursive: true});

let serveUrl, browser; // opened only when something has to be rendered
const still = async (id, props, out) => {
  const o = {serveUrl, inputProps: props, puppeteerInstance: browser, chromiumOptions: {gl: 'angle'}, timeoutInMilliseconds: 120000};
  const comp = await selectComposition({...o, id});
  await renderStill({...o, composition: comp, frame: 0, output: out, imageFormat: 'png'});
  console.log('ok', out);
};
// a light view copy next to every sheet (<name>_v.jpg, long side ≤ 1600, ≈100–400 KB): open THAT one to review;
// the PNG stays the master for plate_check.py and for zoomed crops
const view = (outs) => outs.length && execFileSync(PY, ['-c', `
import sys
from PIL import Image
for p in sys.argv[1:]:
    im = Image.open(p).convert("RGB"); m = max(im.size)
    if m > 1600: im = im.resize((round(im.size[0]*1600/m), round(im.size[1]*1600/m)), Image.LANCZOS)
    im.save(p[:-4] + "_v.jpg", quality=72, optimize=True)
    n = p.split("/")[-1]
    if n.startswith("set_") and not n.endswith("_grid.png"):
        # 3x3 zoom: each ninth of the plate at full resolution, to judge detail, text and edges, not just layout
        big = Image.open(p).convert("RGB"); w, h = big.size; cw, chh = w // 3, h // 3; s = 360 / cw
        z = Image.new("RGB", (3 * 360 + 8, 3 * round(chh * s) + 8), (14, 20, 52))
        for r in range(3):
            for c in range(3):
                z.paste(big.crop((c * cw, r * chh, (c + 1) * cw, (r + 1) * chh)).resize((360, round(chh * s)), Image.LANCZOS), (c * 362 + 2, r * (round(chh * s) + 2) + 2))
        z.save(p[:-4] + "_zoom.jpg", quality=74, optimize=True)
`, ...outs], {stdio: 'inherit'});
const sha = (x) => crypto.createHash('sha1').update(x).digest('hex').slice(0, 12);
const walk = (d) => fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
// every source kind the renders read (a .css/.svg/.mjs or a public/ image changed the picture but used to say "unchanged")
const SRC_RE = /\.(tsx?|jsx?|mjs|json|css|svg)$/;
const readAll = (fs_) => fs_.sort().map((f) => f + fs.readFileSync(f, 'utf8')).join('\n');
const shared = sha(readAll(walk('src').filter((f) => SRC_RE.test(f) && !/episode[\\/](shotlist|sets)/.test(f) && !/src[\\/](sets|data)[\\/]/.test(f)))
  + (fs.existsSync('public') ? walk('public').filter((f) => /\.(png|jpe?g|webp|svg)$/.test(f)).sort().map((f) => f + fs.statSync(f).size + ':' + fs.statSync(f).mtimeMs).join('\n') : ''));
// a set plate is drawn by its render() AND the helpers beside it: hash the whole set source, not String(render)
const setSrc = sha(readAll([...(fs.existsSync('src/sets') ? walk('src/sets') : []), ...(fs.existsSync('src/episode') ? walk('src/episode') : []).filter((f) => /episode[\\/]sets/.test(f))].filter((f) => SRC_RE.test(f))));
const jobKey = ([id, props]) => sha(
  shared + id + JSON.stringify(props)
  + (id === 'SetPlate' && props.id ? setSrc + String(P.SETS[props.id]?.render) : '')
  + (id === 'SubjectSheet' && props.id ? String(P.SUBJECTS?.[props.id]?.render) : ''),
);
const CACHE = 'qa/design/cache.json';
const cache = (() => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; } })();

const jobs = [];
if (!only) {
  const pages = Math.max(1, Math.ceil(castKeys.length / 10));
  for (let p = 0; p < pages; p++) jobs.push(['CastSheet', {which: 'episode', page: p}, `qa/design/cast_episode_p${p + 1}.png`]);
}
if ((!only || only === 'props') && propKeys.length) {
  const sizes = {};
  for (const k of propKeys) {
    try {
      const b = measurePropBox(k, P);
      sizes[k] = {w: Math.round(b.width), h: Math.round(b.height), minX: Math.round(b.minX), minY: Math.round(b.minY), maxX: Math.round(b.maxX), maxY: Math.round(b.maxY)};
    } catch {}
  }
  const pPages = Math.ceil(propKeys.length / 6);
  for (let p = 0; p < pPages; p++) {
    const pageSizes = Object.fromEntries(propKeys.slice(p * 6, (p + 1) * 6).map((k) => [k, sizes[k]]).filter(([, v]) => v));
    jobs.push(['PropSheet', {page: p, sizes: pageSizes}, `qa/design/props_episode_p${p + 1}.png`]);
  }
}
const subjectPoseSizes = {};
for (const id of subjectKeys) {
  const def = P.SUBJECTS[id];
  const sizes = {};
  for (const pose of def?.poses ?? []) {
    try {
      const b = measurePropBox((_, t) => def.render(pose, {t, expr: def.exprs?.[0]}), P);
      sizes[pose] = {w: Math.round(b.width), h: Math.round(b.height), minX: Math.round(b.minX), minY: Math.round(b.minY), maxX: Math.round(b.maxX), maxY: Math.round(b.maxY)};
    } catch {}
  }
  subjectPoseSizes[id] = sizes;
  if (!only || only === 'subject:' + id || only === 'subjects') {
    jobs.push(['SubjectSheet', {id, sizes}, `qa/design/subject_${id}.png`]);
  }
}
for (const k of castKeys) {
  const role = P.CAST_ROLES[k]?.role;
  if ((!only && role !== 'extra') || only === 'look:' + k) jobs.push(['ExprSheet', {look: k}, `qa/design/expr_${k}.png`]);
}
for (const id of setIds) {
  if (only && only !== 'set:' + id) continue;
  jobs.push(['SetPlate', {id, grid: false}, `qa/design/set_${id}.png`]);
  jobs.push(['SetPlate', {id, grid: true}, `qa/design/set_${id}_grid.png`]);
}
if (withEx) {
  const exKeys = Object.keys(P.EX_LOOKS);
  for (let p = 0; p < Math.ceil(exKeys.length / 10); p++) jobs.push(['CastSheet', {which: 'exemplar', page: p}, `qa/design/cast_exemplar_p${p + 1}.png`]);
  jobs.push(['ExprSheet', {look: 'ex_baHanh'}, 'qa/design/expr_ex_baHanh.png']);
  for (const id of Object.keys(P.EXEMPLAR_SETS)) jobs.push(['SetPlate', {id, grid: false}, `qa/design/set_${id}.png`]);
}
const todo = jobs.filter((j) => !(CHANGED && cache[j[2]] === jobKey(j) && fs.existsSync(j[2])));
if (args.includes('--status')) { // no browser: which sheets no longer match the source (sv_gate.py G4)
  const stale = jobs.filter((j) => cache[j[2]] !== jobKey(j) || !fs.existsSync(j[2])).map((j) => j[2]);
  console.log(JSON.stringify({stale}));
  process.exit(0);
}
{
  const is16x9 = (() => {
    try {
      const s = JSON.parse(fs.readFileSync('script.json', 'utf8'));
      return s?.format === '16:9' || s?.length === 'long_16x9';
    } catch {
      return false;
    }
  })();
  const traitsOf = (l) => [l.glasses, l.hat && l.hat !== 'none', l.mustache, l.beard, l.pattern, l.earrings, l.chain, l.vest, l.lips,
    (l.belly ?? 0) > 0.05, Math.abs((l.w ?? 1) - 1) > 0.04, Math.abs((l.h ?? 1) - 1) > 0.04, Math.abs((l.head ?? 1) - 1) > 0.03,
    l.hairC && l.hairC !== 'hair', l.topC2].filter(Boolean).length;
  const BUILTIN_HAND_PROPS = new Set(['clip', 'phone', 'book', 'money', 'env', 'trash', 'noodle', 'wrench', 'incense', 'seeds', 'paper', 'pen', 'coin', 'card', 'cup', 'bag', 'box', 'key', 'cane']);
  const castSpec = Object.fromEntries(castKeys.map((k) => {
    const l = P.CAST[k];
    return [k, {role: P.CAST_ROLES[k]?.role ?? null, h: l.h ?? 1, w: l.w ?? 1, head: l.head ?? 1, traits: traitsOf(l)}];
  }));
  const setsSpec = Object.fromEntries(setIds.map((id) => {
    const d = P.EPISODE_SETS[id];
    return [id, {
      title: d.title ?? null,
      bed: d.bed ?? null,
      bounds: d.bounds ?? null,
      plateCam: d.plateCam ?? (is16x9 ? [960, 540, 1] : [540, 1150, 1]),
      location: d.location ?? null,
      shotScale: d.shotScale ?? null,
      angle: d.angle ?? null,
      actorScale: d.actorScale ?? null,
      zones: d.zones ?? null,
    }];
  }));
  const subjectsSpec = Object.fromEntries(subjectKeys.map((id) => {
    const d = P.SUBJECTS[id];
    const seatsCount = Object.values(d.seats ?? {}).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
    return [id, {
      title: d.title ?? null,
      kind: d.kind ?? null,
      relToActor: d.relToActor ?? null,
      poses: d.poses ?? [],
      exprs: d.exprs ?? [],
      seatsCount,
      poseBoxes: subjectPoseSizes[id] ?? {},
    }];
  }));
  const worldPropsSpec = {};
  for (const k of propKeys) {
    try {
      const b = measurePropBox(k, P);
      worldPropsSpec[k] = {w: Math.round(b.width), h: Math.round(b.height), minX: Math.round(b.minX), minY: Math.round(b.minY), maxX: Math.round(b.maxX), maxY: Math.round(b.maxY)};
    } catch {}
  }
  const handPropsSpec = {};
  for (const k of Object.keys(P.HAND_PROPS ?? {})) {
    if (BUILTIN_HAND_PROPS.has(k)) continue;
    try {
      const b = measureHandPropBox(k, P);
      handPropsSpec[k] = {w: Math.round(b.width), h: Math.round(b.height), minX: Math.round(b.minX), minY: Math.round(b.minY), maxX: Math.round(b.maxX), maxY: Math.round(b.maxY), gripDist: Math.round(b.gripDist)};
    } catch {}
  }
  fs.writeFileSync('qa/design/visual_spec.json', JSON.stringify({cast: castSpec, sets: setsSpec, subjects: subjectsSpec, world_props: worldPropsSpec, hand_props: handPropsSpec}, null, 2));
}
if (todo.length) { serveUrl = await cachedBundle('src/index.ts'); browser = await openBrowser('chrome', {chromiumOptions: {gl: 'angle'}}); }
let k = 0;
const N = Math.max(1, +(process.env.SV_QA_WORKERS ?? Math.min(6, Math.max(4, Math.floor(os.cpus().length / 2)))));
const worker = async () => { while (k < todo.length) { const j = todo[k++]; await still(...j); cache[j[2]] = jobKey(j); } };
// keep the previous sheet of every job: a re-render with the same picture keeps the old file time, so sv_gate
// G4 ("X is newer than G4.review.md") asks to look again only at sheets that really changed
fs.mkdirSync('qa/design/_prev', {recursive: true});
for (const j of todo) if (fs.existsSync(j[2])) fs.cpSync(j[2], 'qa/design/_prev/' + path.basename(j[2]), {preserveTimestamps: true});
try { await Promise.all(Array.from({length: Math.min(N, todo.length)}, worker)); }
finally { fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1)); await browser?.close({silent: true}).catch(() => {}); }
const same = new Set(todo.length ? JSON.parse(execFileSync(PY, ['-c', `
import sys, os, json
import numpy as np
from PIL import Image
out = []
for p in sys.argv[1:]:
    q = os.path.join("qa/design/_prev", os.path.basename(p))
    if not os.path.exists(q): continue
    a = np.asarray(Image.open(q).convert("L"), dtype=np.int16); b = np.asarray(Image.open(p).convert("L"), dtype=np.int16)
    if a.shape == b.shape and int((np.abs(a - b) > 24).sum()) <= 20:
        st = os.stat(q); os.utime(p, (st.st_atime, st.st_mtime)); out.append(p)
    os.remove(q)
print(json.dumps(out))
`, ...todo.map((j) => j[2])]).toString()) : []);
if (same.size) console.log(`design: ${same.size} sheet(s) re-rendered with the same picture — time kept`);
view(todo.map((j) => j[2]).filter((o) => !same.has(o) || !fs.existsSync(o.slice(0, -4) + '_v.jpg')));
console.log(`design: ${todo.length} rendered, ${jobs.length - todo.length} unchanged`);
// visible-detail measure of every clean plate (lint SE-13 reads qa/design/plate_stats.json)
const plates = jobs.filter(([id, props]) => id === 'SetPlate' && !props.grid && !P.SETS[props.id]?.insert).map(([, , out]) => out);
if (plates.length) execFileSync(PY, ['scripts/plate_check.py', ...plates], {stdio: 'inherit'});
if (!jobs.length) console.log('nothing to render (cast and sets are empty)');
