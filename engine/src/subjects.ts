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
};

export type SubjectDef = {
  title: string;                // Vietnamese name shown on SubjectSheet
  kind: SubjectKind;
  relToActor: [number, number]; // expected height ratio vs 575px adult (or episode actor scale), e.g. [1.6, 3.8]
  poses: string[];              // >= 4 distinct poses (e.g. ['idle', 'stalk', 'pounce', 'lookup', 'startled', 'back'])
  exprs?: string[];             // optional facial expressions (e.g. ['calm', 'alert', 'fierce', 'curious'])
  seats?: Record<string, SubjectSeat[]>; // optional mount slots per pose (or 'default')
  render: (pose: string, opts: SubjectRenderOpts) => React.ReactNode;
};

/** Resolve mount/seat anchor for a subject pose + slot index, falling back to 'default'. */
export const resolveSeat = (def: SubjectDef, pose: string, slot = 0): SubjectSeat | null =>
  def.seats?.[pose]?.[slot] ?? def.seats?.default?.[slot] ?? null;
