// Cross-platform headless ANGLE WebGL baker for opt-in pre-baked atmospheric plates & loop MP4s (G4).
// Uses @remotion/renderer's Chromium (with playwright-core fallback) and load.mjs's cross-platform FFmpeg discovery.
//
// Usage:
//   1) Static PNG plate (default):
//      node scripts/rough_pixi_bake.mjs <scene.html> <out.png> [--width 1080] [--height 1920] [--root <dir>]
//   2) Seamless animated loop MP4 (when the scene genuinely calls for live rain/fireflies/dust/godray):
//      node scripts/rough_pixi_bake.mjs <scene.html> <out.mp4> --frames 120 [--fps 30] [--width 1080] [--height 1920]
//      (Scene HTML must expose `window.__RENDER_FRAME__(frame, totalFrames, fps)` and set `window.__RENDER_READY__ = true`.)
//   3) Batch manifest:
//      node scripts/rough_pixi_bake.mjs --manifest <manifest.json>
//
// Optional environment overrides for shared dependencies:
//   SV_ROUGH_PIXI_MODULES  path to a node_modules directory containing roughjs, pixi.js, pixi-filters
//   SV_NODE_MODULES        general shared node_modules fallback directory
//   SV_FFMPEG_DIR          directory containing ffmpeg / ffmpeg.exe (handled by load.mjs)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ensureFfmpegInPath } from './load.mjs';

ensureFfmpegInPath();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function resolveNodeModuleFile(absRoot, subRel) {
  const candidates = [
    path.join(absRoot, 'node_modules'),
    path.join(process.cwd(), 'node_modules'),
    process.env.SV_ROUGH_PIXI_MODULES,
    process.env.SV_NODE_MODULES,
  ].filter(Boolean);
  for (const base of candidates) {
    const absBase = path.resolve(base);
    const full = path.resolve(absBase, subRel);
    if ((full.startsWith(absBase + path.sep) || full === absBase) && fs.existsSync(full) && fs.statSync(full).isFile()) {
      return full;
    }
  }
  return null;
}

function startStaticServer(rootDir) {
  const absRoot = path.resolve(rootDir);
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const reqUrl = (req.url || '/').split('?')[0];
      if (reqUrl === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      const rel = decodeURIComponent(reqUrl).replace(/^\/+/, '');
      let fullPath = null;
      if (rel.startsWith('node_modules/')) {
        fullPath = resolveNodeModuleFile(absRoot, rel.slice('node_modules/'.length));
      } else {
        const candidate = path.resolve(absRoot, rel);
        if (!candidate.startsWith(absRoot + path.sep) && candidate !== absRoot) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) fullPath = candidate;
      }
      if (!fullPath) {
        res.writeHead(404);
        res.end('Not found: ' + rel);
        return;
      }
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(fullPath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let manifest = null, width = 1080, height = 1920, frames = 1, fps = 30, root = process.cwd();
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--manifest') manifest = args[++i];
    else if (a === '--width' || a === '-w') width = Number(args[++i]);
    else if (a === '--height' || a === '-h') height = Number(args[++i]);
    else if (a === '--frames') frames = Number(args[++i]);
    else if (a === '--fps') fps = Number(args[++i]);
    else if (a === '--root') root = args[++i];
    else positional.push(a);
  }
  if (manifest) {
    const items = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    return {
      root,
      jobs: items.map((j) => ({
        html: j.html,
        out: j.out,
        width: Number(j.width ?? width),
        height: Number(j.height ?? height),
        frames: Number(j.frames ?? (/\.mp4$/i.test(j.out) ? 120 : 1)),
        fps: Number(j.fps ?? fps),
      })),
    };
  }
  if (positional.length < 2) {
    console.error('Usage: node scripts/rough_pixi_bake.mjs <scene.html> <out.png|out.mp4> [--frames N] [--fps 30] [--width W] [--height H] [--root DIR]');
    console.error('   or: node scripts/rough_pixi_bake.mjs --manifest <manifest.json>');
    process.exit(1);
  }
  return { root, jobs: [{ html: positional[0], out: positional[1], width, height, frames, fps }] };
}

async function waitReady(evalFn, getPageErr, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pErr = getPageErr?.();
    if (pErr) throw new Error('Browser page error: ' + pErr);
    const st = await evalFn(() => ({
      ready: window.__RENDER_READY__ === true || window.__READY__ === true,
      err: (window.__RENDER_ERROR__ || window.__ERROR__) ? String(window.__RENDER_ERROR__ || window.__ERROR__) : null,
    }));
    if (st?.err) throw new Error('Scene render error: ' + st.err);
    if (st?.ready) return;
    await new Promise((r) => setTimeout(r, 60));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for window.__RENDER_READY__ === true`);
}

async function writeChunk(stream, buf) {
  if (!stream.write(buf)) await new Promise((res) => stream.once('drain', res));
}

async function captureJob(job, { goto, evalFn, screenshotBuf, getPageErr }) {
  const t0 = performance.now();
  await goto();
  await waitReady(evalFn, getPageErr, 45000);
  fs.mkdirSync(path.dirname(path.resolve(job.out)), { recursive: true });

  const isVideo = job.frames > 1 || /\.mp4$/i.test(job.out);
  if (!isVideo) {
    const buf = await screenshotBuf('png');
    fs.writeFileSync(job.out, buf);
    console.log(`[rough_pixi_bake] ${job.out} (${job.width}x${job.height}) baked in ${Math.round(performance.now() - t0)}ms`);
    return;
  }

  const ff = spawn('ffmpeg', [
    '-y', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(job.fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', job.out,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', (d) => { ffErr += d.toString(); });
  const ffDone = new Promise((resolve, reject) => {
    ff.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exited ${c}:\n${ffErr.slice(-1200)}`))));
    ff.on('error', reject);
  });

  for (let f = 0; f < job.frames; f++) {
    await evalFn(([fr, tot, fps]) => window.__RENDER_FRAME__(fr, tot, fps), [f, job.frames, job.fps]);
    const buf = await screenshotBuf('jpeg');
    await writeChunk(ff.stdin, buf);
  }
  ff.stdin.end();
  await ffDone;
  console.log(`[rough_pixi_bake] ${job.out} (${job.width}x${job.height}, ${job.frames}f @ ${job.fps}fps) baked in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
}

async function bakeWithRemotion(baseUrl, jobs) {
  const { openBrowser } = await import('@remotion/renderer');
  const browser = await openBrowser('chrome', { chromiumOptions: { gl: 'angle' }, logLevel: 'error' });
  try {
    const dummySourceMap = { getSourceMap: async () => null };
    for (const job of jobs) {
      const page = await browser.newPage(dummySourceMap, 'error', false);
      try {
        await page.setViewport({ width: job.width, height: job.height, deviceScaleFactor: 1 });
        const relUrl = job.html.replace(/\\/g, '/').replace(/^\/+/, '');
        const url = `${baseUrl}/${relUrl}${relUrl.includes('?') ? '&' : '?'}w=${job.width}&h=${job.height}`;
        const client = page._client();
        let pageErr = null;
        await client.send('Runtime.enable').catch(() => {});
        client.on('Runtime.exceptionThrown', (ev) => {
          const d = ev?.exceptionDetails;
          pageErr = pageErr ?? (d?.exception?.description || d?.text || 'Uncaught page exception');
        });
        await captureJob(job, {
          goto: () => page.goto({ url, timeout: 45000 }),
          evalFn: (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg)),
          getPageErr: () => pageErr,
          screenshotBuf: async (fmt) => {
            const res = await client.send('Page.captureScreenshot', {
              format: fmt,
              ...(fmt === 'jpeg' ? { quality: 92 } : {}),
              clip: { x: 0, y: 0, width: job.width, height: job.height, scale: 1 },
              captureBeyondViewport: true,
              fromSurface: true,
            });
            const b64 = res?.value?.data ?? res?.data;
            if (!b64) throw new Error('Page.captureScreenshot returned no image data');
            return Buffer.from(b64, 'base64');
          },
        });
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close({ silent: true }).catch(() => browser.close(true, 'error', false).catch(() => {}));
  }
}

async function bakeWithPlaywright(baseUrl, jobs) {
  const { chromium } = await import('playwright-core');
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const executablePath = candidates.find((p) => fs.existsSync(p));
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
  });
  try {
    for (const job of jobs) {
      const ctx = await browser.newContext({ viewport: { width: job.width, height: job.height }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      let pageErr = null;
      page.on('pageerror', (e) => { pageErr = pageErr ?? String(e); });
      const cdp = await ctx.newCDPSession(page);
      const relUrl = job.html.replace(/\\/g, '/').replace(/^\/+/, '');
      const url = `${baseUrl}/${relUrl}${relUrl.includes('?') ? '&' : '?'}w=${job.width}&h=${job.height}`;
      await captureJob(job, {
        goto: () => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }),
        evalFn: (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg)),
        getPageErr: () => pageErr,
        screenshotBuf: async (fmt) => {
          const { data } = await cdp.send('Page.captureScreenshot', {
            format: fmt,
            ...(fmt === 'jpeg' ? { quality: 92 } : {}),
            clip: { x: 0, y: 0, width: job.width, height: job.height, scale: 1 },
            captureBeyondViewport: true,
            fromSurface: true,
          });
          return Buffer.from(data, 'base64');
        },
      });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const { root, jobs } = parseArgs(process.argv);
  const { server, port } = await startStaticServer(root);
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    let usedRemotion = false;
    try {
      await import('@remotion/renderer');
      usedRemotion = true;
    } catch {}
    if (usedRemotion) await bakeWithRemotion(baseUrl, jobs);
    else await bakeWithPlaywright(baseUrl, jobs);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('[rough_pixi_bake] ERROR:', err);
  process.exit(1);
});
