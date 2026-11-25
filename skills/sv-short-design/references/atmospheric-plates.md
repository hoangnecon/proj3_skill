# Atmospheric Pre-Baked Plates (`SetDef.rasterPlate` / `SetDef.videoPlate` + `rough.js` & PixiJS v8)

Default episode sets use pure vector SVG (`sets.md`). When a story genuinely benefits from richer painterly paper texture, optical depth-of-field (`KawaseBlurFilter`), volumetric light shafts (`GodrayFilter`), or emissive bloom (`AdvancedBloomFilter`), a set may opt into **`rasterPlate: true`** (static PNG/JPG/WebP) or **`videoPlate: {...}`** (seamless looped MP4/WebM).

## 1. Non-Negotiable Visual Locks
1. **Characters Stay 100% Untouched 2D Risograph SVG:** `<Person>`, `<Person3Q>`, `<PersonSide>`, `<PersonBack>`, and `SUBJECTS` are ALWAYS rendered on top in crisp vector SVG (`Film.tsx`). Never render characters inside PixiJS or apply blur/bloom/3D shaders to characters.
2. **All Spatial & Continuity Rules Still Apply:** Every `rasterPlate` or `videoPlate` set MUST still declare `bounds`, `bed`, `zones: {bgY, mgY, fgY}`, `actorScale`, `location`, `landmarks`, `shotScale`, `scaleMode`, and `stateless: true`.
3. **Design Lint Behaviour (`SE-06`, `SE-13`, `SE-16`):**
   - `rasterPlate: true` verifies a local `public/` static image (`>= 512 B`, covering `>= 85%` of `bounds`; external `http(s)://` URLs and `.mp4`/`.webm` inside SVG `<image>` are rejected).
   - `videoPlate: {src, x, y, width, height, dur}` verifies a local `public/` `.mp4`/`.webm` loop (`>= 1024 B`, covering `>= 85%` of `bounds`) and mounts it via Remotion `<Loop>` + `<OffthreadVideo muted>` inside `Film.tsx` and `SetPlate` (`Sheets.tsx`).
   - Rendered perceptual checks (`SE-13` plate freshness vs `public/` mtime & `empty_mid`, `SE-16` clutter/contrast/balance, `SE-14` live SVG sign clipping) remain active so low-detail or muddy plates fail CI.

## 2. Story-Motivation Restraint Rule (Zero Visual Clutter)
Atmospheric FX exist to serve the story's light, weather, and mood — never to decorate every frame:
- **Static PNG by default:** Bake a static `.png` plate unless continuous atmospheric motion directly serves the beat.
- **At most ONE particle mode per scene (`0` or `1`):**
  - `'dust_motes'` — indoor sunbeam or moonbeam specks confined strictly inside the light shaft `bounds`.
  - `'rain'` — rainy scenes only (diagonal streaks + optional floor splash ripples matching the set's `zones.mgY`).
  - `'fireflies'` — calm summer/night outdoor gardens, alleys, or villages (gentle low count `18–32`).
  - `'petals'` — spring, festive, or poetic beats only (NEVER over mundane rooms, sad scenes, arguments, or deadpan gags).
- **Never stack unrelated particle modes** (e.g. rain + petals + fireflies) or crank bloom/vignette so high that 2D character silhouettes lose readability.

## 3. Reference Toolkit (`rough.js + PixiJS v8`)
Four generalized, aspect-agnostic (`9:16` & `16:9`) scripts ship in `engine/scripts/`:
- `scripts/rough_helpers.mjs` — pure hand-drawn canvas primitives (`createSketchLayer`, `addPaperTooth`, `sketchRect`, `sketchPolygon`, `sketchPath`, `sketchEllipse`, `sketchHatchRect`, `drawSoftGlow`, `drawStarSparkle`, `drawText`, `createGradientMaskCanvas`).
- `scripts/pixi_stage.mjs` — WebGL atmospheric compositor (`createPixiApp`, `addDepthLayer`, `addEmissiveBloomLayer`, `addWindowGodrayBeam`, `addAtmosphereVignette`).
- `scripts/pixi_fx.mjs` — deterministic seamless-loop GPU particles & light modulation (`createParticleAtlas`, `createParticleField`, `animateGodray`, `animateBreathingBloom`).
- `scripts/rough_pixi_bake.mjs` — cross-platform headless ANGLE WebGL baker (tested against `@remotion/renderer@4.0.250` with automatic `playwright-core` fallback; resolves `node_modules` from project root or `SV_ROUGH_PIXI_MODULES` / `SV_NODE_MODULES`).

### One-Time Dependency Setup
Standard `engine/package.json` stays lean for pure-SVG episodes. Before running `rough_pixi_bake.mjs`, install the 3 optional packages into your episode or a shared runtime folder (`SV_ROUGH_PIXI_MODULES`):
```bash
# Option A: install inside the episode without modifying package.json
npm install --no-save roughjs@4.6.6 pixi.js@8.6.6 pixi-filters@6.0.5

# Option B: install once in a shared folder and point SV_ROUGH_PIXI_MODULES to its node_modules
# export SV_ROUGH_PIXI_MODULES=/path/to/shared-pixi/node_modules
```

### Baking Commands
```bash
# Static high-res PNG backdrop (size matches set bounds width x height)
node scripts/rough_pixi_bake.mjs plates/yard.html public/plates/yard.png --width 1400 --height 2240

# Seamless 4-second animated loop MP4 (only when live weather/godray motion is story-motivated)
node scripts/rough_pixi_bake.mjs plates/rain_street.html public/plates/rain_street.mp4 --frames 120 --fps 30 --width 1920 --height 1080
```
For animated loop bakes, the scene HTML exposes `window.__RENDER_FRAME__(frame, totalFrames, fps)` in addition to setting `window.__RENDER_READY__ = true`. Always include a browser `<script type="importmap">` in the scene HTML so `pixi-filters` resolves `'pixi.js'` cleanly:
```html
<script type="importmap">
  {
    "imports": {
      "pixi.js": "/node_modules/pixi.js/dist/pixi.min.mjs",
      "pixi-filters": "/node_modules/pixi-filters/dist/pixi-filters.mjs",
      "roughjs": "/node_modules/roughjs/bundled/rough.esm.js"
    }
  }
</script>
```

### PixiJS v8 `GodrayFilter` Safety Rule
Attach `GodrayFilter` directly onto the visible sky/backdrop sprite or container (`addDepthLayer(app, skyCanvas, {PIXI, filters, godray: {...}})`), or use `addWindowGodrayBeam` (sprite-level `blendMode = 'add'` with stage-level mask). Never put `GodrayFilter` on an opaque black sprite inside an additive container — in PixiJS v8 that turns the upper sky black.

## 4. Mounting Static (`rasterPlate`) vs Looped Video (`videoPlate`) in `src/episode/sets.tsx`
```tsx
import {staticFile} from 'remotion';
import type {SetDef} from '../sets/types';

export const EPISODE_SETS: Record<string, SetDef> = {
  // (A) Static PNG backdrop (default — fast, zero video decode overhead)
  alleyNight: {
    title: 'Ngõ nhỏ buổi tối',
    bed: 'night',
    rasterPlate: true,
    bounds: [-160, -160, 1240, 2080],
    shotScale: 'establishing',
    actorScale: [0.88, 1.12],
    zones: {bgY: 1180, mgY: [1540, 1780], fgY: 1880},
    stateless: true,
    render: (o) => ({
      back: (
        <g>
          <image href={staticFile('plates/alley_night.png')} x={-160} y={-160} width={1400} height={2240} />
          {/* Optional live SVG life (e.g. subtle lamp pulse driven by o.t) so SE-12 sees motion */}
        </g>
      ),
      mid: [],
    }),
  },

  // (B) Seamless looped MP4 backdrop (only when continuous rain/fireflies/godray motion serves the beat)
  rainStreet: {
    title: 'Phố mưa đêm',
    bed: 'rain',
    videoPlate: {src: 'plates/rain_street.mp4', x: -160, y: -160, width: 1400, height: 2240, dur: 4.0},
    bounds: [-160, -160, 1240, 2080],
    shotScale: 'establishing',
    actorScale: [0.88, 1.12],
    zones: {bgY: 1180, mgY: [1540, 1780], fgY: 1880},
    stateless: true,
    render: () => ({
      back: <g />, // Film.tsx & SetPlate automatically mount videoPlate at depth 1 behind back!
      mid: [],
    }),
  },
};
```
Keep doors, counters, furniture actors walk behind, and animated plot fixtures as live vector SVG in `mid` (and optional `fg`) so depth sorting (`y`) and shot `keys` work identically to pure-SVG sets.
