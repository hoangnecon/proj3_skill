// Standalone blind-review evidence packer (Pillar 3, v5.6).
//   node scripts/blind_pack.mjs            -> qa/blind_review/{manifest.json, slice_1.json, slice_2.json, slice_3.json, RUBRIC.md}
//   node scripts/blind_pack.mjs --unit U1  -> qa/blind_review/unit_U1.json + updates manifest.json & RUBRIC.md
// Reads ONLY rendered QA artifacts + script/words/brief (NEVER shotlist.ts, coordinates, or actor/prop code).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const rawArgs = process.argv.slice(2);
let unitId = null;
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--unit') unitId = (rawArgs[++i] ?? '').trim() || null;
  else if (a.startsWith('--unit=')) unitId = a.slice(7).trim() || null;
}

const pad = (i) => String(i).padStart(2, '0');
const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const sha256File = (p) => (fs.existsSync(p) ? sha256Hex(fs.readFileSync(p)) : '');

const readJson = (p, fallback) => {
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
};

const readText = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

const extractSetTitles = (script, briefText) => {
  const titles = {};
  if (script && typeof script === 'object') {
    for (const key of ['sets', 'locations']) {
      const map = script[key];
      if (map && typeof map === 'object' && !Array.isArray(map)) {
        for (const [id, val] of Object.entries(map)) {
          if (typeof val === 'string' && val.trim()) titles[id] = val.trim();
          else if (val && typeof val === 'object' && typeof val.title === 'string' && val.title.trim()) {
            titles[id] = val.title.trim();
          }
        }
      }
    }
  }
  const locMatch = /##\s+Locations\s*\n([\s\S]*?)(?:\n##\s+|$)/i.exec(briefText);
  if (locMatch) {
    for (const rawLine of locMatch[1].split(/\r?\n/)) {
      const line = rawLine.trim().replace(/^[-*]\s*/, '');
      if (!line || line.startsWith('TODO')) continue;
      const m = /^`?([a-zA-Z0-9_-]+)`?\s*[:—–-]\s*(.+)$/.exec(line);
      if (m && !titles[m[1]]) titles[m[1]] = m[2].trim();
    }
  }
  return titles;
};

const shots = readJson('qa/shots.json', null);
if (!Array.isArray(shots)) {
  console.error('ERROR blind_pack.mjs: qa/shots.json missing or invalid — run qa.mjs first');
  process.exit(1);
}

const qaStatus = readJson('qa/qa_status.json', {hashes: {}});
const hot = readJson('qa/hot.json', {});
const stripsNeeded = readJson('qa/strips_needed.json', []);
const segIndex = readJson('qa/contact_segments/index.json', {});
const contactIndex = readJson('qa/contact_index.json', null);
const layoutReport = readJson('qa/layout_report.json', null);
const plateStats = readJson('qa/design/plate_stats.json', null);
const layoutByShot = new Map();
if (Array.isArray(layoutReport)) {
  for (const item of layoutReport) {
    if (item && Number.isInteger(item.i)) layoutByShot.set(item.i, item);
  }
}
const script = readJson('script.json', {});
const isLong16x9 = script?.format === '16:9' || script?.length === 'long_16x9';
const format = isLong16x9 ? '16:9' : '9:16';
const words = readJson('src/data/words.json', []);
const brief = readText('brief.md');
const setTitles = extractSetTitles(script, brief);

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
const shotSegOf = (r) => normSegId(r?.seg) ?? normSegId(r?.at);
const scriptSegIds = Array.isArray(script?.segments)
  ? script.segments.map((s) => normSegId(s?.id)).filter(Boolean)
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

const scriptUnits = Array.isArray(script?.units) ? script.units.filter((u) => u && typeof u === 'object') : [];
const unitOfShot = (r) => {
  const sg = shotSegOf(r);
  if (!sg) return null;
  return scriptUnits.find((u) => segInUnitRange(sg, normSegId(u.seg_start), normSegId(u.seg_end))) ?? null;
};

let targetUnit = null;
if (unitId !== null) {
  if (!scriptUnits.length) {
    console.error(`ERROR blind_pack.mjs --unit ${unitId}: script.json has no "units" array`);
    process.exit(1);
  }
  targetUnit = scriptUnits.find((u) => String(u.id) === String(unitId)) ??
    scriptUnits.find((u) => String(u.id ?? '').toLowerCase() === String(unitId).toLowerCase()) ??
    null;
  if (!targetUnit) {
    console.error(`ERROR blind_pack.mjs: unknown unit '${unitId}' (available: ${scriptUnits.map((u) => u.id).filter(Boolean).join(', ')})`);
    process.exit(1);
  }
}

const orderedShots = [...shots].sort((a, b) => a.i - b.i);
let lastSet = null;
let streak = 0;

const entries = orderedShots.map((r) => {
  const i = r.i;
  const prevSet = lastSet;
  streak = r.set === lastSet ? streak + 1 : 1;
  lastSet = r.set;
  const hash = String(qaStatus?.hashes?.[i] ?? qaStatus?.hashes?.[String(i)] ?? '');
  const narration = (Array.isArray(words) ? words : [])
    .filter((w) => w && typeof w.s === 'number' && w.s >= r.t0 - 0.05 && w.s < r.t1)
    .map((w) => w.w)
    .join(' ');

  const shotUnit = unitOfShot(r);
  const unitContactCandidate = shotUnit?.id ? `qa/units/${shotUnit.id}_contact.jpg` : null;
  const unitContactPath = unitContactCandidate && fs.existsSync(unitContactCandidate) ? unitContactCandidate : null;

  const hotReasons = Array.isArray(hot?.[i]) ? [...new Set(hot[i])] : [];
  const cardPath = `qa/cards/${pad(i)}.jpg`;
  const cropCandidate = `qa/crops/${pad(i)}.jpg`;
  const cropPath = fs.existsSync(cropCandidate) ? cropCandidate : null;
  const indexedContact = contactIndex?.[i] ?? contactIndex?.[String(i)] ?? null;
  const contactPage = (indexedContact && fs.existsSync(indexedContact))
    ? indexedContact
    : (unitContactPath ?? indexedContact ?? `qa/contact_p${Math.floor(i / 12) + 1}.jpg`);
  const segmentContactPath = segIndex?.[i] ?? segIndex?.[String(i)] ?? null;
  const shotStripCandidate = `qa/shots/${pad(i)}.jpg`;
  const shotStripPath = fs.existsSync(shotStripCandidate) ? shotStripCandidate : null;
  const prefix = `s${pad(i)}_`;
  const shotStrips = (Array.isArray(stripsNeeded) ? stripsNeeded : [])
    .filter((s) => s && typeof s.name === 'string' && (s.name.startsWith(prefix) || (typeof s.t0 === 'number' && s.t0 >= r.t0 - 0.01 && s.t0 < r.t1)))
    .map((s) => `qa/strips/${s.name}.jpg`);

  const cardSha = sha256File(cardPath);
  const cropSha = cropPath ? sha256File(cropPath) : '';
  const shotStripSha = shotStripPath ? sha256File(shotStripPath) : '';
  const blindSha = sha256Hex(
    shotStripSha
      ? `${hash}|${narration}|${cardSha}|${cropSha}|${shotStripSha}`
      : `${hash}|${narration}|${cardSha}|${cropSha}`
  ).slice(0, 12);
  const lr = layoutByShot.get(i) ?? null;
  const ps = plateStats && typeof plateStats === 'object' ? (plateStats[r.set] ?? null) : null;
  const layout = lr
    ? {
        max_cell: lr.gridLayout?.maxCellCount ?? 0,
        occ_pct: Math.round((lr.gridLayout?.occupancyFrac ?? 0) * 100),
        scale_err: Array.isArray(lr.scaleIssues) ? lr.scaleIssues.length : 0,
        cutoff_err: Array.isArray(lr.creatureCutoffIssues) ? lr.creatureCutoffIssues.length : 0,
        ...(ps && typeof ps.empty_mid === 'number' ? {plate_empty_mid: ps.empty_mid, plate_edge_pct: ps.edge_pct} : {}),
      }
    : null;

  return {
    shot: i,
    seg: shotSegOf(r),
    ...(shotUnit?.id ? {unit: String(shotUnit.id)} : {}),
    name: r.name,
    t0: r.t0,
    t1: r.t1,
    format,
    set_title: setTitles[r.set] || r.set,
    set_streak: streak,
    prev_set: prevSet,
    narration,
    is_hot: hotReasons.length > 0,
    hot_reasons: hotReasons,
    layout,
    images: {
      card: cardPath,
      crop: cropPath,
      contact_page: contactPage,
      ...(unitContactPath ? {unit_contact: unitContactPath} : {}),
      segment_contact: segmentContactPath,
      shot_strip: shotStripPath,
      strips: [...new Set(shotStrips)],
    },
    hash,
    blind_sha: blindSha,
  };
});

// Attach 3-shot continuity context window (prev_shot / next_shot) without exposing any code or coordinates
const briefCtx = (e) => (e ? {shot: e.shot, name: e.name, set_title: e.set_title, narration: e.narration, card: e.images.card} : null);
for (let idx = 0; idx < entries.length; idx++) {
  entries[idx].context_window = {
    prev_shot: idx > 0 ? briefCtx(entries[idx - 1]) : null,
    next_shot: idx + 1 < entries.length ? briefCtx(entries[idx + 1]) : null,
  };
}

const formatSliceShot = (e) => ({
  shot: e.shot,
  ...(e.seg ? {seg: e.seg} : {}),
  ...(e.unit ? {unit: e.unit} : {}),
  name: e.name,
  t0: e.t0,
  t1: e.t1,
  format: e.format,
  set_title: e.set_title,
  set_streak: e.set_streak,
  prev_set: e.prev_set,
  narration: e.narration,
  context_window: e.context_window,
  is_hot: e.is_hot,
  hot_reasons: e.hot_reasons,
  layout: e.layout,
  images: e.is_hot
    ? e.images
    : {
        contact_page: e.images.contact_page,
        ...(e.images.unit_contact ? {unit_contact: e.images.unit_contact} : {}),
        segment_contact: e.images.segment_contact,
        shot_strip: e.images.shot_strip,
        strips: e.images.strips,
        card_fallback: e.images.card,
      },
  hash: e.hash,
  blind_sha: e.blind_sha,
});

const formatUnitShot = (e, unitContactFile) => ({
  shot: e.shot,
  ...(e.seg ? {seg: e.seg} : {}),
  ...(e.unit ? {unit: e.unit} : {}),
  name: e.name,
  t0: e.t0,
  t1: e.t1,
  format: e.format,
  set_title: e.set_title,
  set_streak: e.set_streak,
  prev_set: e.prev_set,
  narration: e.narration,
  context_window: e.context_window,
  is_hot: e.is_hot,
  hot_reasons: e.hot_reasons,
  layout: e.layout,
  images: {
    ...(unitContactFile ? {unit_contact: unitContactFile} : {}),
    contact_page: unitContactFile ?? e.images.contact_page,
    segment_contact: e.images.segment_contact,
    card: e.images.card,
    card_fallback: e.images.card,
    crop: e.images.crop,
    shot_strip: e.images.shot_strip,
    strips: e.images.strips,
  },
  hash: e.hash,
  blind_sha: e.blind_sha,
});

const outDir = 'qa/blind_review';
fs.mkdirSync(outDir, {recursive: true});
const manifestPath = path.join(outDir, 'manifest.json');
const prevManifest = readJson(manifestPath, null);

const checksKeys = isLong16x9
  ? ['acting', 'contact', 'overlap', 'set', 'text', 'caption', 'beat', 'model', 'continuity', 'framing', 'variety']
  : ['acting', 'contact', 'overlap', 'set', 'text', 'caption', 'beat', 'model', 'continuity'];
const reviewSchema = {
  format: 'JSONL — one JSON object per line, committed via: node scripts/qa.mjs review --batch <file.jsonl>',
  required_fields: ['i', 'shot', 'hash', 'blind_sha', 'builder', 'reviewer', 'saw_strip', 'saw_crop', 'looked', 'verdict', 'checks', 'note'],
  checks_keys: checksKeys,
  looked_rules: "Always include 'unit_contact' (or 'contact') and 'card'; include 'shot_strip' when images.shot_strip is non-null; include 'strips' when images.strips is non-empty; include 'crops' (and saw_crop: true) for every shot where is_hot is true.",
  example_line: {
    i: 0,
    shot: 0,
    hash: '<copy verbatim from shot.hash>',
    blind_sha: '<copy verbatim from shot.blind_sha>',
    builder: 'conductor',
    reviewer: '<your unique reviewer id != builder>',
    saw_strip: true,
    saw_crop: false,
    looked: ['unit_contact', 'card', 'shot_strip'],
    verdict: 'ok',
    checks: Object.fromEntries(checksKeys.map((k) => [k, 'ok — <concise visual observation>'])),
    note: '<concise factual summary of what is visually seen>',
  },
};

if (targetUnit) {
  const uid = String(targetUnit.id);
  const startSid = normSegId(targetUnit.seg_start);
  const endSid = normSegId(targetUnit.seg_end);
  const unitEntries = entries.filter((e) => segInUnitRange(e.seg, startSid, endSid));
  if (!unitEntries.length) {
    console.error(`ERROR blind_pack.mjs --unit ${uid}: 0 shots in qa/shots.json fall inside ${startSid}..${endSid}`);
    process.exit(1);
  }
  const unitContactCand = `qa/units/${uid}_contact.jpg`;
  const unitContactFile = fs.existsSync(unitContactCand) ? unitContactCand : null;
  const unitShotsOut = unitEntries.map((e) => formatUnitShot(e, unitContactFile));
  const byPage = new Map();
  for (const us of unitShotsOut) {
    const cp = us.images.contact_page;
    if (!byPage.has(cp)) byPage.set(cp, []);
    byPage.get(cp).push(us);
  }
  const contactPages = [...byPage.keys()];
  const segmentContacts = [...new Set(unitShotsOut.map((s) => s.images.segment_contact).filter(Boolean))];
  const unitPayload = {
    unit: uid,
    title: typeof targetUnit.title === 'string' ? targetUnit.title.trim() : '',
    seg_start: startSid,
    seg_end: endSid,
    scale_mode: targetUnit.scale_mode ?? null,
    format,
    count: unitShotsOut.length,
    hot_count: unitShotsOut.filter((e) => e.is_hot).length,
    unit_contact: unitContactFile,
    contact_pages: contactPages,
    segment_contacts: segmentContacts,
    hot_shots: unitShotsOut.filter((e) => e.is_hot).map((e) => e.shot),
    review_schema: reviewSchema,
    shots: unitShotsOut,
    pages: contactPages.map((cp) => ({contact_page: cp, shots: byPage.get(cp)})),
  };
  const unitOutPath = path.join(outDir, `unit_${uid}.json`);
  fs.writeFileSync(unitOutPath, JSON.stringify(unitPayload, null, 1) + '\n');

  const mergedByShot = new Map();
  if (Array.isArray(prevManifest?.shots)) {
    for (const ps of prevManifest.shots) {
      if (ps && Number.isInteger(ps.shot) && ps.shot >= 0 && ps.shot < orderedShots.length) {
        mergedByShot.set(ps.shot, ps);
      }
    }
  }
  for (const e of entries) {
    if (!mergedByShot.has(e.shot) || fs.existsSync(e.images.card)) {
      mergedByShot.set(e.shot, e);
    }
  }
  for (const e of unitEntries) {
    mergedByShot.set(e.shot, unitContactFile ? {...e, images: {...e.images, unit_contact: unitContactFile, contact_page: unitContactFile}} : e);
  }
  const mergedShots = [...mergedByShot.values()].sort((a, b) => a.shot - b.shot);
  const unitsMap = {...(prevManifest?.units && typeof prevManifest.units === 'object' ? prevManifest.units : {}), [uid]: `${outDir}/unit_${uid}.json`};
  const manifest = {
    generated_at: new Date().toISOString(),
    format,
    total_shots: mergedShots.length,
    ...(prevManifest?.slices ? {slices: prevManifest.slices} : {}),
    units: unitsMap,
    shots: mergedShots,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
} else {
  // Group shots by contact_page and partition contiguously into 3 balanced slices so each
  // Blind Reviewer reads only ~2 contact pages + HOT card/crop/strips (~70% fewer vision tokens).
  const pageMap = new Map();
  for (const e of entries) {
    const cp = e.images.contact_page;
    if (!pageMap.has(cp)) pageMap.set(cp, []);
    pageMap.get(cp).push(e);
  }
  const pageGroups = [...pageMap.entries()].sort((a, b) => {
    const pa = Number(/contact_p(\d+)\./.exec(a[0])?.[1] ?? 0);
    const pb = Number(/contact_p(\d+)\./.exec(b[0])?.[1] ?? 0);
    return pa - pb;
  });

  const slices = [[], [], []];
  if (pageGroups.length >= 3) {
    const n = pageGroups.length;
    const counts = pageGroups.map(([, list]) => list.length);
    const total = counts.reduce((a, b) => a + b, 0);
    let best = [1, 2];
    let bestScore = Infinity;
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const s0 = counts.slice(0, i).reduce((a, b) => a + b, 0);
        const s1 = counts.slice(i, j).reduce((a, b) => a + b, 0);
        const s2 = total - s0 - s1;
        const score = Math.max(s0, s1, s2) - Math.min(s0, s1, s2);
        if (score < bestScore) {
          bestScore = score;
          best = [i, j];
        }
      }
    }
    const [c1, c2] = best;
    for (let p = 0; p < n; p++) {
      const idx = p < c1 ? 0 : p < c2 ? 1 : 2;
      slices[idx].push(...pageGroups[p][1]);
    }
  } else {
    entries.forEach((e, idx) => slices[idx % 3].push(e));
  }
  for (const sl of slices) sl.sort((a, b) => a.shot - b.shot);

  const unitsMap = prevManifest?.units && typeof prevManifest.units === 'object' ? prevManifest.units : undefined;
  const manifest = {
    generated_at: new Date().toISOString(),
    format,
    total_shots: entries.length,
    slices: [1, 2, 3].map((k) => `${outDir}/slice_${k}.json`),
    ...(unitsMap ? {units: unitsMap} : {}),
    shots: entries,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');

  for (let k = 0; k < 3; k++) {
    const sl = slices[k];
    const byPage = new Map();
    for (const e of sl) {
      const cp = e.images.contact_page;
      if (!byPage.has(cp)) byPage.set(cp, []);
      byPage.get(cp).push(formatSliceShot(e));
    }
    const contactPages = [...byPage.keys()];
    const segmentContacts = [...new Set(sl.map((e) => e.images.segment_contact).filter(Boolean))];
    const pages = contactPages.map((cp) => ({contact_page: cp, shots: byPage.get(cp)}));
    const payload = {
      slice: k + 1,
      total_slices: 3,
      format,
      count: sl.length,
      hot_count: sl.filter((e) => e.is_hot).length,
      contact_pages: contactPages,
      segment_contacts: segmentContacts,
      hot_shots: sl.filter((e) => e.is_hot).map((e) => e.shot),
      review_schema: reviewSchema,
      pages,
    };
    fs.writeFileSync(path.join(outDir, `slice_${k + 1}.json`), JSON.stringify(payload, null, 1) + '\n');
  }
}

const rubric = isLong16x9
  ? `# Blind Visual QA Rubric (3-Tier Hierarchical Contact Protocol · 16:9 Long-Form)

1. **Judge ONLY from the rendered images and \`narration\`** in \`qa/blind_review/unit_*.json\` (or \`slice_*.json\`).
2. **NEVER read \`src/episode/shotlist.ts\`** or inspect coordinates, actor rigs, or prop code while reviewing.
3. **Mandatory 3-Tier Hierarchical Contact Sheet Review Protocol**:
   - **Tier 1 — Đại đoạn / Unit Sheet (\`unit_contact\`: \`qa/units/<unitId>_contact.jpg\` or \`contact_pages\`: \`qa/contact_p*.jpg\`)**: Open \`unit_contact\` / every image in \`contact_pages\` first to audit pacing, shot variety, set transitions, and macro framing (4 frames per shot).
   - **Tier 2 — Trung đoạn (\`segment_contacts\`: \`qa/contact_segments/*.jpg\`)**: Open each contiguous location block sheet (\`images.segment_contact\`) to verify spatial continuity, scale consistency, camera-angle variety, and lighting coherence across every beat in the same location.
   - **Tier 3 — Tiểu đoạn (\`images.shot_strip\`: \`qa/shots/NN.jpg\` 8-frame strip + \`images.strips\`: \`qa/strips/*.jpg\`)**: Whenever a shot has a non-null \`images.shot_strip\` (8-frame 4×2 motion strip) or non-empty \`images.strips\`, you **MUST** open it to inspect frame-by-frame motion, takeoff/apex/landing arcs, flight trajectories, and prop/creature depth ordering, and include \`"shot_strip"\` or \`"strips"\` in \`looked\` (reviews that omit it are rejected).
   - **HOT Shots (\`is_hot: true\`)**: Also open \`images.card\` and \`images.crop\` (if non-null), and include \`"crops"\` in \`looked\`. Only open \`images.card_fallback\` for non-HOT shots if a frame on the contact sheet is ambiguous.
   - In \`looked\`, include \`"contact"\` (or \`"card"\`) for every shot, \`"shot_strip"\` / \`"strips"\` whenever motion strips exist, plus \`"crops"\` for HOT shots.
4. **Include \`"blind_sha"\`** from the slice entry verbatim in each JSONL review line.
5. **Check ALL 11 criteria** (\`acting\`, \`contact\`, \`overlap\`, \`set\`, \`text\`, \`caption\`, \`beat\`, \`model\`, \`continuity\`, \`framing\`, \`variety\`) formatted as \`"ok — ..."\` or \`"fix — ..."\`, with a \`note\` of >= 6 words describing what you actually saw:
   - \`acting\`: expression, gesture, posture, and gaze match the narration beat; **verify articulated bent knees/elbows and dynamic physics** (no stiff, board-like standing on mounts or mid-action!). **Pasted-Sticker & Airborne / Jump / Flight Realism Check (MANDATORY \`fix\`):** flag automatic \`fix\` if (a) limbs/torso read as a rigid brick with zero spine curve, knee flexion, or secondary hair/FX life, (b) ANY frame in the 8-frame \`shot_strip\` or \`strips\` shows a character walking/running in mid-air or moon-floating without takeoff/landing squash, or (c) a flying creature (\`ladybug\`, etc.) is occluded behind ground/tabletop props!
   - \`contact\`: feet planted on ground/floor, hands actually meet props/targets, seated bodies rest on seats; **verify mounted riders sit physically on their mount facing the travel direction, and verify non-OTS creatures are not half-sliced off the frame edge**. **Pasted-Sticker & Airborne / Jump / Flight Realism Check (MANDATORY \`fix\`):** flag automatic \`fix\` if (a) ANY frame in the 8-frame \`shot_strip\` or \`strips\` shows a character walking/running in mid-air, moon-floating without takeoff/landing squash, or a grounded character floating with no contact shadow, (b) a flying creature (\`ladybug\`, etc.) is occluded behind ground/tabletop props instead of flying clearly above them, (c) hands in \`push\`/\`hold\`/\`ride\` grab empty air instead of the physical target/grip point, or (d) riders sit pasted flat on one side of a creature instead of straddling with a seat shadow.
   - \`overlap\`: no unintended character/prop collisions or faces hidden behind props/overlays.
   - \`set\`: environment reads clearly, clean perspective, no stray/clipped set geometry.
   - \`text\`: every sign, label, and overlay is legible, unclipped, and unoccluded.
   - \`caption\`: caption band is clear of faces, hands, and hero props.
   - \`beat\`: visual action and timing match the spoken \`narration\` for this shot.
   - \`model\`: character proportions, outfits, and identity stay on-model.
   - \`continuity\` (**3-shot cross-shot continuity — MANDATORY \`fix\` trigger**): inspect \`context_window.prev_shot\` and \`context_window.next_shot\` alongside the rendered frames. Flag automatic \`fix\` if (a) physical distance between actors/objects contradicts the action or narration (e.g. warning from afar while standing shoulder-to-shoulder, or impact shown BEFORE the spoken approach/collision), (b) a moving vehicle/prop loses or gains its operator inconsistently between consecutive shots, (c) a ground-bound object floats off the floor plane, or (d) a closeup-only detached limb appears next to the full character in a wide shot!
   - \`framing\` (**16:9 cinematic framing — MANDATORY \`fix\` trigger**): check depth, angle, frame edges, and the shot's \`layout\` telemetry (\`layout.occ_pct\`, \`layout.scale_err\`, \`layout.cutoff_err\`, \`layout.max_cell\`) alongside the rendered frame. Flag **cluttered/chaotic cells ("rối mắt / búa xua")**, **fake over-zoomed low-detail backgrounds**, and **any severed or floating giant limb** (arm, hand, leg, tentacle, creature appendage) terminating mid-air inside the frame — all are automatic \`fix\`!
   - \`variety\` (**visual freshness — MANDATORY \`fix\` trigger**): inspect \`set_streak\` and \`prev_set\` on each shot entry alongside the rendered contact page. **Same-wall / same-prop copy-paste fatigue**, repeating the same static wall framing/pose/prop layout across consecutive shots, or **recurring hero creatures/subjects failing to vary their poses/expressions across shots (copy-pasted static stickers!)** is an automatic \`fix\`!
6. Submit reviews via \`node scripts/qa.mjs review --batch <file.jsonl>\`.
`
  : `# Blind Visual QA Rubric (3-Tier Hierarchical Contact Protocol)

1. **Judge ONLY from the rendered images and \`narration\`** in \`qa/blind_review/slice_*.json\`.
2. **NEVER read \`src/episode/shotlist.ts\`** or inspect coordinates, actor rigs, or prop code while reviewing.
3. **Mandatory 3-Tier Hierarchical Contact Sheet Review Protocol**:
   - **Tier 1 — Đại đoạn (\`contact_pages\`: \`qa/contact_p*.jpg\`)**: Open every image in \`contact_pages\` first to audit episode-wide pacing and framing.
   - **Tier 2 — Trung đoạn (\`segment_contacts\`: \`qa/contact_segments/*.jpg\`)**: Open each contiguous location block sheet (\`images.segment_contact\`) to verify spatial continuity and scale consistency within each location.
   - **Tier 3 — Tiểu đoạn (\`images.shot_strip\`: \`qa/shots/NN.jpg\` 8-frame strip + \`images.strips\`: \`qa/strips/*.jpg\`)**: Whenever a shot has a non-null \`images.shot_strip\` (8-frame 4×2 motion strip) or non-empty \`images.strips\`, you **MUST** open it to inspect frame-by-frame motion, jump arcs, flight trajectories, and prop/creature depth ordering, and include \`"shot_strip"\` or \`"strips"\` in \`looked\` (reviews that omit it are rejected).
   - **HOT Shots (\`is_hot: true\`)**: Also open \`images.card\` and \`images.crop\` (if non-null), and include \`"crops"\` in \`looked\`. Only open \`images.card_fallback\` for non-HOT shots if a frame on the contact sheet is ambiguous.
   - In \`looked\`, include \`"contact"\` (or \`"card"\`) for every shot, \`"shot_strip"\` / \`"strips"\` whenever motion strips exist, plus \`"crops"\` for HOT shots.
4. **Include \`"blind_sha"\`** from the slice entry verbatim in each JSONL review line.
5. **Check ALL 9 criteria** (\`acting\`, \`contact\`, \`overlap\`, \`set\`, \`text\`, \`caption\`, \`beat\`, \`model\`, \`continuity\`) formatted as \`"ok — ..."\` or \`"fix — ..."\`, with a \`note\` of >= 6 words describing what you actually saw:
   - \`acting\`: expression, gesture, posture, and gaze match the narration beat. **Pasted-Sticker & Airborne / Jump / Flight Realism Check (MANDATORY \`fix\`):** flag automatic \`fix\` if (a) limbs/torso read as a rigid brick with zero spine curve, knee flexion, or secondary hair/FX life, (b) ANY frame in the 8-frame \`shot_strip\` or \`strips\` shows a character walking/running in mid-air or moon-floating without takeoff/landing squash, or (c) a flying creature (\`ladybug\`, etc.) is occluded behind ground/tabletop props!
   - \`contact\`: feet planted on ground/floor, hands actually meet props/targets, seated bodies rest on seats. **Pasted-Sticker & Airborne / Jump / Flight Realism Check (MANDATORY \`fix\`):** flag automatic \`fix\` if (a) ANY frame in the 8-frame \`shot_strip\` or \`strips\` shows a character walking/running in mid-air, moon-floating without takeoff/landing squash, or a grounded character floating with no contact shadow, (b) a flying creature (\`ladybug\`, etc.) is occluded behind ground/tabletop props instead of flying clearly above them, (c) hands in \`push\`/\`hold\`/\`ride\` grab empty air instead of the physical target/grip point, or (d) riders sit pasted flat on one side of a creature instead of straddling with a seat shadow.
   - \`overlap\`: no unintended character/prop collisions or faces hidden behind props/overlays.
   - \`set\`: environment reads clearly, clean perspective, no stray/clipped set geometry.
   - \`text\`: every sign, label, and overlay is legible, unclipped, and unoccluded.
   - \`caption\`: caption band is clear of faces, hands, and hero props.
   - \`beat\`: visual action and timing match the spoken \`narration\` for this shot.
   - \`model\`: character proportions, outfits, and identity stay on-model.
   - \`continuity\` (**3-shot cross-shot continuity — MANDATORY \`fix\` trigger**): inspect \`context_window.prev_shot\` and \`context_window.next_shot\` alongside the rendered frames. Flag automatic \`fix\` if (a) physical distance between actors/objects contradicts the action or narration, (b) chronological event order contradicts spoken narration (e.g. aftermath/impact shown before approach), (c) moving objects lose/gain their operator across adjacent shots, (d) ground-bound objects float off the floor plane, or (e) a closeup-only detached limb appears next to the full character in a wide shot!
6. Submit reviews via \`node scripts/qa.mjs review --batch <file.jsonl>\`.
`;
fs.writeFileSync(path.join(outDir, 'RUBRIC.md'), rubric);

if (targetUnit) {
  const uid = String(targetUnit.id);
  const startSid = normSegId(targetUnit.seg_start);
  const endSid = normSegId(targetUnit.seg_end);
  const uList = entries.filter((e) => segInUnitRange(e.seg, startSid, endSid));
  const hotU = uList.filter((e) => e.is_hot);
  console.log(`blind_pack (--unit ${uid}): ${uList.length} shot(s) (${hotU.length} hot) -> ${outDir}/unit_${uid}.json + ${outDir}/manifest.json`);
} else {
  const hotEntries = entries.filter((e) => e.is_hot);
  console.log(`blind_pack: ${entries.length} shot(s) (${hotEntries.length} hot) -> ${outDir}/manifest.json + slice_{1,2,3}.json`);
}
