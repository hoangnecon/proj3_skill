# Conventions (`v4.4.0`)

Enforced by `tools/validate_skills.py`.

## Repository layout — one kind of thing per top-level folder
| Folder | Holds | Never holds |
|---|---|---|
| `skills/` | instructions only: `sv-*/SKILL.md` + `references/*.md` (the plugin's `skills` path) | code, data, templates |
| `standards/` | the house standards as versioned data: `voice_standard.json`, `pacing.json`, `mix_targets.json` | anything one episode may change |
| `engine/` | code every episode shares: `scripts/` (tools), `src/` (Remotion engine), `package.json`, `tsconfig.json`, `remotion.config.ts` | episode content, standards, examples |
| `starter/` | the blank episode files an agent fills in: `brief.md`, `beats.md`, `script.json`, `audio.json`, `src/episode/*`, empty `src/data/*`, `gates/*.review.md`, `README.md` | demo or reference content |
| `examples/` | `thang-may/` (reference episode: geo, looks, sets, shotlist), `demo/` (4-shot engine demo, an overlay on a new episode) | anything a real episode needs to run |
| `tools/` | suite tooling: `new_episode.sh` (assembles an episode), `validate_skills.py`, `benchmark_suite.py` (dual-format quality & speed regression CLI) | episode tools (those live in `engine/scripts/`) |
| `docs/` | reviews and research notes about the suite | instructions (those are skills) |

An episode is assembled, never edited in place in the suite: `engine/` → episode root, `standards/` →
`standards/`, `examples/thang-may/` → `src/exemplar/`, `starter/` on top, and `examples/demo/` on top only with
`--demo`. The episode keeps its own copy, so a later suite change never alters a finished episode; the gates
pin `standards/` by hash.

## Skills
- Directory `skills/sv-<TT>-<slug>/` with `SKILL.md`; the tier digit groups phases: 0 pipeline/bible,
  1 story and voice, 2 picture, 4 sound and delivery.
- Frontmatter: `name` equals the directory name; `description` is 150–1024 characters with no `<` or `>`,
  and says both what the skill does and when to use it.
- `SKILL.md` ≤ 500 lines. Every file in `references/` and `scripts/` is mentioned in its SKILL.md
  (or, for scripts, in sv-00's commands reference).
- English prose for instructions. Vietnamese is used where it is the content: narration, on-screen text,
  quoted user feedback, northern/southern word lists, gate review templates.

## Rules and lint IDs
| Prefix | Area | Where |
|---|---|---|
| SC-01..27, SC-29..31 | script, words budget, voice text rules, 5-Knot spine, Long-Form 5-Chapter/3+ Plants/Anti-Padding (`SC-27`, `SC-29..31`) | `scripts/script_lint.py` |
| CH-01..10 | characters (format-aware cast richness `CH-09`, no hand-drawn characters outside `<Person>` `CH-10`) | `scripts/lint.mjs design` |
| TK-01..03 | tokens (no raw colours, one font) | `lint.mjs design` |
| SE-01..16 | sets: density, text, halftone, glow, bounds, life, plate emptiness, plate sign clipping, Long-Form ≥15 sets, ≥4 angles & drawn sub-scenes (`SE-15`), perceptual plate clutter/contrast/balance gate (`SE-16`) | `lint.mjs design` |
| PR-01..06 | props & Hero Subjects: human-scale proportions & origin, internal text collision, no disembodied `*Head`, grip distance, giant partial-body continuity (`PR-05`), multi-pose Hero Subjects (`PR-06`) | `lint.mjs design` |
| SH-01..19 | shot table, Long-Form set-fatigue streak/share (`SH-16`), cinematic view/prop diversity (`SH-17`), multi-pose Hero Creature enforcement (`SH-18`), atmospheric `ShotDef.mood` enum & over-dark `danger` + `night > 0.7` guard (`SH-19`) | `lint.mjs shots` |
| LA-01..04 | layout & scale CI: set `actorScale`/`shotScale`/`location` & `relToActor` ratios (`LA-01`), 3×3 spatial grid & union occupancy clutter budget (`LA-02`), ban fake close-up camera zoom on establishing/wide sets (`LA-03`), z-aware occlusion & awkward hero creature frame-edge cut-off (`LA-04`) | `lint.mjs design` & `shots` |
| AN-01..02 | anchors | `lint.mjs shots` |
| OV-01..04 | overlays | `lint.mjs shots` |
| CA-01..07 | camera: zoom, move jolt, ratio, establish, world bounds (`CA-01..05`), 180° axis/eyeline continuity (`CA-06`), Long-Form shot-size progression & variety rhythm (`CA-07`) | `lint.mjs shots` |
| SZ-01..02 | on-screen size and framing | `lint.mjs shots` |
| MO-01..12 | motion (turnaround-squash, reach-across-face / raised-arms walk, floating `seatH`) | `lint.mjs shots` |
| KY-01 | animated set keys | `lint.mjs shots` |
| CO-01..03 | coverage | `lint.mjs shots` |
| PC-01..03 | shot pacing (`standards/pacing.json`) | `lint.mjs shots` |
| GE-01, GE-04, GE-07, GE-10, GE-11, GE-15..19 | screen geometry: overlap, head/caption, size jump, sign clip/occlusion, prop clip, overlay/prop head cover, cast continuity, severed mid-frame giant limb (`GE-19`) | `lint.mjs shots` |

A rule documented in a skill must name its lint ID when one exists. A waiver is
`// lint-ok: <ID> <reason>` on the shot's line, and it must be justified in the G5 review.

## Gates
- There are seven gates, G1 to G7 (see sv-00). Run `scripts/sv_doctor.py --stage G#` for fast zero-cost preflight before checking or passing a gate.
- `scripts/sv_gate.py` writes `gates/log.jsonl` with hashes of each gate's inputs. When an input changes, that gate and every later gate become STALE.
- Review files must name every evidence file with a remark of at least 4 words, and must be newer than the evidence.
- G1, G2 and G4 need `approval: user` (with `user_quote`) or `approval: delegated`.

## Episode assembly
- An episode made by `tools/new_episode.sh` (blank and `--demo`) must type-check (`npx tsc --noEmit`) and run
  `node scripts/times.mjs`.
- Generated folders are git-ignored and never committed: `audio/`, `public/`, `qa/`, `out/`, `gates/log.jsonl`
  in an episode, `examples/demo/audio/` and `examples/demo/public/` in the suite.
