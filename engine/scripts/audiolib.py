"""Shared DSP + measurement for the mix/master standard (sv-42-mix-master). Pure numpy/scipy, 48 kHz.

Measurement follows ITU-R BS.1770-4 / EBU R128: K-weighting, momentary 400 ms, short-term 3 s,
integrated with -70 LUFS absolute and -10 LU relative gates, LRA (10-95 % of gated short-term),
true peak on 4x oversampled signal. audio_qa.py cross-checks integrated loudness against ffmpeg ebur128.
"""
from __future__ import annotations

import numpy as np
from scipy.signal import lfilter, resample_poly, sosfilt, butter

SR = 48000


# ------------------------------------------------------------------ filters
def biquad(x, b, a):
    return lfilter(b, a, x, axis=0)


def peq(f0, gain_db, q=1.0, sr=SR):
    """RBJ peaking EQ -> (b, a)"""
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / sr; al = np.sin(w) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w), 1 - al * A]); a = np.array([1 + al / A, -2 * np.cos(w), 1 - al / A])
    return b / a[0], a / a[0]


def shelf(f0, gain_db, high=True, sr=SR):
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / sr; al = np.sin(w) / 2 * np.sqrt(2); c = np.cos(w); s = 2 * np.sqrt(A) * al
    if high:
        b = [A * ((A + 1) + (A - 1) * c + s), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - s)]
        a = [(A + 1) - (A - 1) * c + s, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - s]
    else:
        b = [A * ((A + 1) - (A - 1) * c + s), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - s)]
        a = [(A + 1) + (A - 1) * c + s, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - s]
    b, a = np.array(b), np.array(a)
    return b / a[0], a / a[0]


def hpf(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x, axis=0)


def lpf(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x, axis=0)


def band(x, lo, hi):
    return sosfilt(butter(4, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


# ------------------------------------------------------------------ dynamics
def follower(x, attack_ms, release_ms):
    """peak envelope follower on |x| (mono)"""
    a = np.exp(-1 / (SR * attack_ms / 1000)); r = np.exp(-1 / (SR * release_ms / 1000))
    e = np.abs(x); out = np.empty_like(e); v = 0.0
    # vectorised enough: process in python only on a decimated grid, then interpolate
    step = 48
    ed = e[: len(e) // step * step].reshape(-1, step).max(1)
    a2, r2 = a ** step, r ** step
    od = np.empty_like(ed)
    for i, s in enumerate(ed):
        v = a2 * v + (1 - a2) * s if s > v else r2 * v + (1 - r2) * s
        od[i] = v
    out[: len(od) * step] = np.repeat(od, step)
    out[len(od) * step:] = od[-1] if len(od) else 0
    return out


def compress(x, thresh_db, ratio, attack_ms=10, release_ms=120, makeup_db=0.0, knee_db=6.0):
    mono = x if x.ndim == 1 else x.mean(1)
    env = follower(mono, attack_ms, release_ms)
    lvl = 20 * np.log10(env + 1e-9)
    over = lvl - thresh_db
    gr = np.where(over <= -knee_db / 2, 0.0,
                  np.where(over >= knee_db / 2, over * (1 - 1 / ratio), (1 - 1 / ratio) * (over + knee_db / 2) ** 2 / (2 * knee_db)))
    g = 10 ** ((makeup_db - gr) / 20)
    return (x * g if x.ndim == 1 else x * g[:, None]), gr


def deess(x, f_lo=5500, f_hi=9500, thresh_db=-30, max_cut_db=6):
    s = band(x, f_lo, f_hi)
    env = 20 * np.log10(follower(s, 1, 60) + 1e-9)
    cut = np.clip(env - thresh_db, 0, max_cut_db)
    return x - s * (1 - 10 ** (-cut / 20))


def true_peak_limit(x, ceiling_db=-1.2, lookahead_ms=5, release_ms=80):
    """stereo lookahead limiter on 4x-oversampled peak -> output true peak <= ceiling (checked after)"""
    c = 10 ** (ceiling_db / 20)
    up = np.abs(resample_poly(x, 4, 1, axis=0)).max(1)
    pk = up[: len(up) // 4 * 4].reshape(-1, 4).max(1)
    pk = np.pad(pk, (0, len(x) - len(pk)))
    need = np.minimum(1, c / (pk + 1e-12))
    la = int(SR * lookahead_ms / 1000)
    # look ahead: minimum gain over the next `la` samples
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * la + 1, origin=0)
    r = np.exp(-1 / (SR * release_ms / 1000))
    # smooth recovery (attack instant thanks to look-ahead window)
    step = 16
    gd = g[: len(g) // step * step].reshape(-1, step).min(1)
    out = np.empty_like(gd); v = 1.0; r2 = r ** step
    for i, s in enumerate(gd):
        v = s if s < v else r2 * v + (1 - r2) * s
        out[i] = v
    gg = np.ones(len(x)); gg[: len(out) * step] = np.repeat(out, step)
    gg = np.minimum(gg, g)
    return x * gg[:, None], 20 * np.log10(gg.min() + 1e-12)


# ------------------------------------------------------------------ loudness (BS.1770)
def k_weight(x):
    # stage 1 high shelf, stage 2 RLB high-pass (coefficients for 48 kHz from BS.1770)
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]; a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)


def _blocks(x, win, hop):
    y = k_weight(x if x.ndim == 2 else x[:, None])
    p = (y ** 2).sum(1)
    c = np.concatenate([[0], np.cumsum(p)])
    n = int(win * SR); h = int(hop * SR)
    starts = np.arange(0, max(1, len(p) - n + 1), h)
    ms = (c[starts + n] - c[starts]) / n if len(p) >= n else np.array([p.mean()])
    return starts / SR, ms


def lufs_of(ms):
    return -0.691 + 10 * np.log10(ms + 1e-15)


def momentary(x):
    t, ms = _blocks(x, 0.4, 0.1)
    return t + 0.4, lufs_of(ms)


def short_term(x, hop=0.1):
    t, ms = _blocks(x, 3.0, hop)
    return t + 3.0, lufs_of(ms)


def integrated(x):
    _, ms = _blocks(x, 0.4, 0.1)
    l = lufs_of(ms)
    g = ms[l > -70]
    if not len(g):
        return -99.0
    rel = lufs_of(g.mean()) - 10
    g2 = ms[(l > -70) & (l > rel)]
    return float(lufs_of(g2.mean()))


def lra(x):
    _, ms = _blocks(x, 3.0, 0.1)
    l = lufs_of(ms)
    g = l[l > -70]
    if not len(g):
        return 0.0
    rel = lufs_of(10 ** ((g + 0.691) / 10).mean()) - 20
    g = np.sort(g[g > rel])
    return float(g[int(0.95 * (len(g) - 1))] - g[int(0.10 * (len(g) - 1))]) if len(g) > 2 else 0.0


def true_peak(x):
    up = resample_poly(x if x.ndim == 2 else x[:, None], 4, 1, axis=0)
    return float(20 * np.log10(np.abs(up).max() + 1e-12))


def rms_db(x):
    return float(20 * np.log10(np.sqrt(np.mean(np.asarray(x) ** 2)) + 1e-12))


def band_energy_db(x, edges):
    """long-term spectrum -> relative dB per band (sum over bands = 0 dB total)"""
    m = x if x.ndim == 1 else x.mean(1)
    n = 8192
    if len(m) < n:
        m = np.pad(m, (0, n - len(m)))
    frames = m[: len(m) // n * n].reshape(-1, n) * np.hanning(n)
    P = (np.abs(np.fft.rfft(frames, axis=1)) ** 2).mean(0)
    f = np.fft.rfftfreq(n, 1 / SR)
    tot = P[(f >= 20) & (f <= 20000)].sum() + 1e-20
    return {k: float(10 * np.log10(P[(f >= lo) & (f < hi)].sum() / tot + 1e-20)) for k, (lo, hi) in edges.items()}


def spectrum_db(x, n=8192):
    m = x if x.ndim == 1 else x.mean(1)
    if len(m) < n:
        m = np.pad(m, (0, n - len(m)))
    frames = m[: len(m) // n * n].reshape(-1, n) * np.hanning(n)
    P = (np.abs(np.fft.rfft(frames, axis=1)) ** 2).mean(0)
    return np.fft.rfftfreq(n, 1 / SR), 10 * np.log10(P + 1e-20)


# ------------------------------------------------------------------ voice clean-up (voice chain v2, 2026-11-16)
def spectral_denoise(x, max_red_db=18.0, over=1.6, quiet_pct=8):
    """stationary noise reduction for TTS output: noise profile = median spectrum of the quietest frames,
    gain smoothed over time and frequency (no 'musical noise'), at most max_red_db of cut."""
    import librosa
    from scipy.ndimage import uniform_filter
    S = librosa.stft(x, n_fft=2048, hop_length=256)
    M = np.abs(S)
    fr = 20 * np.log10(M.mean(0) + 1e-9)
    q = fr <= np.percentile(fr[fr > -150] if np.any(fr > -150) else fr, quiet_pct)
    q &= fr > -150                                  # ignore digital silence (zero padding)
    if q.sum() < 4:
        return x
    noise = np.median(M[:, q], axis=1, keepdims=True)
    snr = 20 * np.log10(M / (noise * over + 1e-12) + 1e-12)
    g = uniform_filter(np.clip(snr / 10, 0, 1), size=(7, 5))
    g = 10 ** (-max_red_db * (1 - g) / 20)
    return librosa.istft(S * g, hop_length=256, length=len(x))


def expander(x, thresh_below_peak_db=-28.0, ratio=4.0, floor_db=-40.0, release=0.85):
    """downward expander on 10 ms RMS: shortens the codec's reverb-like tail between words.
    Opens at once (20 ms look-ahead, never clips an onset), closes over ~60 ms."""
    win = SR // 100
    n = len(x) // win
    env = 20 * np.log10(np.sqrt((x[: n * win].reshape(n, win) ** 2).mean(1)) + 1e-12)
    ref = np.percentile(env[env > -120], 95) if np.any(env > -120) else 0.0
    under = np.clip(ref + thresh_below_peak_db - env, 0, None)
    gd = np.maximum(-under * (ratio - 1), floor_db)
    out = np.empty_like(gd); v = 0.0
    for i, s in enumerate(gd):
        v = s if s > v else release * v + (1 - release) * s
        out[i] = v
    out = np.maximum(out, np.concatenate([out[2:], [out[-1]] * 2]))
    gain = np.interp(np.arange(len(x)), np.arange(n) * win + win / 2, 10 ** (out / 20))
    return x * gain


MIX_SPEECH_RMS_DB = -16.0   # speech RMS of the voice stem in a finished -14 LUFS master (measured on 5 episodes)


# ------------------------------------------------------------------ voice bus (shared by mix.py and voice.py / G3)
def speech_mask(words, n):
    m = np.zeros(n, bool)
    for w in words:
        m[int(w["s"] * SR):int(w["e"] * SR)] = True
    return m


def voice_chain(voice, pv, words, seg_bounds):
    """House voice chain v2 (mix_targets 1.1 processing.voice). voice: mono 48 kHz. Returns (voice, info).
    The same function runs in mix.py (G6) and at the end of voice.py (G3), so G3 measures what G6 will hear."""
    voice = hpf(voice, pv["hpf_hz"], 4)
    dn = pv["denoise"]
    voice = spectral_denoise(voice, dn["max_reduction_db"], dn["over_subtract"])
    voice = biquad(voice, *peq(*pv["mud_cut"]))
    voice = biquad(voice, *peq(*pv["presence"]))
    voice = biquad(voice, *shelf(*pv["air_shelf"], high=True))
    voice = lpf(voice, pv["lpf_hz"], 4)
    voice = deess(voice, *pv["deess"]["band"], pv["deess"]["thresh_db"], pv["deess"]["max_cut_db"])
    c = pv["comp"]
    voice, comp_gr = compress(voice, c["thresh_db"], c["ratio"], c["attack_ms"], c["release_ms"], knee_db=c.get("knee_db", 6.0))
    seg_lufs = {}
    for k, a, b in seg_bounds:
        chunk = voice[int(a * SR):int(b * SR)]
        if len(chunk) > SR * 0.5:
            seg_lufs[k] = integrated(chunk)
    med = float(np.median(list(seg_lufs.values()))) if seg_lufs else 0.0
    lv = np.ones(len(voice))
    for k, a, b in seg_bounds:
        if k in seg_lufs:
            lv[int(a * SR):int(b * SR)] = 10 ** (np.clip(med - seg_lufs[k], -pv["segment_level_clamp_db"], pv["segment_level_clamp_db"]) / 20)
    bl, al = butter(2, 2 / (SR / 2), "low")
    voice = voice * lfilter(bl, al, lv)
    ex = pv["expander"]   # after compression + levelling: nothing later can lift the tails back up
    voice = expander(voice, ex["thresh_below_peak_db"], ex["ratio"], ex["floor_db"], ex["release"])
    speak = speech_mask(words, len(voice))
    # voice peak limit, last stage: plosive/onset spikes sit 20+ dB over the speech level after the expander
    pk = pv["peak_limit"]
    v_rms = float(np.sqrt(np.mean(voice[speak] ** 2))) if speak.any() else 0.1
    voice, pk_gr = true_peak_limit(voice[:, None], 20 * np.log10(v_rms + 1e-12) + pk["crest_db"], pk["lookahead_ms"], pk["release_ms"])
    return voice[:, 0], {"comp_gr": comp_gr, "pk_gr": pk_gr, "seg_lufs": seg_lufs, "med": med, "speak": speak}


def between_words_db(voice, speak):
    """noise + codec reverb tail between words: 10 ms frames that are not speech and not digital silence;
    the quietest quarter (p25) relative to the speech level. p25, not the median: whisper word ends are early,
    so many "gap" frames still hold speech. -99 when there are too few gap frames to measure."""
    h = SR // 100
    nfr = len(voice) // h
    if nfr == 0 or not speak.any():
        return -99.0
    fr_db = 20 * np.log10(np.sqrt((voice[: nfr * h].reshape(nfr, h) ** 2).mean(1)) + 1e-12)
    fr_sp = speak[: nfr * h].reshape(nfr, h).any(1)
    gap = ~fr_sp & (fr_db > -120)
    return float(np.percentile(fr_db[gap], 25)) - rms_db(voice[speak]) if gap.sum() > 20 else -99.0
