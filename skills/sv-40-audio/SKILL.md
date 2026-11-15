---
name: sv-40-audio
description: Mix the sound of a story-video episode — ambience bed per set, foley derived automatically from the shot table (reaches, set keys, overlays, transitions), word-anchored accents, and sparse generated music (≤ 80 BPM, moods light/tender/dark/tense/silence) placed 20–24 dB under the voice, loudness −14 LUFS — configured in audio.json, verified by qa/mix_report.json and gate G6. Use whenever you set up or change music, ambience or sound effects, when the user says the music is too loud/busy/fast, or after shots or voice change.
---

# sv-40 · Audio (gate G6)

The user's verdict on an earlier mix: "nhạc to và dở quá… nhạc nhẹ và chậm lại tí, đừng dồn dập".
House sound = voice first; music is a soft bed you barely notice; small sounds make the pictures feel
physical.

## audio.json
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
| `music.bpm` | ≤ 80 (hard stop). 72–78 normal |
| `music.under_voice_db` | 20–24 (hard stop). Music gain is solved so it sits exactly this far under the voice while speaking |
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
2. Write `audio.json` from beats.md (sections) and the shotlist (keys used).
3. `python3 scripts/mix.py` → `public/mix.wav` (48 kHz, −14 LUFS) and `qa/mix_report.json`.
4. Read the report: `warnings` empty, `bpm` ≤ 80, `under_voice_db_speaking` 20–24, `lufs` −15…−13,
   `true_peak` ≤ −1, the sfx list matches what you expect (count reaches/keys).
5. Listen through on headphones at least: the hook, every key/reach shot, the silence before the turn, the
   ending. Music must never compete with a word. Fix in audio.json, re-mix.
6. `gates/G6.review.md`: report line + listening notes. Show the user a preview (render via sv-41 phone
   copy or the 30 s around the turn) if the mood plan is new. `python3 scripts/sv_gate.py pass G6`.

## Rules
- Never raise the music to "fill" a quiet part; use a bed or silence.
- No beat-driven, plucky, busy patterns; at most one note per beat (the generator enforces).
- After any shot or voice change the mix is stale (hashes in the report) — re-run mix.py; deliver.mjs refuses a stale mix.
