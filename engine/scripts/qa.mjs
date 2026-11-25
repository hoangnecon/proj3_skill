// Visual QA evidence (gate G5). Renders frames of the Film composition and tiles them into LIGHT JPEG sheets
// (each ≤ ~1 MB, usually 100–400 KB) so a reviewer can open many of them cheaply.
//   node scripts/qa.mjs where <i> [t] [--free WxH] -> terminal layout table of frame boxes + 3x3 grid + scale/cutoff (no render)
//   node scripts/qa.mjs layout [i] [t]             -> 3x3 grid + scale + creature-cutoff summary for 1 shot or all shots (no render)
//   node scripts/qa.mjs place <setId> [--actors N] [--subject key[:pose]] [--ots] [--cam cx,cy,k] -> zero-browser auto-layout solver
//   node scripts/qa.mjs pass [changed|all] [--unit U1] -> ONE bundle/browser: Đại đoạn (or qa/units/U1_contact.jpg) + Tiểu đoạn + strips + cards + HOT crops + carry.py + blind_pack
//   node scripts/qa.mjs review --batch <file.jsonl> -> validate & atomically write batch qa/review/NN.json (no render)
//   node scripts/qa.mjs contact [--all] [--unit U1] -> qa/contact_p<N>.jpg (or qa/units/U1_contact.jpg, 4 frames/shot)
//   node scripts/qa.mjs segments [--all]           -> qa/contact_segments/seg_NN_<loc>.jpg : Trung đoạn grouped by location (4 frames/shot)
//   node scripts/qa.mjs shotstrips [all|0,1] [--unit U1] [--all] -> qa/shots/NN.jpg : Tiểu đoạn 8-frame strips for long/motion/HOT shots
//   node scripts/qa.mjs strips [names] [--unit U1] [--all] -> qa/strips/<name>.jpg : motion strips from qa/strips_needed.json
//   node scripts/qa.mjs frames 12.5,13.0           -> qa/frames/t<sec>.jpg : single full-size frames at absolute seconds
//   node scripts/qa.mjs cards [changed|hot|all|3,7] [--unit U1] -> qa/cards/NN.jpg : review card per shot (3 frames + beat words + flags)
//   node scripts/qa.mjs crops 7                    -> qa/crops/07.jpg : measurement crops (head/hands/feet/overlap, 1:1+)
//   node scripts/qa.mjs status                     -> qa/qa_status.json : shots/strips whose evidence is stale (no render)
//   node scripts/qa.mjs adopt                      -> once, episode reviewed under v3.6: snapshot reviewed card frames
//   node scripts/qa.mjs shot 7                     -> qa/shots/07.jpg : 8 frames (4×2) across shot #7 (Tiểu đoạn / fix loop)
// Speed: ONE shared browser, a pool of parallel workers (SV_QA_WORKERS, default 4), QA frames at half size.
// Only one render at a time per episode (qa/.render.lock).
// Run `node scripts/lint.mjs` first (it writes qa/strips_needed.json; qa/shots.json is refreshed here).
import {cachedBundle} from './bundle_cache.mjs';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {loadProject, writeTables} from './load.mjs';
import * as geom from './geom.mjs';
import {makeShotHash} from './deps.mjs';

const {actorBoxes, inter, area} = geom;

// ---- CLI parsing (preserves positional args while supporting --unit <id>, --batch <f>, --free <WxH>, --all, --actors, --subject, --ots, --cam)
const rawArgs = process.argv.slice(2);
let ALL = false, batchFile = null, freeBox = null, unitId = null;
let placeActors = null, placeSubject = null, placeOts = false, placeCam = null;
const posArgs = [];
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--all') { ALL = true; }
  else if (a === '--ots') { placeOts = true; }
  else if (a === '--unit') { unitId = (rawArgs[++i] ?? '').trim() || null; }
  else if (a.startsWith('--unit=')) { unitId = a.slice(7).trim() || null; }
  else if (a === '--batch') { batchFile = rawArgs[++i] ?? ''; }
  else if (a.startsWith('--batch=')) { batchFile = a.slice(8); }
  else if (a === '--free') { freeBox = rawArgs[++i] ?? ''; }
  else if (a.startsWith('--free=')) { freeBox = a.slice(7); }
  else if (a === '--actors') { placeActors = rawArgs[++i] ?? ''; }
  else if (a.startsWith('--actors=')) { placeActors = a.slice(9); }
  else if (a === '--subject') { placeSubject = rawArgs[++i] ?? ''; }
  else if (a.startsWith('--subject=')) { placeSubject = a.slice(10); }
  else if (a === '--cam') { placeCam = rawArgs[++i] ?? ''; }
  else if (a.startsWith('--cam=')) { placeCam = a.slice(6); }
  else if (!a.startsWith('--')) { posArgs.push(a); }
}
const [mode = 'contact', arg, arg2] = posArgs;
const WORKERS = Math.max(1, +(process.env.SV_QA_WORKERS ?? Math.min(6, Math.max(4, Math.floor(os.cpus().length / 2)))));
const SCALE = +(process.env.SV_QA_SCALE ?? 0.5);
const PYTHON = process.env.SV_PYTHON || (fs.existsSync('/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python') ? '/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python' : 'python3');

fs.mkdirSync('qa/_f', {recursive: true});

const readJson = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);
const scriptJson = readJson('script.json', {});
const P = await loadProject();
const rows = P.shotTable();

const normSegId = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return `s${Math.trunc(v)}`;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (/^\d+[a-z]?$/.test(s)) return `s${s}`;
    const m = /^(s\d+[a-z]?)/i.exec(s);
    if (m) return m[1].toLowerCase();
  }
  return null;
};
const segNumOf = (sid) => {
  const m = /^s(\d+)/i.exec(String(sid ?? ''));
  return m ? Number(m[1]) : null;
};
const shotSegOf = (r) =>
  normSegId(r?.seg) ??
  normSegId(P.SHOTS?.[r?.i]?.seg) ??
  normSegId(r?.at) ??
  normSegId(P.SHOTS?.[r?.i]?.at);
const scriptSegIds = Array.isArray(scriptJson?.segments)
  ? scriptJson.segments.map((s) => normSegId(s?.id)).filter(Boolean)
  : [];
const segIdxMap = new Map(scriptSegIds.map((sid, idx) => [sid, idx]));
const segInUnitRange = (sid, startSid, endSid) => {
  if (!sid || !startSid || !endSid) return false;
  if (segIdxMap.has(startSid) && segIdxMap.has(endSid) && segIdxMap.has(sid)) {
    const idx = segIdxMap.get(sid);
    return idx >= segIdxMap.get(startSid) && idx <= segIdxMap.get(endSid);
  }
  const n = segNumOf(sid), n0 = segNumOf(startSid), n1 = segNumOf(endSid);
  return n !== null && n0 !== null && n1 !== null && n >= n0 && n <= n1;
};

// Progressive SHOTS authoring support: when SHOTS currently ends at the boundary of a non-final
// episodic unit U<k> (before U<k+1> is authored), clamp the trailing shot's t1 to the next unit's
// segment start (- LEAD 0.06s) instead of stretching across the remaining 10-min audio tail.
if (Array.isArray(scriptJson?.units) && scriptJson.units.length > 0 && rows.length > 0) {
  const lastR = rows[rows.length - 1];
  const lastSeg = shotSegOf(lastR);
  const uIdx = scriptJson.units.findIndex((u) =>
    u && segInUnitRange(lastSeg, normSegId(u.seg_start), normSegId(u.seg_end))
  );
  if (uIdx >= 0 && uIdx < scriptJson.units.length - 1) {
    const endIdx = segIdxMap.get(normSegId(scriptJson.units[uIdx]?.seg_end));
    const nextSeg = normSegId(scriptJson.units[uIdx + 1]?.seg_start) ??
      (endIdx !== undefined && endIdx + 1 < scriptSegIds.length ? scriptSegIds[endIdx + 1] : null);
    const nextStart = nextSeg ? P.C?.seg_starts?.[nextSeg] : undefined;
    if (typeof nextStart === 'number' && Number.isFinite(nextStart)) {
      const clampedT1 = +(nextStart - 0.06).toFixed(3);
      if (clampedT1 > lastR.t0 + 0.2 && lastR.t1 > clampedT1 + 0.5) {
        lastR.t1 = clampedT1;
      }
    }
  }
}

for (const r of rows) {
  if (!r.seg) {
    const sg = shotSegOf(r);
    if (sg) r.seg = sg;
  }
}
writeTables(fs, rows);

/** Reads script.json "units", finds unit with id === targetUnitId, and returns Set of shot indices i in [seg_start..seg_end]. */
function unitShotRange(targetUnitId) {
  const units = scriptJson?.units;
  if (!Array.isArray(units) || !units.length) {
    throw new Error(`script.json has no "units" array (cannot resolve --unit ${targetUnitId})`);
  }
  const unit = units.find((u) => u && String(u.id) === String(targetUnitId)) ??
    units.find((u) => u && String(u.id ?? '').toLowerCase() === String(targetUnitId).toLowerCase());
  if (!unit) {
    throw new Error(`unknown unit '${targetUnitId}' in script.json (available: ${units.map((u) => u?.id).filter(Boolean).join(', ')})`);
  }
  const startSid = normSegId(unit.seg_start);
  const endSid = normSegId(unit.seg_end);
  if (!startSid || !endSid) {
    throw new Error(`unit '${unit.id}' in script.json has invalid seg_start/seg_end (${JSON.stringify(unit.seg_start)}..${JSON.stringify(unit.seg_end)})`);
  }
  const shotSet = new Set();
  for (const r of rows) {
    const sg = shotSegOf(r);
    if (segInUnitRange(sg, startSid, endSid)) shotSet.add(r.i);
  }
  return shotSet;
}

const resolveUnitMeta = (targetUnitId) => {
  const shotSet = unitShotRange(targetUnitId);
  const units = scriptJson.units;
  const unit = units.find((u) => u && String(u.id) === String(targetUnitId)) ??
    units.find((u) => u && String(u.id ?? '').toLowerCase() === String(targetUnitId).toLowerCase());
  const unitRows = rows.filter((r) => shotSet.has(r.i));
  if (!unitRows.length) {
    throw new Error(`unit '${unit.id}' (${unit.seg_start}..${unit.seg_end}) has 0 authored shots in src/episode/shotlist.ts`);
  }
  return {
    id: String(unit.id),
    title: typeof unit.title === 'string' ? unit.title.trim() : '',
    seg_start: normSegId(unit.seg_start),
    seg_end: normSegId(unit.seg_end),
    scale_mode: unit.scale_mode ?? null,
    shotSet,
    unitRows,
    t0: Math.min(...unitRows.map((r) => r.t0)),
    t1: Math.max(...unitRows.map((r) => r.t1)),
  };
};

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

let activeUnit = null;
if (unitId !== null) {
  try {
    activeUnit = resolveUnitMeta(unitId);
  } catch (e) {
    console.error(`ERROR qa.mjs --unit ${unitId}: ${e.message}`);
    process.exit(1);
  }
}

const computeStatus = () => {
  const need = readJson('qa/strips_needed.json', []);
  return {
    contact_stale: rows.filter((r) => {
      const firstU = (r.t1 - r.t0) > 4.0 ? 0.12 : 0.25;
      return cache.contact?.[r.i] !== hashes[r.i] || !fs.existsSync(`qa/_f/c${r.i}_${firstU}.jpg`);
    }).map((r) => r.i),
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
  const blindManifest = readJson('qa/blind_review/manifest.json', null);
  const blindByShot = new Map();
  if (blindManifest?.shots) {
    if (Array.isArray(blindManifest.shots)) {
      for (const s of blindManifest.shots) {
        if (s && Number.isInteger(s.shot)) blindByShot.set(s.shot, s);
      }
    } else if (typeof blindManifest.shots === 'object') {
      for (const [k, s] of Object.entries(blindManifest.shots)) {
        if (s && typeof s === 'object') blindByShot.set(Number(k), s);
      }
    }
  }
  const BASE_CHECK_KEYS = ['acting', 'contact', 'overlap', 'set', 'text', 'caption', 'beat', 'model', 'continuity'];
  const CHECK_KEYS = geom.FORMAT === '16:9' ? [...BASE_CHECK_KEYS, 'framing', 'variety'] : BASE_CHECK_KEYS;
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
    if (blindManifest) {
      const mShot = blindByShot.get(i);
      if (item.blind_sha !== undefined && item.blind_sha !== null) {
        if (!mShot || typeof item.blind_sha !== 'string' || item.blind_sha !== mShot.blind_sha) {
          errs.push(`${tag}: blind_sha ${JSON.stringify(item.blind_sha)} != manifest blind_sha ${JSON.stringify(mShot?.blind_sha ?? null)}`);
        }
      } else if (mShot) {
        errs.push(`${tag}: missing blind_sha from qa/blind_review/unit_*.json or slice_*.json — reviewer must use blind review pack`);
      }
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
    if (!looked || (!looked.includes('card') && !looked.includes('contact') && !looked.includes('contact_page') && !looked.includes('unit_contact'))) {
      errs.push(`${tag}: looked must be an array including 'contact', 'unit_contact', or 'card'`);
    }
    if (blindManifest) {
      const mShot = blindByShot.get(i);
      const hasMotionStrip = Boolean(mShot?.images?.shot_strip) || (Array.isArray(mShot?.images?.strips) && mShot.images.strips.length > 0);
      if (hasMotionStrip && (!looked || (!looked.includes('shot_strip') && !looked.includes('strips')))) {
        errs.push(`${tag}: shot has 8-frame Tiểu đoạn motion strip (${mShot?.images?.shot_strip || mShot?.images?.strips?.[0]}) — looked must include 'shot_strip' or 'strips'`);
      }
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
    const outItem = blindManifest && blindByShot.has(item.shot) ? {...item, blind_verified: true} : item;
    fs.writeFileSync(tmpPath, JSON.stringify(outItem, null, 2) + '\n');
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
    const cap = g.caption ?? {x0: 0, y0: geom.CAPTION[0], x1: geom.W, y1: geom.CAPTION[1]};
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
    if (g.gridLayout) {
      const gl = g.gridLayout;
      const cellStr = (id) => {
        const n = gl.cells[id] ?? 0;
        return `${id}=${n}${n >= 4 ? '!!' : n >= 3 ? '*' : ' '}`;
      };
      console.log(`  3x3 GRID (clutter_occupancy=${Math.round(gl.occupancyFrac * 100)}%, maxCell=${gl.maxCellCount}${gl.overcrowdedCells.length ? ` !! OVERCROWDED(${gl.overcrowdedCells.join(',')})` : gl.crowdedCells.length ? ` * CROWDED(${gl.crowdedCells.join(',')})` : ''}):`);
      console.log(`    ${cellStr('A1').padEnd(8)} ${cellStr('B1').padEnd(8)} ${cellStr('C1')}`);
      console.log(`    ${cellStr('A2').padEnd(8)} ${cellStr('B2').padEnd(8)} ${cellStr('C2')}`);
      console.log(`    ${cellStr('A3').padEnd(8)} ${cellStr('B3').padEnd(8)} ${cellStr('C3')}`);
    }
    if (g.scaleIssues?.length) {
      console.log('  SCALE ISSUES (LA-01):');
      for (const si of g.scaleIssues) {
        if (si.kind === 'actor_scale') {
          console.log(`    !! actor '${si.id}' s=${si.s} outside set actorScale [${si.expected[0]}..${si.expected[1]}]`);
        } else {
          console.log(`    !! subject '${si.k}' height ratio ${si.ratio}x vs actor outside relToActor [${si.expected[0]}..${si.expected[1]}]`);
        }
      }
    }
    if (g.creatureCutoffIssues?.length) {
      console.log('  CREATURE CUTOFF (LA-04):');
      for (const cc of g.creatureCutoffIssues) {
        console.log(`    !! creature '${cc.k}' clipped ${Math.round(cc.clippedFrac * 100)}% at frame edge box=${fmtB(cc.screenBox)}`);
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
      for (let y = 40; y + freeReq.h <= geom.H - 40; y += 60) {
        for (let x = 40; x + freeReq.w <= geom.W - 40; x += 60) {
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

// layout [i] [t]: 3x3 grid + scale + creature-cutoff inspection (no browser)
if (mode === 'layout') {
  if (typeof geom.shotGeometry !== 'function') {
    console.error('qa.mjs layout requires geom.mjs shotGeometry() export');
    process.exit(1);
  }
  const fmtB = (b) => `[${Math.round(b.x0)},${Math.round(b.y0)}..${Math.round(b.x1)},${Math.round(b.y1)}]`;
  if (arg !== undefined) {
    const idx = Number(arg);
    const r = rows[idx];
    if (!Number.isInteger(idx) || !r) {
      console.error(`usage: node scripts/qa.mjs layout [i] [t] (shot 0..${rows.length - 1})`);
      process.exit(1);
    }
    const ts = arg2 !== undefined ? [Number(arg2)] : [0.15, 0.5, 0.85].map((u) => +(r.t0 + (r.t1 - r.t0) * u).toFixed(2));
    if (ts.some((t) => Number.isNaN(t))) { console.error(`invalid timestamp '${arg2}'`); process.exit(1); }
    const setDef = P.SETS?.[r.set] ?? {};
    console.log(`#${r.i} '${r.name}' · set=${r.set} · shotScale=${setDef.shotScale ?? '-'} · actorScale=${setDef.actorScale ? `[${setDef.actorScale.join('..')}]` : '-'} · ${r.t0.toFixed(2)}–${r.t1.toFixed(2)}s`);
    for (const t of ts) {
      const g = geom.shotGeometry(r, t, P, rows);
      const gl = g.gridLayout;
      console.log(`\n@ t=${t.toFixed(2)}s  cam=[${g.cam.map((v, k) => k === 2 ? v.toFixed(2) : Math.round(v)).join(', ')}]  occ=${Math.round(gl.occupancyFrac * 100)}%  maxCell=${gl.maxCellCount}`);
      for (const rowIds of [['A1', 'B1', 'C1'], ['A2', 'B2', 'C2'], ['A3', 'B3', 'C3']]) {
        const line = rowIds.map((id) => {
          const ents = gl.cellEntities?.[id] ?? [];
          const flag = ents.length >= 4 ? '!!' : ents.length >= 3 ? '*' : '';
          return `${id}(${ents.length}${flag}):[${ents.join(',')}]`.padEnd(28);
        }).join(' ');
        console.log('  ' + line);
      }
      if (g.scaleIssues?.length) {
        console.log('  SCALE ISSUES (LA-01):');
        for (const si of g.scaleIssues) {
          console.log(si.kind === 'actor_scale'
            ? `    !! actor '${si.id}' s=${si.s} outside [${si.expected[0]}..${si.expected[1]}]`
            : `    !! subject '${si.k}' ratio=${si.ratio}x outside [${si.expected[0]}..${si.expected[1]}]`);
        }
      }
      if (g.creatureCutoffIssues?.length) {
        console.log('  CREATURE CUTOFF (LA-04):');
        for (const cc of g.creatureCutoffIssues) {
          console.log(`    !! creature '${cc.k}' clipped ${Math.round(cc.clippedFrac * 100)}% box=${fmtB(cc.screenBox)}`);
        }
      }
    }
    process.exit(0);
  }
  console.log('#i  | set                      | shotScale    | maxCell | occ% | scaleErr | cutoffErr');
  console.log('----+--------------------------+--------------+---------+------+----------+----------');
  let totScale = 0, totCutoff = 0, totOver = 0;
  const layoutRows = activeUnit ? activeUnit.unitRows : rows;
  for (const r of layoutRows) {
    let maxCell = 0, maxOcc = 0;
    const scaleSet = new Set(), cutoffSet = new Set();
    for (const u of [0.15, 0.5, 0.85]) {
      const t = r.t0 + (r.t1 - r.t0) * u;
      const g = geom.shotGeometry(r, t, P, rows);
      if (g.gridLayout) {
        if (g.gridLayout.maxCellCount > maxCell) maxCell = g.gridLayout.maxCellCount;
        if (g.gridLayout.occupancyFrac > maxOcc) maxOcc = g.gridLayout.occupancyFrac;
      }
      for (const si of g.scaleIssues ?? []) scaleSet.add(`${si.kind}:${si.id ?? si.k}`);
      for (const cc of g.creatureCutoffIssues ?? []) cutoffSet.add(cc.k);
    }
    const sc = P.SETS?.[r.set]?.shotScale ?? '-';
    const occPct = Math.round(maxOcc * 100);
    if (maxCell >= 4 || occPct > 78) totOver++;
    totScale += scaleSet.size;
    totCutoff += cutoffSet.size;
    console.log(
      `${String('#' + r.i).padEnd(3)} | ${r.set.slice(0, 24).padEnd(24)} | ${String(sc).padEnd(12)} | ${String(maxCell).padStart(7)} | ${String(occPct + '%').padStart(4)} | ${String(scaleSet.size).padStart(8)} | ${String(cutoffSet.size).padStart(9)}`
    );
  }
  console.log(`layout${activeUnit ? ` (${activeUnit.id})` : ''}: ${layoutRows.length} shots · overcrowded=${totOver} · scaleErr=${totScale} · cutoffErr=${totCutoff}`);
  process.exit(0);
}

// place <setId> [--actors N] [--subject key[:pose]] [--ots] [--cam cx,cy,k]: zero-browser auto-layout solver
if (mode === 'place') {
  const tStartPlace = Date.now();
  const setId = arg;
  const def = setId ? P.SETS?.[setId] : null;
  if (!setId || !def) {
    const avail = Object.keys(P.EPISODE_SETS ?? P.SETS ?? {});
    console.error(`usage: node scripts/qa.mjs place <setId> [--actors N] [--subject key[:pose]] [--ots] [--cam cx,cy,k]`);
    if (setId) console.error(`unknown set '${setId}'. available: ${avail.join(', ')}`);
    process.exit(1);
  }
  const W = geom.W, H = geom.H;
  const capBox = {x0: 0, y0: geom.CAPTION[0], x1: W, y1: geom.CAPTION[1]};
  const looks = {...(P.EX_LOOKS ?? {}), ...(P.CAST ?? {})};

  // 1. Camera [cx, cy, k]
  let cam;
  if (placeCam !== null) {
    const parts = placeCam.split(',').map((v) => Number(v.trim()));
    if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v)) || parts[2] <= 0) {
      console.error(`invalid --cam '${placeCam}' (expected cx,cy,k with k > 0)`);
      process.exit(1);
    }
    cam = parts;
  } else if (Array.isArray(def.plateCam) && def.plateCam.length === 3) {
    cam = [...def.plateCam];
  } else {
    cam = [W / 2, H / 2, 1];
  }
  const [cx, cy, k] = cam;
  const sxAt = (wx, d = 1) => { const kd = Math.pow(k, d); const ox = W / 2 + (cx - W / 2) * d; return W / 2 + (wx - ox) * kd; };
  const syAt = (wy, d = 1) => { const kd = Math.pow(k, d); const oy = H / 2 + (cy - H / 2) * d; return H / 2 + (wy - oy) * kd; };
  const invX = (px, d = 1) => { const kd = Math.pow(k, d); const ox = W / 2 + (cx - W / 2) * d; return ox + (px - W / 2) / kd; };
  const invY = (py, d = 1) => { const kd = Math.pow(k, d); const oy = H / 2 + (cy - H / 2) * d; return oy + (py - H / 2) / kd; };

  // 2. Actor count, cast selection, and safe scale s
  const actorCount = placeActors !== null ? Math.max(0, Math.floor(Number(placeActors))) : 2;
  if (!Number.isFinite(actorCount)) {
    console.error(`invalid --actors '${placeActors}'`);
    process.exit(1);
  }
  const defaultScale = geom.FORMAT === '16:9' ? [0.72, 0.92] : [0.85, 1.05];
  const [minS, maxS] = Array.isArray(def.actorScale) && def.actorScale.length === 2 ? def.actorScale : defaultScale;
  const midS = (minS + maxS) / 2;
  const talkTargetS = Math.ceil((480 / Math.max(1, 610 * k)) * 100) / 100;
  const rawS = midS < talkTargetS ? Math.min(maxS, talkTargetS) : midS;
  const actorS = +Math.max(minS, Math.min(maxS, rawS)).toFixed(2);

  const roleRank = {principal: 0, support: 1, extra: 2};
  const castKeys = Object.keys(P.CAST ?? {}).sort((a, b) => (roleRank[P.CAST_ROLES?.[a]?.role] ?? 3) - (roleRank[P.CAST_ROLES?.[b]?.role] ?? 3));
  const pickLook = (idx) => castKeys[idx % Math.max(1, castKeys.length)] ?? `actor${idx + 1}`;

  // 3. Depth zones & visible diegetic signs
  const mgY = (Array.isArray(def.zones?.mgY) && def.zones.mgY.length === 2)
    ? [def.zones.mgY[0], def.zones.mgY[1]]
    : [Math.round(invY(H * 0.62)), Math.round(invY(geom.CAPTION[0] - 10))];
  const visSigns = geom.setTextsAt(setId, {t: 1, ...(def.plateOpts ?? {})}, P)
    .filter((sg) => sg.fontSize >= 14)
    .map((sg) => ({...sg, screenBox: geom.projectBox({x0: sg.x0, y0: sg.y0, x1: sg.x1, y1: sg.y1}, cam, sg.d)}))
    .filter((sg) => area(geom.clip(sg.screenBox)) > 0);

  const mkBox = (x0, y0, x1, y1) => ({x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1)});
  const estActorBox = (wx, wy, sVal, lookKey, d = 1) => {
    const L = looks[lookKey] ?? {};
    const hh = L.h ?? 1, hd = L.head ?? 1, ww = L.w ?? 1;
    const headC = wy - (382 * hh + 90 * hd) * sVal, headR = 100 * hd * sVal;
    const top = headC - headR * 1.15;
    const half = Math.max(headR, 110 * ww * sVal);
    return {
      head: mkBox(sxAt(wx - headR * 1.3, d), syAt(top - 40 * sVal, d), sxAt(wx + headR * 1.3, d), syAt(headC + headR * 1.25, d)),
      body: mkBox(sxAt(wx - half, d), syAt(headC + headR * 0.8, d), sxAt(wx + half, d), syAt(wy, d)),
      hands: mkBox(sxAt(wx - 260 * sVal, d), syAt(wy - 400 * hh * sVal, d), sxAt(wx + 260 * sVal, d), syAt(wy - 120 * hh * sVal, d)),
      all: mkBox(sxAt(wx - half * 1.2, d), syAt(top, d), sxAt(wx + half * 1.2, d), syAt(wy + 10 * sVal, d)),
      h: (wy - top) * Math.pow(k, d),
      halfScreen: half * Math.pow(k, d),
    };
  };

  // Helper: fast 3x3 maxCellCount check matching geom.mjs LA-02
  const evalMaxCell = (clusterBoxes) => {
    const colW = W / 3, rowH = H / 3, cellArea = colW * rowH;
    let maxC = 0;
    for (let rr = 0; rr < 3; rr++) {
      for (let cc = 0; cc < 3; cc++) {
        const cbox = {x0: cc * colW, y0: rr * rowH, x1: (cc + 1) * colW, y1: (rr + 1) * rowH};
        let n = 0;
        for (const b of clusterBoxes) {
          const cb = geom.clip(b);
          const ca = area(cb);
          if (ca <= 0) continue;
          const ov = inter(cb, cbox);
          if (ov / cellArea > 0.12 || ov / Math.max(1, ca) > 0.25) n++;
        }
        if (n > maxC) maxC = n;
      }
    }
    return maxC;
  };

  const hasOts = placeOts && actorCount >= 1;
  const mgCount = hasOts ? actorCount - 1 : actorCount;
  const mgLooks = Array.from({length: mgCount}, (_, idx) => pickLook(hasOts ? idx + 1 : idx));
  const avgActorH = mgLooks.length > 0
    ? mgLooks.reduce((sum, lk) => sum + estActorBox(cx, mgY[1], actorS, lk).h, 0) / mgLooks.length
    : 587 * actorS * k;

  // 4. Optional Subject / Prop placement in right-third focal zone (0% edge clipping, above CAPTION[0])
  let placedSubject = null;
  if (placeSubject) {
    const [subjKey, subjPoseRaw] = placeSubject.split(':');
    const subjDef = P.SUBJECTS?.[subjKey] ?? null;
    const propFn = !subjDef ? P.WORLD_PROPS?.[subjKey] ?? null : null;
    if (!subjDef && !propFn) {
      const availS = Object.keys(P.SUBJECTS ?? {});
      const availP = Object.keys(P.WORLD_PROPS ?? {});
      console.error(`unknown --subject '${subjKey}'. SUBJECTS: [${availS.join(', ')}]; WORLD_PROPS: [${availP.slice(0, 12).join(', ')}]`);
      process.exit(1);
    }
    const pose = subjDef ? (subjPoseRaw || subjDef.poses?.[0] || 'idle') : null;
    const expr = subjDef ? (subjDef.exprs?.[0] ?? undefined) : undefined;
    const mb = subjDef
      ? geom.measureSubjectBox(subjKey, pose, P, {t: 1.0, expr})
      : geom.measurePropBox(subjKey, P);
    const flip = actorCount > 0;
    const rel = Array.isArray(subjDef?.relToActor) && subjDef.relToActor.length === 2 ? subjDef.relToActor : [0.85, 1.45];
    const mbH = Math.max(1, mb.height), mbW = Math.max(1, mb.width);
    const sMin = (rel[0] * avgActorH) / (mbH * k);
    const sMinLa01 = (rel[0] * 0.74 * avgActorH) / (mbH * k);
    const sMax = (rel[1] * avgActorH) / (mbH * k);
    const sMid = (((rel[0] + rel[1]) / 2) * avgActorH) / (mbH * k);
    const sFitH = Math.max(0.1, (geom.CAPTION[0] - 44) / (mbH * k));
    const sFitW = Math.max(0.1, (W * 0.44) / (mbW * k));
    const sStart = Math.max(sMin, Math.min(sMax, Math.min(sMid, sFitH, sFitW)));
    const scaleCands = [...new Set([
      sStart,
      sMin + (sStart - sMin) * 0.80,
      sMin + (sStart - sMin) * 0.60,
      sMin + (sStart - sMin) * 0.35,
      sMin,
      Math.max(sMinLa01, Math.min(sMin, sFitW)),
      sMinLa01,
    ].map((v) => +Math.max(0.15, Math.min(sMax, v)).toFixed(2)))];

    const subjBoxFor = (ex, ey, sc) => {
      const wx0 = flip ? ex - mb.maxX * sc : ex + mb.minX * sc;
      const wx1 = flip ? ex - mb.minX * sc : ex + mb.maxX * sc;
      return geom.projectBox(mkBox(wx0, ey + mb.minY * sc, wx1, ey + mb.maxY * sc), cam, 1);
    };

    let bestSubj = null;
    const targetWx = invX(W * 0.72);
    const prefSubjY = Math.round(mgY[0] + (mgY[1] - mgY[0]) * 0.68);
    for (const sc of scaleCands) {
      const exLo = Math.ceil(flip ? invX(20) + mb.maxX * sc : invX(20) - mb.minX * sc);
      const exHi = Math.floor(flip ? invX(W - 20) + mb.minX * sc : invX(W - 20) - mb.maxX * sc);
      const eyLo = Math.ceil(Math.max(mgY[0], invY(20) - mb.minY * sc));
      const eyHi = Math.floor(Math.min(mgY[1], invY(geom.CAPTION[0] - 8) - mb.maxY * sc));
      const xStart = exLo <= exHi ? Math.max(exLo, Math.round(invX(W * 0.60))) : Math.round(targetWx);
      const xEnd = exLo <= exHi ? Math.min(exHi, Math.round(invX(W * 0.86))) : Math.round(targetWx);
      const xs = [];
      if (xStart <= xEnd) {
        for (let x = xStart; x <= xEnd; x += 24) xs.push(x);
        if (xs[xs.length - 1] !== xEnd) xs.push(xEnd);
      } else {
        xs.push(exLo <= exHi ? Math.max(exLo, Math.min(exHi, Math.round(targetWx))) : Math.round(targetWx));
      }
      const ys = [];
      if (eyLo <= eyHi) {
        for (let y = eyLo; y <= eyHi; y += 20) ys.push(y);
        if (ys[ys.length - 1] !== eyHi) ys.push(eyHi);
      } else {
        ys.push(Math.max(mgY[0], Math.min(mgY[1], Math.floor(invY(geom.CAPTION[0] - 8) - mb.maxY * sc))));
      }

      for (const ex of xs) {
        for (const ey of ys) {
          const sb = subjBoxFor(ex, ey, sc);
          const sArea = Math.max(1, area(sb));
          const clipFrac = 1 - area(geom.clip(sb)) / sArea;
          const capOv = inter(sb, capBox);
          let signOv = 0, signHits = 0;
          for (const sg of visSigns) {
            const padSg = {x0: sg.screenBox.x0 - 12, y0: sg.screenBox.y0 - 12, x1: sg.screenBox.x1 + 12, y1: sg.screenBox.y1 + 12};
            const ov = inter(sb, padSg);
            if (ov > 0) { signOv += ov; signHits++; }
          }
          const leftPenalty = Math.max(0, W * 0.52 - sb.x0) * 40;
          const ratio = (sb.y1 - sb.y0) / Math.max(1, avgActorH);
          const ratioErr = (ratio < rel[0] * 0.7 || ratio > rel[1] * 1.35) ? 1e7 : (ratio < rel[0] ? 15000 : 0);
          const score =
            clipFrac * 1e7 +
            (capOv > 0 ? 5e6 + capOv : 0) +
            ratioErr +
            signHits * 5e5 + signOv * 20 +
            leftPenalty +
            Math.abs(sxAt(ex) - W * 0.72) * 1.5 +
            Math.abs(ey - prefSubjY) * 1.2 +
            Math.abs(sc - sStart) * 1200;
          if (!bestSubj || score < bestSubj.score) {
            bestSubj = {score, k: subjKey, pose, expr, x: ex, y: ey, s: sc, flip, isSubject: !!subjDef, screenBox: sb, clipFrac};
          }
        }
      }
    }
    placedSubject = bestSubj;
  }

  // 5. Place actors (optional foreground OTS #0 + midground Rule-of-Thirds columns + sign/collision sweep)
  const placedActors = [];
  if (hasOts) {
    const lk = pickLook(0);
    const otsX = Math.round(invX(W * 0.13, 1.2));
    const otsY = Math.round(invY(H * 1.01, 1.2));
    placedActors.push({id: lk, look: lk, x: otsX, y: otsY, s: 1.42, view: 'back', fg: true, p: 'brace'});
  }

  if (mgCount > 0) {
    const halfScreens = mgLooks.map((lk) => estActorBox(cx, mgY[1], actorS, lk).halfScreen);
    const maxHalf = Math.max(...halfScreens, 90);
    let leftSx = hasOts ? Math.max(W * 0.27, W * 0.13 + 220) : Math.max(W * 0.16, maxHalf + 48);
    let rightSx = placedSubject
      ? Math.min(W * 0.62, placedSubject.screenBox.x0 - maxHalf - 36)
      : Math.min(W * 0.84, W - maxHalf - 48);
    const minSpan = Math.max(0, (mgCount - 1) * (maxHalf * 2 + 28));
    if (rightSx - leftSx < minSpan) {
      leftSx = hasOts ? Math.max(W * 0.23, maxHalf + 36) : Math.max(W * 0.11, maxHalf + 32);
      rightSx = placedSubject
        ? Math.min(W - maxHalf - 32, placedSubject.screenBox.x0 - maxHalf - 16)
        : W - maxHalf - 32;
    }

    let colSx;
    if (!placedSubject && !hasOts) {
      if (mgCount === 1) colSx = [W * 0.36];
      else if (mgCount === 2) colSx = [W * 0.30, W * 0.70];
      else if (mgCount === 3) colSx = [W * 0.22, W * 0.50, W * 0.78];
      else colSx = Array.from({length: mgCount}, (_, idx) => leftSx + ((rightSx - leftSx) * idx) / (mgCount - 1));
    } else {
      if (mgCount === 1) colSx = [Math.min(rightSx, Math.max(leftSx, W * 0.34))];
      else if (mgCount === 2) {
        const a0 = Math.max(leftSx, hasOts ? W * 0.30 : W * 0.24);
        const a1 = Math.min(rightSx, hasOts ? W * 0.51 : W * 0.48);
        colSx = a1 - a0 >= maxHalf * 2 + 24 ? [a0, a1] : [leftSx, Math.max(leftSx + maxHalf * 2 + 24, rightSx)];
      } else {
        colSx = Array.from({length: mgCount}, (_, idx) => leftSx + ((rightSx - leftSx) * idx) / (mgCount - 1));
      }
    }

    // Build initial midground placements inside safe Y window of mgY
    const mgActors = mgLooks.map((lk, idx) => {
      const L = looks[lk] ?? {};
      const hh = L.h ?? 1, hd = L.head ?? 1;
      const yMinHead = Math.ceil(invY(24) + (382 * hh + 205 * hd + 40) * actorS);
      const yMaxCap = Math.floor(invY(geom.CAPTION[0] - 8) + 120 * hh * actorS);
      const yMaxFrame = Math.floor(invY(H - 20));
      const yLo = Math.max(mgY[0], yMinHead);
      const yHi = Math.min(mgY[1], yMaxCap, yMaxFrame);
      const stagger = mgCount > 1 ? ((idx % 2 === 0 ? 0 : 14) - 6) : 0;
      const yPref = Math.round(mgY[0] + (mgY[1] - mgY[0]) * 0.68) + stagger;
      const wy = yLo <= yHi ? Math.max(yLo, Math.min(yHi, yPref)) : Math.max(mgY[0], Math.min(mgY[1], yMaxCap));
      const wx = Math.round(invX(colSx[idx]));
      const face = placedSubject ? 1 : (idx < mgCount - 1 ? 1 : -1);
      return {
        id: lk, look: lk, x: wx, y: wy, s: actorS, view: '3q', face,
        p: idx === 0 ? 'pointR' : 'idle',
        e: idx === 0 ? 'eager' : 'stern',
        _baseX: wx, _baseY: wy, _yLo: yLo <= yHi ? yLo : mgY[0], _yHi: yLo <= yHi ? yHi : Math.min(mgY[1], yMaxCap),
      };
    });

    // Coordinate sweep: ±80px X, ±30px Y (2 passes) for zero caption/sign/body overlap & maxCell <= 2
    const dxs = [0, -16, 16, -32, 32, -48, 48, -64, 64, -80, 80];
    const dys = [0, -10, 10, -20, 20, -30, 30];
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < mgActors.length; i++) {
        const cur = mgActors[i];
        const minWx = Math.ceil(invX(hasOts ? W * 0.23 : halfScreens[i] + 24));
        const maxWx = Math.floor(invX(W - halfScreens[i] - 24));
        let best = null;
        for (const dx of dxs) {
          const wx = Math.max(minWx, Math.min(maxWx, cur._baseX + dx));
          for (const dy of dys) {
            const wy = Math.max(cur._yLo, Math.min(cur._yHi, cur._baseY + dy));
            const ab = estActorBox(wx, wy, cur.s, cur.look);
            const capHit = inter(ab.head, capBox) + inter(ab.hands, capBox);
            const headClip = (ab.head.y0 < 8 || ab.head.x0 < 8 || ab.head.x1 > W - 8) ? 1 : 0;
            let bodyOv = 0, bodyHits = 0;
            const clusterBoxes = placedSubject ? [placedSubject.screenBox] : [];
            for (let j = 0; j < mgActors.length; j++) {
              const ob = j === i ? ab : estActorBox(mgActors[j].x, mgActors[j].y, mgActors[j].s, mgActors[j].look);
              clusterBoxes.push(ob.all);
              if (j === i) continue;
              const ov = inter(ab.body, ob.body);
              if (ov > 0) { bodyOv += ov; bodyHits++; }
            }
            let subjOv = 0;
            if (placedSubject) {
              subjOv = inter(ab.body, placedSubject.screenBox) + inter(ab.head, placedSubject.screenBox) * 2;
            }
            let signOv = 0, signHits = 0;
            for (const sg of visSigns) {
              const ov = inter(ab.head, sg.screenBox) + inter(ab.body, sg.screenBox);
              if (ov > 0) { signOv += ov; signHits++; }
            }
            const maxCell = evalMaxCell(clusterBoxes);
            const cellPen = maxCell > 2 ? (maxCell - 2) * 1.5e5 : 0;
            const score =
              (capHit > 0 ? 1e6 + capHit : 0) +
              headClip * 1e6 +
              bodyHits * 5e5 + bodyOv * 20 +
              (subjOv > 0 ? 2e5 + subjOv * 10 : 0) +
              cellPen +
              signHits * 5e4 + signOv * 5 +
              (Math.abs(dx) + Math.abs(dy)) * 0.05;
            if (!best || score < best.score) best = {score, wx, wy};
          }
        }
        if (best) { cur.x = best.wx; cur.y = best.wy; }
      }
    }

    for (const a of mgActors) {
      placedActors.push({id: a.id, look: a.look, x: a.x, y: a.y, s: a.s, view: a.view, face: a.face, p: a.p, e: a.e});
    }
  }

  const placedExtras = placedSubject ? [{
    id: `${placedSubject.k}1`,
    k: placedSubject.k,
    x: placedSubject.x,
    y: placedSubject.y,
    s: placedSubject.s,
    ...(placedSubject.pose ? {pose: placedSubject.pose} : {}),
    ...(placedSubject.expr ? {expr: placedSubject.expr} : {}),
    ...(placedSubject.flip ? {flip: true} : {}),
  }] : [];

  // 6. Fast end-to-end verification through geom.shotGeometry (zero browser)
  const mockShot = {
    at: 's1', name: `place_${setId}`, set: setId, cam,
    o: def.plateOpts ?? {},
    actors: placedActors,
    extras: placedExtras,
    over: [],
  };
  const mockRow = {
    i: 0, name: mockShot.name, set: setId, t0: 0, t1: 2, cam, cam2: null,
    actors: placedActors.map((a) => ({...a})),
    extras: placedExtras,
    over: [], keys: [], reaches: [],
  };
  const mockP = {...P, SHOTS: [mockShot], shotTable: () => [mockRow]};
  const g = geom.shotGeometry(mockRow, 1.0, mockP, [mockRow]);

  // Strict pairwise body overlap + sign overlap counts
  let pairOverlaps = 0;
  for (let i = 0; i < g.actors.length; i++) {
    if (g.actors[i].fg) continue;
    for (let j = i + 1; j < g.actors.length; j++) {
      if (g.actors[j].fg) continue;
      if (inter(g.actors[i].body, g.actors[j].body) > 0) pairOverlaps++;
    }
  }
  const visSetSigns = (g.signs ?? []).filter((sg) => sg.onScreen && sg.source === 'set');
  let signOverlapCount = 0;
  for (const sg of visSetSigns) {
    const hitActor = g.actors.some((a) => !a.fg && (inter(a.head, sg.screenBox) > 0 || inter(a.body, sg.screenBox) > 0));
    const hitProp = g.props.some((pr) => !pr.fg && inter(pr.screenBox, sg.screenBox) > 0);
    if (hitActor || hitProp) signOverlapCount++;
  }
  const signOccludedCount = visSetSigns.reduce((n, sg) => n + (sg.occludedBy?.length ?? 0), 0);

  // 7. Print clean ready-to-paste TypeScript snippet + verification scorecard
  const fmtActor = (a) => {
    const parts = [`id: '${a.id}'`, `look: '${a.look}'`, `x: ${a.x}`, `y: ${a.y}`, `s: ${a.s}`, `view: '${a.view}'`];
    if (a.fg) parts.push('fg: true');
    if (a.face !== undefined) parts.push(`face: ${a.face}`);
    if (a.p) parts.push(`p: '${a.p}'`);
    if (a.e) parts.push(`e: '${a.e}'`);
    return `    {${parts.join(', ')}},`;
  };
  const fmtExtra = (e) => {
    const parts = [`id: '${e.id}'`, `k: '${e.k}'`, `x: ${e.x}`, `y: ${e.y}`, `s: ${e.s}`];
    if (e.pose) parts.push(`pose: '${e.pose}'`);
    if (e.expr) parts.push(`expr: '${e.expr}'`);
    if (e.flip) parts.push('flip: true');
    return `    {${parts.join(', ')}},`;
  };

  console.log(`place: set=${setId} · shotScale=${def.shotScale ?? '-'} · actorScale=[${minS}..${maxS}] -> s=${actorS} (talkH=${Math.round(610 * actorS * k)}px) · mgY=[${mgY.join('..')}] · cam=[${cam.join(', ')}]`);
  console.log('\n// --- Ready-to-paste ShotDef snippet ---');
  console.log(`  set: '${setId}',`);
  console.log(`  cam: [${cam.map((v, idx) => idx === 2 ? +v.toFixed(2) : Math.round(v)).join(', ')}],`);
  console.log('  actors: [');
  for (const a of placedActors) console.log(fmtActor(a));
  console.log('  ],');
  if (placedExtras.length) {
    console.log('  extras: [');
    for (const e of placedExtras) console.log(fmtExtra(e));
    console.log('  ],');
  }

  const gl = g.gridLayout;
  const cellStr = (id) => `${id}=${gl.cells[id] ?? 0}`;
  const subjClip = g.props.length ? Math.round((g.props[0].clippedFrac ?? 0) * 100) : 0;
  const fgActorIds = new Set(g.actors.filter((a) => a.fg).map((a) => a.id));
  const mgCaptionIssues = g.captionIssues.filter((c) => !fgActorIds.has(c.id));
  const fgCaptionIssues = g.captionIssues.filter((c) => fgActorIds.has(c.id));
  console.log('\n// --- Layout Verification (zero-browser) ---');
  console.log(`  3x3 GRID:  ${cellStr('A1')} ${cellStr('B1')} ${cellStr('C1')} | ${cellStr('A2')} ${cellStr('B2')} ${cellStr('C2')} | ${cellStr('A3')} ${cellStr('B3')} ${cellStr('C3')}  (maxCell=${gl.maxCellCount}, occ=${Math.round(gl.occupancyFrac * 100)}%)`);
  console.log(`  CAPTION:   ${mgCaptionIssues.length} midground issue(s)${fgCaptionIssues.length ? ` (+${fgCaptionIssues.length} fg-OTS lower-hands)` : ''} (band y=${geom.CAPTION[0]}..${geom.CAPTION[1]})`);
  console.log(`  SIGNS:     ${visSetSigns.length} visible · ${signOverlapCount} touched · ${signOccludedCount} GE-11 occluded`);
  console.log(`  OVERLAP:   ${pairOverlaps} pairwise body overlap(s)`);
  console.log(`  SCALE:     ${g.scaleIssues.length} LA-01 issue(s) (actor s=${actorS} in [${minS}..${maxS}]${placedSubject ? `, subject s=${placedSubject.s}` : ''})`);
  console.log(`  CUTOFF:    ${g.creatureCutoffIssues.length} LA-04 issue(s)${placedExtras.length ? ` (subject edge clip=${subjClip}%)` : ''}`);
  console.log(`  SOLVED IN: ${Date.now() - tStartPlace} ms`);
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
const serveUrl = await cachedBundle('src/index.ts');
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
const is16x9 = geom.FORMAT === '16:9';
const CONTACT_LABELS = ['a', 'b', 'c', 'd'];
const SEG_FRACS = [0.12, 0.38, 0.64, 0.88];
const SHOT_STRIP_FRACS = [0.04, 0.17, 0.30, 0.43, 0.57, 0.70, 0.83, 0.96];
const contactFracs = (r) => ((r.t1 - r.t0) > 4.0 ? SEG_FRACS : [0.25, 0.75]);
const slugify = (s) => String(s ?? 'set').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'set';

// Tier 1 — Đại đoạn: episode-wide contact sheets (4 frames for >4.0s shots, 2 frames for <=4.0s shots)
const runContact = async (forceAll) => {
  const changed = rows.filter((r) => cache.contact?.[r.i] !== hashes[r.i]).map((r) => r.i);
  const jobs = rows.flatMap((r) => contactFracs(r).map((u, idx) => ({r, u, idx, t: r.t0 + (r.t1 - r.t0) * u, out: `qa/_f/c${r.i}_${u}.jpg`})));
  const st = await renderAll(jobs, (j) => !forceAll && !changed.includes(j.r.i));
  const unreviewed = new Set(rows.filter((r) => { try { const v = JSON.parse(fs.readFileSync(`qa/review/${pad(r.i)}.json`, 'utf8')); return v.verdict !== 'ok' || v.hash !== hashes[r.i]; } catch { return true; } }).map((r) => r.i));
  const per = 24;
  const contactCols = is16x9 ? 4 : 6;
  const contactW = is16x9 ? 380 : 300;
  const jobsByShot = new Map();
  for (const j of jobs) {
    if (!jobsByShot.has(j.r.i)) jobsByShot.set(j.r.i, []);
    jobsByShot.get(j.r.i).push(j);
  }
  const pages = [];
  const contactIndex = {};
  let curPage = [];
  for (const r of rows) {
    const rJobs = jobsByShot.get(r.i) ?? [];
    const rCells = rJobs.map(({idx, t, out}) => ({
      img: out,
      label: `#${r.i} ${CONTACT_LABELS[idx] ?? idx} · ${fmt(t)}${unreviewed.has(r.i) ? ' ●' : ''}`,
      sub: idx === 0 ? r.name : (idx === 1 ? `${r.set} · ${fmt(r.t1 - r.t0)}` : ''),
    }));
    if (curPage.length > 0 && curPage.length + rCells.length > per) {
      pages.push(curPage);
      curPage = [];
    }
    contactIndex[r.i] = `qa/contact_p${pages.length + 1}.jpg`;
    curPage.push(...rCells);
  }
  if (curPage.length) pages.push(curPage);
  for (const f of fs.readdirSync('qa')) { const m = /^contact_p(\d+)\.(png|jpg)$/.exec(f); if (m && (m[2] === 'png' || +m[1] > pages.length)) fs.unlinkSync(path.join('qa', f)); }
  for (let p = 0; p < pages.length; p++) {
    tile({out: `qa/contact_p${p + 1}.jpg`, cols: contactCols, w: contactW, title: `CONTACT · trang ${p + 1} · ${rows.length} shot · ${fmt(P.DURATION)} · ● = chưa review ở bản này`, cells: pages[p]});
  }
  cache.contact = {...hashes};
  fs.writeFileSync('qa/contact_index.json', JSON.stringify(contactIndex, null, 1) + '\n');
  fs.writeFileSync('qa/changed.json', JSON.stringify({at: new Date().toISOString(), shots: changed, all: rows.length}, null, 1));
  console.log(`contact: ${pages.length} page(s) · ${st.rendered} rendered, ${st.reused} reused · changed shots: ${changed.join(',') || 'none'} · ${((Date.now() - t00) / 1000).toFixed(0)} s`);
};

// Tier 2 — Trung đoạn: contiguous location-grouped contact sheets (4 frames/shot, max 8 shots/sheet)
const runSegmentContacts = async (forceAll) => {
  fs.mkdirSync('qa/contact_segments', {recursive: true});
  cache.segments ??= {};
  cache.segment_sheets ??= {};
  const groups = [];
  for (const r of rows) {
    const locRaw = P.SETS?.[r.set]?.location;
    const loc = (typeof locRaw === 'string' && locRaw.trim()) ? locRaw.trim() : r.set;
    const prev = groups[groups.length - 1];
    if (prev && prev.loc === loc && prev.shots.length < 8) {
      prev.shots.push(r);
    } else {
      groups.push({loc, shots: [r]});
    }
  }
  const jobs = rows.flatMap((r) => SEG_FRACS.map((u, idx) => ({
    r, u, idx, t: r.t0 + (r.t1 - r.t0) * u, out: `qa/_f/c${r.i}_${u}.jpg`,
  })));
  const st = await renderAll(jobs, (j) => {
    if (forceAll) return false;
    if (cache.segments[j.r.i] === hashes[j.r.i]) return true;
    return (j.r.t1 - j.r.t0) > 4.0 && cache.contact?.[j.r.i] === hashes[j.r.i];
  });
  const segIndex = {};
  const keptFiles = new Set();
  const segW = is16x9 ? 420 : 300;
  let tiled = 0;
  for (let gIdx = 1; gIdx <= groups.length; gIdx++) {
    const g = groups[gIdx - 1];
    const fname = `seg_${pad(gIdx)}_${slugify(g.loc)}.jpg`;
    const outPath = `qa/contact_segments/${fname}`;
    keptFiles.add(fname);
    const first = g.shots[0].i;
    const last = g.shots[g.shots.length - 1].i;
    const groupSig = g.shots.map((r) => `${r.i}:${hashes[r.i]}`).join(',');
    if (forceAll || !fs.existsSync(outPath) || cache.segment_sheets[fname] !== groupSig) {
      const cells = g.shots.flatMap((r) => SEG_FRACS.map((u, idx) => ({
        img: `qa/_f/c${r.i}_${u}.jpg`,
        label: `#${r.i} ${CONTACT_LABELS[idx]} · ${fmt(r.t0 + (r.t1 - r.t0) * u)}`,
        sub: idx === 0 ? r.name : (idx === 1 ? `${r.set} · ${fmt(r.t1 - r.t0)}` : ''),
      })));
      tile({
        out: outPath,
        cols: 4,
        w: segW,
        title: `TRUNG ĐOẠN ${gIdx} · ${g.loc} · shots #${first}–#${last}`,
        cells,
      });
      cache.segment_sheets[fname] = groupSig;
      tiled++;
    }
    for (const r of g.shots) segIndex[r.i] = outPath;
  }
  for (const f of fs.readdirSync('qa/contact_segments')) {
    if (/^seg_\d+_.*\.jpg$/.test(f) && !keptFiles.has(f)) {
      try { fs.unlinkSync(path.join('qa/contact_segments', f)); } catch {}
    }
  }
  for (const r of rows) cache.segments[r.i] = hashes[r.i];
  fs.writeFileSync('qa/contact_segments/index.json', JSON.stringify(segIndex, null, 1) + '\n');
  console.log(`segments: ${groups.length} sheet(s) (${tiled} tiled) · ${st.rendered} rendered, ${st.reused} reused · ${((Date.now() - t00) / 1000).toFixed(0)} s`);
};

// Tier 3 — Tiểu đoạn: 8-frame (4×2) motion strips for long (>4.0s), motion/subject, or HOT shots
const shotNeedsStrip = (r, hot) => {
  if ((r.t1 - r.t0) > 4.0) return true;
  if (Array.isArray(hot[r.i]) && hot[r.i].length > 0) return true;
  const s = P.SHOTS?.[r.i];
  if ((r.actors ?? []).some((a) => a.walks || (a.path && a.path.length > 1))) return true;
  if ((s?.actors ?? []).some((A) =>
    A.walks || (A.path && A.path.length > 1) || (A.arcH ?? 0) > 0 || A.pushTarget || A.mount || A.ride ||
    (Array.isArray(A.reach) && A.reach.length > 0) ||
    (Array.isArray(A.legs) ? A.legs.some(([m]) => String(m) === 'jump') : A.legs === 'jump')
  )) return true;
  if ((s?.extras ?? []).some((ex) => !!P.SUBJECTS?.[ex.k])) return true;
  return false;
};

const PY_MOTION_ENERGY = `
import json, sys
import numpy as np
from PIL import Image

spec = json.loads(open(sys.argv[1], encoding="utf-8").read())
y0, y1 = int(spec["y0"]), int(spec["y1"])
out = {}
for k, paths in spec["shots"].items():
    arrs = []
    for p in paths:
        with Image.open(p) as im:
            g = np.asarray(im.convert("L"), dtype=np.int16)
        ih = g.shape[0]
        cy0 = max(0, min(ih - 1, y0))
        cy1 = max(cy0 + 1, min(ih, y1))
        arrs.append(g[cy0:cy1, :])
    raw_deltas = []
    streak = 0
    max_streak = 0
    for i in range(len(arrs) - 1):
        a, b = arrs[i], arrs[i + 1]
        if a.shape != b.shape:
            h = min(a.shape[0], b.shape[0])
            w = min(a.shape[1], b.shape[1])
            a, b = a[:h, :w], b[:h, :w]
        pct = float((np.abs(a - b) > 18).mean() * 100.0)
        raw_deltas.append(pct)
        if pct < 0.18:
            streak += 1
            if streak > max_streak:
                max_streak = streak
        else:
            streak = 0
    pair_deltas = [round(v, 2) for v in raw_deltas]
    out[k] = {
        "mean_delta_pct": round(sum(raw_deltas) / len(raw_deltas), 2) if raw_deltas else 0.0,
        "min_delta_pct": round(min(raw_deltas), 2) if raw_deltas else 0.0,
        "pair_deltas": pair_deltas,
        "frozen_streak": max_streak,
    }
sys.stdout.write(json.dumps(out))
`;

const measureShotStripsMotion = (targetRows) => {
  const rawExisting = readJson('qa/motion_energy.json', {});
  const motionEnergy = {};
  for (const [k, v] of Object.entries(rawExisting ?? {})) {
    const idx = Number(k);
    if (Number.isInteger(idx) && idx >= 0 && idx < rows.length && v && typeof v === 'object') {
      motionEnergy[idx] = v;
    }
  }
  if (targetRows.length > 0) {
    const specPath = 'qa/_f/motion_energy_spec.json';
    const shotsPayload = Object.fromEntries(targetRows.map((r) => [
      r.i,
      SHOT_STRIP_FRACS.map((_, idx) => `qa/_f/s${r.i}_${idx}.jpg`),
    ]));
    fs.writeFileSync(specPath, JSON.stringify({
      y0: Math.round(95 * SCALE),
      y1: Math.round((geom.CAPTION[0] - 12) * SCALE),
      shots: shotsPayload,
    }));
    const stdout = execFileSync(PYTHON, ['-c', PY_MOTION_ENERGY, specPath], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    const computed = JSON.parse(stdout);
    for (const [k, v] of Object.entries(computed)) {
      motionEnergy[Number(k)] = v;
    }
  }
  fs.writeFileSync('qa/motion_energy.json', JSON.stringify(motionEnergy, null, 1) + '\n');
  return motionEnergy;
};

// Unit-scoped contact sheet: qa/units/<unitId>_contact.jpg (4 frames/shot across all shots in unit)
const runUnitContact = async (uMeta, forceAll) => {
  fs.mkdirSync('qa/units', {recursive: true});
  cache.unit_contact ??= {};
  cache.unit_sheets ??= {};
  cache.segments ??= {};
  const uRows = uMeta.unitRows;
  const jobs = uRows.flatMap((r) => SEG_FRACS.map((u, idx) => ({
    r, u, idx, t: r.t0 + (r.t1 - r.t0) * u, out: `qa/_f/c${r.i}_${u}.jpg`,
  })));
  const st = await renderAll(jobs, (j) => {
    if (forceAll) return false;
    if (cache.unit_contact[j.r.i] === hashes[j.r.i]) return true;
    if (cache.segments[j.r.i] === hashes[j.r.i]) return true;
    return (j.r.t1 - j.r.t0) > 4.0 && cache.contact?.[j.r.i] === hashes[j.r.i];
  });
  const unreviewed = new Set(uRows.filter((r) => {
    try {
      const v = JSON.parse(fs.readFileSync(`qa/review/${pad(r.i)}.json`, 'utf8'));
      return v.verdict !== 'ok' || v.hash !== hashes[r.i];
    } catch {
      return true;
    }
  }).map((r) => r.i));
  const outPath = `qa/units/${uMeta.id}_contact.jpg`;
  const unitSig = uRows.map((r) => `${r.i}:${hashes[r.i]}:${unreviewed.has(r.i) ? 1 : 0}`).join(',');
  const unitCols = uRows.length <= 7 ? 4 : 8;
  const unitW = is16x9 ? 380 : 300;
  if (forceAll || !fs.existsSync(outPath) || cache.unit_sheets[uMeta.id] !== unitSig) {
    const cells = uRows.flatMap((r) => SEG_FRACS.map((u, idx) => ({
      img: `qa/_f/c${r.i}_${u}.jpg`,
      label: `#${r.i} ${CONTACT_LABELS[idx]} · ${fmt(r.t0 + (r.t1 - r.t0) * u)}${unreviewed.has(r.i) ? ' ●' : ''}`,
      sub: idx === 0 ? r.name : (idx === 1 ? `${r.set} · ${fmt(r.t1 - r.t0)}` : ''),
    })));
    const first = uRows[0].i;
    const last = uRows[uRows.length - 1].i;
    tile({
      out: outPath,
      cols: unitCols,
      w: unitW,
      title: `UNIT ${uMeta.id}${uMeta.title ? ' · ' + uMeta.title : ''} (${uMeta.seg_start}..${uMeta.seg_end}) · shots #${first}–#${last} (${uRows.length}) · ${fmt(uMeta.t0)}–${fmt(uMeta.t1)}`,
      cells,
    });
    cache.unit_sheets[uMeta.id] = unitSig;
  }
  for (const r of uRows) {
    cache.unit_contact[r.i] = hashes[r.i];
    cache.segments[r.i] = hashes[r.i];
  }
  const unitIdxPath = 'qa/units/index.json';
  const unitIdx = readJson(unitIdxPath, {units: {}, shots: {}});
  unitIdx.units ??= {};
  unitIdx.shots ??= {};
  unitIdx.units[uMeta.id] = outPath;
  for (const r of uRows) unitIdx.shots[r.i] = outPath;
  fs.writeFileSync(unitIdxPath, JSON.stringify(unitIdx, null, 1) + '\n');
  console.log(`unit-contact (${uMeta.id}): ${outPath} · ${uRows.length} shot(s) (4 frames/shot) · ${st.rendered} rendered, ${st.reused} reused · ${((Date.now() - t00) / 1000).toFixed(0)} s`);
};

const runShotStrips = async (forceAll, which = null, unitFilterSet = null) => {
  const hot = readJson('qa/hot.json', {});
  fs.mkdirSync('qa/shots', {recursive: true});
  cache.shot_strips ??= {};
  const existingEnergy = readJson('qa/motion_energy.json', {});
  const pool = unitFilterSet ? rows.filter((r) => unitFilterSet.has(r.i)) : rows;
  const sel = which === 'all'
    ? pool
    : which
      ? pool.filter((r) => which.split(',').map(Number).includes(r.i))
      : pool.filter((r) => shotNeedsStrip(r, hot));
  const todo = sel.filter((r) =>
    forceAll ||
    cache.shot_strips[r.i] !== hashes[r.i] ||
    !fs.existsSync(`qa/shots/${pad(r.i)}.jpg`) ||
    !Array.isArray(existingEnergy?.[r.i]?.pair_deltas)
  );
  const jobs = todo.flatMap((r) => SHOT_STRIP_FRACS.map((u, idx) => ({
    r, idx, t: r.t0 + (r.t1 - r.t0) * u, out: `qa/_f/s${r.i}_${idx}.jpg`,
  })));
  const st = await renderAll(jobs, (j) => !forceAll && cache.shot_strips[j.r.i] === hashes[j.r.i]);
  const motionEnergy = measureShotStripsMotion(todo);
  for (const r of sel) {
    const frozen_streak = motionEnergy[r.i]?.frozen_streak ?? 0;
    if (frozen_streak >= 2) {
      console.log(`WARN motion-freeze: shot #${r.i} has ${frozen_streak} consecutive near-static strip intervals (<0.18% active px change)`);
    }
  }
  const stripW = is16x9 ? 420 : 300;
  for (const r of todo) {
    const rJobs = jobs.filter((j) => j.r === r);
    const pairDeltas = motionEnergy[r.i]?.pair_deltas ?? [];
    tile({
      out: `qa/shots/${pad(r.i)}.jpg`,
      cols: 4,
      w: stripW,
      title: `TIỂU ĐOẠN #${r.i} ${r.name} · ${r.set} · ${fmt(r.t1 - r.t0)} · hash ${hashes[r.i]}`,
      cells: rJobs.map((j) => ({
        img: j.out,
        label: `f${j.idx + 1} · ${fmt(j.t)}`,
        sub: j.idx > 0 && pairDeltas[j.idx - 1] !== undefined ? `Δ=${pairDeltas[j.idx - 1]}%` : '',
      })),
    });
    cache.shot_strips[r.i] = hashes[r.i];
  }
  console.log(`shotstrips: ${todo.length}/${sel.length} sheet(s) · ${st.rendered} rendered, ${st.reused} reused · ${((Date.now() - t00) / 1000).toFixed(0)} s`);
};

const stripOverlapsUnit = (s, uMeta) => {
  if (!uMeta) return true;
  const m = /^s(\d+)_/.exec(String(s?.name ?? ''));
  if (m && uMeta.shotSet.has(Number(m[1]))) return true;
  if (typeof s?.t0 === 'number') {
    const st1 = typeof s?.t1 === 'number' ? s.t1 : s.t0;
    return s.t0 < uMeta.t1 - 0.01 && st1 > uMeta.t0 - 0.01;
  }
  return false;
};

const runStrips = async (onlyNames, forceAll, staleOnly = false, unitMetaFilter = null) => {
  const need = readJson('qa/strips_needed.json', []);
  fs.mkdirSync('qa/strips', {recursive: true});
  cache.strips ??= {};
  const isFresh = (s) => cache.strips[s.name] === stripKey(s) && fs.existsSync(`qa/strips/${s.name}.jpg`);
  const sel = need.filter((s) =>
    stripOverlapsUnit(s, unitMetaFilter) &&
    (!onlyNames || onlyNames.includes(s.name)) &&
    (!staleOnly || forceAll || !isFresh(s))
  );
  const jobs = sel.flatMap((s) => Array.from({length: s.n}, (_, i) => ({s, i, t: s.t0 + ((s.t1 - s.t0) * i) / (s.n - 1), out: `qa/_f/${s.name}_${i}.jpg`})));
  const st = await renderAll(jobs, (j) => !forceAll && isFresh(j.s));
  for (const s of sel) {
    const cells = jobs.filter((j) => j.s === s).map((j) => ({img: j.out, label: fmt(j.t), sub: j.i === 0 ? s.why : ''}));
    const cols = is16x9 ? Math.min(4, Math.max(1, s.n)) : (s.n <= 4 ? s.n : Math.ceil(s.n / 2));
    const stripW = is16x9 ? 380 : 270;
    tile({out: `qa/strips/${s.name}.jpg`, cols, w: stripW, title: `${s.name} · ${s.why} · ${fmt(s.t0)}–${fmt(s.t1)}`, cells});
    try { fs.unlinkSync(`qa/strips/${s.name}.png`); } catch {}
    cache.strips[s.name] = stripKey(s);
  }
  console.log(`strips: ${sel.length} · ${st.rendered} frames rendered, ${st.reused} reused · ${((Date.now() - t00) / 1000).toFixed(0)} s`);
};

const runCards = async (which, forceAll, includeStaleInChanged = false, unitFilterSet = null) => {
  const hot = readJson('qa/hot.json', {});
  const pool = unitFilterSet ? rows.filter((x) => unitFilterSet.has(x.i)) : rows;
  const ch = (!unitFilterSet && fs.existsSync('qa/changed.json'))
    ? JSON.parse(fs.readFileSync('qa/changed.json', 'utf8')).shots
    : pool.filter((x) => cache.cards?.[x.i] !== hashes[x.i] || !fs.existsSync(`qa/cards/${pad(x.i)}.jpg`) || !fs.existsSync(`qa/snap/${hashes[x.i]}.json`)).map((x) => x.i);
  const sel = !which || which === 'all' ? pool
    : which === 'changed' ? pool.filter((x) => ch.includes(x.i) || (includeStaleInChanged && (cache.cards?.[x.i] !== hashes[x.i] || !fs.existsSync(`qa/cards/${pad(x.i)}.jpg`) || !fs.existsSync(`qa/snap/${hashes[x.i]}.json`))))
    : which === 'hot' ? pool.filter((x) => hot[x.i])
    : pool.filter((x) => which.split(',').map(Number).includes(x.i));
  fs.mkdirSync('qa/cards', {recursive: true});
  const jobs = sel.flatMap((x) => [0.15, 0.5, 0.85].map((u, n) => ({x, n, t: x.t0 + (x.t1 - x.t0) * u, out: `qa/_f/k${x.i}_${n}.jpg`})));
  cache.cards ??= {};
  await renderAll(jobs, (j) => !forceAll && cache.cards[j.x.i] === hashes[j.x.i]);
  const isLongHeavy = is16x9 && (rows.length >= 80 || Boolean(unitFilterSet));
  const probes = sel.flatMap((x) => {
    const dur = x.t1 - x.t0;
    const n = isLongHeavy
      ? Math.max(4, Math.min(8, Math.ceil(dur / 0.45)))
      : Math.max(6, Math.min(16, Math.ceil(dur / 0.2)));
    return Array.from({length: n}, (_, k) => ({x, k, n, t: x.t0 + dur * (k + 0.5) / n, scale: 0.25, q: 92, out: `qa/snap/${hashes[x.i]}_p${k}.jpg`}));
  });
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
  fs.writeFileSync(sp, JSON.stringify({out: `qa/crops/${pad(x.i)}.jpg`, title: `#${x.i} ${x.name} · crops · hash ${hashes[x.i]}`, frame_size: [geom.W, geom.H], rows: rowsOut}));
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
    if (activeUnit) {
      await runUnitContact(activeUnit, passAll);
      await runShotStrips(passAll, null, activeUnit.shotSet);
      await runStrips(null, passAll, true, activeUnit);
      await runCards(passAll ? 'all' : 'changed', passAll, true, activeUnit.shotSet);
      const hot = readJson('qa/hot.json', {});
      const hotTodo = Object.keys(hot)
        .map(Number)
        .filter((i) => activeUnit.shotSet.has(i) && hot[i]?.length && (passAll || cache.crops?.[i] !== hashes[i] || !fs.existsSync(`qa/crops/${pad(i)}.jpg`)))
        .sort((a, b) => a - b);
      for (const i of hotTodo) await runCrops(i);
      console.log(`pass --unit ${activeUnit.id} (${passAll ? 'all' : 'changed'}): ${hotTodo.length} HOT crop(s) rendered · render total ${((Date.now() - t00) / 1000).toFixed(0)} s`);
    } else {
      await runContact(passAll);
      await runSegmentContacts(passAll);
      await runShotStrips(passAll);
      await runStrips(null, false, true);
      await runCards(passAll ? 'all' : 'changed', passAll, true);
      const hot = readJson('qa/hot.json', {});
      const hotTodo = Object.keys(hot).map(Number).filter((i) => hot[i]?.length && (cache.crops?.[i] !== hashes[i] || !fs.existsSync(`qa/crops/${pad(i)}.jpg`))).sort((a, b) => a - b);
      for (const i of hotTodo) await runCrops(i);
      console.log(`pass (${passAll ? 'all' : 'changed'}): ${hotTodo.length} HOT crop(s) rendered · render total ${((Date.now() - t00) / 1000).toFixed(0)} s`);
    }
  } else if (mode === 'contact') {
    if (activeUnit) await runUnitContact(activeUnit, ALL);
    else await runContact(ALL);
  } else if (mode === 'segments') {
    await runSegmentContacts(ALL);
  } else if (mode === 'shotstrips') {
    await runShotStrips(ALL, arg ?? null, activeUnit?.shotSet ?? null);
  } else if (mode === 'strips') {
    await runStrips(arg ? arg.split(',') : null, ALL, false, activeUnit);
  } else if (mode === 'cards') {
    await runCards(arg, ALL, false, activeUnit?.shotSet ?? null);
  } else if (mode === 'crops') {
    if (arg !== undefined) {
      await runCrops(+arg);
    } else if (activeUnit) {
      const hot = readJson('qa/hot.json', {});
      const hotTodo = Object.keys(hot).map(Number).filter((i) => activeUnit.shotSet.has(i) && hot[i]?.length).sort((a, b) => a - b);
      for (const i of hotTodo) await runCrops(i);
    } else {
      throw new Error('usage: node scripts/qa.mjs crops <i> (or crops --unit <unitId>)');
    }
  } else if (mode === 'frames') {
    fs.mkdirSync('qa/frames', {recursive: true});
    for (const t of arg.split(',').map(Number)) { await still(t, `qa/frames/t${t.toFixed(2)}.jpg`, 1, 88); console.log('ok', t); }
  } else if (mode === 'shot') {
    const r = rows[+arg];
    if (!r) throw new Error(`no shot #${arg} (0–${rows.length - 1})`);
    fs.mkdirSync('qa/shots', {recursive: true});
    const jobs = SHOT_STRIP_FRACS.map((u, idx) => ({idx, t: r.t0 + (r.t1 - r.t0) * u, out: `qa/_f/s${r.i}_${idx}.jpg`}));
    await renderAll(jobs);
    const motionEnergy = measureShotStripsMotion([r]);
    const frozen_streak = motionEnergy[r.i]?.frozen_streak ?? 0;
    if (frozen_streak >= 2) {
      console.log(`WARN motion-freeze: shot #${r.i} has ${frozen_streak} consecutive near-static strip intervals (<0.18% active px change)`);
    }
    const pairDeltas = motionEnergy[r.i]?.pair_deltas ?? [];
    tile({
      out: `qa/shots/${pad(r.i)}.jpg`,
      cols: 4,
      w: is16x9 ? 420 : 300,
      title: `TIỂU ĐOẠN #${r.i} ${r.name} · ${r.set} · ${fmt(r.t1 - r.t0)} · hash ${hashes[r.i]}`,
      cells: jobs.map((j) => ({
        img: j.out,
        label: `f${j.idx + 1} · ${fmt(j.t)}`,
        sub: j.idx > 0 && pairDeltas[j.idx - 1] !== undefined ? `Δ=${pairDeltas[j.idx - 1]}%` : '',
      })),
    });
    cache.shot_strips ??= {};
    cache.shot_strips[r.i] = hashes[r.i];
    console.log('ok', r.i, `${((Date.now() - t00) / 1000).toFixed(0)} s`);
  } else {
    console.log('modes: pass [changed|all] [--unit U1] | where <i> [t] [--free WxH] | layout [i] [t] [--unit U1] | place <setId> [--actors N] [--subject key[:pose]] [--ots] [--cam cx,cy,k] | review --batch <file.jsonl> | contact [--all] [--unit U1] | segments [--all] | shotstrips [all|0,1] [--unit U1] [--all] | strips [names] [--unit U1] [--all] | cards [changed|hot|all|i,j] [--unit U1] | crops <i> | frames t1,t2 | shot <i> | status');
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
  const revList = activeUnit
    ? (carry.review ?? []).filter((x) => activeUnit.shotSet.has(x.shot))
    : (carry.review ?? []);
  const revShots = revList.map((x) => x.shot);
  console.log(`pass${activeUnit ? ` --unit ${activeUnit.id}` : ''} review list (${revShots.length}): ${JSON.stringify(revShots)}`);
  for (const x of revList) console.log(`  #${x.shot}: ${x.why}`);
  fs.writeFileSync('qa/qa_status.json', JSON.stringify(computeStatus(), null, 1));
  execFileSync(process.execPath, ['scripts/blind_pack.mjs', ...(activeUnit ? ['--unit', activeUnit.id] : [])], {stdio: 'inherit'});
}
