// Content-addressed Webpack bundle cache (v3.9.1).
// Avoids re-running Remotion's ~15s Webpack bundle() when src/ has not changed.
import {bundle} from '@remotion/bundler';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SRC_RE = /\.(ts|tsx|js|mjs|json|css|svg)$/;

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
};

/**
 * Compute a content-addressed Webpack bundle for entryPoint under qa/.bundle_cache/<srcHash>.
 * Returns the resolved bundle directory path immediately on cache hit (< 0.1s).
 */
export async function cachedBundle(entryPoint = 'src/index.ts') {
  const normEntry = path.normalize(entryPoint).replace(/\\/g, '/');
  const h = crypto.createHash('sha1');
  h.update(normEntry + '\n');

  const files = walk('src')
    .filter((f) => SRC_RE.test(f) && !/(?:^|[\\/])qa(?:[\\/]|$)/.test(f))
    .sort();
  for (const f of files) {
    h.update(f.replace(/\\/g, '/') + '\n');
    h.update(fs.readFileSync(f));
    h.update('\n');
  }
  if (fs.existsSync('remotion.config.ts')) {
    h.update('remotion.config.ts\n');
    h.update(fs.readFileSync('remotion.config.ts'));
  }

  const srcHash = h.digest('hex').slice(0, 16);
  const cacheRoot = path.resolve('qa/.bundle_cache');
  const cacheDir = path.join(cacheRoot, srcHash);
  const indexHtml = path.join(cacheDir, 'index.html');

  if (fs.existsSync(indexHtml)) {
    try {
      const now = new Date();
      fs.utimesSync(cacheDir, now, now);
    } catch {}
    console.log('bundle: cache hit', srcHash);
    return cacheDir;
  }

  fs.mkdirSync(cacheRoot, {recursive: true});
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, {recursive: true, force: true});
  }

  await bundle({
    entryPoint: path.resolve(entryPoint),
    outDir: cacheDir,
  });

  // Prune older sibling dirs in qa/.bundle_cache/ (keep only latest 2 total).
  try {
    const siblings = fs.readdirSync(cacheRoot, {withFileTypes: true})
      .filter((e) => e.isDirectory() && e.name !== srcHash)
      .map((e) => {
        const full = path.join(cacheRoot, e.name);
        return {full, mtime: fs.statSync(full).mtimeMs};
      })
      .sort((a, b) => b.mtime - a.mtime);
    for (const old of siblings.slice(1)) {
      fs.rmSync(old.full, {recursive: true, force: true});
    }
  } catch {}

  return cacheDir;
}
