# Shotlist API (src/episode/shotlist.ts → `SHOTS: ShotDef[]`)

A shot starts at a word and lasts until the next shot's word. You never write durations: the narration
decides them. `resolveShots` cuts `LEAD = 0.06 s` before each anchor so the picture changes just before
the word is heard.

## Anchors (`TT`)
| Form | Meaning |
|---|---|
| `'s5'` | start of segment s5 |
| `'s5@mở'` | start of the first word "mở" in s5 (case/diacritics must match `src/data/words.json`, punctuation ignored) |
| `'s5@mở#2'` | the second "mở" in s5. Lint AN-02 forces `#n` when the word occurs more than once |
| `'s5@mở+0.3'` / `'s5@mở-0.2'` | offset in seconds |
| `0.8` (number) | seconds from the shot start (only for keys inside a shot; never for `at`) |

`talk: [['s5@Tôi', 's5@dối']]` uses the START of the first word and the END of the last.
Check the words: `node -e "console.log(require('./src/words.json').filter(w=>w.seg==='s5').map(w=>w.w).join(' '))"`.
If the aligner split a word differently than the script (`Thang-máy` → `Thang`), anchor to what words.json says.

## ShotDef fields
| Field | Type | Notes |
|---|---|---|
| `at` | anchor | first shot `'s1'`; strictly increasing (SH-13) |
| `name` | string | Vietnamese, what happens (`'bà Hạnh thú nhận'`), shown on QA sheets, used for waivers |
| `set` | id | episode set (SH-05); never an `ex-*` set (SH-06) |
| `o` | object | static set options for the whole shot (`{flicker: 1, disp: 'G'}`) |
| `keys` | `{opt: KeyTrack}` | animated options: `[[value, at, tween?], …]`. Numbers tween with ease-in-out STARTING at the key time and lasting `tween` s (default 0.6); other types (bool, string, arrays) switch at the key time. First entry at `0` = initial state |
| `of` | fn | `(u, ts, t) => opts` escape hatch for computed options (u = 0..1 shot progress, ts = seconds in shot, t = absolute). Use only when `keys` cannot express it |
| `cam` | `[cx, cy, k]` | camera start: centre in world px, zoom k (k = 1 shows 1080 × 1920 world px) |
| `cam2` | same | camera end — only for a MOTIVATED move (see shot-grammar §3) |
| `ease` | `'io' \| 'out' \| 'in' \| 'lin'` | camera move curve; default `'io'` |
| `actors` | `Actor[]` | see sv-short-production actor-api.md |
| `over` | `Over[]` | screen graphics, see below |
| `extras` | `[{k, x, y, s?, c?}]` | WORLD_PROPS placed on the floor |
| `punch` | 0.04–0.08 | zoom kick at the cut, for gags/stamps |
| `shake` | px 2–8 | camera shake, impacts and flicker only |
| `night` | 0..1 | night grade |
| `tr` | `'cut' \| 'flash' \| 'wipe'` | transition INTO this shot. Default cut. `flash` = time jump/shock (≤ 2 per episode), `wipe` = chapter change (≤ 1) |

## Over (overlays)
`{k, text?, sub?, x, y, at?, until?, r?, s?, c?, world?, tail?}`. `x, y` screen px (or world px with
`world: true`). `at` defaults to the shot start, `until` to the shot end. Kinds and when to use them:
sv-short-design `props-overlays.md` §2. Lint: OV-01 unknown kind, OV-02 bubble > 28 chars, OV-03 caption band,
OV-04 more than 2 at once.

## Waivers
Put `// lint-ok: <RULE> <reason of ≥ 3 words>` on the line of the shot's `name` to accept a warning or an
error that is intended (a 0.4 s flash cut for a gag, a long hold on a sunset). Every waiver is listed in
`qa/lint.json` and must be justified in `gates/G5.review.md`.

## Migrating old shotlists (the Thang-máy exemplar uses v1 names)
| v1 | v2 |
|---|---|
| `doorKeys: [[1,0],[0,'s2@cửa']]` | `keys: {door: [[1,0],[0,'s2@cửa']]}` |
| `floors: [0, a, b], floorsTo: 12` | `keys: {floor: [[0,0],[12, a, b−a]]}` (tween starts at a, lasts b−a; the option name is whatever the set reads) |
| `lights: …` | `keys: {lit: …}` |
| overlay `k: 'year'` | `k: 'tag'` |

`src/exemplar/shotlist.thang-may.ts.txt` is the full shotlist of the reference episode (67 shots, 153 s).
Read it for rhythm and density; do not copy its shots.
