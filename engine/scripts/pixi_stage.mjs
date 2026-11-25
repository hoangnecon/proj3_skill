// Generalized PixiJS v8 + pixi-filters WebGL atmospheric compositor for opt-in pre-baked plates (G4).
// Aspect-agnostic (9:16, 16:9, or wide pan plates) and time-of-day-agnostic (daylight, dusk, indoor, night).
// Layers rough.js canvases with KawaseBlurFilter (DoF), GodrayFilter (light shafts),
// AdvancedBloomFilter (emissive glow), and subtle edge vignette + archival paper grain.
// Characters are NEVER passed through PixiJS — they stay untouched 2D Risograph SVG in Film.tsx.
import { createSketchLayer, createGradientMaskCanvas, drawSoftGlow, makeSeededRand } from './rough_helpers.mjs';

export async function createPixiApp({
  PIXI,
  width = 1080,
  height = 1920,
  backgroundColor = 0xf4ecd8,
  backgroundAlpha = 1,
} = {}) {
  const app = new PIXI.Application();
  await app.init({
    width,
    height,
    backgroundColor,
    backgroundAlpha,
    preference: 'webgl',
    antialias: true,
    preserveDrawingBuffer: true,
    resolution: 1,
  });
  return app;
}

/**
 * Mount a canvas layer with optional optical depth-of-field (KawaseBlurFilter)
 * and volumetric light shafts (GodrayFilter).
 *
 * PixiJS v8 safety note: attach GodrayFilter directly onto the visible sky/backdrop layer
 * (or a Container holding the sky sprite), never onto an opaque black rect inside an additive container.
 */
export function addDepthLayer(app, canvas, {
  PIXI,
  filters,
  blurStrength = 0,
  blurQuality = 3,
  godray = null, // e.g. { angle: -28, parallel: true, gain: 0.54, lacunarity: 2.35, time: 1.2, alpha: 0.45 }
  blendMode = 'normal',
} = {}) {
  const sprite = PIXI.Sprite.from(canvas);
  const fl = [];
  if (blurStrength > 0) {
    fl.push(new filters.KawaseBlurFilter({ strength: blurStrength, quality: blurQuality, clamp: true }));
  }
  if (godray) {
    fl.push(new filters.GodrayFilter({
      angle: -28,
      parallel: true,
      gain: 0.54,
      lacunarity: 2.35,
      time: 1.2,
      alpha: 0.45,
      ...godray,
    }));
  }
  if (fl.length) sprite.filters = fl;
  if (blendMode !== 'normal') sprite.blendMode = blendMode;
  app.stage.addChild(sprite);
  return sprite;
}

/**
 * Mount a dedicated emissive canvas with WebGL AdvancedBloomFilter (additive glow).
 * Keep crisp ink details (text signage, clock hands, mullions) on a separate layer above this.
 */
export function addEmissiveBloomLayer(app, canvas, {
  PIXI,
  filters,
  threshold = 0.28,
  bloomScale = 0.80,
  brightness = 1.0,
  blur = 9,
  quality = 6,
} = {}) {
  const sprite = PIXI.Sprite.from(canvas);
  sprite.filters = [
    new filters.AdvancedBloomFilter({ threshold, bloomScale, brightness, blur, quality }),
  ];
  sprite.blendMode = 'add';
  app.stage.addChild(sprite);
  return sprite;
}

/**
 * Masked volumetric sunbeam / moonbeam streaming through an indoor window or skylight opening.
 * Combines a feathered ambient light trapezoid ('screen') + masked GPU GodrayFilter shafts ('add').
 */
export function addWindowGodrayBeam(app, {
  PIXI,
  filters,
  width = 1080,
  height = 1920,
  box = null, // [x, y, w, h] filterArea covering the beam
  polygonPts = null, // [[x, y], ...] beam polygon in canvas px
  gradFrom = null, // [x, y]
  gradTo = null, // [x, y]
  beamColorStops = [
    [0, 'rgba(255, 240, 198, 0.24)'],
    [0.5, 'rgba(255, 232, 184, 0.14)'],
    [0.85, 'rgba(255, 224, 168, 0.06)'],
    [1, 'rgba(255, 220, 160, 0)'],
  ],
  godray = { angle: 26, parallel: true, gain: 0.60, lacunarity: 2.35, time: 0.85, alpha: 0.72 },
  tint = null, // optional AdjustmentFilter options, e.g. { red: 1.08, green: 1.0, blue: 0.86 }
} = {}) {
  const effBox = box ?? [width * 0.28, height * 0.26, width * 0.62, height * 0.52];
  const effPts = polygonPts ?? [
    [width * 0.52, height * 0.28],
    [width * 0.88, height * 0.28],
    [width * 0.82, height * 0.78],
    [width * 0.30, height * 0.78],
  ];
  const effFrom = gradFrom ?? [width * 0.76, height * 0.28];
  const effTo = gradTo ?? [width * 0.48, height * 0.78];

  const drawPoly = (ctx) => {
    ctx.beginPath();
    effPts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
  };

  const beamCanvas = createGradientMaskCanvas((bctx) => {
    bctx.save();
    bctx.filter = 'blur(18px)';
    const bg = bctx.createLinearGradient(effFrom[0], effFrom[1], effTo[0], effTo[1]);
    for (const [stop, col] of beamColorStops) bg.addColorStop(stop, col);
    bctx.fillStyle = bg;
    drawPoly(bctx);
    bctx.fill();
    bctx.restore();
  }, width, height);

  const maskCanvas = createGradientMaskCanvas((mctx) => {
    mctx.save();
    mctx.filter = 'blur(22px)';
    const mg = mctx.createLinearGradient(effFrom[0], effFrom[1], effTo[0], effTo[1]);
    mg.addColorStop(0, 'rgba(255,255,255,0.96)');
    mg.addColorStop(0.55, 'rgba(255,255,255,0.80)');
    mg.addColorStop(0.86, 'rgba(255,255,255,0.48)');
    mg.addColorStop(1, 'rgba(255,255,255,0)');
    mctx.fillStyle = mg;
    drawPoly(mctx);
    mctx.fill();
    mctx.restore();
  }, width, height);

  const beamGlow = PIXI.Sprite.from(beamCanvas);
  beamGlow.blendMode = 'screen';
  app.stage.addChild(beamGlow);

  const [bx, by, bw, bh] = effBox;
  const godrayBox = new PIXI.Graphics().rect(bx, by, bw, bh).fill({ color: 0x000000, alpha: 1 });
  const fl = [new filters.GodrayFilter(godray)];
  if (tint) fl.push(new filters.AdjustmentFilter(tint));
  godrayBox.filters = fl;
  godrayBox.filterArea = new PIXI.Rectangle(bx, by, bw, bh);
  godrayBox.blendMode = 'add';

  const maskSprite = PIXI.Sprite.from(maskCanvas);
  const container = new PIXI.Container();
  container.addChild(godrayBox);
  container.mask = maskSprite;
  app.stage.addChild(maskSprite);
  app.stage.addChild(container);
  return { beamGlow, container, maskSprite, godrayFilter: fl[0] };
}

/**
 * Subtle cinema edge vignette + archival paper grain (keeps frame center clear for 2D characters).
 */
export function addAtmosphereVignette(app, rough, {
  PIXI,
  width = 1080,
  height = 1920,
  vignetteColor = [15, 22, 52],
  vignetteAlpha = 0.28,
  grainCount = null,
  seed = 404,
  motes = [], // optional [[x, y, r, warm?], ...]
} = {}) {
  const layer = createSketchLayer(rough, width, height);
  const { ctx } = layer;
  const [vr, vg, vb] = vignetteColor;
  const areaRatio = Math.max(0.25, (width * height) / (1080 * 1920));
  const nGrain = grainCount ?? Math.round(2400 * areaRatio);

  const vig = ctx.createRadialGradient(
    width * 0.5, height * 0.48, Math.min(width, height) * 0.36,
    width * 0.5, height * 0.5, Math.max(width, height) * 0.62,
  );
  vig.addColorStop(0, `rgba(${vr}, ${vg}, ${vb}, 0)`);
  vig.addColorStop(0.68, `rgba(${vr}, ${vg}, ${vb}, ${(vignetteAlpha * 0.16).toFixed(3)})`);
  vig.addColorStop(1, `rgba(${vr}, ${vg}, ${vb}, ${vignetteAlpha})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  for (const [mx, my, mr, warm = true] of motes) {
    drawSoftGlow(
      ctx, mx, my, mr * 5,
      warm ? 'rgba(255, 240, 172, 0.44)' : 'rgba(224, 240, 255, 0.46)',
      warm ? 'rgba(255, 198, 92, 0.12)' : 'rgba(170, 210, 255, 0.12)',
    );
    ctx.fillStyle = warm ? 'rgba(255, 250, 224, 0.78)' : 'rgba(246, 252, 255, 0.80)';
    ctx.beginPath();
    ctx.arc(mx, my, mr * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const rand = makeSeededRand(seed);
  for (let i = 0; i < nGrain; i++) {
    const gx = rand() * width;
    const gy = rand() * height;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,250,235,0.024)' : 'rgba(10,16,44,0.026)';
    ctx.fillRect(gx, gy, 1.5, 1.5);
  }

  const sprite = PIXI.Sprite.from(layer.canvas);
  app.stage.addChild(sprite);
  return sprite;
}
