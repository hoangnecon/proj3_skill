# Conventions (`v2.0.0`)

Enforced by `tools/validate_skills.py`.

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
| SC-01..14 | script | `scripts/script_lint.py` |
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

A rule documented in a skill must name its lint ID when one exists. A waiver is
`// lint-ok: <ID> <reason>` on the shot's line, and it must be justified in the G5 review.

## Gates
- There are seven gates, G1 to G7 (see sv-00).
- `scripts/sv_gate.py` writes `gates/log.jsonl` with hashes of each gate's inputs. When an input changes, that gate and every later gate become STALE.
- Review files must name every evidence file with a remark of at least 4 words, and must be newer than the evidence.
- G1, G2 and G4 need `approval: user` (with `user_quote`) or `approval: delegated`.

## Template
- `templates/episode-starter/` must lint and type-check: `npx tsc --noEmit`.
- Generated folders are git-ignored and never committed: `audio/`, `public/`, `qa/`, `out/`, `gates/log.jsonl`.
