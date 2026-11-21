// Machine checks for design + shots. Writes qa/lint.json and qa/strips_needed.json; exit 1 on any error.
// Usage: node scripts/lint.mjs [design|shots|all]   (default all)
// Every rule here is documented in the skills (rule ids in brackets). Do not weaken a threshold to pass:
// fix the work. If a rule is genuinely wrong for a shot, add `// lint-ok: <rule> <reason>` on that shot's
// line in shotlist.ts — the reviewer must accept each waiver in the gate review.
import fs from 'node:fs';
import path from 'node:path';
import {loadProject} from './load.mjs';
import {actorBoxes, inter, area, CAPTION, W, H, measurePropBox, measureHandPropBox, overlayBoxesAt, setTextsAt, projectBox, shotGeometry, actorStateAt, scalarKeyAt} from './geom.mjs';

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
const EXPRS = new Set(['neutral', 'smug', 'angry', 'shock', 'sad', 'cry', 'joy', 'stern', 'sly', 'deadpan', 'eager', 'shh']);
const SIDE_ARMS = new Set(['swing', 'down', 'hold', 'phone', 'cane', 'carry', 'ride', 'shh', 'raise', 'pocket']);
const OVER = new Set(['tag', 'bubble', 'label', 'stamp', 'score', 'pin', 'title', 'card', 'arrow']);
const TH = {shapes: 60, colours: 8, texts: 2, halftone: 2, glow: 1, insertShapes: 15}; // exemplar median = 60 shapes

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
  }
  const princ = keys.filter((k) => P.CAST_ROLES[k]?.role === 'principal');
  if (keys.length && !princ.length) err('CH-09', 'no principal in CAST_ROLES');
  if (princ.length > 4) warn('CH-09', `${princ.length} principals — a 2–3 minute story rarely carries more than 3`);

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
      if (st.shapes < TH.shapes) err('SE-06', `${id}: ${st.shapes} shapes < ${TH.shapes} (exemplar median). Add fixtures, clutter, wear — see sets.md §Detail budget`);
      if (st.colours < TH.colours) err('SE-08', `${id}: ${st.colours} distinct colours < ${TH.colours}`);
      if (st.texts < TH.texts) err('SE-07', `${id}: ${st.texts} diegetic texts < ${TH.texts} (signs, labels, notices — one must be a gag)`);
      if (st.halftone < TH.halftone) err('SE-09', `${id}: halftone texture used ${st.halftone}× < ${TH.halftone} (walls/floor/shade side)`);
      const pl = plateStats[id];
      if (!pl) err('SE-13', `${id}: plate not measured yet — run node scripts/design.mjs`);
      else if ((pl.measured ?? pl.mtime) * 1000 < fs.statSync('src/episode/sets.tsx').mtimeMs) err('SE-13', `${id}: plate is older than src/episode/sets.tsx — re-render with node scripts/design.mjs --only set:${id}`);
      else if (pl.empty_mid > 8) err('SE-13', `${id}: ${pl.empty_mid} empty 180-px cells in the visible middle of the plate (max 8; rows ${pl.rows}) — detail must be IN FRAME, not off-screen. Fill the wall band: notices, fixtures, clutter (sets.md §3)`);
      else if (pl.empty_mid > 5) warn('SE-13', `${id}: ${pl.empty_mid} empty cells in the middle of the plate (rows ${pl.rows}) — look for bare wall`);
      if (!st.moves) warn('SE-12', `${id}: nothing in the set changes over time — add life driven by o.t (LED pulse, fan, smoke, leaves, clock; sets.md §7)`);
      if (st.glow < TH.glow) err('SE-10', `${id}: no light source glow (url(#glowY)) — every location has a visible light source`);
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
    }
  }
  // PR-01, PR-02 & PR-03: human-scale guard, internal text collision & disembodied head check on custom episode WORLD_PROPS
  {
    const BUILTIN_PROPS = new Set(['stool', 'cone', 'lamp', 'gladiolus', 'cat', 'chicken', 'xoi', 'lobster', 'wagyu', 'tofu']);
    const BIG_VEH = /bus|truck|van|train|ambulance|fire.?truck/i;
    const SMALL_VEH = /kart|cart|car|taxi|moto|bike/i;
    const GROUND_PROP = /bus|truck|van|train|ambulance|fire.?truck|kart|cart|car|taxi|moto|bike|table|desk|bench|crib|chair|stool|fence|stand|rack|float|podium|counter|shelf|crate|box|barrel|pot|plant/i;
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
    const ENGINE = /^src[\\/](chars|kit|side|Film|Root|overlays)\.tsx$|^src[\\/](design|exemplar)[\\/]/;
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
    // drop comments and the <Person …> / <PersonSide …> elements themselves (their expr / look props are the rig, not a drawing)
    for (const k in units) units[k] = units[k].replace(/\/\*[\s\S]*?\*\//g, '').replace(/<Person(Side)?\b[^>]*?\/>/gs, '<Person />');
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
    usedSets.add(s.set);
    for (const [k, tr] of Object.entries(s.keys ?? {})) tr.forEach(([, tt]) => visitTT(tt, `${tag}.keys.${k}`));
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
      for (const w of a.path ?? []) visitTT(w[2], at + '.path');
      visitTT(a.enter, at + '.enter'); visitTT(a.exit, at + '.exit');
      if (a.ride && !(s.actors ?? []).some((c) => c.id === a.ride)) err('MO-07', `${at}: rides '${a.ride}' who is not in the shot`);
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
  rows.forEach((r, i) => {
    const s = shots[i];
    const tag = `#${i} '${r.name}'`;
    const dur = r.t1 - r.t0;
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
    if (dur > 6.5 && !waived('SH-15', r.name)) warn('SH-15', `${tag}: ${dur.toFixed(1)} s — long hold; is something moving/changing?`);
    const k0 = r.cam[2], k1 = r.cam2 ? r.cam2[2] : k0;
    if (Math.min(k0, k1) < 0.5 || Math.max(k0, k1) > 4) err('CA-01', `${tag}: zoom ${k0}->${k1} outside 0.5–4`);
    if (r.cam2 && dur < 1.0 && (Math.abs(r.cam2[0] - r.cam[0]) > 40 || Math.abs(k1 - k0) > 0.1)) warn('CA-02', `${tag}: camera move in a ${dur.toFixed(2)} s shot reads as a jolt`);
    const B = P.SETS[r.set]?.bounds;
    if (B) for (const [cx, cy, k] of [r.cam, r.cam2 ?? r.cam]) {
      const [x0, y0, x1, y1] = [cx - (W / 2) / k, cy - (H / 2) / k, cx + (W / 2) / k, cy + (H / 2) / k];
      if (x0 < B[0] - 1 || y0 < B[1] - 1 || x1 > B[2] + 1 || y1 > B[3] + 1)
        err('CA-05', `${tag}: camera [${cx}, ${cy}, ${k}] sees [${Math.round(x0)}, ${Math.round(y0)}, ${Math.round(x1)}, ${Math.round(y1)}] — outside the painted set bounds [${B.join(', ')}] (empty void on screen)`);
    }
    if (Math.max(k0, k1) / Math.min(k0, k1) > 2.2) warn('CA-03', `${tag}: zoom ratio ${(Math.max(k0, k1) / Math.min(k0, k1)).toFixed(1)}× inside one shot`);
    // first appearance of a set: establish it
    if (!P.SETS[r.set]?.insert && r.set !== 'solid' && !rows.slice(0, i).some((q) => q.set === r.set) && Math.min(k0, k1) > 1.2 && !waived('CA-04', r.name))
      err('CA-04', `${tag}: first shot in '${r.set}' is not an establishing frame (zoom ${Math.min(k0, k1)} > 1.2)`);
    // something must change in every shot (actor motion, camera move, set state, talk, expression, overlay)
    const lives = r.cam2 || (s.keys && Object.keys(s.keys).length) || (s.over ?? []).length || s.of || s.punch ||
      (s.actors ?? []).some((A) => A.path || A.reach || A.talk || A.hop || A.shake || A.pant || A.ride || ['p', 'e', 'legs', 'arms', 'view'].some((k) => Array.isArray(A[k])));
    if (!lives && !waived('MO-08', r.name)) warn('MO-08', `${tag}: nothing moves or changes for ${dur.toFixed(1)} s — add a camera drift, an expression key or a gesture`);
    // overlays visible at once
    const ovs = (s.over ?? []).map((o, j) => ({a: r.over[j].t, b: o.until ? P.tAt(o.until) : r.t1}));
    for (const o of ovs) { const n = ovs.filter((q) => q.a <= o.a + 0.01 && q.b > o.a + 0.01).length; if (n > 2) { err('OV-04', `${tag}: ${n} overlays on screen at once (max 2)`); break; } }
    for (const a of r.actors) {
      const A = s.actors.find((q) => q.id === a.id);
      const look = P.CAST[a.look] ?? P.EX_LOOKS[a.look];
      if (!look) continue;
      const H = look.h ?? 1;
      // readable face when talking: standing height on screen >= 25 % of frame
      if (a.talks) {
        const px = 610 * H * a.s * Math.min(k0, k1);
        const role = P.CAST_ROLES[a.look]?.role;
        if (px < 480 && !waived('SZ-01', r.name)) (role === 'principal' ? err : warn)('SZ-01', `${tag}: ${a.id} talks at ${Math.round(px)} px tall (< 480 = 25 % of frame) — push in or scale up`);
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
      if (A.seatH !== undefined && !waived('MO-12', r.name)) {
        const bed = P.SETS[r.set]?.bed;
        const hasSeatProp = (s.extras ?? []).some((e) => /bench|stool|chair|desk/i.test(e.k));
        if (A.seatH > 180) {
          warn('MO-12', `${tag}: ${a.id} has seatH=${A.seatH} (> 180) — floating sit`);
        } else if (A.seatH > 40 && (bed === 'outdoor' || bed === 'street' || bed === 'rain') && !hasSeatProp) {
          warn('MO-12', `${tag}: ${a.id} has seatH=${A.seatH} (> 40) on ${bed} set '${r.set}' without a bench/stool/chair/desk in extras — floating sit`);
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
  segs.forEach(([id, t0], j) => {
    const t1 = j + 1 < segs.length ? segs[j + 1][1] : P.C.voice_end;
    const n = rows.filter((r) => r.t0 < t1 - 0.2 && r.t1 > t0 + 0.2).length;
    if (t1 - t0 > 5 && n < 2) warn('CO-03', `${id}: ${(t1 - t0).toFixed(1)} s of narration on a single shot`);
  });
  // pacing (standards/pacing.json): every episode cuts at the same speed
  {
    const PA = JSON.parse(fs.readFileSync(new URL('../standards/pacing.json', import.meta.url), 'utf8')).shots;
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
      console.log(`pacing: ${durs.length} shots, mean ${mean.toFixed(2)} s, ${perMin.toFixed(1)}/min, p10 ${p10.toFixed(2)} s`);
    }
  }
  // ---- screen geometry (GE-*): measured from the shot table, no render. Each hit makes the shot HOT:
  // its review must open the measurement crops (node scripts/qa.mjs crops <i>) — see sv-22 "review cards".
  const looks = {...(P.EX_LOOKS ?? {}), ...P.CAST};
  const hot = {};
  const seen = new Set();
  const flag = (r, rule, msg, who = '', makeHot = rule !== 'GE-10') => {
    if (waived(rule, r.name) || seen.has(`${r.i}|${rule}|${who}`)) return; // one warning per shot, rule and actor
    seen.add(`${r.i}|${rule}|${who}`);
    warn(rule, `#${r.i} '${r.name}': ${msg}`);
    if (makeHot) (hot[r.i] ??= []).push(rule);
  };
  const lastH = {};
  for (const r of rows) {
    for (const u of [0.15, 0.5, 0.85]) {
      const t = r.t0 + (r.t1 - r.t0) * u;
      const g = shotGeometry(r, t, P, rows);
      const B = g.actors;
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
        for (const occ of sg.occludedBy) {
          flag(r, 'GE-11', `${occ.kind} ${occ.id} covers ${Math.round(occ.frac * 100)}% of sign '${sg.text}'${sg.source !== 'set' ? ` (${sg.source})` : ''} at ${t.toFixed(2)} s`, `occ:${sg.source}:${sg.text}:${occ.id}`, occ.kind !== 'prop');
        }
      }
      for (const pr of g.props) {
        if (pr.edgeClipped) {
          flag(r, 'GE-15', `prop '${pr.k}' clipped ${Math.round(pr.clippedFrac * 100)}% off frame edge at ${t.toFixed(2)} s — ${pr.dxHint}`, `prop:${pr.k}`);
        }
        if (pr.onScreen) {
          for (const x of B) {
            const {x: hx, y: hy, r: hr} = x.hc;
            const onScreen = hx + hr > 0 && hx - hr < W && hy + hr > 0 && hy - hr < H;
            if (!onScreen || pr.y < x.worldY - 5) continue;
            const frac = inter(pr.screenBox, x.head) / Math.max(1, area(x.head));
            if (frac > 0.35) {
              flag(r, 'GE-17', `prop '${pr.k}' (y=${Math.round(pr.y)}) covers ${Math.round(frac * 100)}% of ${x.id}'s head (y=${Math.round(x.worldY)}) at ${t.toFixed(2)} s`, `${pr.k}:${x.id}`);
            }
          }
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
      }
    }
    if (r.reaches.length) (hot[r.i] ??= []).push('reach');
    if (r.keys.length) (hot[r.i] ??= []).push('key');
  }
  fs.mkdirSync('qa', {recursive: true});
  fs.writeFileSync('qa/hot.json', JSON.stringify(Object.fromEntries(Object.entries(hot).map(([k, v]) => [k, [...new Set(v)]])), null, 1));
  fs.writeFileSync('qa/strips_needed.json', JSON.stringify(strips, null, 1));
}

Object.assign(report, {phase, at: new Date().toISOString(), errors, warns, sets: setReport, strips: strips.length});
fs.mkdirSync('qa', {recursive: true});
fs.writeFileSync('qa/lint.json', JSON.stringify(report, null, 1));
for (const s of setReport) console.log(`set ${s.id}: ${s.shapes} shapes · ${s.colours} colours · ${s.texts} texts · halftone ${s.halftone} · glow ${s.glow} · mid ${s.midItems} · ${s.moves ? "moves" : "STATIC"}`);
for (const w of warns) console.log('WARN ', w);
for (const e of errors) console.log('ERROR', e);
console.log(`lint ${phase}: ${errors.length} errors, ${warns.length} warnings${phase !== 'design' ? `, ${strips.length} motion strips required (qa/strips_needed.json)` : ''}`);
process.exit(errors.length ? 1 : 0);
