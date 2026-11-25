import type React from 'react';

/** a depth-sorted element of the mid layer (furniture, doors, counters) — sorted with actors by y */
export type Item = {y: number; node: React.ReactNode; key: string};

/**
 * What a set returns for one frame.
 *  far  — depth 0.5 (sky, distant buildings): moves at half camera speed
 *  back — depth 1: walls, floor, fixed fixtures. Same plane as actors so feet never slide.
 *  mid  — depth 1, interleaved with actors by y (things people walk in front of / behind)
 *  fg   — depth 1.3: foreground framing (plants, door frames, light overlays). Keep it thin.
 */
export type SetLayers = {far?: React.ReactNode; back: React.ReactNode; mid: Item[]; fg?: React.ReactNode};

/** every option a set reads. t = absolute seconds. Everything else comes from ShotDef.o / keys / of. */
export type SetOpts = {t: number; [k: string]: unknown};

/** Seamless looped video plate specification mounted via Remotion <Loop> + <OffthreadVideo muted> at depth 1. */
export type VideoPlateSpec = {
  src: string; // relative path under public/ (e.g. 'plates/rain_street.mp4')
  x: number; // world X origin (typically bounds[0])
  y: number; // world Y origin (typically bounds[1])
  width: number; // world width (typically bounds[2] - bounds[0])
  height: number; // world height (typically bounds[3] - bounds[1])
  dur?: number; // seamless loop duration in seconds (default 4.0)
};

export type SetDef = {
  title: string; // Vietnamese name shown on the design plate
  bed: string; // ambience bed for mix.py: room | hum | quiet | echo | outdoor | fan | motor | basement | paper | street | market | kitchen | rain | night
  render: (o: SetOpts) => SetLayers;
  insert?: boolean; // full-frame close-up (document, phone screen, palm): no actors, no floor
  bounds?: [number, number, number, number]; // world rect the back layer fully paints [x0, y0, x1, y1] — REQUIRED for episode sets; lint keeps every camera inside it
  plateCam?: [number, number, number]; // camera for the design plate (default [540, 1150, 1])
  plateOpts?: Record<string, unknown>; // options for the design plate (e.g. door open, lights on)
  angle?: 'wide' | 'low' | 'high' | 'ots' | 'reverse' | 'closeup' | 'pov'; // optional camera angle grammar for set framing
  cameraDir?: 'front' | 'reverse' | 'left' | 'right' | 'top' | 'low' | 'detail'; // camera compass/elevation viewpoint inside the parent location
  location?: string; // parent location id grouping drawn sub-scenes (e.g. 'lab', 'corridor', 'schoolyard')
  landmarks?: string[]; // shared physical room/environment anchor IDs drawn consistently across all redrawn sub-scenes of the same location (e.g. ['mayThuPhong', 'bangXanh', 'quatTran', 'cuaSoTang3'])
  shotScale?: 'establishing' | 'medium' | 'closeup' | 'insert'; // true drawn scale of this plate (never fake close-up by over-zooming an establishing plate)
  actorScale?: [number, number]; // valid actor scale [minS, maxS] on the set's main floor plane (validated by LA-01 & drawn as silhouettes on _grid plate)
  zones?: {bgY?: number; mgY?: [number, number]; fgY?: number}; // explicit depth-lane Y coordinates for BG / MG / FG layout validation
  scaleMode?: 'normal' | 'tiny'; // declares whether this plate depicts normal human world scale or shrunken miniature world scale
  stateless?: boolean; // optional marker confirming zero transient plot props/shadows are baked into the background
  rasterPlate?: boolean; // opt-in pre-baked static raster backdrop (.png/.jpg/.webp via <image>) composited behind untouched 2D Risograph actors
  videoPlate?: VideoPlateSpec; // opt-in pre-baked seamless loop video backdrop (.mp4/.webm via Remotion <OffthreadVideo>) synced with 2.5D camera
};
