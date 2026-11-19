// Visual QA evidence (gate G5). Renders frames of the Film composition and tiles them into LIGHT JPEG sheets
// (each ≤ ~1 MB, usually 100–400 KB) so a reviewer can open many of them cheaply.
//   node scripts/qa.mjs where <i> [t] [--free WxH] -> terminal layout table of 1080×1920 boxes + open regions (no render)
//   node scripts/qa.mjs pass [changed|all]         -> ONE bundle/browser: contact + stale strips + cards + HOT crops + carry.py
//   node scripts/qa.mjs review --batch <file.jsonl> -> validate & atomically write batch qa/review/NN.json (no render)
//   node scripts/qa.mjs contact [--all]            -> qa/contact_p<N>.jpg : every shot at 25 % and 75 % (full frame)
//   node scripts/qa.mjs strips [names] [--all]     -> qa/strips/<name>.jpg : motion strips from qa/strips_needed.json
//   node scripts/qa.mjs frames 12.5,13.0           -> qa/frames/t<sec>.jpg : single full-size frames at absolute seconds
//   node scripts/qa.mjs cards [changed|hot|all|3,7] -> qa/cards/NN.jpg : review card per shot (3 frames + beat words + flags)
//   node scripts/qa.mjs crops 7                    -> qa/crops/07.jpg : measurement crops (head/hands/feet/overlap, 1:1+)
//   node scripts/qa.mjs status                     -> qa/qa_status.json : shots/strips whose evidence is stale (no render)
//   node scripts/qa.mjs adopt                      -> once, episode reviewed under v3.6: snapshot reviewed card frames
//   node scripts/qa.mjs shot 7                     -> qa/shots/07.jpg : 6 frames across shot #7 (the fix loop)
// Speed: ONE shared browser, a pool of parallel workers (SV_QA_WORKERS, default 4), QA frames at half size.
// Only one render at a time per episode (qa/.render.lock).
// Run `node scripts/lint.mjs` first (it writes qa/strips_needed.json; qa/shots.json is refreshed here).
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {loadProject, writeTables} from './load.mjs';
import * as geom from './geom.mjs';
import {makeShotHash} from './deps.mjs';

const {actorBoxes, inter, area} = geom;

// ---- CLI parsing (preserves positional args while supporting --batch <f>, --free <WxH>, --all)
const rawArgs = process.argv.slice(2);
let ALL = false, batchFile = null, freeBox = null;
const posArgs = [];
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--all') { ALL = true; }
  else if (a === '--batch') { batchFile = rawArgs[++i] ?? ''; }
  else if (a.startsWith('--batch=')) { batchFile = a.slice(8); }
  else if (a === '--free') { freeBox = rawArgs[++i] ?? ''; }
  else if (a.startsWith('--free=')) { freeBox = a.slice(7); }
  else if (!a.startsWith('--')) { posArgs.push(a); }
}
const [mode = 'contact', arg, arg2] = posArgs;
const WORKERS = Math.max(1, +(process.env.SV_QA_WORKERS ?? 4));
const SCALE = +(process.env.SV_QA_SCALE ?? 0.5);
const PYTHON = process.env.SV_PYTHON || (fs.existsSync('/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python') ? '/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python' : 'python3');

fs.mkdirSync('qa/_f', {recursive: true});

const P = await loadProject();
const rows = P.shotTable();
writeTables(fs, rows);

// ---- per-shot hash
const pad = (i) => String(i).padStart(2, '0');
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const DEPS = makeShotHash(rows, P.SHOTS);
const shotHash = (r) => DEPS.hashOf(r);
const CACHE = 'qa/cache.json';
const cache = (() => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; } })();
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
const hashes = Object.fromEntries(rows.map((r) => [r.i, shotHash(r)]));
const shotOf = (s) => rows.find((r) => s.t0 >= r.t0 - 0.01 && s.t0 < r.t1) ?? rows[0];
const stripKey = (s) => sha(hashes[shotOf(s).i] + JSON.stringify(s));
const readJson = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);

const computeStatus = () => {
  const need = readJson('qa/strips_needed.json', []);
  return {
    contact_stale: rows.filter((r) => cache.contact?.[r.i] !== hashes[r.i] || !fs.existsSync(`qa/_f/c${r.i}_0.25.jpg`)).map((r) => r.i),
    cards_stale: rows.filter((r) => cache.cards?.[r.i] !== hashes[r.i]).map((r) => r.i),
    crops_ok: Object.fromEntries(rows.map((r) => [r.i, cache.crops?.[r.i] === hashes[r.i] && fs.existsSync(`qa/crops/${pad(r.i)}.jpg`)])),
    strips_stale: need.filter((s) => cache.strips?.[s.name] !== stripKey(s) || !fs.existsSync(`qa/strips/${s.name}.jpg`)).map((s) => s.name),
    hashes,
  };
};

// ---- NO-LOCK, NO-BROWSER MODES

// status: which evidence no longer matches the source (sv_gate.py G5 runs this)
if (mode === 'status') {
  const out = computeStatus();
  fs.writeFileSync('qa/qa_status.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify({contact_stale: out.contact_stale, strips_stale: out.strips_stale}));
  process.exit(0);
}

// adopt (once, when an episode reviewed under v3.6 moves to v3.7; no browser)
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
  console.log('next: node scripts/qa.mjs pass all');
  process.exit(0);
}

// review --batch <file.jsonl>: validate every review strictly and write qa/review/NN.json atomically
if (mode === 'review') {
  const file = batchFile ?? arg;
  if (!file) {
    console.error('usage: node scripts/qa.mjs review --batch <file.jsonl>');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`review --batch: file not found: ${file}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) {
    console.error(`review --batch: empty file: ${file}`);
    process.exit(1);
  }
  const entries = [];
  if (raw.startsWith('[')) {
    let arr;
    try { arr = JSON.parse(raw); } catch (e) { console.error(`review --batch: invalid JSON array: ${e.message}`); process.exit(1); }
    if (!Array.isArray(arr) || !arr.length) { console.error('review --batch: JSON array must be non-empty'); process.exit(1); }
    arr.forEach((item, idx) => entries.push({loc: `item[${idx}]`, item}));
  } else {
    const lines = raw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i].trim();
      if (!ln) continue;
      try { entries.push({loc: `line ${i + 1}`, item: JSON.parse(ln)}); }
      catch (e) { console.error(`review --batch: line ${i + 1} invalid JSON: ${e.message}`); process.exit(1); }
    }
    if (!entries.length) { console.error('review --batch: no review lines found'); process.exit(1); }
  }

  const st = computeStatus();
  fs.writeFileSync('qa/qa_status.json', JSON.stringify(st, null, 1));
  const hot = readJson('qa/hot.json', {});
  const CHECK_KEYS = ['acting', 'contact', 'overlap', 'set', 'text', 'caption', 'beat', 'model'];
  const CHECK_RE = /^(ok|fix)\s*(?:—|–|-)\s*\S+/u;
  const errs = [];
  const seenShots = new Set();

  for (const {loc, item} of entries) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errs.push(`${loc}: must be a JSON object`);
      continue;
    }
    const i = item.shot;
    if (!Number.isInteger(i) || i < 0 || i >= rows.length) {
      errs.push(`${loc}: invalid shot ${JSON.stringify(i)} (expected 0..${rows.length - 1})`);
      continue;
    }
    const tag = `${loc} (shot #${i})`;
    if (seenShots.has(i)) errs.push(`${tag}: duplicate shot in batch`);
    seenShots.add(i);

    const expectedHash = st.hashes[i];
    if (typeof item.hash !== 'string' || item.hash !== expectedHash) {
      errs.push(`${tag}: hash ${JSON.stringify(item.hash)} != current qa_status.json hash '${expectedHash}'`);
    }
    const rev = typeof item.reviewer === 'string' ? item.reviewer.trim() : '';
    const bld = typeof item.builder === 'string' ? item.builder.trim() : 'builder';
    if (!rev || rev === 'builder' || rev === bld) {
      errs.push(`${tag}: reviewer (${JSON.stringify(item.reviewer)}) must be named and != builder (${JSON.stringify(item.builder ?? 'builder')})`);
    }
    if (item.verdict !== 'ok' && item.verdict !== 'fix') {
      errs.push(`${tag}: verdict must be 'ok' or 'fix' (got ${JSON.stringify(item.verdict)})`);
    }
    const checks = item.checks;
    if (!checks || typeof checks !== 'object' || Array.isArray(checks)) {
      errs.push(`${tag}: checks object missing`);
    } else {
      const checkStatuses = [];
      for (const k of CHECK_KEYS) {
        const v = checks[k];
        if (typeof v !== 'string' || !CHECK_RE.test(v.trim())) {
          errs.push(`${tag}: checks.${k} must be formatted 'ok — ...' or 'fix — ...' (got ${JSON.stringify(v)})`);
        } else {
          checkStatuses.push(v.trim().startsWith('ok') ? 'ok' : 'fix');
        }
      }
      if (checkStatuses.length === CHECK_KEYS.length) {
        if (item.verdict === 'ok' && checkStatuses.some((s) => s !== 'ok')) {
          errs.push(`${tag}: verdict is 'ok' but one or more checks start with 'fix'`);
        }
        if (item.verdict === 'fix' && !checkStatuses.some((s) => s === 'fix')) {
          errs.push(`${tag}: verdict is 'fix' but no check starts with 'fix'`);
        }
      }
    }
    const words = (String(item.note ?? '').match(/[\p{L}\p{N}_]+/gu) ?? []);
    if (typeof item.note !== 'string' || words.length < 6) {
      errs.push(`${tag}: note must have >= 6 words (got ${words.length})`);
    }
    const looked = Array.isArray(item.looked) ? item.looked : null;
    if (!looked || !looked.includes('card')) {
      errs.push(`${tag}: looked must be an array including 'card'`);
    }
    if (Array.isArray(hot[i]) && hot[i].length > 0) {
      if (!looked || !looked.includes('crops')) {
        errs.push(`${tag}: HOT shot (${hot[i].join(',')}) must include "crops" in looked`);
      } else if (!st.crops_ok[i]) {
        errs.push(`${tag}: HOT shot crops are missing or stale — run qa.mjs crops ${i} (or qa.mjs pass) first`);
      }
    }
  }

  if (errs.length) {
    console.error(`review --batch REJECTED (${errs.length} error(s), 0 files written):`);
    for (const e of errs) console.error('  -', e);
    process.exit(1);
  }

  fs.mkdirSync('qa/review', {recursive: true});
  let okN = 0;
  const fixShots = [];
  for (const {item} of entries) {
    const outPath = `qa/review/${pad(item.shot)}.json`;
    const tmpPath = `${outPath}.tmp.${process.pid}`;
    fs.writeFileSync(tmpPath, JSON.stringify(item, null, 2) + '\n');
    fs.renameSync(tmpPath, outPath);
    if (item.verdict === 'ok') okN++;
    else fixShots.push(item.shot);
  }
  console.log(`review --batch: wrote ${entries.length} review(s) · ${okN} ok, ${fixShots.length} fix${fixShots.length ? ` · fix: [${fixShots.join(', ')}]` : ''}`);
  process.exit(0);
}

// where <i> [t] [--free WxH]: terminal layout table of 1080×1920 boxes (no browser)
if (mode === 'where') {
  if (typeof geom.shotGeometry !== 'function') {
    console.error('qa.mjs where requires geom.mjs shotGeometry() export (not available yet)');
    process.exit(1);
  }
  const idx = Number(arg);
  const r = rows[idx];
  if (!Number.isInteger(idx) || !r) {
    console.error(`usage: node scripts/qa.mjs where <i> [t] [--free WxH] (shot 0..${rows.length - 1})`);
    process.exit(1);
  }
  const ts = arg2 !== undefined ? [Number(arg2)] : [0.15, 0.5, 0.85].map((u) => +(r.t0 + (r.t1 - r.t0) * u).toFixed(2));
  if (ts.some((t) => Number.isNaN(t))) {
    console.error(`invalid timestamp '${arg2}'`);
    process.exit(1);
  }
  let freeReq = null;
  if (freeBox) {
    const m = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(freeBox.trim());
    if (!m) { console.error(`invalid --free '${freeBox}' (expected WxH, e.g. 320x140)`); process.exit(1); }
    freeReq = {w: +m[1], h: +m[2]};
  }
  const fmtB = (b) => `[${Math.round(b.x0)},${Math.round(b.y0)}..${Math.round(b.x1)},${Math.round(b.y1)}]`;
  console.log(`#${r.i} '${r.name}' · set=${r.set} · ${r.t0.toFixed(2)}–${r.t1.toFixed(2)}s`);
  let printedReach = false;
  for (const t of ts) {
    const g = geom.shotGeometry(r, t, P, rows);
    if (!printedReach && g.reachIssues?.length) {
      printedReach = true;
      console.log('  REACH ISSUES (MO-11):');
      for (const ri of g.reachIssues) {
        console.log(`    !! ${ri.id} reaches to x=${Math.round(ri.rx)} behind facing dir=${ri.dir > 0 ? '+1' : '-1'} (actor x=${Math.round(ri.x)}) @ t=${ri.t.toFixed(2)}s`);
      }
    }
    const cap = g.caption ?? {x0: 0, y0: 1570, x1: 1080, y1: 1710};
    const capFlag = g.captionIssues?.length ? `  !! CAPTION(${g.captionIssues.map((c) => `${c.kind}:${c.id}`).join(', ')})` : '  (head/hands/hero-props clear)';
    console.log(`\n@ t=${t.toFixed(2)}s  cam=[${g.cam.map((v, k) => k === 2 ? v.toFixed(2) : Math.round(v)).join(', ')}]  caption=${fmtB(cap)}${capFlag}`);
    if (g.actors?.length) {
      console.log('  ACTORS:');
      for (const a of g.actors) {
        console.log(`    ${a.id.padEnd(12)} head=${fmtB(a.head)}  body=${fmtB(a.body)}  feet=${fmtB(a.feet)}${a.h ? `  h=${Math.round(a.h)}px` : ''}`);
      }
    }
    const visSigns = (g.signs ?? []).filter((s) => s.onScreen);
    if (visSigns.length) {
      console.log('  SIGNS (visible):');
      for (const s of visSigns) {
        const srcTag = s.source && s.source !== 'set' ? `[${s.source}] ` : '';
        const label = `${srcTag}"${s.text}"`;
        const flags = [
          ...(s.edgeClipped ? [`CLIP(${Math.round(s.clippedW * 100)}%${s.camHint ? '; ' + s.camHint : ''})`] : !s.fullyInFrame ? ['PARTIAL'] : []),
          ...(s.occludedBy?.length ? s.occludedBy.map((o) => o.kind === 'prop' ? `PROP-OVER-SIGN(${o.id}:${Math.round(o.frac * 100)}%)` : `OCCLUDED(${o.id}:${Math.round(o.frac * 100)}%)`) : []),
        ];
        console.log(`    ${label.padEnd(28)} box=${fmtB(s.screenBox)}${flags.length ? '  !! ' + flags.join(' ') : ''}`);
      }
    }
    if (g.props?.length) {
      console.log('  WORLD_PROPS:');
      for (const p of g.props) {
        const flags = [
          ...(!p.onScreen ? ['OFF'] : []),
          ...(p.edgeClipped ? [`CLIP(${Math.round(p.clippedFrac * 100)}%${p.dxHint ? '; ' + p.dxHint : ''})`] : []),
        ];
        console.log(`    ${p.k.padEnd(16)} box=${fmtB(p.screenBox)}${flags.length ? '  !! ' + flags.join(' ') : ''}`);
      }
    }
    if (g.overlays?.length) {
      console.log('  OVERLAYS:');
      for (const o of g.overlays) {
        console.log(`    ${o.k.padEnd(10)} "${(o.text ?? '').slice(0, 26)}" box=${fmtB(o)}`);
      }
    }
    if (freeReq) {
      const blocked = [
        cap,
        ...(g.actors ?? []).map((a) => a.head),
        ...visSigns.map((s) => s.screenBox),
        ...(g.overlays ?? []),
      ];
      const candidates = [];
      for (let y = 40; y + freeReq.h <= 1880; y += 60) {
        for (let x = 40; x + freeReq.w <= 1040; x += 60) {
          const cand = {x0: x, y0: y, x1: x + freeReq.w, y1: y + freeReq.h};
          if (blocked.every((b) => inter(cand, b) === 0)) candidates.push(cand);
        }
      }
      const pick = [];
      for (const c of candidates) {
        if (pick.every((p) => inter(p, c) === 0)) pick.push(c);
        if (pick.length >= 4) break;
      }
      console.log(`  FREE (${freeReq.w}x${freeReq.h} clear of faces/signs/overlays/captions): ${pick.length ? pick.map(fmtB).join('  ') : 'NONE'}`);
    }
  }
  process.exit(0);
}

// ---- lock: two renders of the same episode at once only fight for CPU and overwrite each other's frames
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
  execFileSync(PYTHON, [path.resolve('scripts/tile.py'), j], {stdio: 'inherit'});
};
const fmt = (t) => t.toFixed(2) + 's';

// ---- shared render pipelines
const runContact = async (forceAll) => {
  const changed = rows.filter((r) => cache.contact?.[r.i] !== hashes[r.i]).map((r) => r.i);
  const jobs = rows.flatMap((r) => [0.25, 0.75].map((u) => ({r, u, t: r.t0 + (r.t1 - r.t0) * u, out: `qa/_f/c${r.i}_${u}.jpg`})));
  const st = await renderAll(jobs, (j) => !forceAll && !changed.includes(j.r.i));
  const unreviewed = new Set(rows.filter((r) => { try { const v = JSON.parse(fs.readFileSync(`qa/review/${pad(r.i)}.json`, 'utf8')); return v.verdict !== 'ok' || v.hash !== hashes[r.i]; } catch { return true; } }).map((r) => r.i));
  const cells = jobs.map(({r, u, t, out}) => ({img: out, label: `#${r.i} ${u === 0.25 ? 'a' : 'b'} · ${fmt(t)}${unreviewed.has(r.i) ? ' ●' : ''}`, sub: u === 0.25 ? r.name : `${r.set} · ${fmt(r.t1 - r.t0)}`}));
  const per = 24;
  for (const f of fs.readdirSync('qa')) { const m = /^contact_p(\d+)\.(png|jpg)$/.exec(f); if (m && (m[2] === 'png' || +m[1] > Math.ceil(cells.length / per))) fs.unlinkSync(path.join('qa', f)); }
  for (let p = 0; p * per < cells.length; p++) tile({out: `qa/contact_p${p + 1}.jpg`, cols: 6, w: 300, title: `CONTACT · trang ${p + 1} · ${rows.length} shot · ${fmt(P.DURATION)} · ● = chưa review ở bản này`, cells: cells.slice(p * per, (p + 1) * per)});
  cache.contact = {...hashes};
  fs.writeFileSync('qa/changed.json', JSON.stringify({at: new Date().toISOString(), shots: changed, all: rows.length}, null, 1));
  console.log(`contact: ${Math.ceil(cells.length / per)} page(s) · ${st.rendered} rendered, ${st.reused} reused · changed shots: ${changed.join(',') || 'none'} · ${((Date.now() - t00) / 1000).toFixed(0)} s`);
};

const runStrips = async (onlyNames, forceAll, staleOnly = false) => {
  const need = readJson('qa/strips_needed.json', []);
  fs.mkdirSync('qa/strips', {recursive: true});
  cache.strips ??= {};
  const isFresh = (s) => cache.strips[s.name] === stripKey(s) && fs.existsSync(`qa/strips/${s.name}.jpg`);
  const sel = need.filter((s) => (!onlyNames || onlyNames.includes(s.name)) && (!staleOnly || forceAll || !isFresh(s)));
  const jobs = sel.flatMap((s) => Array.from({length: s.n}, (_, i) => ({s, i, t: s.t0 + ((s.t1 - s.t0) * i) / (s.n - 1), out: `qa/_f/${s.name}_${i}.jpg`})));
  const st = await renderAll(jobs, (j) => !forceAll && isFresh(j.s));
  for (const s of sel) {
    const cells = jobs.filter((j) => j.s === s).map((j) => ({img: j.out, label: fmt(j.t), sub: j.i === 0 ? s.why : ''}));
    const cols = s.n <= 4 ? s.n : Math.ceil(s.n / 2);
    tile({out: `qa/strips/${s.name}.jpg`, cols, w: 270, title: `${s.name} · ${s.why} · ${fmt(s.t0)}–${fmt(s.t1)}`, cells});
    try { fs.unlinkSync(`qa/strips/${s.name}.png`); } catch {}
    cache.strips[s.name] = stripKey(s);
  }
  console.log(`strips: ${sel.length} · ${st.rendered} frames rendered, ${st.reused} reused · ${((Date.now() - t00) / 1000).toFixed(0)} s`);
};

const runCards = async (which, forceAll, includeStaleInChanged = false) => {
  const hot = readJson('qa/hot.json', {});
  const ch = fs.existsSync('qa/changed.json') ? JSON.parse(fs.readFileSync('qa/changed.json', 'utf8')).shots : rows.map((x) => x.i);
  const sel = !which || which === 'all' ? rows
    : which === 'changed' ? rows.filter((x) => ch.includes(x.i) || (includeStaleInChanged && (cache.cards?.[x.i] !== hashes[x.i] || !fs.existsSync(`qa/cards/${pad(x.i)}.jpg`))))
    : which === 'hot' ? rows.filter((x) => hot[x.i])
    : rows.filter((x) => which.split(',').map(Number).includes(x.i));
  fs.mkdirSync('qa/cards', {recursive: true});
  const jobs = sel.flatMap((x) => [0.15, 0.5, 0.85].map((u, n) => ({x, n, t: x.t0 + (x.t1 - x.t0) * u, out: `qa/_f/k${x.i}_${n}.jpg`})));
  cache.cards ??= {};
  await renderAll(jobs, (j) => !forceAll && cache.cards[j.x.i] === hashes[j.x.i]);
  const probes = sel.flatMap((x) => { const n = Math.max(6, Math.min(16, Math.ceil((x.t1 - x.t0) / 0.2)));
    return Array.from({length: n}, (_, k) => ({x, k, n, t: x.t0 + (x.t1 - x.t0) * (k + 0.5) / n, scale: 0.25, q: 92, out: `qa/snap/${hashes[x.i]}_p${k}.jpg`})); });
  fs.mkdirSync('qa/snap', {recursive: true});
  await renderAll(probes, () => !forceAll);
  for (const x of sel) {
    const words = (P.WORDS ?? []).filter((w) => w.s >= x.t0 - 0.05 && w.s < x.t1).map((w) => w.w).join(' ');
    const flags = (hot[x.i] ?? []).join(' ');
    tile({out: `qa/cards/${pad(x.i)}.jpg`, cols: 3, w: 300,
      title: `#${x.i} ${x.name.slice(0, 34)} · ${fmt(x.t1 - x.t0)}${flags ? ' · HOT ' + flags : ''}`,
      cells: jobs.filter((j) => j.x === x).map((j) => ({img: j.out, label: fmt(j.t), sub: j.n === 0 ? `“${words.slice(0, 60)}”` : j.n === 1 ? `hash ${hashes[x.i]}` : (flags ? 'crops: node scripts/qa.mjs crops ' + x.i : '')}))});
    cache.cards[x.i] = hashes[x.i];
    jobs.filter((j) => j.x === x).forEach((j) => fs.copyFileSync(j.out, `qa/snap/${hashes[x.i]}_${j.n}.jpg`));
    fs.writeFileSync(`qa/snap/${hashes[x.i]}.json`, JSON.stringify({shot: x.i, probes: probes.filter((p) => p.x === x).length, static: DEPS.staticOf(x), nums: DEPS.numsOf(x), list: DEPS.listSrc, hot: hot[x.i] ?? [], words, t0: x.t0, t1: x.t1}));
  }
  console.log(`cards: ${sel.length} · ${((Date.now() - t00) / 1000).toFixed(0)} s`);
};

const runCrops = async (shotIdx) => {
  const x = rows[shotIdx];
  if (!x) throw new Error(`no shot #${shotIdx}`);
  const looks = {...(P.EX_LOOKS ?? {}), ...P.CAST};
  const ts = [...new Set([x.t0 + (x.t1 - x.t0) * 0.5, ...x.reaches.filter((c) => c > x.t0 && c < x.t1).slice(0, 2), ...x.keys.map((e) => e.t).filter((c) => c > x.t0 && c < x.t1).slice(0, 1)].map((c) => +c.toFixed(2)))].sort((a, b) => a - b);
  fs.mkdirSync('qa/crops', {recursive: true});
  const jobs = ts.map((t, n) => ({t, scale: 1, q: 90, out: `qa/_f/m${x.i}_${n}.jpg`}));
  await renderAll(jobs);
  fs.mkdirSync('qa/snap', {recursive: true});
  const ev = jobs.filter((j) => x.reaches.some((c) => Math.abs(c - j.t) < 0.02) || x.keys.some((e) => Math.abs(e.t - j.t) < 0.02));
  ev.forEach((j, n) => fs.copyFileSync(j.out, `qa/snap/${hashes[x.i]}_m${n}.jpg`));
  fs.writeFileSync(`qa/snap/${hashes[x.i]}_m.json`, JSON.stringify({shot: x.i, events: ev.map((j) => +(j.t - x.t0).toFixed(3))}));
  const R = (b, padPx = 0) => [b.x0 - padPx, b.y0 - padPx, b.x1 + padPx, b.y1 + padPx].map(Math.round);
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
  execFileSync(PYTHON, [path.resolve('scripts/crops.py'), sp], {stdio: 'inherit'});
  cache.crops ??= {};
  cache.crops[x.i] = hashes[x.i];
};

try {
  if (mode === 'pass') {
    const passAll = arg === 'all' || ALL;
    if (arg && arg !== 'changed' && arg !== 'all') {
      throw new Error(`unknown pass scope '${arg}' (expected changed | all)`);
    }
    await runContact(passAll);
    await runStrips(null, false, true);
    await runCards(passAll ? 'all' : 'changed', passAll, true);
    const hot = readJson('qa/hot.json', {});
    const hotTodo = Object.keys(hot).map(Number).filter((i) => hot[i]?.length && (cache.crops?.[i] !== hashes[i] || !fs.existsSync(`qa/crops/${pad(i)}.jpg`))).sort((a, b) => a - b);
    for (const i of hotTodo) await runCrops(i);
    console.log(`pass (${passAll ? 'all' : 'changed'}): ${hotTodo.length} HOT crop(s) rendered · render total ${((Date.now() - t00) / 1000).toFixed(0)} s`);
  } else if (mode === 'contact') {
    await runContact(ALL);
  } else if (mode === 'strips') {
    await runStrips(arg ? arg.split(',') : null, ALL, false);
  } else if (mode === 'cards') {
    await runCards(arg, ALL, false);
  } else if (mode === 'crops') {
    await runCrops(+arg);
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
    console.log('modes: pass [changed|all] | where <i> [t] [--free WxH] | review --batch <file.jsonl> | contact [--all] | strips [names] [--all] | cards [changed|hot|all|i,j] | crops <i> | frames t1,t2 | shot <i> | status');
    process.exitCode = 1;
  }
} finally {
  saveCache();
  await browser.close({silent: true}).catch(() => {});
  unlock();
}

if (mode === 'pass') {
  execFileSync(PYTHON, [path.resolve('scripts/carry.py')], {stdio: 'inherit'});
  const carry = readJson('qa/carry.json', {carried: [], review: [], unchanged: 0});
  const revShots = (carry.review ?? []).map((x) => x.shot);
  console.log(`pass review list (${revShots.length}): ${JSON.stringify(revShots)}`);
  for (const x of carry.review ?? []) console.log(`  #${x.shot}: ${x.why}`);
}
