// Render the design evidence for gate G4 into qa/design/:
//   cast_episode_p<N>.png      every look in src/cast.ts (front + side, role, description)
//   expr_<look>.png            per principal/support: 12 expressions, 6 poses, walk cycle, sitting
//   set_<id>.png / _grid.png   every episode set (clean plate + world-coordinate grid)
//   --exemplar                 also render the exemplar cast + ex-* plates for side-by-side comparison
// Usage: node scripts/design.mjs [--exemplar] [--only set:<id>|look:<key>]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {loadProject} from './load.mjs';

const args = process.argv.slice(2);
const withEx = args.includes('--exemplar');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const P = await loadProject();
const castKeys = Object.keys(P.CAST);
const setIds = Object.keys(P.EPISODE_SETS);
fs.mkdirSync('qa/design', {recursive: true});

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const still = async (id, props, out) => {
  const comp = await selectComposition({serveUrl, id, inputProps: props, chromiumOptions: {gl: 'angle'}});
  await renderStill({serveUrl, composition: comp, inputProps: props, frame: 0, output: out, chromiumOptions: {gl: 'angle'}, imageFormat: 'png'});
  console.log('ok', out);
};

const jobs = [];
if (!only) {
  const pages = Math.max(1, Math.ceil(castKeys.length / 10));
  for (let p = 0; p < pages; p++) jobs.push(['CastSheet', {which: 'episode', page: p}, `qa/design/cast_episode_p${p + 1}.png`]);
}
for (const k of castKeys) {
  const role = P.CAST_ROLES[k]?.role;
  if ((!only && role !== 'extra') || only === 'look:' + k) jobs.push(['ExprSheet', {look: k}, `qa/design/expr_${k}.png`]);
}
for (const id of setIds) {
  if (only && only !== 'set:' + id) continue;
  jobs.push(['SetPlate', {id, grid: false}, `qa/design/set_${id}.png`]);
  jobs.push(['SetPlate', {id, grid: true}, `qa/design/set_${id}_grid.png`]);
}
if (withEx) {
  const exKeys = Object.keys(P.EX_LOOKS);
  for (let p = 0; p < Math.ceil(exKeys.length / 10); p++) jobs.push(['CastSheet', {which: 'exemplar', page: p}, `qa/design/cast_exemplar_p${p + 1}.png`]);
  jobs.push(['ExprSheet', {look: 'ex_baHanh'}, 'qa/design/expr_ex_baHanh.png']);
  for (const id of Object.keys(P.EXEMPLAR_SETS)) jobs.push(['SetPlate', {id, grid: false}, `qa/design/set_${id}.png`]);
}
for (const [id, props, out] of jobs) await still(id, props, out);
// visible-detail measure of every clean plate (lint SE-13 reads qa/design/plate_stats.json)
const plates = jobs.filter(([id, props]) => id === 'SetPlate' && !props.grid && !P.SETS[props.id]?.insert).map(([, , out]) => out);
if (plates.length) execFileSync('python3', ['scripts/plate_check.py', ...plates], {stdio: 'inherit'});
if (!jobs.length) console.log('nothing to render (cast and sets are empty)');
