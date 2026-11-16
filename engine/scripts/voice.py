"""Giọng VieNeu theo chuẩn nhà (standards/voice_standard.json, skill sv-12-voice): MỘT take mỗi đoạn, seed cố định,
đo từng đoạn so với hồ sơ giọng Hải Đăng -> đoạn trượt mới sinh lại bằng seed kế tiếp -> ghép -> mốc từng từ ->
cues -> qa/voice_report.json (bằng chứng gate G3).

Chạy: /Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/voice.py [--only s3,s7] [--missing] [--reuse]
  --reuse : không sinh lại giọng, dùng audio/<id>.wav đã có (chỉ đo lại + tính lại timeline/words/cues)
  --calibrate a.wav:text ... : in hồ sơ giọng (chỉ dùng khi đổi chuẩn — việc của series, không phải của tập)
Đầu ra: audio/<id>.wav, audio/voice.wav, public/voice.wav, qa/timeline.json, qa/voice_report.json, src/data/words.json, src/data/cues.json
Luật nhà: giọng Hải Đăng gốc (preset, không clone), tốc độ gốc 1.0×, không kéo/nén thời gian, không đổi cao độ.
"""
import argparse
import difflib
import hashlib
import json
import random
import re
import unicodedata
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parent.parent
SR = 48000


def strip_acc(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm(w: str) -> str:
    """Bỏ dấu: dùng khi so từ KỊCH BẢN với từ whisper nghe (whisper hay sai dấu)."""
    return strip_acc(re.sub(r"[^\w]", "", w.lower(), flags=re.UNICODE))


def norm_keep(w: str) -> str:
    """Giữ dấu: dùng cho anchor cues/fx, khớp với tAt() trong shots.ts (tránh trùng giường/giương)."""
    return re.sub(r"[^\w]", "", w.lower(), flags=re.UNICODE)


def trim(wav, thr=0.008, margin_ms=40):
    idx = np.where(np.abs(wav) > thr)[0]
    if len(idx) == 0:
        return wav
    m = int(SR * margin_ms / 1000)
    a, b = max(0, idx[0] - m), min(len(wav), idx[-1] + m)
    out = wav[a:b].copy()
    f = int(SR * 0.012)
    out[:f] *= np.linspace(0, 1, f)
    out[-f:] *= np.linspace(1, 0, f)
    return out


def asr(wm, w):
    segs, _ = wm.transcribe(resample_poly(w, 1, 3).astype(np.float32), language="vi", word_timestamps=True, beam_size=5)
    words = []
    for s in segs:
        for ww in s.words or []:
            words.append({"w": ww.word.strip(), "s": float(ww.start), "e": float(ww.end)})
    return words


_DIG = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]


def num_vi(n: int) -> str:
    """số -> chữ (cách đọc miền Bắc), để so với whisper vốn ghi số bằng chữ số ('180' = 'một trăm tám mươi')"""
    if n < 10:
        return _DIG[n]
    if n < 100:
        t, u = divmod(n, 10)
        head = "mười" if t == 1 else _DIG[t] + " mươi"
        tail = "" if u == 0 else (" mốt" if u == 1 and t > 1 else " lăm" if u == 5 else " " + _DIG[u])
        return head + tail
    if n < 1000:
        h, r = divmod(n, 100)
        return _DIG[h] + " trăm" + ("" if r == 0 else (" linh " + _DIG[r] if r < 10 else " " + num_vi(r)))
    if n < 1_000_000:
        k, r = divmod(n, 1000)
        return num_vi(k) + " nghìn" + ("" if r == 0 else (" không trăm " + num_vi(r) if r < 100 else " " + num_vi(r)))
    return str(n)


def spell_numbers(s: str) -> str:
    return re.sub(r"\d[\d.]*", lambda m: num_vi(int(m.group().replace(".", ""))) if m.group().replace(".", "").isdigit() else m.group(), s)


def similarity(words, text):
    a = " ".join(norm(x) for x in spell_numbers(" ".join(w["w"] for w in words)).split())
    b = " ".join(norm(x) for x in re.sub(r"\[[^\]]*\]", "", text).split())
    return difflib.SequenceMatcher(None, a, b).ratio()


# ---------------------------------------------------------------- house voice standard
STD = json.loads((ROOT / "standards/voice_standard.json").read_text())


def text_problems(t):
    """luật chữ gửi vào engine (cũng được script_lint SC-15..17 kiểm)"""
    r, bad = STD["text"], []
    if r["no_digits"] and re.search(r"\d", t):
        bad.append("có chữ số — viết số thành chữ trong tts_text")
    if r["no_ellipsis"] and ("..." in t or "…" in t):
        bad.append("có '…' — mỗi dấu ba chấm thành một chỗ hở, bỏ đi")
    tags = re.findall(r"\[([^\]]+)\]", t)
    if any(x not in r["allowed_tags"] for x in tags):
        bad.append(f"tag cảm xúc {tags} không nằm trong chuẩn")
    if len(t.split()) > r["max_words_per_call"]:
        bad.append(f"{len(t.split())} từ > {r['max_words_per_call']} trong một lần đọc")
    return bad


def seed_for(title, sid, attempt):
    """seed cố định theo (tập, đoạn, lần): cùng chữ + cùng seed = cùng âm thanh"""
    return int(hashlib.sha1(f"{title}|{sid}|{attempt}".encode()).hexdigest()[:8], 16)


def holes(w, thr_db=-38, min_s=0.08):
    """các khoảng lặng bên trong một đoạn: [(bắt đầu, dài)]"""
    import librosa
    y = resample_poly(w, 1, 3)
    rms = librosa.feature.rms(y=y, frame_length=400, hop_length=160)[0]
    db = 20 * np.log10(rms + 1e-6) - 20 * np.log10(rms.max() + 1e-6)
    sil, out, i = db < thr_db, [], 0
    while i < len(sil):
        if sil[i]:
            j = i
            while j < len(sil) and sil[j]:
                j += 1
            d = (j - i) * 0.01
            if d >= min_s and i > 0 and j < len(sil):
                out.append((round(i * 0.01, 2), round(d, 2)))
            i = j
        else:
            i += 1
    return out


def measure(w, text, aw):
    """đặc trưng một đoạn: tốc độ, cao độ trung vị, âm sắc (spectral centroid), chỗ hở dài nhất, độ đúng chữ"""
    import librosa
    y = resample_poly(w, 1, 3)
    f0, vf, _ = librosa.pyin(y, fmin=65, fmax=400, sr=16000, frame_length=1024, hop_length=160)
    v = f0[vf & ~np.isnan(f0)]
    cent = float(np.median(librosa.feature.spectral_centroid(y=y, sr=16000)))
    hs = holes(w)
    return {"rate_wps": round(len(text.split()) / (len(w) / SR), 3), "f0_hz": round(float(np.median(v)) if len(v) else 0.0, 1),
            "centroid_hz": round(cent, 1), "max_hole_s": max([d for _, d in hs] or [0.0]), "asr_similarity": round(similarity(aw, text), 3)}


def line_checks(m):
    """so một đoạn với hồ sơ giọng -> {check: (giá trị, [min,max], ok)}"""
    P, L = STD["profile"], STD["line_checks"]
    vals = {"asr_similarity": m["asr_similarity"], "rate_vs_profile": m["rate_wps"] / P["rate_wps"] - 1,
            "f0_vs_profile_st": 12 * np.log2(max(m["f0_hz"], 1) / P["f0_hz"]), "timbre_vs_profile": m["centroid_hz"] / P["centroid_hz"] - 1,
            "max_hole_s": m["max_hole_s"]}
    return {k: (round(float(v), 3), L[k], bool(L[k][0] <= v <= L[k][1])) for k, v in vals.items()}


def map_words(script_text, asr_words, t_off, seg_end):
    """Gán thời gian cho từng từ của kịch bản bằng cách khớp với từ whisper nghe được, chỗ nào không khớp thì nội suy."""
    toks = script_text.split()
    sn = [norm(t) for t in toks]
    an = [norm(x["w"]) for x in asr_words]
    sm = difflib.SequenceMatcher(None, sn, an, autojunk=False)
    anchor = {}
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            anchor[blk.a + k] = asr_words[blk.b + k]
    first = asr_words[0]["s"] if asr_words else 0.0
    last = asr_words[-1]["e"] if asr_words else seg_end - t_off
    n = len(toks)
    starts = [None] * n
    ends = [None] * n
    for i, a in anchor.items():
        starts[i], ends[i] = a["s"], a["e"]
    # nội suy các từ chưa có mốc, chia theo độ dài chữ giữa hai mốc gần nhất
    i = 0
    while i < n:
        if starts[i] is not None:
            i += 1
            continue
        j = i
        while j < n and starts[j] is None:
            j += 1
        left = ends[i - 1] if i > 0 else first
        right = starts[j] if j < n else last
        right = max(right, left + 0.05 * (j - i))
        wts = [len(sn[k]) + 1.2 for k in range(i, j)]
        tot = sum(wts)
        cur = left
        for k in range(i, j):
            d = (right - left) * wts[k - i] / tot
            starts[k], ends[k] = cur, cur + d
            cur += d
        i = j
    out = []
    for k, t in enumerate(toks):
        out.append({"w": t, "s": round(t_off + starts[k], 3), "e": round(t_off + max(ends[k], starts[k] + 0.04), 3)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=None)
    ap.add_argument("--reuse", action="store_true")
    ap.add_argument("--calibrate", nargs="+", default=None, help="wav:text ... -> in hồ sơ giọng (đổi chuẩn series)")
    ap.add_argument("--missing", action="store_true", help="chỉ sinh các đoạn chưa có audio/<id>.wav")
    ap.add_argument("--only", default=None, help="sinh lại các đoạn này (s3,s7) — dùng khi báo cáo chỉ ra đoạn đọc sai")
    ap.add_argument("--allow-voice", action="store_true", help="cho phép giọng khác Hải Đăng (chỉ khi người dùng yêu cầu)")
    args = ap.parse_args()

    script = json.loads((ROOT / "script.json").read_text())
    voice = args.voice or script["voice"]
    if voice != "Hải Đăng" and not args.allow_voice:
        raise SystemExit(f"giọng '{voice}' không phải Hải Đăng — luật nhà. Dùng --allow-voice chỉ khi người dùng yêu cầu.")
    default_pause = script.get("pause_after", json.loads((ROOT / "standards/pacing.json").read_text())["voice"]["default_pause_after_s"])
    for d in ("audio", "public", "qa", "src/data"):
        (ROOT / d).mkdir(exist_ok=True)
    only = set(args.only.split(",")) if args.only else None

    from faster_whisper import WhisperModel

    wm = WhisperModel("small", device="cpu", compute_type="int8")

    if args.calibrate:
        ms = []
        for spec in args.calibrate:
            p, _, txt = spec.partition(":")
            w, _ = sf.read(p, dtype="float32")
            ms.append(measure(w, txt, asr(wm, w)))
            print(p, ms[-1])
        prof = {k: round(float(np.median([m[k] for m in ms])), 2) for k in ("rate_wps", "f0_hz", "centroid_hz")}
        print("PROFILE", json.dumps(prof), "| asr p10", round(float(np.percentile([m["asr_similarity"] for m in ms], 10)), 3))
        return

    E = STD["engine"]
    bad_text = {s["id"]: p for s in script["segments"] if (p := text_problems(s.get("tts_text", s["text"])))}
    if bad_text:
        raise SystemExit("chữ gửi vào giọng sai chuẩn (voice_standard.json → text):\n" + "\n".join(f"  {k}: {v}" for k, v in bad_text.items()))
    attempts_log = {}
    alog_path = ROOT / "qa" / "voice_attempts.json"
    if alog_path.exists():
        attempts_log = json.loads(alog_path.read_text())

    if not args.reuse:
        import torch
        from vieneu import Vieneu

        tts = Vieneu(precision=E["precision"])
        for seg in script["segments"]:
            sid = seg["id"]
            if args.missing and (ROOT / "audio" / f"{sid}.wav").exists():
                continue
            if only and sid not in only:
                continue
            text = seg.get("tts_text", seg["text"])
            tries = []
            for attempt in range(E["max_attempts"]):
                sd = seed_for(script.get("title", ""), sid, attempt)
                torch.manual_seed(sd); np.random.seed(sd % 2**32); random.seed(sd)
                w = trim(np.asarray(tts.infer(text=text, voice=voice, temperature=E["temperature"], top_k=E["top_k"], top_p=E["top_p"],
                                              repetition_penalty=E["repetition_penalty"]), dtype=np.float32))
                m = measure(w, text, asr(wm, w))
                ch = line_checks(m)
                fails = [k for k, (_, _, ok) in ch.items() if not ok]
                tries.append({"attempt": attempt, "seed": sd, "fails": fails, **m})
                print(f"{sid} lần {attempt + 1}: {len(w) / SR:.2f}s {m['rate_wps']} từ/s f0 {m['f0_hz']} sim {m['asr_similarity']}"
                      f" -> {'ĐẠT' if not fails else 'trượt ' + ','.join(fails)}", flush=True)
                if not fails:
                    break
                sf.write(ROOT / "audio" / f"{sid}_try{attempt}.wav", w, SR)   # giữ lại để nghe vì sao trượt
            # không đạt sau max_attempts: giữ lần trượt ít check nhất, báo cáo sẽ đánh dấu -> G3 chặn
            if tries[-1]["fails"]:
                pick = min(range(len(tries)), key=lambda i: len(tries[i]["fails"]))
                w, _ = sf.read(ROOT / "audio" / f"{sid}_try{pick}.wav", dtype="float32")
            sf.write(ROOT / "audio" / f"{sid}.wav", w, SR)
            attempts_log[sid] = {"text_sha": hashlib.sha1(text.encode()).hexdigest()[:12], "tries": tries}
            alog_path.write_text(json.dumps(attempts_log, ensure_ascii=False, indent=1))

    # ghép + timeline + words
    t = 0.0
    chunks, timeline, words = [], [], []
    for seg in script["segments"]:
        w, sr = sf.read(ROOT / "audio" / f"{seg['id']}.wav", dtype="float32")
        assert sr == SR
        dur = len(w) / SR
        aw = asr(wm, w)
        mapped = map_words(seg["text"], aw, t, t + dur)
        seg_words = [{**m, "seg": seg["id"]} for m in mapped]
        words += seg_words
        spoken = seg.get("tts_text", seg["text"])
        m = measure(w, spoken, aw)
        ch = line_checks(m)
        timeline.append({"id": seg["id"], "text": seg["text"], "start": round(t, 3), "end": round(t + dur, 3), "asr": " ".join(x["w"] for x in aw),
                         "similarity": round(similarity(aw, seg["text"]), 3), "wps": round(len(seg["text"].split()) / max(dur, 0.1), 2),
                         "measure": m, "checks": {k: {"value": v, "range": r, "ok": ok} for k, (v, r, ok) in ch.items()},
                         "fails": [k for k, (_, _, ok) in ch.items() if not ok],
                         "attempts": len(attempts_log.get(seg["id"], {}).get("tries", [])) or None,
                         "text_sha_ok": attempts_log.get(seg["id"], {}).get("text_sha") in (None, hashlib.sha1(spoken.encode()).hexdigest()[:12])})
        print(seg["id"], f"{t:.2f}-{t+dur:.2f}", "|", timeline[-1]["asr"], "| trượt: " + ",".join(timeline[-1]["fails"]) if timeline[-1]["fails"] else "")
        chunks += [w, np.zeros(int(SR * seg.get("pause_after", default_pause)), dtype=np.float32)]
        t += dur + seg.get("pause_after", default_pause)
    voice_wav = np.concatenate(chunks)
    sf.write(ROOT / "audio" / "voice.wav", voice_wav, SR)
    sf.write(ROOT / "public" / "voice.wav", voice_wav, SR)

    # cues: "từ" hoặc "từ#n" (lần xuất hiện thứ n) trong đoạn
    cues = {}
    for seg in script["segments"]:
        sw = [x for x in words if x["seg"] == seg["id"]]
        for name, spec in seg.get("cues", {}).items():
            target, _, nth = spec.partition("#")
            nth = int(nth) if nth else 1
            hits = [x for x in sw if norm_keep(x["w"]) == norm_keep(target)]
            if len(hits) < nth:
                raise SystemExit(f"cue {name}: không thấy '{spec}' trong {seg['id']}")
            cues[name] = hits[nth - 1]["s"]
    # sự kiện hiệu ứng (mưa, âm nền, SFX) neo theo từ trong kịch bản
    events = []
    for ev in script.get("fx", []):
        sw = [x for x in words if x["seg"] == ev["seg"]]
        spec = ev.get("at", "")
        if spec:
            target, _, nth = spec.partition("#")
            nth = int(nth) if nth else 1
            hits = [x for x in sw if norm_keep(x["w"]) == norm_keep(target)]
            if len(hits) < nth:
                raise SystemExit(f"fx {ev}: không thấy '{spec}'")
            t0 = hits[nth - 1]["s"]
        else:
            t0 = sw[0]["s"]
        events.append({**{k: v for k, v in ev.items() if k != "at"}, "t": t0})
    events.sort(key=lambda e: e["t"])
    (ROOT / "src/data/events.json").write_text(json.dumps(events, ensure_ascii=False, indent=1))
    cues["seg_starts"] = {x["id"]: x["start"] for x in timeline}
    cues["voice_end"] = round(timeline[-1]["end"], 3)
    cues["total"] = round(t, 3)

    (ROOT / "qa" / "timeline.json").write_text(json.dumps({"voice": voice, "total": round(t, 3), "segments": timeline}, ensure_ascii=False, indent=2))
    # ---- line + episode checks (voice_standard.json) and pacing (pacing.json)
    failed = {x["id"]: x["fails"] for x in timeline if x["fails"]}
    ms = [x["measure"] for x in timeline]
    f0s = np.array([m["f0_hz"] for m in ms if m["f0_hz"] > 0])
    rates = np.array([m["rate_wps"] for m in ms]); cents = np.array([m["centroid_hz"] for m in ms])
    tried = [x["attempts"] for x in timeline if x["attempts"]]
    EC = STD["episode_checks"]
    ep_vals = {"f0_spread_st": float(np.std(12 * np.log2(f0s / np.median(f0s)))) if len(f0s) else 99.0,
               "rate_cv": float(rates.std() / rates.mean()), "timbre_cv": float(cents.std() / cents.mean()),
               "retry_share": float(np.mean([a > 1 for a in tried])) if tried else 0.0}
    PA = json.loads((ROOT / "standards/pacing.json").read_text())
    voice_end = timeline[-1]["end"]
    pauses_s = sum(s.get("pause_after", default_pause) for s in script["segments"][:-1])
    pace_vals = {"voice_s": voice_end, "overall_wps": len(words) / max(voice_end, 0.1), "pause_share": pauses_s / max(voice_end, 0.1),
                 "segments": len(timeline)}
    pace_rng = {"voice_s": PA["episode"]["voice_s"], "overall_wps": PA["voice"]["overall_wps"], "pause_share": PA["voice"]["pause_share"],
                "segments": PA["episode"]["segments"]}
    episode_checks = [{"group": "voice", "check": k, "value": round(v, 3), "range": EC[k], "ok": EC[k][0] <= v <= EC[k][1]} for k, v in ep_vals.items()]
    episode_checks += [{"group": "pacing", "check": k, "value": round(v, 3), "range": pace_rng[k], "ok": pace_rng[k][0] <= v <= pace_rng[k][1]} for k, v in pace_vals.items()]
    stale = [x["id"] for x in timeline if not x["text_sha_ok"]]
    report = {
        "voice": voice, "standard": STD["version"], "pacing": PA["version"], "engine": E,
        "total": round(t, 3), "words": len(words), "wps": round(len(words) / max(voice_end, 0.1), 2),
        "script_sha": hashlib.sha256((ROOT / "script.json").read_bytes()).hexdigest()[:16],
        "voice_sha": hashlib.sha256((ROOT / "audio" / "voice.wav").read_bytes()).hexdigest()[:16],
        "standard_sha": hashlib.sha256((ROOT / "standards/voice_standard.json").read_bytes()).hexdigest()[:16],
        "pacing_sha": hashlib.sha256((ROOT / "standards/pacing.json").read_bytes()).hexdigest()[:16],
        "failed_lines": failed, "stale_lines": stale, "episode_checks": episode_checks,
        "segments": [{k: x[k] for k in ("id", "start", "end", "similarity", "wps", "asr", "measure", "checks", "fails", "attempts")} for x in timeline],
    }
    (ROOT / "qa" / "voice_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    bad_ep = [f"{c['group']}.{c['check']}={c['value']} ngoài {c['range']}" for c in episode_checks if not c["ok"]]
    print(f"voice report: {len(timeline)} đoạn, {voice_end:.1f}s, {report['wps']} từ/giây, đoạn trượt: {failed or 'không'}, cả tập: {bad_ep or 'đạt'}")
    if failed:
        print("=> sửa chữ (tts_text) của các đoạn trượt rồi:  --only " + ",".join(failed))
    if stale:
        print("=> chữ đã đổi sau khi sinh giọng:  --only " + ",".join(stale))
    (ROOT / "src/data").mkdir(parents=True, exist_ok=True)
    (ROOT / "src/data/words.json").write_text(json.dumps(words, ensure_ascii=False))
    (ROOT / "src/data/cues.json").write_text(json.dumps(cues, ensure_ascii=False, indent=2))
    print("CUES", json.dumps({k: v for k, v in cues.items() if k != "seg_starts"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
