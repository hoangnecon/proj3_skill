// Visual QA evidence (gate G5). Renders frames of the Film composition and tiles them with labels.
//   node scripts/qa.mjs contact            -> qa/contact_p<N>.png  : every shot at 25 % and 75 % of its length
//   node scripts/qa.mjs strips [name,...]  -> qa/strips/<name>.png : every motion strip in qa/strips_needed.json
//   node scripts/qa.mjs frames 12.5,13.0   -> qa/frames/t<sec>.png : single frames at absolute seconds
//   node scripts/qa.mjs shot 7             -> qa/shots/07.png      : 6 frames across shot #7 (for a fix loop)
// Run `node scripts/lint.mjs` first (it writes qa/strips_needed.json and qa/shots.json is refreshed here).
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {loadProject} from './load.mjs';

const [mode = 'contact', arg] = process.argv.slice(2);
const P = await loadProject();
const rows = P.shotTable();
fs.mkdirSync('qa/_f', {recursive: true});
fs.writeFileSync('qa/shots.json', JSON.stringify(rows, null, 1));

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const comp = await selectComposition({serveUrl, id: 'Film', chromiumOptions: {gl: 'angle'}});
const frameAt = async (t, out) => {
  const f = Math.max(0, Math.min(comp.durationInFrames - 1, Math.round(t * 30)));
  await renderStill({serveUrl, composition: comp, frame: f, output: out, chromiumOptions: {gl: 'angle'}, imageFormat: 'jpeg', jpegQuality: 82});
  return out;
};
const tile = (spec) => {
  const j = 'qa/_f/tile.json';
  fs.writeFileSync(j, JSON.stringify(spec));
  execFileSync('python3', [path.resolve('scripts/tile.py'), j], {stdio: 'inherit'});
};
const fmt = (t) => t.toFixed(2) + 's';

if (mode === 'contact') {
  const cells = [];
  for (const r of rows) {
    for (const u of [0.25, 0.75]) {
      const t = r.t0 + (r.t1 - r.t0) * u;
      cells.push({img: await frameAt(t, `qa/_f/c${r.i}_${u}.jpg`), label: `#${r.i} ${u === 0.25 ? 'a' : 'b'} · ${fmt(t)}`, sub: u === 0.25 ? r.name : `${r.set} · ${fmt(r.t1 - r.t0)}`});
    }
    process.stdout.write(`\r${r.i + 1}/${rows.length}`);
  }
  const per = 24; // 12 shots per page, 2 frames each
  for (let p = 0; p * per < cells.length; p++) tile({out: `qa/contact_p${p + 1}.png`, cols: 6, w: 300, title: `CONTACT · trang ${p + 1} · ${rows.length} shot · ${fmt(P.DURATION)}`, cells: cells.slice(p * per, (p + 1) * per)});
  console.log(`\ncontact sheets: ${Math.ceil(cells.length / per)} page(s)`);
} else if (mode === 'strips') {
  const need = JSON.parse(fs.readFileSync('qa/strips_needed.json', 'utf8'));
  const only = arg ? arg.split(',') : null;
  fs.mkdirSync('qa/strips', {recursive: true});
  for (const s of need) {
    if (only && !only.includes(s.name)) continue;
    const cells = [];
    for (let i = 0; i < s.n; i++) {
      const t = s.t0 + ((s.t1 - s.t0) * i) / (s.n - 1);
      cells.push({img: await frameAt(t, `qa/_f/${s.name}_${i}.jpg`), label: fmt(t), sub: i === 0 ? s.why : ''});
    }
    tile({out: `qa/strips/${s.name}.png`, cols: s.n, w: 270, title: `${s.name} · ${s.why} · ${fmt(s.t0)}–${fmt(s.t1)}`, cells});
    console.log('ok', s.name);
  }
} else if (mode === 'frames') {
  fs.mkdirSync('qa/frames', {recursive: true});
  for (const t of arg.split(',').map(Number)) {
    await renderStill({serveUrl, composition: comp, frame: Math.round(t * 30), output: `qa/frames/t${t.toFixed(2)}.png`, chromiumOptions: {gl: 'angle'}, imageFormat: 'png'});
    console.log('ok', t);
  }
} else if (mode === 'shot') {
  const r = rows[+arg];
  fs.mkdirSync('qa/shots', {recursive: true});
  const cells = [];
  for (let i = 0; i < 6; i++) {
    const t = r.t0 + 0.02 + ((r.t1 - r.t0 - 0.04) * i) / 5;
    cells.push({img: await frameAt(t, `qa/_f/s${r.i}_${i}.jpg`), label: fmt(t), sub: ''});
  }
  tile({out: `qa/shots/${String(r.i).padStart(2, '0')}.png`, cols: 6, w: 300, title: `#${r.i} ${r.name} · ${r.set}`, cells});
  console.log('ok', r.i);
} else {
  console.log('modes: contact | strips [names] | frames t1,t2 | shot <i>');
  process.exit(1);
}
