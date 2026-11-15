"""Giọng VieNeu -> chọn bản đọc tốt nhất -> ghép -> mốc từng từ -> cues -> qa/voice_report.json (bằng chứng gate G3).

Chạy: /Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/voice.py [--voice "Tên"] [--takes 4] [--reuse]
  --reuse : không sinh lại giọng, dùng audio/<id>.wav đã có (chỉ tính lại timeline/words/cues)
Đầu ra: audio/<id>.wav, audio/voice.wav, public/voice.wav, qa/timeline.json, qa/voice_report.json, src/words.json, src/cues.json
Luật nhà: giọng Hải Đăng (giọng Bắc). Đổi giọng phải có --allow-voice và người dùng đồng ý.
"""
import argparse
import difflib
import hashlib
import json
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


def similarity(words, text):
    a = " ".join(norm(x["w"]) for x in words)
    b = " ".join(norm(x) for x in re.sub(r"\[[^\]]*\]", "", text).split())
    return difflib.SequenceMatcher(None, a, b).ratio()


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
    ap.add_argument("--takes", type=int, default=4)
    ap.add_argument("--temperature", type=float, default=0.8)
    ap.add_argument("--reuse", action="store_true")
    ap.add_argument("--missing", action="store_true", help="chỉ sinh các đoạn chưa có audio/<id>.wav")
    ap.add_argument("--only", default=None, help="sinh lại các đoạn này (s3,s7) — dùng khi báo cáo chỉ ra đoạn đọc sai")
    ap.add_argument("--allow-voice", action="store_true", help="cho phép giọng khác Hải Đăng (chỉ khi người dùng yêu cầu)")
    args = ap.parse_args()

    script = json.loads((ROOT / "script.json").read_text())
    voice = args.voice or script["voice"]
    if voice != "Hải Đăng" and not args.allow_voice:
        raise SystemExit(f"giọng '{voice}' không phải Hải Đăng — luật nhà. Dùng --allow-voice chỉ khi người dùng yêu cầu.")
    default_pause = script.get("pause_after", 0.32)
    for d in ("audio", "public", "qa", "src"):
        (ROOT / d).mkdir(exist_ok=True)
    only = set(args.only.split(",")) if args.only else None

    from faster_whisper import WhisperModel

    wm = WhisperModel("small", device="cpu", compute_type="int8")

    if not args.reuse:
        from vieneu import Vieneu

        tts = Vieneu()
        for seg in script["segments"]:
            if args.missing and (ROOT / "audio" / f"{seg['id']}.wav").exists():
                continue
            if only and seg["id"] not in only:
                continue
            text = seg.get("tts_text", seg["text"])
            best, best_score = None, -1
            lens = []
            cand = []
            for t in range(args.takes):
                w = trim(np.asarray(tts.infer(text=text, voice=voice, temperature=args.temperature), dtype=np.float32))
                cand.append(w)
                lens.append(len(w))
            med = float(np.median(lens))
            for t, w in enumerate(cand):
                sc = similarity(asr(wm, w), seg["text"]) - 0.6 * abs(len(w) - med) / med
                sf.write(ROOT / "audio" / f"{seg['id']}_take{t}.wav", w, SR)
                if sc > best_score:
                    best, best_score = w, sc
            sf.write(ROOT / "audio" / f"{seg['id']}.wav", best, SR)
            print(f"{seg['id']}: {len(best)/SR:.2f}s score={best_score:.2f} takes={[round(l/SR,2) for l in lens]}", flush=True)

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
        timeline.append({"id": seg["id"], "text": seg["text"], "start": round(t, 3), "end": round(t + dur, 3), "asr": " ".join(x["w"] for x in aw),
                         "similarity": round(similarity(aw, seg["text"]), 3), "wps": round(len(seg["text"].split()) / max(dur, 0.1), 2)})
        print(seg["id"], f"{t:.2f}-{t+dur:.2f}", "|", timeline[-1]["asr"])
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
    (ROOT / "src" / "events.json").write_text(json.dumps(events, ensure_ascii=False, indent=1))
    cues["seg_starts"] = {x["id"]: x["start"] for x in timeline}
    cues["voice_end"] = round(timeline[-1]["end"], 3)
    cues["total"] = round(t, 3)

    (ROOT / "qa" / "timeline.json").write_text(json.dumps({"voice": voice, "total": round(t, 3), "segments": timeline}, ensure_ascii=False, indent=2))
    bad = [x["id"] for x in timeline if x["similarity"] < 0.85]
    fast = [x["id"] for x in timeline if x["wps"] > 5.2]
    slow = [x["id"] for x in timeline if x["wps"] < 3.2 and len(x["text"].split()) > 6]
    report = {
        "voice": voice, "total": round(t, 3), "words": len(words), "wps": round(len(words) / max(timeline[-1]["end"], 0.1), 2),
        "script_sha": hashlib.sha256((ROOT / "script.json").read_bytes()).hexdigest()[:16],
        "voice_sha": hashlib.sha256((ROOT / "audio" / "voice.wav").read_bytes()).hexdigest()[:16],
        "low_similarity": bad, "too_fast": fast, "too_slow": slow,
        "segments": [{k: x[k] for k in ("id", "start", "end", "similarity", "wps", "asr")} for x in timeline],
    }
    (ROOT / "qa" / "voice_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    print(f"voice report: {len(timeline)} đoạn, {report['wps']} từ/giây, similarity thấp: {bad or 'không'}, nhanh: {fast or 'không'}, chậm: {slow or 'không'}")
    if bad:
        print("=> đọc lại:  --only " + ",".join(bad))
    (ROOT / "src").mkdir(exist_ok=True)
    (ROOT / "src" / "words.json").write_text(json.dumps(words, ensure_ascii=False))
    (ROOT / "src" / "cues.json").write_text(json.dumps(cues, ensure_ascii=False, indent=2))
    print("CUES", json.dumps({k: v for k, v in cues.items() if k != "seg_starts"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
