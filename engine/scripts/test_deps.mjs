// Regression test for the per-shot dependency hash (engine/scripts/deps.mjs). Run INSIDE A COPY of an episode
// (it edits src/ and puts every file back):  cd <copy> && node scripts/test_deps.mjs (copied from engine/scripts)
// Each case injects a change and checks which shots go stale. A miss (a change that should make a shot stale
// but does not) fails the test: missing a change means a shot nobody re-reviewed.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const here = process.cwd();
const load = async () => (await import(pathToFileURL(path.join(here, 'scripts/load.mjs')) + '?v=' + Date.now())).loadProject();
const {makeShotHash} = await import(pathToFileURL(path.join(here, 'scripts/deps.mjs')));
const hashes = async () => { const P = await load(); const rows = P.shotTable(); const H = makeShotHash(rows, P.SHOTS); return {P, rows, h: rows.map((r) => H.hashOf(r)), H}; };
const base = await hashes();
const N = base.rows.length;
let fails = 0;

async function edit(name, file, fn, expect) {
  const orig = fs.readFileSync(file, 'utf8');
  try {
    fs.writeFileSync(file, fn(orig));
    const now = await hashes();
    const stale = now.h.map((x, i) => (x !== base.h[i] ? i : -1)).filter((i) => i >= 0);
    const ok = expect(stale);
    if (!ok) fails++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${stale.length}/${N} stale${stale.length && stale.length < N ? ' ' + stale.join(',') : ''}`);
  } finally { fs.writeFileSync(file, orig); }
}

// 1. engine file → every shot
await edit('engine edit (Film.tsx)', 'src/Film.tsx', (s) => s + '\n// x\n', (st) => st.length === N);
// 2. a new, unused component in props.tsx → no shot
await edit('unused new prop', 'src/props.tsx', (s) => s + '\nexport const ZzUnused = () => null;\n', (st) => st.length === 0);
// 3. a top-level statement (side effect) in props.tsx → every shot
await edit('top-level statement in props.tsx', 'src/props.tsx', (s) => s + '\nvoid 0;\n', (st) => st.length === N);
// 4. every set: an edit inside its render source → at least every shot on that set
const setsFile = fs.existsSync('src/episode/sets.tsx') ? 'src/episode/sets.tsx' : null;
if (setsFile) {
  const src = fs.readFileSync(setsFile, 'utf8');
  for (const id of [...new Set(base.rows.map((r) => r.set))].filter((id) => src.includes(`'${id}'`) || src.includes(`${id}:`)).slice(0, 6)) {
    const on = base.rows.filter((r) => r.set === id).map((r) => r.i);
    // find the render function named in the registry entry for this set and add a comment to its body
    const at = Math.max(src.indexOf(`'${id}':`), src.indexOf(`\n  ${id}:`));
    const m = at >= 0 ? /render:\s*(?:\w+\()?(\w+)/.exec(src.slice(at, at + 600)) : null;
    if (!m) continue;
    const fnName = m[1];
    await edit(`set ${id} (${fnName})`, setsFile, (s) => s.replace(new RegExp(`(const ${fnName} = [^\\n]*\\n)`), `$1  // x\n`),
      (st) => on.every((i) => st.includes(i)));
  }
}
// 5. a cast look → every shot that casts it
const look = base.rows.flatMap((r) => r.actors.map((a) => a.look))[0];
if (look && fs.existsSync('src/episode/cast.ts')) {
  const on = base.rows.filter((r) => r.actors.some((a) => a.look === look)).map((r) => r.i);
  await edit(`look ${look}`, 'src/episode/cast.ts', (s) => s.replace(`\n  ${look}: {`, `\n  ${look}: {zz: 1, `), (st) => on.every((i) => st.includes(i)) && st.length < N);
}
// 6. words of one segment moved 0.05 s → only shots within 3 s of that segment (+ shots anchored in it)
const W = 'src/data/words.json';
const words = JSON.parse(fs.readFileSync(W, 'utf8'));
const seg = words[Math.floor(words.length / 2)].seg;
await edit(`words of ${seg} +0.05 s`, W, (s) => JSON.stringify(JSON.parse(s).map((w) => (w.seg === seg ? {...w, s: w.s + 0.05, e: w.e + 0.05} : w))),
  (st) => st.length > 0 && st.length < N);

console.log(fails ? `test_deps: ${fails} FAILED` : 'test_deps: all ok');
process.exit(fails ? 1 : 0);
