"""Series theme music (sv-40-audio): one theme shared by every episode, generated to the exact length needed.

The music is not stored as audio. This file is the theme: the same notes, instruments and seed always give
the same sound, so git holds about 5 KB of code instead of a long WAV, and every episode gets music that
starts on the melody at 0 s, loops seamlessly, and resolves on the tonic exactly where the story ends.

Theme "Pizzicato tò mò" v2 (chosen by the user 2026-11-15):
D minor, 118 BPM, i-VI-iv-V (Dm Bb Gm A). Kalimba melody, music-box doubling, a soft round bass pulsing on every
beat ("tưng tưng"), a very quiet shaker on the off-beats, and a low pad.

Use
  python3 scripts/theme.py --sec 75 [--end 71.2] [--out audio/theme.wav]     preview / standalone
  mix.py imports render(seconds, end_at) when audio.json has  "music": {"theme": "series", ...}
"""
from __future__ import annotations

import argparse

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
BPM = 118
BEAT = 60 / BPM
BAR = 4 * BEAT
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

# 4-bar phrases (beats). A = theme, B = answer. Order loops A A B A.
A = ("D5:.5 r:.5 F5:.5 r:.5 A5:.5 r:.5 G5:.5 F5:.5 "
     "D5:.5 r:.5 F5:.5 r:.5 Bb5:1 r:1 "
     "G5:.5 r:.5 F5:.5 E5:.5 D5:.5 r:.5 Bb4:.5 r:.5 "
     "C#5:.5 r:.5 E5:.5 r:.5 A4:1 r:1")
B = ("A5:.5 r:.5 G5:.5 r:.5 F5:.5 r:.5 E5:.5 F5:.5 "
     "D5:.5 r:.5 r:.5 F5:.5 Bb5:.5 r:.5 A5:.5 r:.5 "
     "G5:.5 r:.5 Bb5:.5 r:.5 D6:.5 r:.5 C6:.5 Bb5:.5 "
     "A5:.5 r:.5 G5:.5 r:.5 E5:.5 r:.5 C#5:1")
ORDER = [A, A, B, A]
ROOTS = ["D2", "Bb1", "G1", "A1"]
CHORDS = [["D3", "F3", "A3"], ["D3", "F3", "Bb3"], ["D3", "G3", "Bb3"], ["C#3", "E3", "A3"]]
FINAL = "D5:1 F5:1 A5:2"          # resolution bar on the tonic


def midi(n: str) -> int:
    p = NOTE[n[0]]
    i = 1
    while n[i] in "#b":
        p += 1 if n[i] == "#" else -1
        i += 1
    return p + 12 * (int(n[i:]) + 1)


def hz(x: float) -> float:
    return 440 * 2 ** ((x - 69) / 12)


def lp(x, f, o=2):
    return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)


def hp(x, f, o=2):
    return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)


def kalimba(f, dur=1.2):
    t = np.arange(int(SR * dur)) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 4.5) + 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 30)
    return lp(x * np.minimum(1, t / 0.004), 3500)


def musicbox(f, dur=1.4):
    t = np.arange(int(SR * dur)) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.5) + 0.3 * np.sin(2 * np.pi * f * 4.2 * t) * np.exp(-t * 14)
    return lp(x * np.minimum(1, t / 0.002), 6000)


def softbass(f, dur=0.5):
    t = np.arange(int(SR * dur)) / SR
    x = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) * np.exp(-t * 12)) * np.exp(-t * 7)
    return x * np.minimum(1, t / 0.008)


def pad(fs, dur):
    t = np.arange(int(SR * dur)) / SR
    x = np.zeros_like(t)
    for f in fs:
        for d in (-0.15, 0.15):
            x += 2 * ((t * (f + d)) % 1) - 1
    x = lp(x, 900, 2)
    a = min(0.6, dur / 3)
    return x * np.minimum(1, np.minimum(t / a, (dur - t) / a)) / len(fs)


def render(seconds: float, end_at: float | None = None, seed: int = 7) -> np.ndarray:
    """Stereo float array, `seconds` long. Melody starts at 0 s. If end_at is given, the music plays phrases
    until the bar line at/after end_at, then a tonic resolution bar rings out; silence after that."""
    rng = np.random.default_rng(seed)
    L = int(SR * seconds)
    out = np.zeros((L + SR * 4, 2))

    def put(sig, t, g, pan=0.0):
        i = int(t * SR)
        if i >= len(out):
            return
        sig = sig[: len(out) - i]
        out[i:i + len(sig), 0] += sig * g * np.sqrt(0.5 - pan / 2)
        out[i:i + len(sig), 1] += sig * g * np.sqrt(0.5 + pan / 2)

    def seq(line, t0, inst, g, pan):
        pos = 0.0
        for tok in line.split():
            n, d = tok.split(":")
            if n != "r":
                vel = 1.0 if pos % 1 < 1e-6 else 0.78
                put(inst(hz(midi(n))), t0 + pos * BEAT, g * vel, pan)
            pos += float(d)

    stop = seconds if end_at is None else end_at
    n_bars = int(np.ceil(stop / BAR))
    if end_at is None:
        n_bars += 1
    for bar in range(n_bars):
        t = bar * BAR
        k = bar % 4
        for j, o in enumerate([0, 7, 12, 7]):
            put(softbass(hz(midi(ROOTS[k]) + o)), t + j * BEAT, 0.9 if j == 0 else 0.68, -0.15)
        for j in range(4):
            nz = hp(rng.standard_normal(int(SR * 0.05)), 6000) * np.exp(-np.arange(int(SR * 0.05)) / (SR * 0.012))
            put(nz, t + (j + 0.5) * BEAT, 0.03, 0.4)
        put(pad([hz(midi(c)) for c in CHORDS[k]], BAR), t, 0.045)
        if k == 0:
            phrase = ORDER[(bar // 4) % len(ORDER)]
            cycle = bar // 4
            seq(phrase, t, kalimba, 0.5, 0.2)
            if cycle % 2 == 1:
                seq(phrase, t, musicbox, 0.2, -0.3)
    if end_at is not None:
        t = n_bars * BAR
        seq(FINAL, t, kalimba, 0.55, 0.2)
        seq(FINAL, t, musicbox, 0.22, -0.3)
        put(softbass(hz(midi("D2")), 2.5), t, 0.9, -0.15)
        put(pad([hz(midi(c)) for c in ["D3", "F3", "A3"]], 3.5), t, 0.05)

    n = int(SR * 2.2)
    tt = np.arange(n) / SR
    ir = np.stack([lp(rng.standard_normal(n), 6000) * np.exp(-tt * 3.1) for _ in range(2)], 1)
    rev = np.stack([fftconvolve(out[:, c], ir[:, c])[: len(out)] for c in range(2)], 1)
    rev *= np.max(np.abs(out)) / (np.max(np.abs(rev)) + 1e-9)
    x = out + 0.3 * rev
    x = np.stack([hp(x[:, c], 45) for c in range(2)], 1)[:L]
    if end_at is None:
        f = int(SR * 1.5)
        x[-f:] *= np.linspace(1, 0, f)[:, None] ** 2
    x *= 10 ** (-18 / 20) / (np.sqrt(np.mean(x ** 2)) + 1e-12)
    pk = np.max(np.abs(x))
    return x / pk * 0.89 if pk > 0.89 else x


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--sec", type=float, default=60)
    ap.add_argument("--end", type=float, default=None, help="story end (s): resolve on the tonic after this bar")
    ap.add_argument("--out", default="audio/theme.wav")
    a = ap.parse_args()
    import soundfile as sf
    sf.write(a.out, render(a.sec, a.end), SR)
    print(f"theme {BPM} BPM -> {a.out} ({a.sec:.1f} s)")
