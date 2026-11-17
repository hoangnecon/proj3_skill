// Write qa/shots.json (shot table with absolute times + events) and qa/timing.json (the part the mix uses).
// Run after every shotlist edit. `--quiet` prints nothing (sv_gate.py runs it before every status).
import fs from 'node:fs';
import {loadProject, writeTables} from './load.mjs';
const P = await loadProject();
const rows = P.shotTable();
writeTables(fs, rows);
if (!process.argv.includes('--quiet')) console.log(`qa/shots.json: ${rows.length} shots, ${P.DURATION.toFixed(2)} s`);
