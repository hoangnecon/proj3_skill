// Final render + delivery report (gate G7).
//   node scripts/deliver.mjs            -> out/final.mp4, qa/deliver_report.json, qa/final_check.jpg (no phone copy: the user does not want one)
// Refuses to run when the mix is stale (shots or voice changed after scripts/mix.py ran).
import {cachedBundle, pruneStaleRemotionTmp} from './bundle_cache.mjs';
import {openBrowser, renderMedia, selectComposition} from '@remotion/renderer';
import {execFile, execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {promisify} from 'node:util';
import {loadProject, writeTables} from './load.mjs';
import {makeShotHash} from './deps.mjs';

const execFileAsync = promisify(execFile);
const tStartDeliver = Date.now();
const imgFmt = process.env.SV_FRAME_FORMAT === 'png' ? 'png' : 'jpeg';
const imgOpts = imgFmt === 'jpeg' ? {imageFormat: 'jpeg', jpegQuality: 95} : {imageFormat: 'png'};

const P = await loadProject();
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const die = (m) => { console.error('ERROR', m); process.exit(1); };
const rows = P.shotTable();
writeTables(fs, rows);
if (!fs.existsSync('public/mix.wav') || !fs.existsSync('qa/mix_report.json')) die('no mix — run scripts/mix.py first');
const mr = JSON.parse(fs.readFileSync('qa/mix_report.json', 'utf8'));
// only TIMING matters for the mix: a visual-only fix (pose, prop, set, camera) does not force a remix
if ((mr.inputs.timing ?? mr.inputs.shots) !== sha(mr.inputs.timing ? 'qa/timing.json' : 'qa/shots.json')) die('shot timing changed after the mix — re-run: node scripts/times.mjs && python scripts/mix.py');
if (mr.inputs.voice !== sha('audio/voice.wav')) die('voice changed after the mix — re-run scripts/mix.py');

fs.mkdirSync('out', {recursive: true});
// Prune orphaned Remotion temp dirs (> 1h old) before checking disk space so stale renders don't trigger false low-disk errors.
const prunedTmp = pruneStaleRemotionTmp(60 * 60 * 1000);
if (prunedTmp > 0) console.log(`pruned ${prunedTmp} stale Remotion temp dir(s)`);

const readFreeGb = () => {
  const probe = fs.existsSync('/private/var/folders') ? '/private/var/folders' : os.tmpdir();
  try {
    return +execFileSync('df', ['-k', probe]).toString().trim().split('\n').pop().split(/\s+/)[3] / 1024 / 1024;
  } catch {
    return +execFileSync('df', ['-k', os.tmpdir()]).toString().trim().split('\n').pop().split(/\s+/)[3] / 1024 / 1024;
  }
};
const free = readFreeGb();
const raw = 'out/_render.mp4';
const final = 'out/final.mp4';
const FPS = 30;
const totalFrames = Math.max(1, Math.round(P.DURATION * FPS));
const x264Preset = process.env.SV_X264_PRESET || 'veryfast';
const envChunkFrames = process.env.SV_CHUNK_FRAMES !== undefined ? Number(process.env.SV_CHUNK_FRAMES) : NaN;
let forceAdaptiveChunks = false;
let targetBlockFrames = 1050;
if (Number.isFinite(envChunkFrames) && envChunkFrames >= 1) {
  targetBlockFrames = Math.floor(envChunkFrames);
} else if (free < 4.5) {
  targetBlockFrames = 450;
  forceAdaptiveChunks = true;
}
if (forceAdaptiveChunks) {
  console.log(`tight disk (${free.toFixed(1)} GB free < 4.5 GB) — adaptive safe chunking enabled (${targetBlockFrames}f/block)`);
}
let usedChunks = false;

// Build contiguous per-shot frame ranges and group them into shot-aligned macro-blocks (~35s each).
const frameRanges = rows.map((r, idx) => {
  const f0 = idx === 0 ? 0 : Math.max(0, Math.min(totalFrames - 1, Math.round(r.t0 * FPS)));
  return [f0, totalFrames - 1];
});
for (let i = 1; i < frameRanges.length; i++) {
  if (frameRanges[i][0] <= frameRanges[i - 1][0]) {
    frameRanges[i][0] = Math.min(totalFrames - 1, frameRanges[i - 1][0] + 1);
  }
  frameRanges[i - 1][1] = frameRanges[i][0] - 1;
}
const blocks = [];
let curBlock = null;
for (let i = 0; i < rows.length; i++) {
  const [f0, f1] = frameRanges[i];
  if (!curBlock) {
    curBlock = {shots: [i], f0, f1};
    continue;
  }
  const curFrames = curBlock.f1 - curBlock.f0 + 1;
  const nextFrames = f1 - curBlock.f0 + 1;
  if (curFrames >= targetBlockFrames || (nextFrames > targetBlockFrames && (nextFrames - targetBlockFrames) > (targetBlockFrames - curFrames))) {
    blocks.push(curBlock);
    curBlock = {shots: [i], f0, f1};
  } else {
    curBlock.shots.push(i);
    curBlock.f1 = f1;
  }
}
if (curBlock) blocks.push(curBlock);

// SV_SKIP_RENDER=1 reuses out/_render.mp4 when it is newer than the shotlist and the mix (audio-only fixes, re-encodes)
const fresh = fs.existsSync(raw) && ['src/episode/shotlist.ts', 'src/episode/sets.tsx', 'src/episode/cast.ts'].every((f) => fs.statSync(raw).mtimeMs > fs.statSync(f).mtimeMs);
if (process.env.SV_SKIP_RENDER && fresh) {
  console.log('reuse', raw);
} else {
  const DEPS = makeShotHash(rows, P.SHOTS);
  const hashes = rows.map((r) => DEPS.hashOf(r));
  const globalFiles = [
    'src/Film.tsx', 'src/Root.tsx', 'src/format.ts', 'src/kit.tsx', 'src/anim.ts', 'src/chars.tsx',
    'src/side.tsx', 'src/back.tsx', 'src/threeq.tsx', 'src/subjects.ts', 'src/overlays.tsx', 'src/data/words.json',
    'src/data/cues.json', 'src/episode/cast.ts', 'src/episode/subjects.tsx', 'src/props.tsx',
  ];
  const gh = crypto.createHash('sha1');
  for (const gf of globalFiles) {
    if (fs.existsSync(gf)) {
      gh.update(gf + '\n');
      gh.update(fs.readFileSync(gf));
      gh.update('\n');
    }
  }
  const srcGlobalHash = gh.digest('hex').slice(0, 14);
  const fmt = (() => {
    try { return JSON.parse(fs.readFileSync('script.json', 'utf8'))?.format === '16:9' ? '16:9' : '9:16'; }
    catch { return '9:16'; }
  })();
  const W = fmt === '16:9' ? 1920 : 1080;
  const H = fmt === '16:9' ? 1080 : 1920;
  const globalKey = `crf21|${x264Preset}|${W}x${H}|30fps|${imgFmt}|${srcGlobalHash}`;
  const blockKeys = blocks.map((b) =>
    sha1(`${globalKey}|${b.shots.map((i) => hashes[i]).join(',')}|${b.f0}:${b.f1}`).slice(0, 14)
  );
  const chunkDir = 'out/_chunks';
  fs.mkdirSync(chunkDir, {recursive: true});
  const blockPath = (bi) => path.join(chunkDir, `${blockKeys[bi]}.mp4`);
  const isCached = (bi) => {
    const p = blockPath(bi);
    return fs.existsSync(p) && fs.statSync(p).size > 0;
  };
  const cachedCount = blocks.filter((_, bi) => isCached(bi)).length;
  const useChunks = blocks.length > 0 && process.env.SV_CHUNK_RENDER !== '0' && (
    (blocks.length > 1 && P.DURATION >= 240)
    || forceAdaptiveChunks
    || process.env.SV_CHUNK_RENDER === '1'
    || (blocks.length > 1 && cachedCount >= Math.ceil(blocks.length * 0.5))
  );
  usedChunks = useChunks;
  // Remotion writes every frame to the temp dir before encoding; JPEG q=95 cuts temp footprint by ~70% vs PNG.
  // When chunked, peak temp footprint is only the largest single block, not the entire episode.
  const maxBlockFrames = blocks.reduce((m, b) => Math.max(m, b.f1 - b.f0 + 1), 0);
  const need = useChunks
    ? (maxBlockFrames * (imgFmt === 'png' ? 0.6 : 0.18)) / 1024 + 0.6
    : (P.DURATION * FPS * (imgFmt === 'png' ? 0.6 : 0.18)) / 1024 + 1.2; // GB
  if (free < need) {
    die(`only ${free.toFixed(1)} GB free, render needs ~${need.toFixed(1)} GB${useChunks ? ` (chunked, max block ${maxBlockFrames}f)` : ''} — free disk space first (ask the user before deleting their files)`);
  }
  const concurrency = Math.max(1, +(process.env.SV_RENDER_CONCURRENCY ?? Math.max(4, Math.min(12, os.cpus().length - 1))));

  if (useChunks) {
    const missing = blocks.map((_, bi) => bi).filter((bi) => !isCached(bi));
    console.log(`macro-blocks: ${cachedCount}/${blocks.length} cached, rendering ${missing.length} block(s) (~${targetBlockFrames}f/block, ${imgFmt}, preset=${x264Preset}, concurrency=${concurrency})`);
    if (missing.length > 0) {
      const serveUrl = await cachedBundle('src/index.ts');
      const browser = await openBrowser('chrome', {chromiumOptions: {gl: 'angle'}});
      try {
        const comp = await selectComposition({serveUrl, id: 'Film', puppeteerInstance: browser, chromiumOptions: {gl: 'angle'}});
        for (let idx = 0; idx < missing.length; idx++) {
          const bi = missing[idx];
          const b = blocks[bi];
          const out = blockPath(bi);
          const tmp = `${out}.tmp.${process.pid}.mp4`;
          let last = 0, lastLogMs = Date.now();
          await renderMedia({
            serveUrl,
            composition: comp,
            codec: 'h264',
            crf: 21,
            x264Preset,
            muted: true,
            frameRange: [b.f0, b.f1],
            outputLocation: tmp,
            puppeteerInstance: browser,
            chromiumOptions: {gl: 'angle'},
            ...imgOpts,
            concurrency,
            onProgress: ({progress}) => {
              const now = Date.now();
              if (progress - last > 0.25 || now - lastLogMs >= 15000) {
                last = progress;
                lastLogMs = now;
                process.stdout.write(`\rblock ${idx + 1}/${missing.length} ${(progress * 100).toFixed(0)}%`);
              }
            },
          });
          fs.renameSync(tmp, out);
          const firstShot = rows[b.shots[0]].i;
          const lastShot = rows[b.shots[b.shots.length - 1]].i;
          console.log(`\nmacro-block ${idx + 1}/${missing.length}: shots #${firstShot}..#${lastShot} [${b.f0}..${b.f1}] (${b.f1 - b.f0 + 1}f) -> ${out}`);
        }
      } finally {
        await browser.close({silent: true}).catch(() => {});
      }
    }
    const concatFile = path.join(chunkDir, 'concat.txt');
    fs.writeFileSync(concatFile, blockKeys.map((k) => `file '${k}.mp4'`).join('\n') + '\n');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concatFile, '-c:v', 'copy', '-an', raw]);
    console.log('ok (macro-block concat)', raw);
  } else {
    const serveUrl = await cachedBundle('src/index.ts');
    const comp = await selectComposition({serveUrl, id: 'Film', chromiumOptions: {gl: 'angle'}});
    let last = 0, lastLogMs = Date.now();
    await renderMedia({
      serveUrl,
      composition: comp,
      codec: 'h264',
      crf: 21,
      x264Preset,
      outputLocation: raw,
      chromiumOptions: {gl: 'angle'},
      ...imgOpts,
      concurrency,
      onProgress: ({progress}) => {
        const now = Date.now();
        if (progress - last > 0.1 || now - lastLogMs >= 15000) {
          last = progress;
          lastLogMs = now;
          process.stdout.write(`\rrender ${(progress * 100).toFixed(0)}%`);
        }
      },
    });
    console.log('\nok', raw);
  }
}
// Remotion's AAC keeps the 2048-sample encoder priming without an edit list -> sound plays ~43 ms late.
// Take the picture from the render and the sound straight from public/mix.wav; ffmpeg's AAC writes a proper edit list.
const vdur = +JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration', '-of', 'json', raw]).toString()).streams[0].duration;
const AUD = ['-map', '0:v:0', '-map', '1:a:0', '-af', 'apad', '-t', vdur.toFixed(3)];
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-i', 'public/mix.wav', ...AUD, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', final]);
console.log('ok', final);

const probe = (f) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', f]).toString());
const pf = probe(final);
const v = pf.streams.find((s) => s.codec_type === 'video');
const a = pf.streams.find((s) => s.codec_type === 'audio');
const [fn, fd] = v.r_frame_rate.split('/').map(Number);
const dur = +pf.format.duration;
const renderSec = Math.max(0.01, (Date.now() - tStartDeliver) / 1000);
const report = {
  final, duration: +dur.toFixed(2), expected: +P.DURATION.toFixed(2), width: v.width, height: v.height, fps: fn / fd,
  audio: !!a, audio_rate: a ? +a.sample_rate : 0, size_mb: +(fs.statSync(final).size / 1e6).toFixed(1),
  render_seconds: +renderSec.toFixed(2),
  fps_effective: +(totalFrames / renderSec).toFixed(2),
  frame_format: imgFmt, x264_preset: x264Preset, chunked: usedChunks, macro_blocks: blocks.length,
  adaptive_chunk_frames: targetBlockFrames,
  final_sha: sha(final), shots_sha: sha('qa/shots.json'),
};
fs.writeFileSync('qa/deliver_report.json', JSON.stringify(report, null, 1));
// audio inside the delivered files: loudness drift after AAC, true peak, A/V length, sync (sv-42-mix-master)
const PY = process.env.SV_PYTHON || process.env.SV_PY || (fs.existsSync('/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python') ? '/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python' : 'python3');
if (fs.existsSync('qa/video_audio.json')) fs.unlinkSync('qa/video_audio.json');
for (const f of [final]) {
  try { execFileSync(PY, ['scripts/audio_qa.py', '--video', f], {stdio: 'inherit'}); }
  catch { console.error(`WARN audio check failed for ${f} — see qa/video_audio.json (gate G7 will refuse)`); }
}
// spot-check frames straight from the encoded file in parallel (catches encode/audio-sync issues the stills cannot)
fs.mkdirSync('qa/_f', {recursive: true});
const cells = await Promise.all(Array.from({length: 12}, async (_, i) => {
  const t = (dur * (i + 0.5)) / 12;
  const f = `qa/_f/final_${i}.jpg`;
  await execFileAsync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', t.toFixed(2), '-i', final, '-frames:v', '1', '-q:v', '3', f]);
  return {img: f, label: t.toFixed(1) + 's', sub: ''};
}));
fs.writeFileSync('qa/_f/tile.json', JSON.stringify({out: 'qa/final_check.jpg', cols: report.width > report.height ? 4 : 6, w: report.width > report.height ? 380 : 300, fmt: 'jpg', title: `FINAL · ${report.duration}s · ${report.width}x${report.height} · ${report.fps} fps`, cells}));
execFileSync(PY, ['scripts/tile.py', 'qa/_f/tile.json'], {stdio: 'inherit'});
console.log(JSON.stringify(report));
