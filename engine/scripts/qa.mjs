// Visual QA evidence (gate G5). Renders frames of the Film composition and tiles them into LIGHT JPEG sheets
// (each ≤ ~1 MB, usually 100–400 KB) so a reviewer can open many of them cheaply.
//   node scripts/qa.mjs contact [--all]    -> qa/contact_p<N>.jpg : every shot at 25 % and 75 % (full frame)
//   node scripts/qa.mjs strips [names] [--all] -> qa/strips/<name>.jpg : motion strips from qa/strips_needed.json,
//                                             full frames in a 2-row grid (≤ 4 per row)
//   node scripts/qa.mjs frames 12.5,13.0   -> qa/frames/t<sec>.jpg : single full-size frames at absolute seconds
//   node scripts/qa.mjs cards [changed|hot|all|3,7]  -> qa/cards/NN.jpg : review card per shot (3 frames + beat words + flags)
//   node scripts/qa.mjs crops 7            -> qa/crops/07.jpg      : measurement crops (head/hands/feet/overlap, 1:1+)
//   node scripts/qa.mjs status             -> qa/qa_status.json   : shots/strips whose evidence is stale (no render)
//   (after `cards changed`: python3 scripts/carry.py keeps the reviews of shots whose picture did not change)
//   node scripts/qa.mjs adopt              -> once, episode reviewed under v3.6: snapshot reviewed card frames (no render)
//   node scripts/qa.mjs shot 7             -> qa/shots/07.jpg      : 6 frames across shot #7 (the fix loop)
// Speed: ONE shared browser, a pool of parallel workers (SV_QA_WORKERS, default 4), QA frames at half size.
// Incremental: each shot has a hash of what it draws (scripts/deps.mjs: its row + definition, the engine, and the
// set / props / looks / helpers it reaches, plus the words spoken near it).
// Frames of unchanged shots are reused from qa/_f; `--all` forces everything. The shots whose hash changed since
// the last contact run are written to qa/changed.json — review those first.
// Only one render at a time per episode (qa/.render.lock).
// Run `node scripts/lint.mjs` first (it writes qa/strips_needed.json; qa/shots.json is refreshed here).
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {loadProject, writeTables} from './load.mjs';
import {actorBoxes, inter, area} from './geom.mjs';
import {makeShotHash} from './deps.mjs';

const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const [mode = 'contact', arg] = argv.filter((a) => !a.startsWith('--'));
const WORKERS = Math.max(1, +(process.env.SV_QA_WORKERS ?? 4));
const SCALE = +(process.env.SV_QA_SCALE ?? 0.5);

// ---- lock: two renders of the same episode at once only fight for CPU and overwrite each other's frames
fs.mkdirSync('qa/_f', {recursive: true});
const LOCK = 'qa/.render.lock';
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
if (fs.existsSync(LOCK)) {
  const pid = +fs.readFileSync(LOCK, 'utf8');
  if (pid && pid !== process.pid && alive(pid)) { console.error(`another QA render is running (pid ${pid}) — wait for it`); process.exit(2); }
}
fs.writeFileSync(LOCK, String(process.pid));
const unlock = () => { try { if (+fs.readFileSync(LOCK, 'utf8') === process.pid) fs.unlinkSync(LOCK); } catch {} };
process.on('exit', unlock);
process.on('SIGINT', () => process.exit(130));

const P = await loadProject();
const rows = P.shotTable();
writeTables(fs, rows);

// ---- per-shot hash
const pad = (i) => String(i).padStart(2, '0');
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const walk = (d) => fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
// v3.7: dependency-scoped (scripts/deps.mjs) — a shot is stale only when something it draws changed
const DEPS = makeShotHash(rows, P.SHOTS);
const shotHash = (r) => DEPS.hashOf(r);
const CACHE = 'qa/cache.json';
const cache = (() => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; } })();
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
const hashes = Object.fromEntries(rows.map((r) => [r.i, shotHash(r)]));
const shotOf = (s) => rows.find((r) => s.t0 >= r.t0 - 0.01 && s.t0 < r.t1) ?? rows[0];
const stripKey = (s) => sha(hashes[shotOf(s).i] + JSON.stringify(s));

// status: no browser — which evidence no longer matches the source (sv_gate.py G5 runs this)
if (mode === 'status') {
  const need = fs.existsSync('qa/strips_needed.json') ? JSON.parse(fs.readFileSync('qa/strips_needed.json', 'utf8')) : [];
  const out = {
    contact_stale: rows.filter((r) => cache.contact?.[r.i] !== hashes[r.i] || !fs.existsSync(`qa/_f/c${r.i}_0.25.jpg`)).map((r) => r.i),
    cards_stale: rows.filter((r) => cache.cards?.[r.i] !== hashes[r.i]).map((r) => r.i),
    crops_ok: Object.fromEntries(rows.map((r) => [r.i, cache.crops?.[r.i] === hashes[r.i] && fs.existsSync(`qa/crops/${pad(r.i)}.jpg`)])),
    strips_stale: need.filter((s) => cache.strips?.[s.name] !== stripKey(s) || !fs.existsSync(`qa/strips/${s.name}.jpg`)).map((s) => s.name),
    hashes,
  };
  fs.writeFileSync('qa/qa_status.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify({contact_stale: out.contact_stale, strips_stale: out.strips_stale}));
  process.exit(0);
}

// adopt (once, when an episode reviewed under v3.6 moves to v3.7; no browser): the v3.6 hash cannot be carried
// by itself, so snapshot the card frames each review actually saw (qa/_f/k<i>_<n>.jpg, still on disk) under the
// reviewed hash. Only when the v3.6 hash of the shot NOW equals the reviewed one (nothing it hashed changed since)
// and the cards were rendered for that hash. Then: cards all -> carry.py keeps every review whose card frames are
// the same picture. Run it BEFORE the first v3.7 `cards` (which overwrites qa/_f/k*).
if (mode === 'adopt') {
  const legacy = DEPS.legacyHashOf(P);
  fs.mkdirSync('qa/snap', {recursive: true});
  let n = 0; const skip = [];
  for (const r of rows) {
    const rp = `qa/review/${pad(r.i)}.json`;
    if (!fs.existsSync(rp)) { skip.push([r.i, 'no review']); continue; }
    const rv = JSON.parse(fs.readFileSync(rp, 'utf8'));
    const fr = [0, 1, 2].map((k) => `qa/_f/k${r.i}_${k}.jpg`);
    const why = rv.verdict !== 'ok' ? 'review not ok' : rv.hash === hashes[r.i] ? null
      : legacy(r) !== rv.hash ? 'changed since the review (v3.6 hash differs)'
      : cache.cards?.[r.i] !== rv.hash ? 'card was not rendered for the reviewed hash'
      : !fr.every((f) => fs.existsSync(f)) ? 'card frames gone' : 'ok';
    if (why !== 'ok') { if (why) skip.push([r.i, why]); continue; }
    fr.forEach((f, k) => fs.copyFileSync(f, `qa/snap/${rv.hash}_${k}.jpg`));
    const words = (P.WORDS ?? []).filter((w) => w.s >= r.t0 - 0.05 && w.s < r.t1).map((w) => w.w).join(' ');
    fs.writeFileSync(`qa/snap/${rv.hash}.json`, JSON.stringify({shot: r.i, legacy: true, words, t0: r.t0, t1: r.t1}));
    n++;
  }
  console.log(`adopt: ${n} reviewed card(s) snapshotted · ${skip.length} not: ${JSON.stringify(skip.slice(0, 12))}`);
  console.log('next: node scripts/qa.mjs cards all && python3 scripts/carry.py');
  process.exit(0);
}

// ---- one browser, N workers
const t00 = Date.now();
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browser = await openBrowser('chrome', {chromiumOptions: {gl: 'angle'}});
const comp = await selectComposition({serveUrl, id: 'Film', puppeteerInstance: browser, chromiumOptions: {gl: 'angle'}, timeoutInMilliseconds: 120000});
const clampF = (t) => Math.max(0, Math.min(comp.durationInFrames - 1, Math.round(t * 30)));
const still = (t, out, scale = SCALE, q = 80) => renderStill({
  serveUrl, composition: comp, frame: clampF(t), output: out, puppeteerInstance: browser, scale,
  chromiumOptions: {gl: 'angle'}, imageFormat: 'jpeg', jpegQuality: q, timeoutInMilliseconds: 120000,
});
/** jobs: [{t, out}] — rendered by WORKERS in parallel; existing outputs are kept when reuse(job) is true */
const renderAll = async (jobs, reuse = () => false) => {
  const todo = jobs.filter((j) => !(reuse(j) && fs.existsSync(j.out)));
  let k = 0, done = 0;
  const worker = async () => { while (k < todo.length) { const j = todo[k++]; await still(j.t, j.out, j.scale ?? SCALE, j.q ?? 80); done++; process.stdout.write(`\r  ${done}/${todo.length} frame(s)`); } };
  await Promise.all(Array.from({length: Math.min(WORKERS, todo.length)}, worker));
  if (todo.length) process.stdout.write('\n');
  return {rendered: todo.length, reused: jobs.length - todo.length};
};
const tile = (spec) => {
  const j = 'qa/_f/tile.json';
  fs.writeFileSync(j, JSON.stringify({q: 70, ...spec}));
  execFileSync('python3', [path.resolve('scripts/tile.py'), j], {stdio: 'inherit'});
};
const fmt = (t) => t.toFixed(2) + 's';

try {
  if (mode === 'contact') {
    const changed = rows.filter((r) => cache.contact?.[r.i] !== hashes[r.i]).map((r) => r.i);
    const jobs = rows.flatMap((r) => [0.25, 0.75].map((u) => ({r, u, t: r.t0 + (r.t1 - r.t0) * u, out: `qa/_f/c${r.i}_${u}.jpg`})));
    const st = await renderAll(jobs, (j) => !ALL && !changed.includes(j.r.i));
    // ● = no ok review for this version of the shot (stable between runs, so an unchanged page keeps its time)
    const unreviewed = new Set(rows.filter((r) => { try { const v = JSON.parse(fs.readFileSync(`qa/review/${pad(r.i)}.json`, 'utf8')); return v.verdict !== 'ok' || v.hash !== hashes[r.i]; } catch { return true; } }).map((r) => r.i));
    const cells = jobs.map(({r, u, t, out}) => ({img: out, label: `#${r.i} ${u === 0.25 ? 'a' : 'b'} · ${fmt(t)}${unreviewed.has(r.i) ? ' ●' : ''}`, sub: u === 0.25 ? r.name : `${r.set} · ${fmt(r.t1 - r.t0)}`}));
    const per = 24; // 12 shots per page, 2 frames each
    // drop only pages past the new last one (tile.py keeps the time of a page whose picture did not change)
    for (const f of fs.readdirSync('qa')) { const m = /^contact_p(\d+)\.(png|jpg)$/.exec(f); if (m && (m[2] === 'png' || +m[1] > Math.ceil(cells.length / per))) fs.unlinkSync(path.join('qa', f)); }
    for (let p = 0; p * per < cells.length; p++) tile({out: `qa/contact_p${p + 1}.jpg`, cols: 6, w: 300, title: `CONTACT · trang ${p + 1} · ${rows.length} shot · ${fmt(P.DURATION)} · ● = chưa review ở bản này`, cells: cells.slice(p * per, (p + 1) * per)});
    cache.contact = {...hashes};
    fs.writeFileSync('qa/changed.json', JSON.stringify({at: new Date().toISOString(), shots: changed, all: rows.length}, null, 1));
    console.log(`contact: ${Math.ceil(cells.length / per)} page(s) · ${st.rendered} rendered, ${st.reused} reused · changed shots: ${changed.join(',') || 'none'} · ${((Date.now() - t00) / 1000).toFixed(0)} s`);
  } else if (mode === 'strips') {
    const need = JSON.parse(fs.readFileSync('qa/strips_needed.json', 'utf8'));
    const only = arg ? arg.split(',') : null;
    fs.mkdirSync('qa/strips', {recursive: true});
    cache.strips ??= {};
    const sel = need.filter((s) => !only || only.includes(s.name));
        const jobs = sel.flatMap((s) => Array.from({length: s.n}, (_, i) => ({s, i, t: s.t0 + ((s.t1 - s.t0) * i) / (s.n - 1), out: `qa/_f/${s.name}_${i}.jpg`})));
    const st = await renderAll(jobs, (j) => !ALL && cache.strips[j.s.name] === stripKey(j.s) && fs.existsSync(`qa/strips/${j.s.name}.jpg`));
    for (const s of sel) {
      const cells = jobs.filter((j) => j.s === s).map((j) => ({img: j.out, label: fmt(j.t), sub: j.i === 0 ? s.why : ''}));
      const cols = s.n <= 4 ? s.n : Math.ceil(s.n / 2);
      tile({out: `qa/strips/${s.name}.jpg`, cols, w: 270, title: `${s.name} · ${s.why} · ${fmt(s.t0)}–${fmt(s.t1)}`, cells});
      try { fs.unlinkSync(`qa/strips/${s.name}.png`); } catch {}
      cache.strips[s.name] = stripKey(s);
    }
    console.log(`strips: ${sel.length} · ${st.rendered} frames rendered, ${st.reused} reused · ${((Date.now() - t00) / 1000).toFixed(0)} s`);
  } else if (mode === 'cards') {
    // one light card per shot for the per-shot reviewer: 3 frames, the words spoken over it, its lint flags
    const hot = fs.existsSync('qa/hot.json') ? JSON.parse(fs.readFileSync('qa/hot.json', 'utf8')) : {};
    const ch = fs.existsSync('qa/changed.json') ? JSON.parse(fs.readFileSync('qa/changed.json', 'utf8')).shots : rows.map((x) => x.i);
    const sel = !arg || arg === 'all' ? rows : arg === 'changed' ? rows.filter((x) => ch.includes(x.i)) : arg === 'hot' ? rows.filter((x) => hot[x.i])
      : rows.filter((x) => arg.split(',').map(Number).includes(x.i));
    fs.mkdirSync('qa/cards', {recursive: true});
    const jobs = sel.flatMap((x) => [0.15, 0.5, 0.85].map((u, n) => ({x, n, t: x.t0 + (x.t1 - x.t0) * u, out: `qa/_f/k${x.i}_${n}.jpg`})));
    cache.cards ??= {};
    await renderAll(jobs, (j) => !ALL && cache.cards[j.x.i] === hashes[j.x.i]);
    // probe frames (never shown): every ~0.2 s at quarter size, so carry.py also sees a change that falls
    // between the 3 card frames
    const probes = sel.flatMap((x) => { const n = Math.max(6, Math.min(16, Math.ceil((x.t1 - x.t0) / 0.2)));
      return Array.from({length: n}, (_, k) => ({x, k, n, t: x.t0 + (x.t1 - x.t0) * (k + 0.5) / n, scale: 0.25, q: 92, out: `qa/snap/${hashes[x.i]}_p${k}.jpg`})); });
    fs.mkdirSync('qa/snap', {recursive: true});
    await renderAll(probes, () => !ALL);
    for (const x of sel) {
      const words = (P.WORDS ?? []).filter((w) => w.s >= x.t0 - 0.05 && w.s < x.t1).map((w) => w.w).join(' ');
      const flags = (hot[x.i] ?? []).join(' ');
      tile({out: `qa/cards/${pad(x.i)}.jpg`, cols: 3, w: 300,
        title: `#${x.i} ${x.name.slice(0, 34)} · ${fmt(x.t1 - x.t0)}${flags ? ' · HOT ' + flags : ''}`,
        cells: jobs.filter((j) => j.x === x).map((j) => ({img: j.out, label: fmt(j.t), sub: j.n === 0 ? `“${words.slice(0, 60)}”` : j.n === 1 ? `hash ${hashes[x.i]}` : (flags ? 'crops: node scripts/qa.mjs crops ' + x.i : '')}))});
      cache.cards[x.i] = hashes[x.i];
      // snapshot what this card shows, keyed by hash: scripts/carry.py compares a reviewed card with a later one
      fs.mkdirSync('qa/snap', {recursive: true});
      jobs.filter((j) => j.x === x).forEach((j) => fs.copyFileSync(j.out, `qa/snap/${hashes[x.i]}_${j.n}.jpg`));
      fs.writeFileSync(`qa/snap/${hashes[x.i]}.json`, JSON.stringify({shot: x.i, probes: probes.filter((p) => p.x === x).length, static: DEPS.staticOf(x), nums: DEPS.numsOf(x), list: DEPS.listSrc, hot: hot[x.i] ?? [], words, t0: x.t0, t1: x.t1}));
    }
    console.log(`cards: ${sel.length} · ${((Date.now() - t00) / 1000).toFixed(0)} s`);
  } else if (mode === 'crops') {
    const x = rows[+arg];
    if (!x) throw new Error(`no shot #${arg}`);
    const looks = {...(P.EX_LOOKS ?? {}), ...P.CAST};
    const ts = [...new Set([x.t0 + (x.t1 - x.t0) * 0.5, ...x.reaches.filter((c) => c > x.t0 && c < x.t1).slice(0, 2), ...x.keys.map((e) => e.t).filter((c) => c > x.t0 && c < x.t1).slice(0, 1)].map((c) => +c.toFixed(2)))].sort((a, b) => a - b);
    fs.mkdirSync('qa/crops', {recursive: true});
    const jobs = ts.map((t, n) => ({t, out: `qa/_f/m${x.i}_${n}.jpg`}));
    for (const j of jobs) await still(j.t, j.out, 1, 90); // full resolution: crops must show real detail
    // snapshot the frames at reach / key moments (not the mid-shot one): carry.py compares them after a retime
    fs.mkdirSync('qa/snap', {recursive: true});
    const ev = jobs.filter((j) => x.reaches.some((c) => Math.abs(c - j.t) < 0.02) || x.keys.some((e) => Math.abs(e.t - j.t) < 0.02));
    ev.forEach((j, n) => fs.copyFileSync(j.out, `qa/snap/${hashes[x.i]}_m${n}.jpg`));
    fs.writeFileSync(`qa/snap/${hashes[x.i]}_m.json`, JSON.stringify({shot: x.i, events: ev.map((j) => +(j.t - x.t0).toFixed(3))}));
    const R = (b, pad = 0) => [b.x0 - pad, b.y0 - pad, b.x1 + pad, b.y1 + pad].map(Math.round);
    const rowsOut = jobs.map((j) => {
      const B = actorBoxes(x, j.t, looks);
      const boxes = B.flatMap((b) => [{label: `${b.id} head`, kind: 'head', box: R(b.head)}, {label: `${b.id} hands`, kind: 'hands', box: R(b.hands)}, {label: `${b.id} feet`, kind: 'feet', box: R(b.feet)}]);
      for (let a = 0; a < B.length; a++) for (let c = a + 1; c < B.length; c++) {
        if (inter(B[a].all, B[c].all) > 0.08 * Math.min(area(B[a].all), area(B[c].all))) {
          const u = {x0: Math.max(B[a].all.x0, B[c].all.x0), y0: Math.max(B[a].all.y0, B[c].all.y0), x1: Math.min(B[a].all.x1, B[c].all.x1), y1: Math.min(B[a].all.y1, B[c].all.y1)};
          boxes.push({label: `${B[a].id}∩${B[c].id}`, kind: 'overlap', box: R(u, 40)});
        }
      }
      return {frame: j.out, label: `${fmt(j.t)}${x.reaches.some((c) => Math.abs(c - j.t) < 0.02) ? ' · reach' : ''}`, boxes};
    });
    const sp = 'qa/_f/crops.json';
    fs.writeFileSync(sp, JSON.stringify({out: `qa/crops/${pad(x.i)}.jpg`, title: `#${x.i} ${x.name} · crops · hash ${hashes[x.i]}`, rows: rowsOut}));
    execFileSync('python3', [path.resolve('scripts/crops.py'), sp], {stdio: 'inherit'});
    cache.crops ??= {};
    cache.crops[x.i] = hashes[x.i];
  } else if (mode === 'frames') {
    fs.mkdirSync('qa/frames', {recursive: true});
    for (const t of arg.split(',').map(Number)) { await still(t, `qa/frames/t${t.toFixed(2)}.jpg`, 1, 88); console.log('ok', t); }
  } else if (mode === 'shot') {
    const r = rows[+arg];
    if (!r) throw new Error(`no shot #${arg} (0–${rows.length - 1})`);
    fs.mkdirSync('qa/shots', {recursive: true});
    const jobs = Array.from({length: 6}, (_, i) => ({i, t: r.t0 + 0.02 + ((r.t1 - r.t0 - 0.04) * i) / 5, out: `qa/_f/s${r.i}_${i}.jpg`}));
    await renderAll(jobs);
    tile({out: `qa/shots/${pad(r.i)}.jpg`, cols: 3, w: 300, title: `#${r.i} ${r.name} · ${r.set} · hash ${hashes[r.i]}`, cells: jobs.map((j) => ({img: j.out, label: fmt(j.t), sub: ''}))});
    console.log('ok', r.i, `${((Date.now() - t00) / 1000).toFixed(0)} s`);
  } else {
    console.log('modes: contact [--all] | strips [names] [--all] | cards [changed|hot|all|i,j] | crops <i> | frames t1,t2 | shot <i> | status');
    process.exitCode = 1;
  }
} finally {
  saveCache();
  await browser.close({silent: true}).catch(() => {});
}
