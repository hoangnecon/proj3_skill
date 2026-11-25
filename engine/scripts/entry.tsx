// Node-side view of the project for lint/gates. Never imported by the Remotion bundle.
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CAST, CAST_ROLES} from '../src/episode/cast';
import {EX_LOOKS} from '../src/exemplar/looks';
import {SETS} from '../src/sets';
import {EPISODE_SETS} from '../src/episode/sets';
import {EXEMPLAR_SETS} from '../src/exemplar/sets';
import {SHOTS} from '../src/episode/shotlist';
import {resolveShots, abs, tAt, WORDS, C, DURATION, normWord} from '../src/engine';
import {POSES} from '../src/chars';
import {HAND_PROPS, SIDE_PROPS, WORLD_PROPS} from '../src/props';
import {SUBJECTS} from '../src/episode/subjects';
import {PAL} from '../src/kit';

export {CAST, CAST_ROLES, EX_LOOKS, SETS, EPISODE_SETS, EXEMPLAR_SETS, SHOTS, WORDS, C, DURATION, POSES, HAND_PROPS, SIDE_PROPS, WORLD_PROPS, SUBJECTS, PAL, tAt, normWord};

/** element statistics of a set rendered at its plate options — the "is this more than a few boxes" measure */
export const setStats = (id: string) => {
  const def = SETS[id];
  const mk = (t: number) => {
    const L = def.render({t, ...(def.plateOpts ?? {})});
    return {L, html: renderToStaticMarkup(<svg>{L.far}{L.back}{L.mid.map((m) => <g key={m.key}>{m.node}</g>)}{L.fg}</svg>)};
  };
  const {L, html} = mk(1);
  // "something always moves": the plate must differ between two moments 1.37 s apart (or run a looped videoPlate)
  const moves = Boolean(def.videoPlate) || html !== mk(2.37).html;
  const count = (re: RegExp) => (html.match(re) ?? []).length;
  const fills = new Set((html.match(/fill="(#[0-9a-fA-F]{3,8})"/g) ?? []).map((x) => x.toLowerCase()));
  const texts = [...html.matchAll(/<text[^>]*>([^<]*)</g)].map((m) => m[1]).filter((s) => s.trim().length > 0);
  const imageTags = [...html.matchAll(/<image\b([^>]*?)>/g)].map((m) => {
    const attrs = m[1] ?? '';
    const getAttr = (re: RegExp) => re.exec(attrs)?.[1] ?? null;
    const href = getAttr(/\b(?:xlink:)?href="([^"]*)"/);
    const num = (k: string) => {
      const v = getAttr(new RegExp(`\\b${k}="([^"]*)"`));
      return v !== null && Number.isFinite(Number(v)) ? Number(v) : null;
    };
    return {href, x: num('x'), y: num('y'), width: num('width'), height: num('height')};
  });
  return {
    id,
    shapes: count(/<(path|rect|circle|ellipse|polygon|line|text)\b/g),
    images: imageTags.length,
    imageTags,
    videoPlate: def.videoPlate ?? null,
    colours: fills.size,
    texts: texts.length,
    textSamples: texts.slice(0, 12),
    halftone: count(/url\(#dots/g),
    glow: count(/url\(#glow/g),
    midItems: L.mid.length,
    moves,
    layers: ['far', 'back', 'fg'].filter((k) => (L as Record<string, unknown>)[k]).concat(L.mid.length ? ['mid'] : []),
  };
};

/** shot timing + events for QA renders, strips, mix.py and the gate */
export const shotTable = () =>
  resolveShots(SHOTS).map((s) => {
    const reaches: number[] = [];
    const actors = (s.actors ?? []).map((a) => {
      for (const r of a.reach ?? []) reaches.push(+abs(r.at, s).toFixed(3));
      const legs = Array.isArray(a.legs) ? a.legs.map(([v, tt]) => [v, +abs(tt, s).toFixed(3)]) : a.legs ? [[a.legs, s.t0]] : [];
      return {
        id: a.id, look: a.look, s: a.s ?? 1, x: a.x, y: a.y,
        walks: !!(a.path && a.path.length > 1), ride: a.ride ?? null, legs, reach: (a.reach ?? []).length,
        talks: (a.talk ?? []).length > 0,
        path: a.path ? a.path.map(([x, y, tt]) => [x, y, +abs(tt, s).toFixed(3)]) : null,
        view: a.view ?? null,
        z: a.z ?? 0, fg: !!a.fg, mount: a.mount ?? null,
        arcH: a.arcH ?? 0, pushTarget: a.pushTarget ?? null, fx: a.fx ?? [],
      };
    });
    const keyEvents: {key: string; value: unknown; t: number}[] = [];
    for (const [k, tr] of Object.entries(s.keys ?? {})) for (let i = 1; i < tr.length; i++) keyEvents.push({key: k, value: tr[i][0], t: +abs(tr[i][1], s).toFixed(3)});
    return {
      i: s.idx, name: s.name, at: s.at, set: s.set, bed: SETS[s.set]?.bed ?? 'room', night: s.night ?? 0, tr: s.tr ?? 'cut',
      t0: +s.t0.toFixed(3), t1: +s.t1.toFixed(3), cam: s.cam, cam2: s.cam2 ?? null,
      camKeys: s.camKeys ? s.camKeys.map(([cx, cy, k, tt]) => [cx, cy, k, +abs(tt, s).toFixed(3)]) : null,
      punch: s.punch ?? 0, shake: s.shake ?? 0,
      o: s.o ?? {}, keys: keyEvents, reaches: reaches.filter((c) => c >= s.t0 - 0.5 && c < s.t1 + 0.5), actors,
      over: (s.over ?? []).map((o) => ({k: o.k, text: o.text ?? '', t: +abs(o.at ?? 0, s).toFixed(3), x: o.x, y: o.y, world: !!o.world})),
      extras: (s.extras ?? []).map((x) => x.k),
      extraEvents: (s.extras ?? []).map((x) => ({id: x.id ?? null, k: x.k, pose: x.pose ?? null, altitude: x.altitude ?? 0, hasPath: !!(x.path && x.path.length > 1)})),
    };
  });
