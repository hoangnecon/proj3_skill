// Set registry. Film.tsx, the design plates and the lints all read SETS.
import React from 'react';
import {col} from '../kit';
import type {SetDef} from './types';
import {EPISODE_SETS} from './episode';
import {EXEMPLAR_SETS} from '../exemplar/sets';

export type {SetDef, SetLayers, SetOpts, Item} from './types';

/** plain colour card for title/end cards and graphic beats: mid items are drawn on top */
const solid: SetDef = {
  title: 'Nền màu trơn',
  bed: 'paper',
  render: (o) => ({
    back: React.createElement('g', null,
      React.createElement('rect', {x: -400, y: -400, width: 1880, height: 2720, fill: col(String(o.bg ?? 'yellow'))}),
      React.createElement('rect', {x: -400, y: -400, width: 1880, height: 2720, fill: 'url(#dots)', opacity: 0.12}),
    ),
    mid: [],
  }),
};

export const SETS: Record<string, SetDef> = {solid, ...EXEMPLAR_SETS, ...EPISODE_SETS};
export const isExemplarSet = (id: string) => id.startsWith('ex-');
