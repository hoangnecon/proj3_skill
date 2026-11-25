# Episode project

Made by `tools/new_episode.py` of story-video-skills (`.episode.json` records track `short` or `long` and suite version). The folder has
three zones. Only the first is written by hand.

| Zone | Paths | Who changes it |
|---|---|---|
| **Episode** — this story | `brief.md`, `beats.md`, `script.json`, `audio.json`, `src/episode/` (`cast.ts`, `geo.ts`, `sets.tsx`, `subjects.tsx`, `shotlist.ts`), `gates/G*.review.md` | the agent, phase by phase (`sv-core-router`) |
| **Suite copy** — read-only | `scripts/` (tools), `src/*.ts(x)` + `src/design/` + `src/sets/` (engine), `src/exemplar/` (reference episode), `standards/` (house standards), `package.json`, `tsconfig.json`, `remotion.config.ts` | nobody. Fix it in the suite and start a new episode; the gates pin `standards/` by hash |
| **Generated** | `src/data/` (`words.json`, `cues.json`, `events.json`: `voice.py`), `audio/`, `public/`, `qa/`, `out/`, `logs/`, `gates/log.jsonl` | the tools only. `src/data/` is tracked (the render needs it); the rest is ignored |

Phase → files:
- G1 brief: `brief.md`
- G2 script: `beats.md`, `script.json`
- G3 voice: `src/data/`, `audio/`
- G4 design: `src/episode/cast.ts`, `geo.ts`, `sets.tsx`, `subjects.tsx`
- G5 shots: `src/episode/shotlist.ts`
- G6 audio: `audio.json`, `public/mix.wav`
- G7 delivery: `out/`

`python scripts/sv_cli.py status` shows where the episode stands.
