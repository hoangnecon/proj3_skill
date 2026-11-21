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
  const contactPage = `qa/contact_p${Math.floor(i / 12) + 1}.jpg`;
  const prefix = `s${pad(i)}_`;
  const shotStrips = (Array.isArray(stripsNeeded) ? stripsNeeded : [])
    .filter((s) => s && typeof s.name === 'string' && (s.name.startsWith(prefix) || (typeof s.t0 === 'number' && s.t0 >= r.t0 - 0.01 && s.t0 < r.t1)))
    .map((s) => `qa/strips/${s.name}.jpg`);

  const cardSha = sha256File(cardPath);
  const cropSha = cropPath ? sha256File(cropPath) : '';
  const blindSha = sha256Hex(`${hash}|${narration}|${cardSha}|${cropSha}`).slice(0, 12);

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
    images: {
      card: cardPath,
      crop: cropPath,
      contact_page: contactPage,
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
  images: e.is_hot
    ? e.images
    : {
        contact_page: e.images.contact_page,
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
  const pages = contactPages.map((cp) => ({contact_page: cp, shots: byPage.get(cp)}));
  const payload = {
    slice: k + 1,
    total_slices: 3,
    format,
    count: sl.length,
    hot_count: sl.filter((e) => e.is_hot).length,
    contact_pages: contactPages,
    hot_shots: sl.filter((e) => e.is_hot).map((e) => e.shot),
    pages,
  };
  fs.writeFileSync(path.join(outDir, `slice_${k + 1}.json`), JSON.stringify(payload, null, 1) + '\n');
}

const rubric = isLong16x9
  ? `# Blind Visual QA Rubric (Contact-First · 16:9 Long-Form)

1. **Judge ONLY from the rendered images and \`narration\`** in \`qa/blind_review/slice_*.json\`.
2. **NEVER read \`src/episode/shotlist.ts\`** or inspect coordinates, actor rigs, or prop code while reviewing.
3. **Contact-First Workflow (Token-Lean)**:
   - **First**, open every image in \`contact_pages\` at the top of your slice (typically only 2 contact pages covering ~12 shots each in a wide 4-column 16:9 grid). Use these contact pages to inspect all non-HOT shots in each \`pages[]\` group.
   - **Next**, for every HOT shot (\`is_hot: true\`), open its \`images.card\`, \`images.crop\` (if non-null), and any \`images.strips\`, and include \`"crops"\` in \`looked\`.
   - For non-HOT shots with non-empty \`images.strips\`, open those strips; only open \`images.card_fallback\` if a frame on the contact page is ambiguous or looks suspicious.
   - In \`looked\`, include \`"contact"\` (or \`"card"\`) for every shot, plus \`"crops"\` for HOT shots.
4. **Include \`"blind_sha"\`** from the slice entry verbatim in each JSONL review line.
5. **Check ALL 10 criteria** (\`acting\`, \`contact\`, \`overlap\`, \`set\`, \`text\`, \`caption\`, \`beat\`, \`model\`, \`framing\`, \`variety\`) formatted as \`"ok — ..."\` or \`"fix — ..."\`, with a \`note\` of >= 6 words describing what you actually saw:
   - \`acting\`: expression, gesture, posture, and gaze match the narration beat.
   - \`contact\`: feet planted on ground/floor, hands actually meet props/targets, seated bodies rest on seats.
   - \`overlap\`: no unintended character/prop collisions or faces hidden behind props/overlays.
   - \`set\`: environment reads clearly, clean perspective, no stray/clipped set geometry.
   - \`text\`: every sign, label, and overlay is legible, unclipped, and unoccluded.
   - \`caption\`: caption band is clear of faces, hands, and hero props.
   - \`beat\`: visual action and timing match the spoken \`narration\` for this shot.
   - \`model\`: character proportions, outfits, and identity stay on-model.
   - \`framing\` (**16:9 cinematic framing — MANDATORY \`fix\` trigger**): check depth, angle, and frame edges. **Any severed or floating giant limb** (arm, hand, leg, tentacle, creature appendage) terminating mid-air inside the frame is an automatic \`fix\` — giant limbs MUST bleed off the frame edge, never end floating in mid-air!
   - \`variety\` (**visual freshness — MANDATORY \`fix\` trigger**): inspect \`set_streak\` and \`prev_set\` on each shot entry alongside the rendered contact page. **Same-wall / same-prop copy-paste fatigue** or repeating the same static wall framing, pose, or prop layout across consecutive shots is an automatic \`fix\`!
6. Submit reviews via \`node scripts/qa.mjs review --batch <file.jsonl>\`.
`
  : `# Blind Visual QA Rubric (Contact-First)

1. **Judge ONLY from the rendered images and \`narration\`** in \`qa/blind_review/slice_*.json\`.
2. **NEVER read \`src/episode/shotlist.ts\`** or inspect coordinates, actor rigs, or prop code while reviewing.
3. **Contact-First Workflow (Token-Lean)**:
   - **First**, open every image in \`contact_pages\` at the top of your slice (typically only 2 contact pages covering ~12 shots each). Use these contact pages to inspect all non-HOT shots in each \`pages[]\` group.
   - **Next**, for every HOT shot (\`is_hot: true\`), open its \`images.card\`, \`images.crop\` (if non-null), and any \`images.strips\`, and include \`"crops"\` in \`looked\`.
   - For non-HOT shots with non-empty \`images.strips\`, open those strips; only open \`images.card_fallback\` if a frame on the contact page is ambiguous or looks suspicious.
   - In \`looked\`, include \`"contact"\` (or \`"card"\`) for every shot, plus \`"crops"\` for HOT shots.
4. **Include \`"blind_sha"\`** from the slice entry verbatim in each JSONL review line.
5. Check all 8 criteria (\`acting\`, \`contact\`, \`overlap\`, \`set\`, \`text\`, \`caption\`, \`beat\`, \`model\`) formatted as \`"ok — ..."\` or \`"fix — ..."\`, with a \`note\` of >= 6 words describing what you actually saw.
6. Submit reviews via \`node scripts/qa.mjs review --batch <file.jsonl>\`.
`;
fs.writeFileSync(path.join(outDir, 'RUBRIC.md'), rubric);

const hotEntries = entries.filter((e) => e.is_hot);
console.log(`blind_pack: ${entries.length} shot(s) (${hotEntries.length} hot) -> ${outDir}/manifest.json + slice_{1,2,3}.json (${slices.map((s) => s.length).join('/')})`);
