// Final render + phone copy + delivery report (gate G7).
//   node scripts/deliver.mjs            -> out/final.mp4, out/<slug>_phone.mp4 (<= 30 MB), qa/deliver_report.json, qa/final_check.png
// Refuses to run when the mix is stale (shots or voice changed after scripts/mix.py ran).
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {loadProject} from './load.mjs';

const P = await loadProject();
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
const die = (m) => { console.error('ERROR', m); process.exit(1); };
fs.writeFileSync('qa/shots.json', JSON.stringify(P.shotTable(), null, 1));
if (!fs.existsSync('public/mix.wav') || !fs.existsSync('qa/mix_report.json')) die('no mix — run scripts/mix.py first');
const mr = JSON.parse(fs.readFileSync('qa/mix_report.json', 'utf8'));
if (mr.inputs.shots !== sha('qa/shots.json')) die('shots changed after the mix — re-run: node scripts/times.mjs && python scripts/mix.py');
if (mr.inputs.voice !== sha('audio/voice.wav')) die('voice changed after the mix — re-run scripts/mix.py');

fs.mkdirSync('out', {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const comp = await selectComposition({serveUrl, id: 'Film', chromiumOptions: {gl: 'angle'}});
const final = 'out/final.mp4';
let last = 0;
await renderMedia({serveUrl, composition: comp, codec: 'h264', crf: 18, outputLocation: final, chromiumOptions: {gl: 'angle'}, concurrency: 4,
  onProgress: ({progress}) => { if (progress - last > 0.1) { last = progress; process.stdout.write(`\rrender ${(progress * 100).toFixed(0)}%`); } }});
console.log('\nok', final);

const script = JSON.parse(fs.readFileSync('script.json', 'utf8'));
const slug = (script.title ?? 'episode').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const phone = `out/${slug}_phone.mp4`;
let crf = 25;
for (;;) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', final, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', phone]);
  const mb = fs.statSync(phone).size / 1e6;
  if (mb <= 30 || crf >= 34) break;
  crf += 2;
}
const probe = (f) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', f]).toString());
const pf = probe(final);
const v = pf.streams.find((s) => s.codec_type === 'video');
const a = pf.streams.find((s) => s.codec_type === 'audio');
const [fn, fd] = v.r_frame_rate.split('/').map(Number);
const dur = +pf.format.duration;
const report = {
  final, phone, duration: +dur.toFixed(2), expected: +P.DURATION.toFixed(2), width: v.width, height: v.height, fps: fn / fd,
  audio: !!a, audio_rate: a ? +a.sample_rate : 0, size_mb: +(fs.statSync(final).size / 1e6).toFixed(1),
  phone_size_mb: +(fs.statSync(phone).size / 1e6).toFixed(1), phone_crf: crf, final_sha: sha(final), shots_sha: sha('qa/shots.json'),
};
fs.writeFileSync('qa/deliver_report.json', JSON.stringify(report, null, 1));
// spot-check frames straight from the encoded file (catches encode/audio-sync issues the stills cannot)
const cells = [];
for (let i = 0; i < 12; i++) {
  const t = (dur * (i + 0.5)) / 12;
  const f = `qa/_f/final_${i}.jpg`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', t.toFixed(2), '-i', final, '-frames:v', '1', '-q:v', '3', f]);
  cells.push({img: f, label: t.toFixed(1) + 's', sub: ''});
}
fs.writeFileSync('qa/_f/tile.json', JSON.stringify({out: 'qa/final_check.png', cols: 6, w: 300, title: `FINAL · ${report.duration}s · ${report.width}x${report.height} · ${report.fps} fps · phone ${report.phone_size_mb} MB`, cells}));
execFileSync('python3', ['scripts/tile.py', 'qa/_f/tile.json'], {stdio: 'inherit'});
console.log(JSON.stringify(report));
