// Load the episode's TypeScript (cast, sets, shotlist, timing) in plain node via esbuild,
// with the Google-font loader stubbed out. Used by lint.mjs, times.mjs, design.mjs, qa.mjs, deliver.mjs, sv_gate.py.
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const IS_WIN = process.platform === 'win32';

/** Resolve a working system Python interpreter (avoids Windows Microsoft Store python3.exe stub). */
export const resolveSystemPython = () => {
  if (process.env.SV_SYS_PY) return process.env.SV_SYS_PY;
  const candidates = IS_WIN ? ['python', 'py', 'python3'] : ['python3', 'python'];
  for (const cmd of candidates) {
    try {
      execFileSync(cmd, ['-c', 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'], {stdio: 'ignore'});
      return cmd;
    } catch {}
  }
  return IS_WIN ? 'python' : 'python3';
};

/** Resolve the VieNeu-TTS / DSP Python virtualenv across Windows and macOS/Linux. */
export const resolveVieneuPython = (fallback = resolveSystemPython()) => {
  if (process.env.SV_PY && fs.existsSync(process.env.SV_PY)) return process.env.SV_PY;
  if (process.env.SV_PY) return process.env.SV_PY;
  const home = os.homedir();
  const candidates = IS_WIN
    ? [
        'D:/mmo/tools/VieNeu-TTS/.venv/Scripts/python.exe',
        'C:/Tools/VieNeu-TTS/.venv/Scripts/python.exe',
        path.join(home, 'Tools/VieNeu-TTS/.venv/Scripts/python.exe'),
        path.join(home, 'VieNeu-TTS/.venv/Scripts/python.exe'),
      ]
    : [
        '/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python',
        path.join(home, 'Tools/VieNeu-TTS/.venv/bin/python'),
        path.join(home, 'VieNeu-TTS/.venv/bin/python'),
      ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return fallback;
};

/** Ensure ffmpeg & ffprobe are reachable on PATH (auto-detects common Windows toolchains). */
export const ensureFfmpegInPath = () => {
  const bin = IS_WIN ? 'ffmpeg.exe' : 'ffmpeg';
  const hasInPath = () => {
    try {
      execFileSync('ffmpeg', ['-version'], {stdio: 'ignore'});
      return true;
    } catch {
      return false;
    }
  };
  if (process.env.SV_FFMPEG_DIR && fs.existsSync(path.join(process.env.SV_FFMPEG_DIR, bin))) {
    process.env.PATH = process.env.SV_FFMPEG_DIR + path.delimiter + (process.env.PATH ?? '');
    return;
  }
  if (hasInPath()) return;
  if (!IS_WIN) return;
  const home = os.homedir();
  const localApp = process.env.LOCALAPPDATA ?? path.join(home, 'AppData/Local');
  const candidates = [
    'D:/mmo/tools/heo-video-runtime/bin',
    'C:/ffmpeg/bin',
    'C:/Tools/ffmpeg/bin',
    path.join(localApp, 'Microsoft/WinGet/Links'),
    path.join(home, 'scoop/shims'),
    'C:/ProgramData/chocolatey/bin',
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, bin))) {
      process.env.PATH = dir + path.delimiter + (process.env.PATH ?? '');
      return;
    }
  }
};

export const PY_SYS = resolveSystemPython();
export const PY_VIENEU = resolveVieneuPython(PY_SYS);
ensureFfmpegInPath();

const fontStub = {
  name: 'font-stub',
  setup(b) {
    b.onResolve({filter: /^@remotion\/google-fonts/}, () => ({path: 'font-stub', namespace: 'stub'}));
    b.onResolve({filter: /^remotion$/}, () => ({path: 'remotion-stub', namespace: 'stub'}));
    b.onLoad({filter: /.*/, namespace: 'stub'}, (a) => ({
      contents: a.path === 'font-stub'
        ? 'export const loadFont = () => ({fontFamily: "Be Vietnam Pro"});'
        : `export const AbsoluteFill = () => null;
export const Audio = () => null;
export const OffthreadVideo = () => null;
export const Loop = ({children}) => children ?? null;
export const staticFile = (s) => s;
export const delayRender = () => 0;
export const continueRender = () => {};
export const useCurrentFrame = () => 0;
export const useVideoConfig = () => ({fps: 30, width: 1080, height: 1920, durationInFrames: 900});
export const Composition = () => null;
export const registerRoot = () => {};
export const Easing = {linear: (x) => x, ease: (x) => x, in: (f) => f, out: (f) => (x) => 1 - f(1 - x), inOut: (f) => f, bezier: () => (x) => x};
export const interpolate = (v, ir, or) => {
  if (v <= ir[0]) return or[0];
  const n = ir.length - 1;
  if (v >= ir[n]) return or[n];
  for (let i = 1; i <= n; i++) if (v <= ir[i]) return or[i - 1] + (or[i] - or[i - 1]) * ((v - ir[i - 1]) / Math.max(1e-6, ir[i] - ir[i - 1]));
  return or[n];
};
export const spring = ({frame = 0, fps = 30}) => (frame <= 0 ? 0 : 1 - Math.exp(-(frame / fps) * 8));`,
      loader: 'js',
    }));
  },
};

/** the part of the shot table the sound mix depends on. A visual-only fix (pose, prop, set detail, camera)
 * leaves qa/timing.json unchanged, so the mix (G6) stays valid and does not have to be redone. */
export const writeTables = (fsMod, rows) => {
  fsMod.mkdirSync('qa', {recursive: true});
  fsMod.writeFileSync('qa/shots.json', JSON.stringify(rows, null, 1));
  const timing = rows.map((r) => ({i: r.i, t0: r.t0, t1: r.t1, set: r.set, bed: r.bed, tr: r.tr, keys: r.keys, reaches: r.reaches,
    over: r.over.map((o) => ({k: o.k, t: o.t}))}));
  const s = JSON.stringify(timing, null, 1);
  const prev = fsMod.existsSync('qa/timing.json') ? fsMod.readFileSync('qa/timing.json', 'utf8') : null;
  if (prev !== s) fsMod.writeFileSync('qa/timing.json', s); // unchanged → untouched
};

export const loadProject = async () => {
  const r = await build({
    entryPoints: [path.resolve('scripts/entry.tsx')], bundle: true, write: false, platform: 'node', format: 'esm',
    jsx: 'automatic', loader: {'.tsx': 'tsx', '.ts': 'ts'}, external: ['react', 'react-dom', 'react/jsx-runtime'],
    plugins: [fontStub], logLevel: 'error',
  });
  const file = path.resolve('node_modules/.sv-entry.mjs');
  fs.writeFileSync(file, r.outputFiles[0].text);
  return import(pathToFileURL(file).href + '?v=' + Date.now());
};
