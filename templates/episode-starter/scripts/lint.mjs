// Machine checks for design + shots. Writes qa/lint.json and qa/strips_needed.json; exit 1 on any error.
// Usage: node scripts/lint.mjs [design|shots|all]   (default all)
// Every rule here is documented in the skills (rule ids in brackets). Do not weaken a threshold to pass:
// fix the work. If a rule is genuinely wrong for a shot, add `// lint-ok: <rule> <reason>` on that shot's
// line in shotlist.ts — the reviewer must accept each waiver in the gate review.
import fs from 'node:fs';
import {loadProject} from './load.mjs';

const phase = process.argv[2] ?? 'all';
const P = await loadProject();
const errors = [], warns = [];
const err = (rule, msg) => errors.push(`[${rule}] ${msg}`);
const warn = (rule, msg) => warns.push(`[${rule}] ${msg}`);
const src = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
const shotSrc = src('src/shotlist.ts');
const waived = (rule, name) => new RegExp(`lint-ok:\\s*${rule}\\b`).test(shotSrc.split('\n').find((l) => l.includes(`'${name}'`)) ?? '');

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
  if (!keys.length) err('CH-01', 'src/cast.ts is empty — design the cast before shots');
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
  if (!sets.length) err('SE-01', 'src/sets/episode.tsx registers no sets');
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
      else if (pl.mtime * 1000 < fs.statSync('src/sets/episode.tsx').mtimeMs) err('SE-13', `${id}: plate is older than src/sets/episode.tsx — re-render with node scripts/design.mjs --only set:${id}`);
      else if (pl.empty_mid > 8) err('SE-13', `${id}: ${pl.empty_mid} empty 180-px cells in the visible middle of the plate (max 8; rows ${pl.rows}) — detail must be IN FRAME, not off-screen. Fill the wall band: notices, fixtures, clutter (sets.md §3)`);
      else if (pl.empty_mid > 5) warn('SE-13', `${id}: ${pl.empty_mid} empty cells in the middle of the plate (rows ${pl.rows}) — look for bare wall`);
      if (!st.moves) warn('SE-12', `${id}: nothing in the set changes over time — add life driven by o.t (LED pulse, fan, smoke, leaves, clock; sets.md §7)`);
      if (st.glow < TH.glow) err('SE-10', `${id}: no light source glow (url(#glowY)) — every location has a visible light source`);
    }
  }
  // token discipline in episode code
  for (const f of ['src/sets/episode.tsx', 'src/cast.ts', 'src/geo.ts', 'src/shotlist.ts']) {
    const lines = src(f).split('\n');
    lines.forEach((ln, i) => {
      if (/^\s*\/\//.test(ln)) return;
      const hex = ln.match(/['"`]#[0-9a-fA-F]{3,8}\b/);
      if (hex && !/token-ok/.test(ln)) err('TK-02', `${f}:${i + 1} raw colour ${hex[0].slice(1)} — use a PAL token (add one to kit.tsx if truly missing)`);
      if (/fontFamily=\{?['"]/.test(ln)) err('TK-03', `${f}:${i + 1} literal fontFamily — use <Txt> or FONT`);
    });
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
      if (!o.world && o.y > 1480 && o.y < 1760) err('OV-03', `${tag}: overlay at y=${o.y} sits in the caption band (1480–1760)`);
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
      const [x0, y0, x1, y1] = [cx - 540 / k, cy - 960 / k, cx + 540 / k, cy + 960 / k];
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
        for (let q = 1; q < P0.length; q++) {
          const [x0, y0, t0] = P0[q - 1], [x1, y1, t1] = P0[q];
          const d = Math.hypot(x1 - x0, y1 - y0), dt = t1 - t0;
          if (dt <= 0) { err('MO-01', `${tag}: ${a.id} path waypoint ${q} arrives before the previous one`); continue; }
          const v = d / dt / a.s;
          if (d > 30 && v > 560) warn('MO-02', `${tag}: ${a.id} moves ${Math.round(v)} px/s (scaled) — that is running; nominal walk is 230`);
          if (d > 30 && v < 60) warn('MO-03', `${tag}: ${a.id} creeps ${Math.round(v)} px/s — hold still instead or shorten the time`);
          const views = Array.isArray(A.view) ? A.view : A.view ? [[A.view, 0]] : [];
          const frontWhile = views.some(([vv, tt]) => vv === 'front' && (typeof tt === 'number' ? r.t0 + tt : P.tAt(tt)) < t1 - 0.25 && (typeof tt === 'number' ? r.t0 + tt : P.tAt(tt)) >= t0 && d > 30);
          if ((A.view === 'front') || frontWhile) err('MO-04', `${tag}: ${a.id} travels ${Math.round(d)} px in front view — walking is always profile (side)`);
        }
        const a0 = Math.max(r.t0, P0[0][2] - 0.2), a1 = Math.min(r.t1, P0[P0.length - 1][2] + 0.4);
        if (a1 - a0 > 0.3) strips.push({name: `s${String(i).padStart(2, '0')}_${a.id}_walk`, t0: +a0.toFixed(2), t1: +a1.toFixed(2), n: 10, why: 'walk'});
      }
      // reach: target must be within arm range of where the actor stands at that moment
      for (const rc of A.reach ?? []) {
        const t = typeof rc.at === 'number' ? r.t0 + rc.at : P.tAt(rc.at);
        let x = A.x, y = A.y;
        if (a.path) {
          const pp = a.path; x = pp[pp.length - 1][0]; y = pp[pp.length - 1][1];
          for (let q = 1; q < pp.length; q++) if (t <= pp[q][2]) { const u = Math.max(0, Math.min(1, (t - pp[q - 1][2]) / Math.max(0.01, pp[q][2] - pp[q - 1][2]))); x = pp[q - 1][0] + (pp[q][0] - pp[q - 1][0]) * u; y = pp[q - 1][1] + (pp[q][1] - pp[q - 1][1]) * u; break; }
        }
        if (a.path) {
          const arrive = a.path[a.path.length - 1][2];
          if (t > a.path[0][2] && t < arrive + 0.3) err('MO-06', `${tag}: ${a.id} reaches at ${t.toFixed(2)} s while still walking (arrives ${arrive.toFixed(2)} s) — arrive ≥ 0.3 s before the reach: settle, then reach`);
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
          if (Math.abs(x - cx) > 540 / k - 110 * a.s) warn('SZ-02', `${tag}: ${a.id} is cut by the frame edge while reaching (x ${Math.round(x)}, frame ${Math.round(cx - 540 / k)}…${Math.round(cx + 540 / k)})`); }
        strips.push({name: `s${String(i).padStart(2, '0')}_${a.id}_reach`, t0: +Math.max(r.t0, t - 0.7).toFixed(2), t1: +Math.min(r.t1, t + (rc.hold ?? 0.4) + 0.5).toFixed(2), n: 8, why: 'reach'});
      }
      if (A.legs && Array.isArray(A.legs) && A.legs.length > 1) {
        const tt = A.legs.slice(1).map(([, x]) => (typeof x === 'number' ? r.t0 + x : P.tAt(x)));
        for (const t of tt) strips.push({name: `s${String(i).padStart(2, '0')}_${a.id}_legs`, t0: +Math.max(r.t0, t - 0.5).toFixed(2), t1: +Math.min(r.t1, t + 0.9).toFixed(2), n: 8, why: 'sit/stand'});
      }
      if (A.ride) strips.push({name: `s${String(i).padStart(2, '0')}_${a.id}_ride`, t0: r.t0, t1: +Math.min(r.t1, r.t0 + 2.5).toFixed(2), n: 8, why: 'piggyback'});
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
  fs.mkdirSync('qa', {recursive: true});
  fs.writeFileSync('qa/strips_needed.json', JSON.stringify(strips, null, 1));
}

const report = {phase, at: new Date().toISOString(), errors, warns, sets: setReport, strips: strips.length};
fs.mkdirSync('qa', {recursive: true});
fs.writeFileSync('qa/lint.json', JSON.stringify(report, null, 1));
for (const s of setReport) console.log(`set ${s.id}: ${s.shapes} shapes · ${s.colours} colours · ${s.texts} texts · halftone ${s.halftone} · glow ${s.glow} · mid ${s.midItems} · ${s.moves ? "moves" : "STATIC"}`);
for (const w of warns) console.log('WARN ', w);
for (const e of errors) console.log('ERROR', e);
console.log(`lint ${phase}: ${errors.length} errors, ${warns.length} warnings${phase !== 'design' ? `, ${strips.length} motion strips required (qa/strips_needed.json)` : ''}`);
process.exit(errors.length ? 1 : 0);
