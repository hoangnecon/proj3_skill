// Render the design evidence for gate G4 into qa/design/:
//   cast_episode_p<N>.png      every look in src/episode/cast.ts (front + side, role, description)
//   expr_<look>.png            per principal/support: 12 expressions, 6 poses, walk cycle, sitting
//   set_<id>.png / _grid.png   every episode set (clean plate + world-coordinate grid)
//   every sheet also gets a light <name>_v.jpg to LOOK at (≤ 1600 px, JPEG); every set plate a set_<id>_zoom.jpg
//   (3×3 full-resolution ninths); `--changed` re-renders only changed sheets; `--status` lists stale sheets (G4)
//   --exemplar                 also render the exemplar cast + ex-* plates for side-by-side comparison
// Usage: node scripts/design.mjs [--exemplar] [--only set:<id>|look:<key>]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {loadProject} from './load.mjs';

const args = process.argv.slice(2);
const withEx = args.includes('--exemplar');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
// --changed: render only sheets whose inputs changed since the last run (qa/design/cache.json); default renders all
const CHANGED = args.includes('--changed');
const P = await loadProject();
const castKeys = Object.keys(P.CAST);
const setIds = Object.keys(P.EPISODE_SETS);
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
const view = (outs) => outs.length && execFileSync('python3', ['-c', `
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
const shared = sha(walk('src').filter((f) => /\.(tsx?|json)$/.test(f) && !/episode[\\/](shotlist|sets)/.test(f) && !/src[\\/]sets[\\/]/.test(f)).sort().map((f) => f + fs.readFileSync(f, 'utf8')).join('\n'));
const jobKey = ([id, props]) => sha(shared + id + JSON.stringify(props) + (props.id ? String(P.SETS[props.id]?.render) : ''));
const CACHE = 'qa/design/cache.json';
const cache = (() => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; } })();

const jobs = [];
if (!only) {
  const pages = Math.max(1, Math.ceil(castKeys.length / 10));
  for (let p = 0; p < pages; p++) jobs.push(['CastSheet', {which: 'episode', page: p}, `qa/design/cast_episode_p${p + 1}.png`]);
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
if (todo.length) { serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')}); browser = await openBrowser('chrome', {chromiumOptions: {gl: 'angle'}}); }
let k = 0;
const N = Math.max(1, +(process.env.SV_QA_WORKERS ?? 4));
const worker = async () => { while (k < todo.length) { const j = todo[k++]; await still(...j); cache[j[2]] = jobKey(j); } };
try { await Promise.all(Array.from({length: Math.min(N, todo.length)}, worker)); }
finally { fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1)); await browser?.close({silent: true}).catch(() => {}); }
view(todo.map((j) => j[2]));
console.log(`design: ${todo.length} rendered, ${jobs.length - todo.length} unchanged`);
// visible-detail measure of every clean plate (lint SE-13 reads qa/design/plate_stats.json)
const plates = jobs.filter(([id, props]) => id === 'SetPlate' && !props.grid && !P.SETS[props.id]?.insert).map(([, , out]) => out);
if (plates.length) execFileSync('python3', ['scripts/plate_check.py', ...plates], {stdio: 'inherit'});
if (!jobs.length) console.log('nothing to render (cast and sets are empty)');
