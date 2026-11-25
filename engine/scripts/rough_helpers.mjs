// Generalized hand-sketched rough.js canvas primitives for opt-in pre-baked atmospheric plates (G4).
// Aspect-agnostic (works for 9:16, 16:9, and oversized camera-pan plates) and palette-agnostic.
// Characters are NEVER painted or filtered here — they remain untouched 2D Risograph SVG in Film.tsx.

export const INK = '#1F2F6E';
export const FONT_STACK = "'Be Vietnam Pro', 'Segoe UI', 'Calibri', 'Arial', sans-serif";

export function makeSeededRand(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Create an offscreen 2D canvas paired with a rough.js canvas renderer. */
export function createSketchLayer(rough, width = 1080, height = 1920) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const rc = rough.canvas(canvas);
  return { canvas, ctx, rc };
}

export function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function roundedRectSvg(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h - rr}Q${x + w} ${y + h} ${x + w - rr} ${y + h}H${x + rr}Q${x} ${y + h} ${x} ${y + h - rr}V${y + rr}Q${x} ${y} ${x + rr} ${y}Z`;
}

/** Tactile watercolor paper tooth & archival stipple scaled proportionally to canvas area. */
export function addPaperTooth(ctx, width = 1080, height = 1920, opts = {}) {
  const cfg = typeof opts === 'number' ? { seed: opts } : opts;
  const {
    seed = 42,
    alpha = 0.048,
    washCount = null,
    grainCount = null,
  } = cfg;
  const areaRatio = Math.max(0.25, (width * height) / (1080 * 1920));
  const nWash = washCount ?? Math.round(22 * areaRatio);
  const nGrain = grainCount ?? Math.round(2400 * areaRatio);
  const rand = makeSeededRand(seed);

  ctx.save();
  for (let i = 0; i < nWash; i++) {
    const bx = rand() * width;
    const by = rand() * height;
    const br = 130 + rand() * 260;
    const g = ctx.createRadialGradient(bx, by, 10, bx, by, br);
    const warm = rand() > 0.5;
    g.addColorStop(0, warm ? `rgba(255,244,218,${alpha * 0.5})` : `rgba(20,34,76,${alpha * 0.55})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  for (let i = 0; i < nGrain; i++) {
    const fx = rand() * width;
    const fy = rand() * height;
    const dark = rand() > 0.45;
    ctx.fillStyle = dark ? `rgba(24,35,76,${alpha * 0.72})` : `rgba(255,250,235,${alpha * 0.58})`;
    ctx.fillRect(fx, fy, 1 + rand() * 1.6, 1 + rand() * 1.6);
  }
  ctx.restore();
}

/** Delicate single-stroke rough.js pen hatching for shadows, eaves, and architectural texture. */
export function sketchHatchRect(rc, x, y, w, h, opts = {}) {
  const {
    color = 'rgba(31, 47, 110, 0.16)',
    style = 'hachure',
    gap = 10,
    angle = -42,
    weight = 0.85,
    roughness = 1.05,
    seed = 11,
  } = opts;
  rc.rectangle(x, y, w, h, {
    fill: color,
    fillStyle: style,
    hachureGap: gap,
    hachureAngle: angle,
    fillWeight: weight,
    disableMultiStrokeFill: true,
    stroke: 'none',
    roughness,
    seed,
  });
}

/** Paint a flat/gradient gouache wash + optional shadow band/hatch + organic pen-nib ink outline. */
export function sketchRect(ctx, rc, x, y, w, h, opts = {}) {
  const {
    fillTop = null,
    fillBot = null,
    fill = '#F6EBD4',
    hatchColor = null,
    hatchStyle = 'hachure',
    hatchGap = 11,
    hatchAngle = -42,
    hatchWeight = 0.85,
    stroke = INK,
    strokeWidth = 3.0,
    roughness = 1.12,
    bowing = 0.95,
    seed = 1,
    radius = 0,
    shadowBand = null,
  } = opts;

  ctx.save();
  if (radius > 0) roundedRectPath(ctx, x, y, w, h, radius);
  else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }

  if (fillTop && fillBot) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, fillTop);
    g.addColorStop(1, fillBot);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = fill;
  }
  ctx.fill();

  if (shadowBand) {
    ctx.clip();
    const { side = 'right', frac = 0.3, color = 'rgba(20, 32, 74, 0.18)', hatch = null } = shadowBand;
    let sx = x, sy = y, sw = w, sh = h;
    if (side === 'right') { sx = x + w * (1 - frac); sw = w * frac; }
    else if (side === 'left') { sw = w * frac; }
    else if (side === 'bottom') { sy = y + h * (1 - frac); sh = h * frac; }
    else if (side === 'top') { sh = h * frac; }
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, sw, sh);
    if (hatch) {
      sketchHatchRect(rc, sx, sy, sw, sh, {
        color: hatch, gap: 9, angle: -42, weight: 0.85, seed: seed + 33,
      });
    }
  }
  ctx.restore();

  if (hatchColor) {
    const hOpts = {
      fill: hatchColor,
      fillStyle: hatchStyle,
      hachureGap: hatchGap,
      hachureAngle: hatchAngle,
      fillWeight: hatchWeight,
      disableMultiStrokeFill: true,
      stroke: 'none',
      roughness: roughness * 0.85,
      seed: seed + 17,
    };
    if (radius > 0) rc.path(roundedRectSvg(x, y, w, h, radius), hOpts);
    else rc.rectangle(x, y, w, h, hOpts);
  }

  if (stroke && stroke !== 'none') {
    const sOpts = { stroke, strokeWidth, roughness, bowing, seed };
    if (radius > 0) rc.path(roundedRectSvg(x, y, w, h, radius), sOpts);
    else rc.rectangle(x, y, w, h, sOpts);
  }
}

/** Paint a polygon with wash + optional delicate rough.js hatching + organic ink outline. */
export function sketchPolygon(ctx, rc, pts, opts = {}) {
  const {
    fillTop = null,
    fillBot = null,
    fill = '#D4CBB8',
    hatchColor = null,
    hatchStyle = 'hachure',
    hatchGap = 11,
    hatchAngle = -45,
    hatchWeight = 0.85,
    stroke = INK,
    strokeWidth = 3.0,
    roughness = 1.15,
    bowing = 0.95,
    seed = 1,
  } = opts;

  let minY = Infinity, maxY = -Infinity;
  ctx.save();
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  if (fillTop && fillBot) {
    const g = ctx.createLinearGradient(0, minY, 0, maxY);
    g.addColorStop(0, fillTop);
    g.addColorStop(1, fillBot);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = fill;
  }
  ctx.fill();
  ctx.restore();

  if (hatchColor) {
    rc.polygon(pts, {
      fill: hatchColor,
      fillStyle: hatchStyle,
      hachureGap: hatchGap,
      hachureAngle: hatchAngle,
      fillWeight: hatchWeight,
      disableMultiStrokeFill: true,
      stroke: 'none',
      roughness: roughness * 0.85,
      seed: seed + 13,
    });
  }

  if (stroke && stroke !== 'none') {
    rc.polygon(pts, { stroke, strokeWidth, roughness, bowing, seed });
  }
}

/** Paint an SVG path string with fill wash + optional rough.js hatch + organic ink outline. */
export function sketchPath(ctx, rc, d, opts = {}) {
  const {
    fill = null,
    hatchColor = null,
    hatchStyle = 'hachure',
    hatchGap = 10,
    hatchAngle = -40,
    hatchWeight = 0.8,
    stroke = INK,
    strokeWidth = 2.8,
    roughness = 1.12,
    bowing = 0.95,
    seed = 1,
  } = opts;

  if (fill) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.fill(new Path2D(d));
    ctx.restore();
  }
  if (hatchColor) {
    rc.path(d, {
      fill: hatchColor,
      fillStyle: hatchStyle,
      hachureGap: hatchGap,
      hachureAngle: hatchAngle,
      fillWeight: hatchWeight,
      disableMultiStrokeFill: true,
      stroke: 'none',
      roughness: roughness * 0.85,
      seed: seed + 19,
    });
  }
  if (stroke && stroke !== 'none') {
    rc.path(d, { stroke, strokeWidth, roughness, bowing, seed });
  }
}

/** Paint an ellipse with fill wash + optional rough.js hatch + organic ink outline. */
export function sketchEllipse(ctx, rc, cx, cy, rx, ry, opts = {}) {
  const {
    fill = '#F6EBD4',
    hatchColor = null,
    hatchStyle = 'hachure',
    hatchGap = 10,
    hatchAngle = -38,
    hatchWeight = 0.8,
    stroke = INK,
    strokeWidth = 2.8,
    roughness = 1.12,
    seed = 1,
  } = opts;

  if (fill) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }
  if (hatchColor) {
    rc.ellipse(cx, cy, rx * 2, ry * 2, {
      fill: hatchColor,
      fillStyle: hatchStyle,
      hachureGap: hatchGap,
      hachureAngle: hatchAngle,
      fillWeight: hatchWeight,
      disableMultiStrokeFill: true,
      stroke: 'none',
      roughness: roughness * 0.85,
      seed: seed + 23,
    });
  }
  if (stroke && stroke !== 'none') {
    rc.ellipse(cx, cy, rx * 2, ry * 2, { stroke, strokeWidth, roughness, seed });
  }
}

/** Soft radial atmospheric glow (for emissive masks, lamps, sun glare, or soft light bounce). */
export function drawSoftGlow(ctx, cx, cy, r, colorInner, colorMid, colorOuter = 'rgba(0,0,0,0)') {
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, colorInner);
  g.addColorStop(0.45, colorMid);
  g.addColorStop(1, colorOuter);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Tapered 4-point geometric glint / star primitive (works for specular highlights or night skies). */
export function drawStarSparkle(ctx, x, y, r = 10, color = '#FFF8D8', alpha = 0.85) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.45);
  g.addColorStop(0, color);
  g.addColorStop(0.4, 'rgba(255, 240, 195, 0.35)');
  g.addColorStop(1, 'rgba(255, 240, 195, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
  ctx.fill();

  const w = Math.max(1.3, r * 0.16);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(w * 0.5, -w * 0.5, r, 0);
  ctx.quadraticCurveTo(w * 0.5, w * 0.5, 0, r);
  ctx.quadraticCurveTo(-w * 0.5, w * 0.5, -r, 0);
  ctx.quadraticCurveTo(-w * 0.5, -w * 0.5, 0, -r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Render crisp Be Vietnam Pro diegetic signage directly onto a canvas plate. */
export function drawText(ctx, text, x, y, opts = {}) {
  const {
    size = 18,
    weight = 800,
    color = INK,
    align = 'center',
    baseline = 'alphabetic',
    strokeColor = null,
    strokeWidth = 0,
  } = opts;
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT_STACK}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (strokeColor && strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Create an arbitrary alpha/gradient mask canvas for PixiJS masked light shafts. */
export function createGradientMaskCanvas(drawFn, width = 1080, height = 1920) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);
  return canvas;
}
