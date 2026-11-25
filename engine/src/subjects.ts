import type React from 'react';

export type SubjectKind = 'creature' | 'vehicle' | 'machine' | 'hero_prop';

/** Mount/seat anchor on a Subject (in subject-local coords before subject scale `s`, relative to origin (0,0) at ground/center). */
export type SubjectSeat = {
  dx: number;
  dy: number;
  angle?: number; // subtle rider tilt in degrees
  pose?: string;  // default rider POSES key (e.g. 'ride')
  view?: 'front' | 'side' | 'back' | '3q';
  face?: 1 | -1;
  zOffset?: number; // depth-sort nudge above subject (default +20)
  straddle?: boolean; // 3-layer straddle sandwich: far limb behind -> subject + SeatShadow -> torso + near limb + grip in front
  grip?: [number, number]; // subject-local (gx, gy) IK hand target so rider grabs actual shell/collar/shoulder
  wind?: number; // default wind stream felt by riders in this pose (e.g. 1.4 in fly, 0.8 in hover)
};

export type SubjectRenderOpts = {
  t: number;
  expr?: string;
  flip?: boolean;
  c?: string;
  phase?: number;    // distance-locked stride cycle along ExtraDef.path (0 when stationary)
  speed?: number;    // normalized locomotion speed 0..1.5
  moving?: boolean;  // true when actively traveling along path (speed > 0.05)
  altitude?: number; // elevation above ground plane (px)
};

export type SubjectDef = {
  title: string;                // Vietnamese name shown on SubjectSheet
  kind: SubjectKind;
  relToActor: [number, number]; // expected height ratio vs 575px adult (or episode actor scale), e.g. [1.6, 3.8]
  poses: string[];              // >= 4 distinct poses (e.g. ['idle', 'stalk', 'pounce', 'lookup', 'startled', 'back'])
  exprs?: string[];             // optional facial expressions (e.g. ['calm', 'alert', 'fierce', 'curious'])
  seats?: Record<string, SubjectSeat[]>; // optional mount slots per pose (or 'default')
  firstSeg?: string;            // earliest segment ID e.g. 's64' where this subject may appear
  appearSegs?: [string, string][]; // allowed [startSeg, endSeg] inclusive story windows where this subject may appear
  poseSegs?: Record<string, [string, string][]>; // allowed [startSeg, endSeg] windows for stateful poses like 'trapped' with sticky tape
  scaleWithTinyActor?: [number, number]; // strict allowed [minRatio, maxRatio] of rendered subject px height / tiny-actor px height in the same shot
  partialOf?: string;           // parent creature key (e.g. 'giantCat') for close-up partial anatomy subjects like giantCatPaw / giantCatHead
  airborne?: boolean;           // true only for inherently flying vehicles/machines/creatures (skips GE-21 floor-contact check)
  render: (pose: string, opts: SubjectRenderOpts) => React.ReactNode;
};

/** Resolve mount/seat anchor for a subject pose + slot index, falling back to 'default'. */
export const resolveSeat = (def: SubjectDef, pose: string, slot = 0): SubjectSeat | null =>
  def.seats?.[pose]?.[slot] ?? def.seats?.default?.[slot] ?? null;
