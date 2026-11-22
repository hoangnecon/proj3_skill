// Standalone blind-review evidence packer (Pillar 3, v3.9).
//   node scripts/blind_pack.mjs -> qa/blind_review/{manifest.json, slice_1.json, slice_2.json, slice_3.json, RUBRIC.md}
// Reads ONLY rendered QA artifacts + script/words/brief (NEVER shotlist.ts, coordinates, or actor/prop code).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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

  const hotReasons = Array.isArray(hot?.[i]) ? [...new Set(hot[i])] : [];
  const cardPath = `qa/cards/${pad(i)}.jpg`;
  const cropCandidate = `qa/crops/${pad(i)}.jpg`;
  const cropPath = fs.existsSync(cropCandidate) ? cropCandidate : null;
  const contactPage = contactIndex?.[i] ?? contactIndex?.[String(i)] ?? `qa/contact_p${Math.floor(i / 12) + 1}.jpg`;
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
      segment_contact: segmentContactPath,
      shot_strip: shotStripPath,
      strips: [...new Set(shotStrips)],
    },
    hash,
    blind_sha: blindSha,
  };
});

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
  // Partition ordered contact pages into 3 contiguous chunks balancing shot counts.
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

const formatSliceShot = (e) => ({
  shot: e.shot,
  name: e.name,
  t0: e.t0,
  t1: e.t1,
  format: e.format,
  set_title: e.set_title,
  set_streak: e.set_streak,
  prev_set: e.prev_set,
  narration: e.narration,
  is_hot: e.is_hot,
  hot_reasons: e.hot_reasons,
  layout: e.layout,
  images: e.is_hot
    ? e.images
    : {
        contact_page: e.images.contact_page,
        segment_contact: e.images.segment_contact,
        shot_strip: e.images.shot_strip,
        strips: e.images.strips,
        card_fallback: e.images.card,
      },
  hash: e.hash,
  blind_sha: e.blind_sha,
});

const outDir = 'qa/blind_review';
fs.mkdirSync(outDir, {recursive: true});

const manifest = {
  generated_at: new Date().toISOString(),
  format,
  total_shots: entries.length,
  slices: [1, 2, 3].map((k) => `${outDir}/slice_${k}.json`),
  shots: entries,
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');

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
    pages,
  };
  fs.writeFileSync(path.join(outDir, `slice_${k + 1}.json`), JSON.stringify(payload, null, 1) + '\n');
}

const rubric = isLong16x9
  ? `# Blind Visual QA Rubric (3-Tier Hierarchical Contact Protocol · 16:9 Long-Form)

1. **Judge ONLY from the rendered images and \`narration\`** in \`qa/blind_review/slice_*.json\`.
2. **NEVER read \`src/episode/shotlist.ts\`** or inspect coordinates, actor rigs, or prop code while reviewing.
3. **Mandatory 3-Tier Hierarchical Contact Sheet Review Protocol**:
   - **Tier 1 — Đại đoạn (\`contact_pages\`: \`qa/contact_p*.jpg\`)**: Open every image in \`contact_pages\` first to audit episode-wide pacing, shot variety, set transitions, and macro framing (4 frames per shot > 4.0s, 2 frames for shorter shots).
   - **Tier 2 — Trung đoạn (\`segment_contacts\`: \`qa/contact_segments/*.jpg\`)**: Open each contiguous location block sheet (\`images.segment_contact\`) to verify spatial continuity, scale consistency, camera-angle variety, and lighting coherence across every beat in the same location.
   - **Tier 3 — Tiểu đoạn (\`images.shot_strip\`: \`qa/shots/NN.jpg\` 8-frame strip + \`images.strips\`: \`qa/strips/*.jpg\`)**: Whenever a shot has a non-null \`images.shot_strip\` (8-frame 4×2 motion strip) or non-empty \`images.strips\`, you **MUST** open it to inspect frame-by-frame motion, takeoff/apex/landing arcs, flight trajectories, and prop/creature depth ordering, and include \`"shot_strip"\` or \`"strips"\` in \`looked\` (reviews that omit it are rejected).
   - **HOT Shots (\`is_hot: true\`)**: Also open \`images.card\` and \`images.crop\` (if non-null), and include \`"crops"\` in \`looked\`. Only open \`images.card_fallback\` for non-HOT shots if a frame on the contact sheet is ambiguous.
   - In \`looked\`, include \`"contact"\` (or \`"card"\`) for every shot, \`"shot_strip"\` / \`"strips"\` whenever motion strips exist, plus \`"crops"\` for HOT shots.
4. **Include \`"blind_sha"\`** from the slice entry verbatim in each JSONL review line.
5. **Check ALL 10 criteria** (\`acting\`, \`contact\`, \`overlap\`, \`set\`, \`text\`, \`caption\`, \`beat\`, \`model\`, \`framing\`, \`variety\`) formatted as \`"ok — ..."\` or \`"fix — ..."\`, with a \`note\` of >= 6 words describing what you actually saw:
   - \`acting\`: expression, gesture, posture, and gaze match the narration beat; **verify articulated bent knees/elbows and dynamic physics** (no stiff, board-like standing on mounts or mid-action!). **Pasted-Sticker & Airborne / Jump / Flight Realism Check (MANDATORY \`fix\`):** flag automatic \`fix\` if (a) limbs/torso read as a rigid brick with zero spine curve, knee flexion, or secondary hair/FX life, (b) ANY frame in the 8-frame \`shot_strip\` or \`strips\` shows a character walking/running in mid-air or moon-floating without takeoff/landing squash, or (c) a flying creature (\`ladybug\`, etc.) is occluded behind ground/tabletop props!
   - \`contact\`: feet planted on ground/floor, hands actually meet props/targets, seated bodies rest on seats; **verify mounted riders sit physically on their mount facing the travel direction, and verify non-OTS creatures are not half-sliced off the frame edge**. **Pasted-Sticker & Airborne / Jump / Flight Realism Check (MANDATORY \`fix\`):** flag automatic \`fix\` if (a) ANY frame in the 8-frame \`shot_strip\` or \`strips\` shows a character walking/running in mid-air, moon-floating without takeoff/landing squash, or a grounded character floating with no contact shadow, (b) a flying creature (\`ladybug\`, etc.) is occluded behind ground/tabletop props instead of flying clearly above them, (c) hands in \`push\`/\`hold\`/\`ride\` grab empty air instead of the physical target/grip point, or (d) riders sit pasted flat on one side of a creature instead of straddling with a seat shadow.
   - \`overlap\`: no unintended character/prop collisions or faces hidden behind props/overlays.
   - \`set\`: environment reads clearly, clean perspective, no stray/clipped set geometry.
   - \`text\`: every sign, label, and overlay is legible, unclipped, and unoccluded.
   - \`caption\`: caption band is clear of faces, hands, and hero props.
   - \`beat\`: visual action and timing match the spoken \`narration\` for this shot.
   - \`model\`: character proportions, outfits, and identity stay on-model.
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
5. **Check ALL 8 criteria** (\`acting\`, \`contact\`, \`overlap\`, \`set\`, \`text\`, \`caption\`, \`beat\`, \`model\`) formatted as \`"ok — ..."\` or \`"fix — ..."\`, with a \`note\` of >= 6 words describing what you actually saw:
   - \`acting\`: expression, gesture, posture, and gaze match the narration beat. **Pasted-Sticker & Airborne / Jump / Flight Realism Check (MANDATORY \`fix\`):** flag automatic \`fix\` if (a) limbs/torso read as a rigid brick with zero spine curve, knee flexion, or secondary hair/FX life, (b) ANY frame in the 8-frame \`shot_strip\` or \`strips\` shows a character walking/running in mid-air or moon-floating without takeoff/landing squash, or (c) a flying creature (\`ladybug\`, etc.) is occluded behind ground/tabletop props!
   - \`contact\`: feet planted on ground/floor, hands actually meet props/targets, seated bodies rest on seats. **Pasted-Sticker & Airborne / Jump / Flight Realism Check (MANDATORY \`fix\`):** flag automatic \`fix\` if (a) ANY frame in the 8-frame \`shot_strip\` or \`strips\` shows a character walking/running in mid-air, moon-floating without takeoff/landing squash, or a grounded character floating with no contact shadow, (b) a flying creature (\`ladybug\`, etc.) is occluded behind ground/tabletop props instead of flying clearly above them, (c) hands in \`push\`/\`hold\`/\`ride\` grab empty air instead of the physical target/grip point, or (d) riders sit pasted flat on one side of a creature instead of straddling with a seat shadow.
   - \`overlap\`: no unintended character/prop collisions or faces hidden behind props/overlays.
   - \`set\`: environment reads clearly, clean perspective, no stray/clipped set geometry.
   - \`text\`: every sign, label, and overlay is legible, unclipped, and unoccluded.
   - \`caption\`: caption band is clear of faces, hands, and hero props.
   - \`beat\`: visual action and timing match the spoken \`narration\` for this shot.
   - \`model\`: character proportions, outfits, and identity stay on-model.
6. Submit reviews via \`node scripts/qa.mjs review --batch <file.jsonl>\`.
`;
fs.writeFileSync(path.join(outDir, 'RUBRIC.md'), rubric);

const hotEntries = entries.filter((e) => e.is_hot);
console.log(`blind_pack: ${entries.length} shot(s) (${hotEntries.length} hot) -> ${outDir}/manifest.json + slice_{1,2,3}.json (${slices.map((s) => s.length).join('/')})`);
