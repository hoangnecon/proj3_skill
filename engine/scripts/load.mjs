// Load the episode's TypeScript (cast, sets, shotlist, timing) in plain node via esbuild,
// with the Google-font loader stubbed out. Used by lint.mjs, times.mjs, design.mjs, sv_gate.py.
import {build} from 'esbuild';
import path from 'node:path';

const fontStub = {
  name: 'font-stub',
  setup(b) {
    b.onResolve({filter: /^@remotion\/google-fonts/}, () => ({path: 'font-stub', namespace: 'stub'}));
    b.onResolve({filter: /^remotion$/}, () => ({path: 'remotion-stub', namespace: 'stub'}));
    b.onLoad({filter: /.*/, namespace: 'stub'}, (a) => ({
      contents: a.path === 'font-stub'
        ? 'export const loadFont = () => ({fontFamily: "Be Vietnam Pro"});'
        : 'export const AbsoluteFill = () => null; export const Audio = () => null; export const staticFile = (s) => s; export const useCurrentFrame = () => 0; export const Composition = () => null; export const registerRoot = () => {};',
      loader: 'js',
    }));
  },
};

export const loadProject = async () => {
  const r = await build({
    entryPoints: [path.resolve('scripts/entry.tsx')], bundle: true, write: false, platform: 'node', format: 'esm',
    jsx: 'automatic', loader: {'.tsx': 'tsx', '.ts': 'ts'}, external: ['react', 'react-dom', 'react/jsx-runtime'],
    plugins: [fontStub], logLevel: 'error',
  });
  const file = path.resolve('node_modules/.sv-entry.mjs');
  const fs = await import('node:fs');
  fs.writeFileSync(file, r.outputFiles[0].text);
  return import(file + '?v=' + Date.now());
};
