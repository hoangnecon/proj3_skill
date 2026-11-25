// Generalized deterministic PixiJS v8 GPU Atmospheric FX & Weather Particles for looped plates (G4).
// Aspect-agnostic (works identically for 9:16 and 16:9) and mathematically seamless over `loopDuration`.
//
// STORY-MOTIVATION RESTRAINT RULE:
// Pick ZERO or AT MOST ONE mode matching the script's actual weather, light source, and emotional tone:
//   - 'fireflies'  : warm night outdoor scenes (gardens, alleys, parks, villages)
//   - 'rain'       : rainy scenes only (diagonal rain streaks + optional floor splash ripples)
//   - 'petals'     : spring / festive / poetic beats only (never on mundane, tense, or sad scenes)
//   - 'dust_motes' : indoor sunbeam / moonbeam dust confined strictly inside the light shaft bounds
// Never mix unrelated particle modes in the same scene.
import { makeSeededRand, drawSoftGlow, drawStarSparkle } from './rough_helpers.mjs';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Procedural 512x256 GPU texture atlas shared by PixiJS v8 ParticleContainer instances. */
export function createParticleAtlas(PIXI) {
  const atlas = makeCanvas(512, 256);
  const ctx = atlas.getContext('2d');

  // 1. Soft Orb (0, 0, 96, 96)
  drawSoftGlow(ctx, 48, 48, 44, 'rgba(255, 255, 255, 1.0)', 'rgba(255, 232, 150, 0.42)');
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(48, 48, 10, 0, Math.PI * 2);
  ctx.fill();

  // 2. Rain Streak (96, 0, 32, 128)
  const rg = ctx.createLinearGradient(112, 6, 112, 122);
  rg.addColorStop(0, 'rgba(220, 242, 255, 0)');
  rg.addColorStop(0.28, 'rgba(215, 240, 255, 0.72)');
  rg.addColorStop(0.75, 'rgba(255, 255, 255, 0.98)');
  rg.addColorStop(1, 'rgba(220, 244, 255, 0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.roundRect(108.5, 6, 7, 116, 3.5);
  ctx.fill();

  // 3. Ground Splash Ripple Ring (128, 0, 128, 64)
  ctx.save();
  ctx.strokeStyle = 'rgba(220, 244, 255, 0.92)';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.ellipse(192, 32, 52, 20, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.50)';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.ellipse(192, 32, 32, 11, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 4. Soft Petal (256, 0, 96, 96)
  ctx.save();
  ctx.translate(304, 48);
  const pg = ctx.createRadialGradient(0, -4, 4, 0, 0, 36);
  pg.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  pg.addColorStop(0.65, 'rgba(255, 232, 240, 0.92)');
  pg.addColorStop(1, 'rgba(255, 205, 224, 0.0)');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.bezierCurveTo(28, -22, 26, 20, 0, 34);
  ctx.bezierCurveTo(-24, 20, -24, -18, 0, -34);
  ctx.fill();
  ctx.restore();

  // 5. Crisp 4-point Glint (352, 0, 96, 96)
  drawStarSparkle(ctx, 400, 48, 38, '#FFFFFF', 1.0);

  const tex = PIXI.Texture.from(atlas);
  const source = tex.source;
  const sub = (x, y, w, h) => new PIXI.Texture({ source, frame: new PIXI.Rectangle(x, y, w, h) });

  return {
    source,
    firefly: sub(0, 0, 96, 96),
    rain: sub(96, 0, 32, 128),
    ripple: sub(128, 0, 128, 64),
    petal: sub(256, 0, 96, 96),
    sparkle: sub(352, 0, 96, 96),
  };
}

/**
 * Create one deterministic, seamlessly-looping PixiJS v8 particle layer.
 * All defaults scale proportionally to `(width, height)` for both 9:16 and 16:9 canvases.
 */
export function createParticleField(PIXI, atlas, {
  mode = 'dust_motes', // 'fireflies' | 'rain' | 'petals' | 'dust_motes'
  width = 1080,
  height = 1920,
  count = null,
  bounds = null, // [x0, y0, x1, y1] spawn region (essential for indoor window 'dust_motes')
  floorYRange = null, // [yMin, yMax] splash ripple band for 'rain' (defaults to 76%–90% of height)
  rainAngle = 0.22,
  tints = null, // optional custom hex tint palette matching scene lighting
  loopDuration = 4.0,
  intensity = 1.0,
  seed = 9021,
} = {}) {
  const rand = makeSeededRand(seed);
  const container = new PIXI.ParticleContainer({
    texture: mode === 'rain' ? atlas.rain : mode === 'petals' ? atlas.petal : atlas.firefly,
    blendMode: 'add',
    dynamicProperties: { vertex: true, position: true, rotation: true, uvs: true, color: true },
  });

  const makeP = (tex) => {
    const p = new PIXI.Particle({
      texture: tex,
      x: -400,
      y: -400,
      anchorX: 0.5,
      anchorY: 0.5,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
    });
    container.addParticle(p);
    return p;
  };

  const [bx0, by0, bx1, by1] = bounds ?? [width * 0.04, height * 0.12, width * 0.96, height * 0.90];
  const bw = Math.max(40, bx1 - bx0);
  const bh = Math.max(40, by1 - by0);

  if (mode === 'rain') {
    const nRain = count ?? 160;
    const nRip = floorYRange === false ? 0 : Math.round(nRain * 0.24);
    const [fy0, fy1] = Array.isArray(floorYRange) ? floorYRange : [height * 0.76, height * 0.90];
    const sinR = Math.sin(rainAngle), cosR = Math.cos(rainAngle);
    const rainPalette = tints ?? [0xc6e4ff, 0xe6f4ff, 0x97c9ff];
    const drops = Array.from({ length: nRain }, (_, i) => ({
      p: makeP(atlas.rain),
      x0: rand() * (width + 360) - 120,
      y0: rand() * (height + 120),
      cycles: 2 + Math.floor(rand() * 2),
      sx: 0.44 + rand() * 0.32,
      sy: 0.62 + rand() * 0.60,
      alpha: (0.34 + rand() * 0.34) * intensity,
      tint: rainPalette[i % rainPalette.length],
    }));
    const ripples = Array.from({ length: nRip }, (_, i) => ({
      p: makeP(atlas.ripple),
      x: width * 0.05 + rand() * (width * 0.90),
      y: fy0 + rand() * Math.max(8, fy1 - fy0),
      cycles: 4 + Math.floor(rand() * 4),
      phase: rand(),
      maxS: 0.30 + rand() * 0.34,
      tint: rainPalette[i % rainPalette.length],
    }));
    return {
      container,
      update(t) {
        const uLoop = (((t % loopDuration) + loopDuration) % loopDuration) / loopDuration;
        const wrapH = height + 180;
        const wrapW = width + 420;
        for (const d of drops) {
          const dist = uLoop * d.cycles * wrapH;
          d.p.x = (((d.x0 - dist * sinR) % wrapW) + wrapW) % wrapW - 140;
          d.p.y = (((d.y0 + dist * cosR) % wrapH) + wrapH) % wrapH - 60;
          d.p.rotation = rainAngle;
          d.p.scaleX = d.sx;
          d.p.scaleY = d.sy;
          d.p.alpha = d.alpha;
          d.p.tint = d.tint;
        }
        for (const r of ripples) {
          const life = (uLoop * r.cycles + r.phase) % 1;
          const ease = 1 - Math.pow(1 - life, 2.2);
          r.p.x = r.x;
          r.p.y = r.y;
          r.p.scaleX = r.maxS * (0.22 + ease * 0.90);
          r.p.scaleY = r.maxS * (0.20 + ease * 0.78);
          r.p.alpha = (1 - life) * 0.76 * intensity;
          r.p.tint = r.tint;
        }
      },
    };
  }

  if (mode === 'petals') {
    const n = count ?? 48;
    const petalPalette = tints ?? [0xffe082, 0xffb4ce, 0xfff3b8, 0xd8f2ff];
    const items = Array.from({ length: n }, (_, i) => ({
      p: makeP(atlas.petal),
      x0: rand() * (width + 200) - 100,
      y0: rand() * (height + 200) - 100,
      cx: 1 + (i % 2),
      cy: 1 + (i % 2),
      phase: rand() * Math.PI * 2,
      spin: (rand() > 0.5 ? 1 : -1) * (1 + Math.floor(rand() * 2)),
      size: 0.22 + rand() * 0.26,
      tint: petalPalette[i % petalPalette.length],
    }));
    return {
      container,
      update(t) {
        const u = (((t % loopDuration) + loopDuration) % loopDuration) / loopDuration;
        const wSpan = width + 220;
        const hSpan = height + 220;
        const a = u * Math.PI * 2;
        for (const pt of items) {
          pt.p.x = (((pt.x0 + u * pt.cx * wSpan * 0.45 + Math.sin(a + pt.phase) * 36) % wSpan) + wSpan) % wSpan - 110;
          pt.p.y = (((pt.y0 + u * pt.cy * hSpan + Math.cos(a + pt.phase) * 18) % hSpan) + hSpan) % hSpan - 110;
          pt.p.rotation = a * pt.spin + pt.phase;
          pt.p.scaleX = pt.size * (0.38 + 0.62 * Math.abs(Math.cos(a * 2 + pt.phase)));
          pt.p.scaleY = pt.size;
          pt.p.alpha = 0.76 * intensity;
          pt.p.tint = pt.tint;
        }
      },
    };
  }

  // 'fireflies' or 'dust_motes'
  const isDust = mode === 'dust_motes';
  const n = count ?? (isDust ? 22 : 26);
  const orbPalette = tints ?? (isDust
    ? [0xe6f2ff, 0xfff7da, 0xd2e8ff]
    : [0xfff6ae, 0xffd85e, 0xffe88a]);
  const items = Array.from({ length: n }, (_, i) => ({
    p: makeP(atlas.firefly),
    x0: bx0 + rand() * bw,
    y0: by0 + rand() * bh,
    rx: (isDust ? 14 : 26) + rand() * (isDust ? 18 : 32),
    ry: (isDust ? 12 : 18) + rand() * (isDust ? 16 : 24),
    freqX: 1 + (i % 2),
    freqY: 1 + ((i + 1) % 2),
    twinkle: 1 + (i % 3),
    phase: rand() * Math.PI * 2,
    size: (isDust ? 0.12 : 0.19) + rand() * (isDust ? 0.13 : 0.20),
    tint: orbPalette[i % orbPalette.length],
  }));
  return {
    container,
    update(t) {
      const a = ((((t % loopDuration) + loopDuration) % loopDuration) / loopDuration) * Math.PI * 2;
      for (const f of items) {
        f.p.x = f.x0 + Math.sin(a * f.freqX + f.phase) * f.rx;
        f.p.y = f.y0 + Math.cos(a * f.freqY + f.phase * 1.3) * f.ry;
        const pulse = 0.45 + 0.55 * Math.sin(a * f.twinkle + f.phase);
        f.p.scaleX = f.size;
        f.p.scaleY = f.size;
        f.p.alpha = (isDust ? 0.54 : 0.70) * pulse * intensity;
        f.p.tint = f.tint;
      }
    },
  };
}

/**
 * Seamless deterministic GodrayFilter animator.
 * Attach GodrayFilter directly to the sky/backdrop container so PixiJS v8 preserves sky luminance.
 */
export function animateGodray(filter, t, {
  loopDuration = 4.0,
  speed = 3.2,
  baseGain = 0.54,
  gainAmp = 0.04,
  baseAlpha = 0.42,
  alphaAmp = 0.06,
} = {}) {
  const a = ((((t % loopDuration) + loopDuration) % loopDuration) / loopDuration) * Math.PI * 2;
  filter.time = Math.sin(a) * speed;
  filter.gain = baseGain + gainAmp * Math.sin(a);
  filter.alpha = baseAlpha + alphaAmp * Math.cos(a);
}

/** Seamless subtle breathing glow for AdvancedBloomFilter emissive layers. */
export function animateBreathingBloom(filter, layers = [], t, {
  loopDuration = 4.0,
  baseScale = 0.78,
  scaleAmp = 0.18,
} = {}) {
  const a = ((((t % loopDuration) + loopDuration) % loopDuration) / loopDuration) * Math.PI * 2;
  const b = 0.5 + 0.5 * Math.sin(a);
  filter.bloomScale = baseScale + scaleAmp * b;
  layers.forEach((sp, i) => {
    if (!sp) return;
    sp.alpha = 0.74 + 0.26 * (0.5 + 0.5 * Math.sin(a * (1 + (i % 2)) + i * 1.3));
  });
}
