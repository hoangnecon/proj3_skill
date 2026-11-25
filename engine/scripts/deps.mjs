// Per-shot dependency hash (v3.7). A shot is stale only when something it actually draws changed:
//   its row in the shot table (times already resolved), the engine (any src file not split below),
//   the source units it reaches — its set, the world props it places, the looks it casts, and every
//   top-level helper those reach, transitively — and the words spoken in or near it (captions).
// Before v3.7 the hash held ALL of src: one edit in props.tsx or one re-take of the voice made every
// shot stale, and every shot was rendered and reviewed again.
//
// Safe by construction: anything the splitter does not understand (top-level statements that are not
// declarations, a file it does not split) goes into the engine part, which every shot hashes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const SRC_RE = /\.(tsx?|jsx?|mjs|json|css|svg)$/;

// files split into units; everything else in src/ is "engine"
const SPLIT = (f) => /src[\\/]props\.tsx$/.test(f) || (/src[\\/](episode|exemplar)[\\/]/.test(f) && !/shotlist/.test(f));
// registries whose entries are roots: a reference to the registry NAME pulls the whole registry
const REGISTRIES = ['EPISODE_SETS', 'EXEMPLAR_SETS', 'WORLD_PROPS', 'HAND_PROPS', 'SIDE_PROPS', 'CAST', 'CAST_ROLES', 'EX_LOOKS'];
const DECL_RE = /^(?:export\s+)?(?:const|let|var|function\*?|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/;
const ENTRY_RE = /^ {2}(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$-]*))\s*:/;

function splitFile(file, text, units, preamble) {
  const lines = text.split('\n');
  let cur = null; let buf = [];
  const flush = () => {
    if (cur) units.set(cur, (units.get(cur) ?? '') + buf.join('\n'));
    else if (buf.length) {
      // only imports, comments and blank lines are harmless outside a declaration
      const live = buf.filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*|import\b|\}?\s*from\b)/.test(l) && !/^\s*[\w\s{},*]+\s*from\s*['"]/.test(l));
      if (live.length) preamble.push(file + '\n' + live.join('\n'));
    }
    buf = [];
  };
  for (const l of lines) {
    const m = DECL_RE.exec(l);
    if (m) { flush(); cur = m[1]; }
    // a statement at column 0 that is not a declaration, a closer or a comment runs for every shot
    else if (cur && /^[^\s})\]\/*]/.test(l) && !/^(import|export\s*\{|export\s+\*|export\s+type)/.test(l)) { preamble.push(file + '\n' + l); continue; }
    buf.push(l);
  }
  flush();
}

function splitRegistry(name, text, units) {
  // entries at 2-space indent inside `NAME ... = {` ... `};`
  const lines = text.split('\n');
  const head = []; let key = null; let buf = [];
  const put = () => { if (key) units.set(`${name}.${key}`, buf.join('\n')); buf = []; };
  for (const l of lines.slice(1)) {
    const m = ENTRY_RE.exec(l);
    if (m) { put(); key = m[1] ?? m[2] ?? m[3]; }
    if (key) buf.push(l); else head.push(l);
  }
  put();
  units.set(name + '#head', lines[0] + '\n' + head.join('\n'));
  units.set(name, '');   // the whole registry: depends on every entry (below)
}

export function buildDeps() {
  const files = walk('src').filter((f) => SRC_RE.test(f) && !/src[\\/]data[\\/]/.test(f) && !/src[\\/]design[\\/]/.test(f) && !/shotlist/.test(f)).sort();
  const units = new Map(); const preamble = []; const engine = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    if (SPLIT(f)) splitFile(f, text, units, preamble); else engine.push(f + '\n' + text);
  }
  for (const r of REGISTRIES) if (units.has(r)) splitRegistry(r, units.get(r), units);
  // references: identifiers that name a unit, and string literals that name a registry entry
  const entryByKey = new Map();
  for (const k of units.keys()) { const i = k.indexOf('.'); if (i > 0) { const key = k.slice(i + 1); (entryByKey.get(key) ?? entryByKey.set(key, []).get(key)).push(k); } }
  const refs = new Map();
  for (const [k, text] of units) {
    const out = new Set();
    const self = k.split(/[.#]/)[0];
    for (const id of text.match(/[A-Za-z_$][\w$]*/g) ?? []) if (id !== self && units.has(id)) out.add(id);
    for (const m of text.matchAll(/['"]([\w-]+)['"]/g)) for (const e of entryByKey.get(m[1]) ?? []) if (e !== k) out.add(e);
    // an entry depends on its registry header (types, shared defaults)
    const i = k.indexOf('.'); if (i > 0) out.add(k.slice(0, i) + '#head');
    refs.set(k, out);
  }
  // the registry name itself (a reference to the whole registry) depends on every entry
  for (const r of REGISTRIES) if (units.has(r)) for (const k of units.keys()) if (k.startsWith(r + '.') || k === r + '#head') refs.get(r).add(k);
  const engineHash = sha(engine.join('\n') + preamble.join('\n') + (fs.existsSync('public') ? walk('public').filter((f) => /\.(png|jpe?g|webp|svg|mp4|webm)$/i.test(f)).sort().map((f) => f + fs.statSync(f).size + ':' + fs.statSync(f).mtimeMs).join('\n') : ''));
  const closure = (roots) => {
    const seen = new Set(); const st = [...roots].filter((r) => units.has(r));
    while (st.length) { const k = st.pop(); if (seen.has(k)) continue; seen.add(k); for (const d of refs.get(k) ?? []) if (!seen.has(d)) st.push(d); }
    return [...seen].sort();
  };
  return {units, refs, engineHash, closure, preamble};
}

// roots: every string in the shot (its row AND its definition in shotlist.ts — the row drops fields such as an
// actor's held prop) that names a registry entry: its set, looks, held/world props, ...
const strings = (x, out = []) => { if (typeof x === 'string') out.push(x); else if (x && typeof x === 'object') for (const v of Object.values(x)) strings(v, out); return out; };
export function rowRoots(r, def) {
  const ss = new Set([...strings(r), ...strings(def ?? {})]);
  return [...ss].flatMap((v) => REGISTRIES.map((g) => `${g}.${v}`));
}

// words of every segment spoken within 3 s of the shot (caption lines are grouped per segment)
export function wordsFor(r, words) {
  const segs = new Set(words.filter((w) => w.e >= r.t0 - 3 && w.s <= r.t1 + 3).map((w) => w.seg));
  return words.filter((w) => segs.has(w.seg));
}

export function makeShotHash(rows, shots = []) {
  const D = buildDeps();
  const words = fs.existsSync('src/data/words.json') ? JSON.parse(fs.readFileSync('src/data/words.json', 'utf8')) : [];
  const cues = fs.existsSync('src/data/cues.json') ? JSON.parse(fs.readFileSync('src/data/cues.json', 'utf8')) : {};
  const total = cues.total ?? 0;
  const memo = new Map();
  const unitHash = (k) => memo.get(k) ?? memo.set(k, sha(k + D.units.get(k))).get(k);
  // static part: what the shot IS (engine, its definition with word anchors, the code it reaches) — no times
  // Numbers in a definition may be computed from timing (a walker's start x so it reaches its mark on a word), so
  // the static hash keeps the shape and every string but not the numbers; numsOf gives them for a drift check.
  const shape = (x) => JSON.stringify(x ?? null, (k, v) => (typeof v === 'number' ? '#' : v));
  const staticOf = (r) => sha([D.engineHash, shape(shots[r.i]), ...D.closure(rowRoots(r, shots[r.i])).map(unitHash)].join('|'));
  // the hand-written shot list (and the positions it imports): if it is unchanged, any number that moved in a
  // definition was moved by the timing, not by an edit
  const listSrc = sha(['src/episode/shotlist.ts', 'src/episode/geo.ts'].filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n'));
  const numsOf = (r) => { const out = []; JSON.stringify(shots[r.i] ?? null, (k, v) => { if (typeof v === 'number') out.push(v); return v; }); return out; };
  // full hash: + WHEN (resolved times in the row, the words spoken near it)
  const hashOf = (r) => sha([staticOf(r), JSON.stringify(shots[r.i] ?? null), JSON.stringify(r), JSON.stringify(wordsFor(r, words)), r.t1 > total - 5 ? String(total) : ''].join('|'));
  // the v3.6 per-shot hash (qa.mjs adopt only): all of src except shotlist/sets + public/timing.json, the row, String(render)
  const legacyHashOf = (P) => {
    const w = (d) => fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => e.isDirectory() ? w(path.join(d, e.name)) : [path.join(d, e.name)]);
    const shared = sha(w('src').filter((f) => /\.(tsx?|json)$/.test(f) && !/episode[\\/](shotlist|sets)/.test(f)).sort()
      .map((f) => f + fs.readFileSync(f, 'utf8')).join('\n') + (fs.existsSync('public/timing.json') ? fs.readFileSync('public/timing.json', 'utf8') : ''));
    return (r) => sha(shared + JSON.stringify(r) + (P.SETS[r.set] ? String(P.SETS[r.set].render) : ''));
  };
  return {hashOf, staticOf, numsOf, listSrc, legacyHashOf, D, explain: (r) => D.closure(rowRoots(r, shots[r.i]))};
}
