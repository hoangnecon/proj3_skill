# Conventions (`v3.0.0`)

Enforced by `tools/validate_skills.py`.

## Repository layout — one kind of thing per top-level folder
| Folder | Holds | Never holds |
|---|---|---|
| `skills/` | instructions only: `sv-*/SKILL.md` + `references/*.md` (the plugin's `skills` path) | code, data, templates |
| `standards/` | the house standards as versioned data: `voice_standard.json`, `pacing.json`, `mix_targets.json` | anything one episode may change |
| `engine/` | code every episode shares: `scripts/` (tools), `src/` (Remotion engine), `package.json`, `tsconfig.json`, `remotion.config.ts` | episode content, standards, examples |
| `starter/` | the blank episode files an agent fills in: `brief.md`, `beats.md`, `script.json`, `audio.json`, `src/episode/*`, empty `src/data/*`, `gates/*.review.md`, `README.md` | demo or reference content |
| `examples/` | `thang-may/` (reference episode: geo, looks, sets, shotlist), `demo/` (4-shot engine demo, an overlay on a new episode) | anything a real episode needs to run |
| `tools/` | suite tooling: `new_episode.sh` (assembles an episode), `validate_skills.py` | episode tools (those live in `engine/scripts/`) |
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
| SC-01..18 | script, words budget, voice text rules | `scripts/script_lint.py` |
| CH-01..09 | characters | `scripts/lint.mjs design` |
| TK-01..03 | tokens (no raw colours, one font) | `lint.mjs design` |
| SE-01..13 | sets: density, text, halftone, glow, bounds, life, rendered-plate emptiness | `lint.mjs design` |
| SH-01..15 | shot table | `lint.mjs shots` |
| AN-01..02 | anchors | `lint.mjs shots` |
| OV-01..04 | overlays | `lint.mjs shots` |
| CA-01..05 | camera | `lint.mjs shots` |
| SZ-01..02 | on-screen size and framing | `lint.mjs shots` |
| MO-01..09 | motion | `lint.mjs shots` |
| KY-01 | animated set keys | `lint.mjs shots` |
| CO-01..03 | coverage | `lint.mjs shots` |
| PC-01..03 | shot pacing (`standards/pacing.json`) | `lint.mjs shots` |

A rule documented in a skill must name its lint ID when one exists. A waiver is
`// lint-ok: <ID> <reason>` on the shot's line, and it must be justified in the G5 review.

## Gates
- There are seven gates, G1 to G7 (see sv-00).
- `scripts/sv_gate.py` writes `gates/log.jsonl` with hashes of each gate's inputs. When an input changes, that gate and every later gate become STALE.
- Review files must name every evidence file with a remark of at least 4 words, and must be newer than the evidence.
- G1, G2 and G4 need `approval: user` (with `user_quote`) or `approval: delegated`.

## Episode assembly
- An episode made by `tools/new_episode.sh` (blank and `--demo`) must type-check (`npx tsc --noEmit`) and run
  `node scripts/times.mjs`.
- Generated folders are git-ignored and never committed: `audio/`, `public/`, `qa/`, `out/`, `gates/log.jsonl`
  in an episode, `examples/demo/audio/` and `examples/demo/public/` in the suite.
