"""Measure a mix (or a delivered video) against the house standard scripts/mix_targets.json (sv-42-mix-master).

  python scripts/audio_qa.py                  measure public/mix.wav + audio/stems/*  -> qa/audio_qa.json, qa/mix/overview.png,
                                              qa/mix/segments.png (merged into qa/mix_report.json as "qa")
  python scripts/audio_qa.py --video F.mp4    measure the audio inside a rendered video against the mix -> qa/video_audio.json
                                              (loudness drift after AAC, true peak, A/V duration, sync offset by cross-correlation)
Exit 1 when any check fails. Every number is in the JSON; the PNGs are the evidence the reviewer must open.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audiolib as A  # noqa: E402

ROOT = Path.cwd()
SR = A.SR
TG = json.loads((Path(__file__).resolve().parent / "mix_targets.json").read_text())


def check(results, group, name, value):
    lo, hi = TG[group][name]
    ok = bool(lo <= value <= hi)
    results.append({"group": group, "check": name, "value": round(float(value), 2), "range": [lo, hi], "ok": ok})
    return ok


def font(sz):
    for f in ["/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc", "/Library/Fonts/Arial.ttf"]:
        try:
            return ImageFont.truetype(f, sz)
        except OSError:
            pass
    return ImageFont.load_default()


def ffmpeg_lufs(path):
    r = subprocess.run(["ffmpeg", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    s = r.stderr[r.stderr.rfind("Summary"):]
    import re
    return float(re.search(r"I:\s+(-?[\d.]+) LUFS", s).group(1))


def windows_db(x, mask, win=1.0):
    """rms dB per window where mask is mostly true; returns times, values (nan elsewhere)"""
    n = int(win * SR)
    k = len(x) // n
    t = (np.arange(k) + 0.5) * win
    v = np.full(k, np.nan)
    for i in range(k):
        m = mask[i * n:(i + 1) * n]
        if m.mean() > 0.5:
            v[i] = A.rms_db(x[i * n:(i + 1) * n][m])
    return t, v


# ======================================================================== mix mode
def measure_mix():
    master, _ = sf.read(ROOT / "public/mix.wav", always_2d=True)
    stems = {k: sf.read(ROOT / f"audio/stems/{k}.wav", always_2d=True)[0] for k in ["voice", "music", "sfx", "ambience"]}
    n = len(master)
    for k in stems:
        stems[k] = np.pad(stems[k], ((0, max(0, n - len(stems[k]))), (0, 0)))[:n]
    words = json.loads((ROOT / "src/words.json").read_text())
    cues = json.loads((ROOT / "src/cues.json").read_text())
    mono = {k: v.mean(1) for k, v in stems.items()}
    T = np.arange(n) / SR
    speak = np.zeros(n, bool)
    for w in words:
        speak[int(w["s"] * SR):int(w["e"] * SR)] = True
    # pauses = gaps >= 0.6 s between words, inside the story
    pause = np.zeros(n, bool)
    ws = sorted(words, key=lambda w: w["s"])
    for a, b in zip(ws, ws[1:]):
        if b["s"] - a["e"] >= 0.6:   # real breaths/beats only; music swells there
            pause[int((a["e"] + 0.25) * SR):int((b["s"] - 0.05) * SR)] = True
    last_word = ws[-1]["e"] if ws else n / SR
    R = []

    # ---- master
    check(R, "master", "integrated_lufs", A.integrated(master))
    check(R, "master", "true_peak_dbtp", A.true_peak(master))
    check(R, "master", "lra_lu", A.lra(master))
    ts, st_l = A.short_term(master)
    check(R, "master", "max_short_term_lufs", st_l.max())
    check(R, "master", "clipped_samples", int((np.abs(master) >= 0.9999).sum()))
    check(R, "master", "dc_offset", float(master.mean()))
    lvl = np.abs(master).max(1)
    first = np.argmax(lvl > 10 ** (-50 / 20)) / SR
    check(R, "master", "head_silence_s", first)
    tm, mom = A.momentary(master)
    after = (tm > last_word)
    quiet = np.where(after & (mom < -60))[0]
    tail = (tm[quiet[0]] - last_word) if len(quiet) else (n / SR - last_word)
    check(R, "master", "tail_fade_s", tail)

    # ---- voice
    segs = sorted(cues["seg_starts"].items(), key=lambda kv: kv[1])
    seg_rows = []
    for i, (k, a) in enumerate(segs):
        b = segs[i + 1][1] if i + 1 < len(segs) else cues["total"]
        sl = slice(int(a * SR), int(b * SR))
        on = speak[sl]
        row = {"seg": k, "from": round(a, 2), "to": round(b, 2)}
        if (b - a) >= 1.0 and on.any():
            row["voice_lufs"] = round(A.integrated(stems["voice"][sl]), 1)
            row["music_under_voice_db"] = round(A.rms_db(mono["voice"][sl][on]) - A.rms_db(mono["music"][sl][on]), 1) if np.any(mono["music"][sl][on]) else None
            row["master_lufs"] = round(A.integrated(master[sl]), 1)
        seg_rows.append(row)
    vl = [r["voice_lufs"] for r in seg_rows if "voice_lufs" in r]
    check(R, "voice", "segment_spread_lu", max(vl) - min(vl) if vl else 0)
    tvm, vmom = A.momentary(stems["voice"])
    sp_at = speak[np.clip((tvm * SR).astype(int) - int(0.2 * SR), 0, n - 1)]
    vv = vmom[sp_at & (vmom > -60)]
    check(R, "voice", "speech_short_term_p10_p90_lu", np.percentile(vv, 90) - np.percentile(vv, 10) if len(vv) else 0)
    vsp = mono["voice"][speak]
    check(R, "voice", "sibilance_ratio_db", A.rms_db(A.band(vsp, 5500, 9500)) - A.rms_db(vsp))
    # noise + codec reverb tail between words (what the user heard as "noise, eco"): 10 ms frames of the voice stem
    # that are not speech and not digital silence; the quietest quarter (p25) relative to the speech level.
    # p25, not the median: whisper word ends are early, so many "gap" frames still hold speech.
    h = SR // 100
    nfr = len(mono["voice"]) // h
    fr_db = 20 * np.log10(np.sqrt((mono["voice"][: nfr * h].reshape(nfr, h) ** 2).mean(1)) + 1e-12)
    fr_sp = speak[: nfr * h].reshape(nfr, h).any(1)
    gap = ~fr_sp & (fr_db > -120)
    check(R, "voice", "between_words_db", (float(np.percentile(fr_db[gap], 25)) - A.rms_db(vsp)) if gap.sum() > 20 else -99.0)

    # ---- music vs voice
    has_music = np.any(mono["music"][speak])
    if has_music:
        check(R, "music", "under_voice_speaking_db", A.rms_db(mono["voice"][speak]) - A.rms_db(mono["music"][speak]))
        pause &= np.abs(mono["music"]) > 0          # planned silence sections are not pauses
        if pause.sum() / SR >= 2.0:                  # continuous narration has no real pauses: nothing to measure
            check(R, "music", "under_voice_pauses_db", A.rms_db(mono["voice"][speak]) - A.rms_db(mono["music"][pause]))
        else:
            R.append({"group": "music", "check": "under_voice_pauses_db", "value": round(pause.sum() / SR, 2),
                      "range": "skipped: < 2 s of pauses >= 0.6 s", "ok": True})
        check(R, "music", "presence_masking_db", A.rms_db(A.band(mono["music"][speak], 1000, 4000)) - A.rms_db(A.band(mono["voice"][speak], 1000, 4000)))
        tw, vw = windows_db(mono["voice"], speak)
        _, mw = windows_db(mono["music"], speak)
        diff = vw - mw
        check(R, "music", "max_under_voice_window_db", np.nanmin(diff) if np.isfinite(diff).any() else 99)
    else:
        tw, diff = np.array([0.0]), np.array([np.nan])

    # ---- sfx
    if np.any(mono["sfx"]):
        _, smom = A.momentary(stems["sfx"])
        check(R, "sfx", "peak_over_voice_db", smom.max() - np.median(vv) if len(vv) else 0)

    # ---- spectrum
    edges = {"sub_20_60": (20, 60), "low_60_250": (60, 250), "lowmid_250_2k": (250, 2000), "presence_2k_5k": (2000, 5000), "air_5k_16k": (5000, 16000)}
    bands = A.band_energy_db(master[: int(min(n, last_word * SR))], edges)
    for k, v in bands.items():
        check(R, "spectrum_bands", k, v)

    fails = [r for r in R if not r["ok"]]
    out = {"targets_version": TG["version"], "checks": R, "fails": len(fails), "segments": seg_rows,
           "evidence": ["qa/mix/overview.png", "qa/mix/segments.png"]}
    (ROOT / "qa/mix").mkdir(parents=True, exist_ok=True)
    plot_overview(master, mono, T, ts, st_l, tvm, vmom, tw, diff, cues, bands, R, last_word)
    plot_segments(seg_rows)
    (ROOT / "qa/audio_qa.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    mr = ROOT / "qa/mix_report.json"
    if mr.exists():
        rep = json.loads(mr.read_text())
        rep["qa"] = {"fails": len(fails), "checks": R, "evidence": out["evidence"]}
        mr.write_text(json.dumps(rep, ensure_ascii=False, indent=1))
    for r in R:
        print(("ok  " if r["ok"] else "FAIL"), f"{r['group']:15s} {r['check']:30s} {r['value']:>8}  in {r['range']}")
    print(f"audio_qa: {len(R) - len(fails)}/{len(R)} checks pass  -> qa/mix/overview.png qa/mix/segments.png")
    return len(fails)


# ======================================================================== plots
W = 1800
COL = {"master": (40, 40, 40), "voice": (30, 90, 200), "music": (210, 120, 20), "sfx": (60, 160, 90), "band": (225, 240, 225), "bad": (210, 40, 40)}


def panel(d, y0, h, title):
    d.rectangle([60, y0, W - 20, y0 + h], outline=(180, 180, 180))
    d.text((64, y0 + 4), title, fill=(0, 0, 0), font=font(18))


def plot_overview(master, mono, T, ts, st_l, tvm, vmom, tw, diff, cues, bands, R, last_word):
    H = 1500
    im = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(im)
    dur = len(T) / SR
    X = lambda t: 60 + (W - 80) * t / dur  # noqa: E731
    fails = [r for r in R if not r["ok"]]
    d.text((60, 10), f"MIX QA · standard v{TG['version']} · {len(R) - len(fails)}/{len(R)} pass" + (" · FAIL: " + ", ".join(r["check"] for r in fails) if fails else ""),
           fill=COL["bad"] if fails else (0, 120, 0), font=font(24))
    # 1 waveform
    y0, h = 50, 200
    panel(d, y0, h, "waveform (master) + segment starts")
    m = master.max(1) if master.ndim == 2 else master
    px = W - 80
    step = max(1, len(m) // px)
    mm = np.abs(master).max(1)[: step * px].reshape(px, step)
    mx = mm.max(1)
    for i, v in enumerate(mx):
        x = 60 + i
        d.line([x, y0 + h / 2 - v * h / 2, x, y0 + h / 2 + v * h / 2], fill=COL["master"])
    for k, a in cues["seg_starts"].items():
        d.line([X(a), y0, X(a), y0 + h], fill=(150, 150, 255))
        d.text((X(a) + 2, y0 + h - 18), k, fill=(80, 80, 200), font=font(12))
    d.line([X(last_word), y0, X(last_word), y0 + h], fill=COL["bad"])
    # 2 loudness
    y0, h = 280, 300
    panel(d, y0, h, "loudness: master short-term (black) · voice momentary (blue) · music momentary (orange) · LUFS")
    Y = lambda l: y0 + h - (np.clip(l, -50, -5) + 50) / 45 * h  # noqa: E731
    for l in (-10, -14, -20, -30, -40):
        d.line([60, Y(l), W - 20, Y(l)], fill=(230, 230, 230) if l != -14 else (120, 200, 120))
        d.text((20, Y(l) - 8), str(l), fill=(100, 100, 100), font=font(12))
    for t, l, c in [(*A.momentary(np.stack([mono["music"]] * 2, 1)), COL["music"]), (tvm, vmom, COL["voice"]), (ts, st_l, COL["master"])]:
        pts = [(X(tt), Y(ll)) for tt, ll in zip(t[::3], l[::3])]
        d.line(pts, fill=c, width=2)
    # 3 music under voice
    y0, h = 610, 220
    lo, hi = TG["music"]["under_voice_speaking_db"]
    floor = TG["music"]["max_under_voice_window_db"][0]
    panel(d, y0, h, f"voice minus music while speaking, 1 s windows (target {lo}-{hi} dB, never below {floor})")
    Y2 = lambda v: y0 + h - (np.clip(v, 0, 30)) / 30 * h  # noqa: E731
    d.rectangle([60, Y2(hi), W - 20, Y2(lo)], fill=COL["band"])
    d.line([60, Y2(floor), W - 20, Y2(floor)], fill=COL["bad"])
    for v in (0, 10, 20, 30):
        d.text((20, Y2(v) - 8), str(v), fill=(100, 100, 100), font=font(12))
    for t, v in zip(tw, diff):
        if np.isfinite(v):
            c = COL["bad"] if v < floor else COL["music"]
            d.ellipse([X(t) - 3, Y2(v) - 3, X(t) + 3, Y2(v) + 3], fill=c)
    # 4 spectrum
    y0, h = 860, 300
    panel(d, y0, h, "long-term spectrum: master (black) · voice (blue) · music (orange) · band windows (green = in range)")
    fx = lambda f: 60 + (W - 80) * (np.log10(f) - np.log10(20)) / (np.log10(20000) - np.log10(20))  # noqa: E731
    for f in (50, 100, 250, 500, 1000, 2000, 5000, 10000):
        d.line([fx(f), y0, fx(f), y0 + h], fill=(235, 235, 235))
        d.text((fx(f) + 2, y0 + h - 16), f"{f}", fill=(100, 100, 100), font=font(12))
    spec = {k: A.spectrum_db(v) for k, v in [("master", master), ("voice", mono["voice"]), ("music", mono["music"])]}
    top = spec["master"][1][(spec["master"][0] > 20)].max()
    Y3 = lambda v: y0 + h - (np.clip(v - top + 80, 0, 80)) / 80 * h  # noqa: E731
    for k, (f, p) in spec.items():
        sel = (f > 20) & (f < 20000)
        ff, pp = f[sel], p[sel]
        idx = np.unique(np.geomspace(1, len(ff) - 1, 600).astype(int))
        sm = np.convolve(pp, np.ones(9) / 9, mode="same")
        d.line([(fx(ff[i]), Y3(sm[i])) for i in idx], fill=COL[k], width=2)
    edges = {"sub_20_60": (20, 60), "low_60_250": (60, 250), "lowmid_250_2k": (250, 2000), "presence_2k_5k": (2000, 5000), "air_5k_16k": (5000, 16000)}
    for k, (a, b) in edges.items():
        ok = next(r["ok"] for r in R if r["check"] == k)
        d.text((fx(a) + 4, y0 + 26), f"{k} {bands[k]:.1f} dB", fill=(0, 130, 0) if ok else COL["bad"], font=font(13))
    # 5 checks table
    y0 = 1190
    d.text((60, y0), "checks", fill=(0, 0, 0), font=font(18))
    for i, r in enumerate(R):
        col, row = divmod(i, 10)
        d.text((60 + col * 600, y0 + 28 + row * 27), f"{'ok ' if r['ok'] else 'FAIL'} {r['check']}: {r['value']}  {r['range']}",
               fill=(0, 110, 0) if r["ok"] else COL["bad"], font=font(15))
    im.save(ROOT / "qa/mix/overview.png")


def plot_segments(rows):
    rows = [r for r in rows if "voice_lufs" in r]
    H = 90 + 30 * len(rows)
    im = Image.new("RGB", (1200, H), "white")
    d = ImageDraw.Draw(im)
    d.text((20, 10), "per segment: voice LUFS (bar, median line) · music under voice dB · master LUFS", fill=(0, 0, 0), font=font(18))
    if not rows:
        im.save(ROOT / "qa/mix/segments.png")
        return
    med = float(np.median([r["voice_lufs"] for r in rows]))
    spread = TG["voice"]["segment_spread_lu"][1] / 2
    lo_m, hi_m = TG["music"]["under_voice_speaking_db"]
    Xv = lambda l: 200 + (np.clip(l, med - 8, med + 8) - (med - 8)) / 16 * 500  # noqa: E731
    d.line([Xv(med), 45, Xv(med), H - 10], fill=(0, 150, 0))
    for i, r in enumerate(rows):
        y = 50 + i * 30
        dv = r["voice_lufs"] - med
        c = (30, 90, 200) if abs(dv) <= spread else (210, 40, 40)
        d.text((20, y), f"{r['seg']} {r['from']:.1f}s", fill=(0, 0, 0), font=font(15))
        d.rectangle([min(Xv(med), Xv(r["voice_lufs"])), y + 4, max(Xv(med), Xv(r["voice_lufs"])) + 1, y + 20], fill=c)
        d.text((720, y), f"voice {r['voice_lufs']} ({dv:+.1f})", fill=c, font=font(15))
        mu = r.get("music_under_voice_db")
        if mu is not None and mu > 40:
            d.text((900, y), "music: silence", fill=(140, 140, 140), font=font(15))
        elif mu is not None:
            mc = (0, 110, 0) if lo_m - 2 <= mu <= hi_m + 2 else (210, 40, 40)
            d.text((900, y), f"music -{mu} dB", fill=mc, font=font(15))
        d.text((1060, y), f"{r['master_lufs']} LUFS", fill=(60, 60, 60), font=font(15))
    im.save(ROOT / "qa/mix/segments.png")


# ======================================================================== video mode
def measure_video(path):
    path = Path(path)
    mix, _ = sf.read(ROOT / "public/mix.wav", always_2d=True)
    tmp = ROOT / "qa/_video_audio.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-vn", "-af", "aresample=async=1:first_pts=0", "-ac", "2", "-ar", str(SR), str(tmp)], check=True)
    va, _ = sf.read(tmp, always_2d=True)
    pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(path)], capture_output=True, text=True).stdout)
    vd = next(float(s["duration"]) for s in pr["streams"] if s["codec_type"] == "video")
    ad = next(float(s["duration"]) for s in pr["streams"] if s["codec_type"] == "audio")
    # sync: cross-correlate 20 s of the voice-heavy start (decimated envelope, then fine on samples)
    seg = slice(0, min(len(mix), len(va), SR * 20))
    a, b = mix[seg].mean(1), va[seg].mean(1)
    corr = np.fft.irfft(np.fft.rfft(b, 2 * len(a)) * np.conj(np.fft.rfft(a, 2 * len(a))))
    lag = int(np.argmax(np.concatenate([corr[-SR // 2:], corr[: SR // 2]]))) - SR // 2
    R = []
    check(R, "delivery", "lufs_drift_lu", abs(A.integrated(va) - A.integrated(mix)))
    check(R, "delivery", "true_peak_dbtp", A.true_peak(va))
    check(R, "delivery", "av_duration_diff_s", abs(vd - ad))
    check(R, "delivery", "sync_offset_ms", lag / SR * 1000)
    tmp.unlink()
    fails = [r for r in R if not r["ok"]]
    out = {"file": str(path), "checks": R, "fails": len(fails), "video_s": round(vd, 3), "audio_s": round(ad, 3),
           "ffmpeg_lufs": ffmpeg_lufs(path)}
    o = ROOT / "qa/video_audio.json"
    allv = json.loads(o.read_text()) if o.exists() else {}
    allv[path.name] = out
    o.write_text(json.dumps(allv, ensure_ascii=False, indent=1))
    for r in R:
        print(("ok  " if r["ok"] else "FAIL"), f"{path.name}: {r['check']:22s} {r['value']:>8}  in {r['range']}")
    return len(fails)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--video":
        sys.exit(1 if measure_video(sys.argv[2]) else 0)
    sys.exit(1 if measure_mix() else 0)
