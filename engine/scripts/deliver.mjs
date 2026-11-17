// Final render + delivery report (gate G7).
//   node scripts/deliver.mjs            -> out/final.mp4, qa/deliver_report.json, qa/final_check.jpg (no phone copy: the user does not want one)
// Refuses to run when the mix is stale (shots or voice changed after scripts/mix.py ran).
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {loadProject, writeTables} from './load.mjs';

const P = await loadProject();
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
const die = (m) => { console.error('ERROR', m); process.exit(1); };
writeTables(fs, P.shotTable());
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
  const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
  const comp = await selectComposition({serveUrl, id: 'Film', chromiumOptions: {gl: 'angle'}});
  let last = 0;
  await renderMedia({serveUrl, composition: comp, codec: 'h264', crf: 18, outputLocation: raw, chromiumOptions: {gl: 'angle'}, concurrency: Math.max(4, Math.min(8, Math.floor(os.cpus().length / 2))),
    onProgress: ({progress}) => { if (progress - last > 0.1) { last = progress; process.stdout.write(`\rrender ${(progress * 100).toFixed(0)}%`); } }});
  console.log('\nok', raw);
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
const PY = process.env.SV_PY || '/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python';
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
execFileSync('python3', ['scripts/tile.py', 'qa/_f/tile.json'], {stdio: 'inherit'});
console.log(JSON.stringify(report));
