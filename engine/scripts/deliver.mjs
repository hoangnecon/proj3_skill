// Final render + delivery report (gate G7).
//   node scripts/deliver.mjs            -> out/final.mp4, qa/deliver_report.json, qa/final_check.jpg (no phone copy: the user does not want one)
// Refuses to run when the mix is stale (shots or voice changed after scripts/mix.py ran).
import {cachedBundle} from './bundle_cache.mjs';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {loadProject, writeTables} from './load.mjs';
import {makeShotHash} from './deps.mjs';

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
// Remotion writes every frame to the temp dir (~0.5 MB each) before encoding; ENOSPC at 44 % cost a 10-minute render once.
{
  const need = (P.DURATION * 30 * 0.6) / 1024 + 1.5; // GB
  const free = +execFileSync('df', ['-k', '/private/var/folders']).toString().trim().split('\n').pop().split(/\s+/)[3] / 1024 / 1024;
  if (free < need) die(`only ${free.toFixed(1)} GB free, render needs ~${need.toFixed(1)} GB — free disk space first (ask the user before deleting their files)`);
}
const raw = 'out/_render.mp4';
const final = 'out/final.mp4';
// SV_SKIP_RENDER=1 reuses out/_render.mp4 when it is newer than the shotlist and the mix (audio-only fixes, re-encodes)
const fresh = fs.existsSync(raw) && ['src/episode/shotlist.ts', 'src/episode/sets.tsx', 'src/episode/cast.ts'].every((f) => fs.statSync(raw).mtimeMs > fs.statSync(f).mtimeMs);
if (process.env.SV_SKIP_RENDER && fresh) {
  console.log('reuse', raw);
} else {
  const DEPS = makeShotHash(rows, P.SHOTS);
  const hashes = rows.map((r) => DEPS.hashOf(r));
  const globalFiles = [
    'src/Film.tsx', 'src/Root.tsx', 'src/kit.tsx', 'src/chars.tsx',
    'src/side.tsx', 'src/overlays.tsx', 'src/data/words.json',
    'src/data/cues.json', 'src/episode/cast.ts', 'src/props.tsx',
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
  const globalKey = `crf21|1080x1920|30fps|${srcGlobalHash}`;
  const FPS = 30;
  const totalFrames = Math.max(1, Math.round(P.DURATION * FPS));
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
  const chunkKeys = rows.map((_, i) =>
    sha1(`${globalKey}|${hashes[i]}|${frameRanges[i][0]}:${frameRanges[i][1]}`).slice(0, 14)
  );
  const chunkDir = 'out/_chunks';
  fs.mkdirSync(chunkDir, {recursive: true});
  const chunkPath = (i) => path.join(chunkDir, `${chunkKeys[i]}.mp4`);
  const isCached = (i) => {
    const p = chunkPath(i);
    return fs.existsSync(p) && fs.statSync(p).size > 0;
  };
  const cachedCount = rows.filter((_, i) => isCached(i)).length;
  const useChunks = rows.length > 0 && (process.env.SV_CHUNK_RENDER === '1' || cachedCount >= Math.ceil(rows.length * 0.5));
  const concurrency = Math.max(4, Math.min(10, os.cpus().length - 2));

  if (useChunks) {
    const missing = rows.map((_, i) => i).filter((i) => !isCached(i));
    console.log(`chunks: ${cachedCount}/${rows.length} cached, rendering ${missing.length} shot(s)`);
    if (missing.length > 0) {
      const serveUrl = await cachedBundle('src/index.ts');
      const comp = await selectComposition({serveUrl, id: 'Film', chromiumOptions: {gl: 'angle'}});
      for (let idx = 0; idx < missing.length; idx++) {
        const i = missing[idx];
        const out = chunkPath(i);
        const tmp = `${out}.tmp.${process.pid}.mp4`;
        await renderMedia({
          serveUrl,
          composition: comp,
          codec: 'h264',
          crf: 21,
          muted: true,
          frameRange: frameRanges[i],
          outputLocation: tmp,
          chromiumOptions: {gl: 'angle'},
          concurrency,
        });
        fs.renameSync(tmp, out);
        console.log(`chunk ${idx + 1}/${missing.length}: shot #${rows[i].i} [${frameRanges[i][0]}..${frameRanges[i][1]}] -> ${out}`);
      }
    }
    const concatFile = path.join(chunkDir, 'concat.txt');
    fs.writeFileSync(concatFile, chunkKeys.map((k) => `file '${k}.mp4'`).join('\n') + '\n');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concatFile, '-c:v', 'copy', '-an', raw]);
    console.log('ok (chunk concat)', raw);
  } else {
    const serveUrl = await cachedBundle('src/index.ts');
    const comp = await selectComposition({serveUrl, id: 'Film', chromiumOptions: {gl: 'angle'}});
    let last = 0;
    await renderMedia({serveUrl, composition: comp, codec: 'h264', crf: 21, outputLocation: raw, chromiumOptions: {gl: 'angle'}, concurrency,
      onProgress: ({progress}) => { if (progress - last > 0.1) { last = progress; process.stdout.write(`\rrender ${(progress * 100).toFixed(0)}%`); } }});
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
const report = {
  final, duration: +dur.toFixed(2), expected: +P.DURATION.toFixed(2), width: v.width, height: v.height, fps: fn / fd,
  audio: !!a, audio_rate: a ? +a.sample_rate : 0, size_mb: +(fs.statSync(final).size / 1e6).toFixed(1),
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
// spot-check frames straight from the encoded file (catches encode/audio-sync issues the stills cannot)
const cells = [];
for (let i = 0; i < 12; i++) {
  const t = (dur * (i + 0.5)) / 12;
  const f = `qa/_f/final_${i}.jpg`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', t.toFixed(2), '-i', final, '-frames:v', '1', '-q:v', '3', f]);
  cells.push({img: f, label: t.toFixed(1) + 's', sub: ''});
}
fs.writeFileSync('qa/_f/tile.json', JSON.stringify({out: 'qa/final_check.jpg', cols: 6, w: 300, fmt: 'jpg', title: `FINAL · ${report.duration}s · ${report.width}x${report.height} · ${report.fps} fps`, cells}));
execFileSync(PY, ['scripts/tile.py', 'qa/_f/tile.json'], {stdio: 'inherit'});
console.log(JSON.stringify(report));
