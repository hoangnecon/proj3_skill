---
name: sv-40-audio
description: Mix the sound of a story-video episode — ambience bed per set, foley derived automatically from the shot table (reaches, set keys, overlays, transitions), word-anchored accents, and music — the one series theme (scripts/theme.py, 118 BPM, generated to length, melody from 0 s) or the legacy sparse mood engine (≤ 80 BPM) — configured in audio.json; levels, processing and mastering follow sv-42-mix-master. Use whenever you set up or change music, ambience or sound effects, when the user says the music is too loud/busy/fast, or after shots or voice change.
---

# sv-40 · Audio design (feeds gate G6; levels in sv-42)

The user's verdict on an earlier mix: "nhạc to và dở quá… nhạc nhẹ và chậm lại tí, đừng dồn dập".
House sound = voice first; music is a soft bed you barely notice; small sounds make the pictures feel
physical.

## Series theme (default for every episode)
The user chose one theme for the whole series on 2026-11-15: "Pizzicato tò mò" v2 — kỳ bí nhẹ, tò mò, nhịp
vừa, a soft "tưng tưng" bass on every beat. It is code, not audio: `scripts/theme.py` (D minor, 118 BPM,
kalimba + music box + soft bass + quiet shaker + pad, fixed seed). mix.py renders it to the exact episode
length, so nothing large goes into git and every episode sounds the same.
- The melody starts at 0 s (no intro: the user wants it in from the first frame).
- It loops A A B A and resolves on the tonic at the bar after `end.at`.
- `sections` only mark `"mood": "silence"` gaps (1–3 s before the turn); any other mood means "theme plays".
- Preview alone: `python3 scripts/theme.py --sec 75 --end 71 --out audio/theme.wav`.
- Changing the theme (notes, instruments, tempo) is a series decision: only on the user's request, and the
  change lands in the suite's `engine/scripts/theme.py` so every new episode gets it.

```json
"music": {"theme": "series", "under_voice_db": 16,
          "sections": [{"from": "s1", "mood": "light"}, {"from": "s20", "mood": "silence"}, {"from": "s21", "mood": "light"}],
          "end": {"at": "s26@không"}}
```

## audio.json (legacy mood engine shown; use the series theme block above for music)
```json
{
  "music": {"bpm": 76, "under_voice_db": 22,
            "sections": [{"from": "s1", "mood": "light", "key": "G"},
                         {"from": "s9", "mood": "tense", "key": "D"},
                         {"from": "s21", "mood": "silence"},
                         {"from": "s23", "mood": "tender", "key": "E"}],
            "end": {"at": "s26@bí"}},
  "beds": {"lobby": "echo"},
  "keys": {"door": "slide", "lit": "ding", "call": "none"},
  "accents": [{"at": "s19@do", "fx": "thump", "d": 0.3, "g": 0.8}]
}
```
| Key | Meaning |
|---|---|
| `music.theme` | `"series"` → scripts/theme.py (118 BPM, bpm key ignored). Omit only for the legacy mood engine |
| `music.bpm` | mood engine only: ≤ 80 (hard stop) |
| `music.under_voice_db` | 15–18 (house standard, mix_targets.json; aim 16). Music gain is solved so it sits exactly this far under the voice while speaking |
| `sections[].from` | anchor where the section starts; `mood` light (major, sparse kalimba + bass) · tender (minor, slower notes + pad) · dark (low pads) · tense (pulsing low pad) · silence; `key` C D E F G A Bb |
| `end.at` | music resolves to a final chord here; put it on the button line |
| `beds` | override a set's ambience (`SetDef.bed`): room hum quiet echo outdoor fan motor basement paper street market kitchen rain night |
| `keys` | sound for each animated set option used in shots: slide whoosh thump gong pop ding click buzz power_down rumble knock paper cheer meow horn, or `none`. Every key used must be listed (warning otherwise) |
| `accents` | extra sounds on words: `{at, fx, d?, g?}` |

Automatic: reach → click; stamp/title → thump; tag → gong; bubble/label/card/pin → pop; score → ding;
arrow → whoosh; flash/wipe/solid cuts → whoosh.

## Music design by beat
| Beat | Mood |
|---|---|
| Hook + setup | light |
| Consequences | light, change key at a new chapter (time tag) |
| Escalation to the system | tense or dark |
| Just before the turn | silence 1–3 s (the strongest effect you have) |
| Turn / reveal | tender or dark |
| Button | `end` on the last line |

## Workflow
1. G5 passed (`qa/shots.json` fresh: `node scripts/times.mjs`).
2. **Action-to-Foley pre-plan (`v5.2.0`):** run `python3 scripts/plan_audio.py` to auto-derive contiguous ambience bed spans and synchronized physical foley cues (`footsteps`, `jump_whoosh`, `land_thud`, `effort_scrape`, `wing_buzz`, `impact_hit`, `whoosh_fast`, `tap_press`, `mech_trigger`, `ui_pop`) directly from `qa/shots.json` into `qa/audio_plan_suggested.json` (pass `--write-audio-json` only if `audio.json` has no custom accents yet) so zero physical actions go silent.
3. Write or refine `audio.json` from `beats.md` (sections), the shotlist (`keys` used), and `qa/audio_plan_suggested.json` (top physical `accents`).
4. Mix and measure with **sv-42-mix-master** (`scripts/mix.py` runs the house chain and `audio_qa.py`).
5. From the report check only the sound-design part here: the sfx list matches what you expect (count
   reaches/keys/physical accents), sections and silences sit where beats.md says. Levels, spectrum and loudness are sv-42's.
6. Listen through on headphones at least: the hook, every key/reach/physical-foley shot, the silence before the turn, the
   ending. Music must never compete with a word. Fix in audio.json, re-mix.
7. G6 is passed through sv-42 (its review lists the plots and listening notes).

## Rules
- Never raise the music to "fill" a quiet part; use a bed or silence.
- Do not write new music per episode. The theme is the series identity; the mood engine is legacy.
- No hi-hats, drums or dense runs on top of the theme.
- After any shot or voice change the mix is stale (hashes in the report) — re-run mix.py; deliver.mjs refuses a stale mix.
