"""Generic episode mix: ambience bed per set, SFX derived from the shot table, sparse generated music, ducking.

Run:  /Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/mix.py
Reads  audio.json (episode audio plan), qa/shots.json (node scripts/times.mjs), src/words.json, src/cues.json, audio/voice.wav
Writes public/mix.wav (48 kHz stereo, -14 LUFS, TP -1.5) and qa/mix_report.json (evidence for gate G6).

House rules (sv-40-audio) are enforced here, not left to taste:
  * music tempo <= 80 BPM (default 76), at most ONE melodic note per beat, no drums/hi-hats
  * music sits 20-24 dB under the voice while speaking: the gain is solved to hit 22 dB exactly
  * every SFX comes from something visible: an overlay, a reach (press), a set key event, a cut to a card,
    or an explicit accent in audio.json anchored to a word
"""
import hashlib
import json
import re
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, lfilter, resample_poly

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
CU = json.loads((ROOT / "src/cues.json").read_text())
WORDS = json.loads((ROOT / "src/words.json").read_text())
SHOTS = json.loads((ROOT / "qa/shots.json").read_text())
PLAN = json.loads((ROOT / "audio.json").read_text())
DUR = CU["total"] + 3.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
T = np.arange(N) / SR
warnings = []


def norm(s):
    return re.sub(r'[.,:;!?…"“”()]', "", s.lower())


def tAt(spec):
    m = re.match(r"^(s\d+[a-z]?)(?:@([^#+\-]+))?(?:#(\d+))?(?:([+-][\d.]+))?$", spec)
    if not m:
        raise SystemExit(f"bad anchor {spec}")
    seg, word, nth, off = m.groups()
    t = CU["seg_starts"][seg]
    if word:
        hits = [w for w in WORDS if w["seg"] == seg and norm(w["w"]) == norm(word)]
        if len(hits) < int(nth or 1):
            raise SystemExit(f"anchor not found: {spec}")
        t = hits[int(nth or 1) - 1]["s"]
    return t + float(off or 0)


def lp(x, hz, o=2):
    b, a = butter(o, hz / (SR / 2), "low")
    return lfilter(b, a, x)


def hp(x, hz, o=2):
    b, a = butter(o, hz / (SR / 2), "high")
    return lfilter(b, a, x)


def bp(x, lo, hi):
    return hp(lp(x, hi), lo)


def place(buf, sig, t0, g=1.0):
    i = int(t0 * SR)
    if i < 0:
        sig, i = sig[-i:], 0
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i] * g


def noise(n):
    return rng.standard_normal(n)


def env(n, a, d):
    k = np.arange(n) / SR
    return np.minimum(1, k / max(a, 1e-4)) * np.exp(-k / d)


def fade(x, fi=0.05, fo=0.1):
    n = len(x)
    e = np.ones(n)
    a, b = min(n // 2, int(fi * SR)), min(n // 2, int(fo * SR))
    if a:
        e[:a] = np.linspace(0, 1, a)
    if b:
        e[n - b:] = np.linspace(1, 0, b)
    return x * e


# ============================ BEDS (one per SetDef.bed) ============================
def drips(n, every=1.7):
    x = np.zeros(n)
    for tt in np.arange(0.3, n / SR, every):
        i = int(tt * SR)
        m = min(n - i, int(0.12 * SR))
        if m > 0:
            kk = np.arange(m) / SR
            x[i:i + m] += np.sin(2 * np.pi * (1400 - 3000 * kk) * kk) * np.exp(-kk / 0.03) * 0.03
    return x


def bed(kind, n):
    k = np.arange(n) / SR
    B = {
        "room": lambda: bp(noise(n), 250, 1600) * 0.02 * (0.8 + 0.2 * np.sin(2 * np.pi * 0.4 * k)) + lp(noise(n), 200) * 0.03,
        "hum": lambda: lp(noise(n), 180, 3) * 0.08 + np.sin(2 * np.pi * 100 * k) * 0.004,
        "quiet": lambda: lp(noise(n), 300) * 0.02 + np.sin(2 * np.pi * 120 * k) * 0.003,
        "echo": lambda: bp(noise(n), 200, 900) * 0.03 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.2 * k) ** 2),
        "outdoor": lambda: lp(noise(n), 500) * 0.04 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.15 * k)),
        "fan": lambda: lp(noise(n), 240) * 0.04 * (0.85 + 0.15 * np.sin(2 * np.pi * 2.6 * k)),
        "motor": lambda: lp(noise(n), 140, 3) * 0.1 + np.sin(2 * np.pi * 50 * k) * 0.012 + np.sin(2 * np.pi * 150 * k) * 0.004,
        "basement": lambda: lp(noise(n), 120, 3) * 0.08 + drips(n),
        "paper": lambda: lp(noise(n), 900) * 0.006,
        "street": lambda: lp(noise(n), 700) * 0.05 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.11 * k)) + bp(noise(n), 900, 2500) * 0.01,
        "market": lambda: bp(noise(n), 300, 2400) * 0.045 * (0.75 + 0.25 * np.abs(np.sin(2 * np.pi * 0.9 * k))),
        "kitchen": lambda: lp(noise(n), 600) * 0.025 + hp(noise(n), 4000) * 0.006 * (np.sin(2 * np.pi * 0.3 * k) > 0.2),
        "rain": lambda: hp(noise(n), 1200) * 0.05 * (0.85 + 0.15 * np.sin(2 * np.pi * 0.07 * k)) + lp(noise(n), 300) * 0.03,
        "night": lambda: lp(noise(n), 400) * 0.012 + np.sin(2 * np.pi * 4200 * k) * 0.004 * (np.sin(2 * np.pi * 14 * k) > 0.6) * (np.sin(2 * np.pi * 0.5 * k) > 0),
        "quiet_room": lambda: lp(noise(n), 300) * 0.015,
    }
    if kind not in B:
        warnings.append(f"unknown bed {kind}, using room")
        kind = "room"
    return B[kind]()


# ============================ SFX library ============================
def whoosh(d=0.35, lo=300, hi=4000):
    n = int(d * SR)
    return bp(noise(n), lo, hi) * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.35


def thump(f=70, d=0.35):
    n = int(d * SR)
    k = np.arange(n) / SR
    fr = f * (1 + 1.5 * np.exp(-k / 0.03))
    return (np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(n, 0.002, 0.09) + hp(noise(n), 1500) * env(n, 0.001, 0.012) * 0.6) * 0.9


def gong(f=196, d=2.2):
    n = int(d * SR)
    k = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * m * k + m) * a for m, a in [(1, 1), (2.01, 0.5), (2.76, 0.35), (4.07, 0.2), (5.4, 0.12)])
    return x * env(n, 0.004, 0.7) * 0.32


def pop(f=900):
    n = int(0.09 * SR)
    k = np.arange(n) / SR
    return np.sin(2 * np.pi * f * (1 + 2 * k / 0.09) * k) * env(n, 0.002, 0.03) * 0.35


def ding(f=1320):
    n = int(1.0 * SR)
    k = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * k) + 0.4 * np.sin(2 * np.pi * f * 2.4 * k)) * env(n, 0.002, 0.25) * 0.22


def click():
    n = int(0.05 * SR)
    k = np.arange(n) / SR
    return hp(noise(n), 2000) * np.exp(-k / 0.006) * 0.25 + np.sin(2 * np.pi * 1800 * k) * np.exp(-k / 0.01) * 0.08


def slide(d=0.7):  # sliding door / drawer
    n = int(d * SR)
    return fade(bp(noise(n), 180, 1200) * 0.12 * np.sin(np.linspace(0, np.pi, n)) ** 0.7, 0.05, 0.15) + np.pad(thump(90, 0.2) * 0.25, (max(0, n - int(0.2 * SR)), 0))[:n]


def buzz(d=1.0):
    n = int(d * SR)
    k = np.arange(n) / SR
    return lp(np.sign(np.sin(2 * np.pi * 100 * k)) * 0.03 * (np.sin(2 * np.pi * 9 * k) > 0.1), 1500)


def power_down(d=0.9):
    n = int(d * SR)
    k = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(220 * np.exp(-k * 2.5)) / SR) * env(n, 0.01, d * 0.7) * 0.12


def rumble(d=2.0):
    n = int(d * SR)
    k = np.arange(n) / SR
    return (lp(noise(n), 120, 3) * 1.2 + np.sin(2 * np.pi * 42 * k) * 0.3) * np.sin(np.linspace(0, np.pi, n)) ** 1.5 * 0.5


def knock():  # two knuckle taps
    return np.concatenate([thump(150, 0.15) * 0.5, thump(140, 0.15) * 0.45])


def paper(d=0.4):
    n = int(d * SR)
    return fade(hp(noise(n), 2500) * 0.08 * (rng.random(n) > 0.4), 0.02, 0.1)


def cheer(d=2.2):
    n = int(d * SR)
    k = np.arange(n)
    voices = sum(np.sin(2 * np.pi * (f + 30 * np.sin(2 * np.pi * 0.7 * k / SR)) * k / SR) for f in [420, 530, 610, 700]) * 0.03
    return (bp(noise(n), 400, 3500) * 0.075 + voices) * np.minimum(1, k / (0.15 * SR)) * np.exp(-k / (1.2 * SR))


def meow():
    n = int(0.7 * SR)
    k = np.arange(n) / SR
    f = 600 + 300 * np.sin(np.pi * k / 0.7)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return bp(x, 400, 3000) * np.sin(np.pi * k / 0.7) ** 0.6 * 0.18


def horn(d=0.9):
    n = int(d * SR)
    k = np.arange(n) / SR
    return fade(lp(np.sign(np.sin(2 * np.pi * 220 * k)) * 0.5 + np.sign(np.sin(2 * np.pi * 277 * k)) * 0.5, 2200) * 0.22, 0.02, 0.15)


FX = {"whoosh": whoosh, "thump": thump, "gong": gong, "pop": pop, "ding": ding, "click": click, "slide": slide, "buzz": buzz,
      "power_down": power_down, "rumble": rumble, "knock": knock, "paper": paper, "cheer": cheer, "meow": meow, "horn": horn}
OVER_FX = {"stamp": ("thump", 0.12, 1.0), "tag": ("gong", 0.0, 0.8), "bubble": ("pop", 0.0, 0.7), "label": ("pop", 0.0, 0.7),
           "card": ("pop", 0.0, 0.8), "pin": ("pop", 0.0, 0.6), "title": ("thump", 0.02, 0.8), "score": ("ding", 0.0, 0.6), "arrow": ("whoosh", 0.0, 0.3)}


HAS_D = {"whoosh", "buzz", "power_down", "rumble", "paper", "cheer", "horn", "slide"}


def fx_call(name, d=None):
    if name not in FX:
        raise SystemExit(f"unknown fx {name}: {' '.join(FX)}")
    return FX[name](d) if d is not None and name in HAS_D else FX[name]()


# ============================ build ambience + sfx ============================
amb = np.zeros(N)
fx = np.zeros(N)
placed = []
key_fx = PLAN.get("keys", {})
for s in SHOTS:
    n = int((s["t1"] - s["t0"] + 0.12) * SR)
    kind = PLAN.get("beds", {}).get(s["set"], s["bed"])
    place(amb, fade(bed(kind, n), 0.06, 0.06), s["t0"], 1.0)
    if s["set"] == "solid" or s["tr"] in ("flash", "wipe"):
        place(fx, whoosh(0.3, 800, 6000), s["t0"] - 0.12, 0.7)
        placed.append(("whoosh", s["t0"] - 0.12, f"cut #{s['i']}"))
    for o in s["over"]:
        name, dt, g = OVER_FX[o["k"]]
        place(fx, FX[name](), o["t"] + dt, g)
        placed.append((name, o["t"] + dt, f"overlay {o['k']} #{s['i']}"))
    for c in s["reaches"]:
        place(fx, click(), c, 0.9)
        placed.append(("click", c, f"reach #{s['i']}"))
    for e in s["keys"]:
        spec = key_fx.get(e["key"])
        if spec is None:
            warnings.append(f"shot #{s['i']}: key '{e['key']}' has no sound in audio.json 'keys' (use \"none\" to silence)")
            continue
        if spec == "none":
            continue
        place(fx, FX[spec](), e["t"], 0.9)
        placed.append((spec, e["t"], f"key {e['key']} #{s['i']}"))
for a in PLAN.get("accents", []):
    t = tAt(a["at"])
    place(fx, fx_call(a["fx"], a.get("d")), t, a.get("g", 1.0))
    placed.append((a["fx"], t, "accent " + a["at"]))

# ============================ MUSIC ============================
M = PLAN.get("music", {})
BPM = float(M.get("bpm", 76))
if BPM > 80:
    raise SystemExit(f"music bpm {BPM} > 80 — house rule: soft and slow")
BEAT = 60 / BPM


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def kal(f, d=1.4, g=1.0):
    n = int(d * SR)
    k = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * k) + 0.18 * np.sin(2 * np.pi * 2 * f * k) * np.exp(-k / 0.15)
    return lp(x * env(n, 0.012, 0.45), 2400) * 0.10 * g


def bass(f, d):
    n = int(d * SR)
    return np.sin(2 * np.pi * f * np.arange(n) / SR) * env(n, 0.04, 0.9) * 0.07


def pad(f, d, g=1.0):
    n = int(d * SR)
    k = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * r * k + r) for r in [1, 1.5, 2.0, 1.004]) / 4
    return lp(fade(x * 0.035 * g, min(1.2, d / 3), min(1.5, d / 3)), 1500)


ROOTS = {"C": 60, "D": 62, "E": 64, "F": 65, "G": 67, "A": 69, "Bb": 70}
MAJ_P = [0, 2, 4, 7, 9, 12]
MIN_P = [0, 3, 5, 7, 10, 12]
# phrase patterns: index into the scale or None (rest). 8 beats each, never more than one note per beat
LIGHT = [[2, None, 3, None, 4, 3, None, None], [1, None, 2, None, 0, None, None, None], [2, None, 3, 4, 5, None, 4, None], [3, None, 1, None, 2, None, None, None]]
TENDER = [[0, None, None, 2, None, None, 1, None], [3, None, None, 2, None, None, None, None]]
BASS_STEPS = [-24, -27, -31, -29]
music = np.zeros(N)
notes_per_beat_max = 0
sections = M.get("sections", [{"from": "s1", "mood": "light", "key": "G"}])
bounds = [tAt(sc["from"]) - 0.2 if i else 0.4 for i, sc in enumerate(sections)] + [tAt(M["end"]["at"]) - 0.2 if "end" in M else CU["total"]]
for i, sc in enumerate(sections):
    a, b = bounds[i], bounds[i + 1]
    root = ROOTS[sc.get("key", "G")]
    mood = sc["mood"]
    t, ph = a, 0
    if mood == "light":
        while t < b - 0.5:
            for j, p in enumerate(LIGHT[ph % 4]):
                if t + j * BEAT >= b - 0.5:
                    break
                if p is not None:
                    place(music, kal(hz(root + MAJ_P[p])), t + j * BEAT)
            place(music, bass(hz(root + BASS_STEPS[ph % 4]), BEAT * 7), t)
            t += 8 * BEAT
            ph += 1
    elif mood == "tender":
        while t < b - 0.5:
            for j, p in enumerate(TENDER[ph % 2]):
                if t + j * BEAT >= b - 0.5:
                    break
                if p is not None:
                    place(music, kal(hz(root + MIN_P[p]), 1.6, 0.85), t + j * BEAT)
            place(music, pad(hz(root - 12 + [0, -4][ph % 2]), BEAT * 8, 0.7), t)
            t += 8 * BEAT
            ph += 1
    elif mood == "dark":
        for j, r in enumerate([-12, -16, -19, -17] * 20):
            tt = a + j * 3.4
            if tt >= b:
                break
            place(music, pad(hz(root + r), min(4.5, b - tt + 1.2)), tt)
    elif mood == "tense":
        while t < b - 0.3:
            place(music, pad(hz(root - 24), min(BEAT * 4 + 0.5, b - t + 0.5), 0.8), t)
            place(music, bass(hz(root - 24), 0.5) * 1.2, t)
            t += BEAT * 2
    elif mood == "silence":
        pass
    else:
        raise SystemExit(f"unknown mood {mood} (light|tender|dark|tense|silence)")
if "end" in M:
    te = bounds[-1]
    root = ROOTS[sections[-1].get("key", "G")]
    place(music, pad(hz(root - 12), CU["total"] - te + 3.0), te)
    for j, m in enumerate([0, 4, 9]):
        place(music, kal(hz(root + m), 2.5), te + 0.7 + j * 0.22, 1.1)

# ============================ mix + ducking ============================
v, vsr = sf.read(ROOT / "audio/voice.wav", always_2d=False)
if v.ndim > 1:
    v = v.mean(axis=1)
if vsr != SR:
    v = resample_poly(v, SR, vsr)
voice = np.zeros(N)
place(voice, v, 0.0)
ve = lp(np.abs(voice), 6)
ve = ve / (ve.max() + 1e-9)
duck = lp(1 - 0.7 * np.clip(ve * 4, 0, 1), 3)
on = ve > 0.15


def db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


TARGET = float(M.get("under_voice_db", 22.0))
if not 20 <= TARGET <= 24:
    raise SystemExit("music.under_voice_db must be within 20..24")
mus_raw = music * duck
gain = 10 ** ((db(voice[on]) - TARGET - db(mus_raw[on])) / 20) if np.any(mus_raw[on]) else 0.0
mus = mus_raw * gain
under_speaking = db(voice[on]) - db(mus[on]) if gain else 99.0
pauses = ~on & (T < CU["total"])
under_pauses = db(voice[on]) - db(mus[pauses]) if gain else 99.0
mix = voice + mus + amb * (0.55 + 0.45 * duck) + fx * 0.85
fo = int(0.8 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)
mix = mix / (np.abs(mix).max() + 1e-9) * 0.9
tmp = ROOT / "audio/mix_raw.wav"
sf.write(tmp, np.stack([mix, mix], axis=1), SR, subtype="PCM_24")
(ROOT / "public").mkdir(exist_ok=True)
out = ROOT / "public/mix.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-af", "loudnorm=I=-14:TP=-1.5:LRA=9", "-ar", str(SR), str(out)], check=True)
r = subprocess.run(["ffmpeg", "-i", str(out), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
summ = r.stderr[r.stderr.rfind("Summary"):]
lufs = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summ).group(1))
tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summ).group(1))
sha = lambda p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest()[:16]
report = {
    "bpm": BPM, "under_voice_db_speaking": round(under_speaking, 1), "under_voice_db_pauses": round(under_pauses, 1),
    "lufs": lufs, "true_peak": tp, "duration": round(DUR, 2), "sections": sections,
    "sfx": [{"fx": f, "t": round(t, 2), "why": w} for f, t, w in sorted(placed, key=lambda x: x[1])],
    "warnings": warnings, "inputs": {"voice": sha("audio/voice.wav"), "shots": sha("qa/shots.json"), "plan": sha("audio.json")},
}
(ROOT / "qa").mkdir(exist_ok=True)
(ROOT / "qa/mix_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
print(f"music {BPM:.0f} BPM, {under_speaking:.1f} dB under voice while speaking ({under_pauses:.1f} dB in pauses)")
print(f"loudness {lufs} LUFS, true peak {tp} dBFS, {len(placed)} sfx, {len(warnings)} warnings")
for w in warnings:
    print("WARN", w)
print("mix ->", out)
