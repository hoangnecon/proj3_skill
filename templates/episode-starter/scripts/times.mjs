// Write qa/shots.json (shot table with absolute times + events). Run after every shotlist edit.
import fs from 'node:fs';
import {loadProject} from './load.mjs';
const P = await loadProject();
fs.mkdirSync('qa', {recursive: true});
const rows = P.shotTable();
fs.writeFileSync('qa/shots.json', JSON.stringify(rows, null, 1));
console.log(`qa/shots.json: ${rows.length} shots, ${P.DURATION.toFixed(2)} s`);
