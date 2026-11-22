"""Giọng VieNeu V3 Turbo theo chuẩn nhà v2.0 (standards/voice_standard.json, skill sv-12-voice):
- Thu từng câu bằng preset Hải Đăng (use_ref_codes=True, t=0.7, top_k=25, top_p=0.95, không clone).
- Hỗ trợ song ngữ Việt-Anh (<en>...</en> hoặc khai báo "english": [...] trong script.json), dấu '...'/'…',
  và các tag biểu cảm nội dòng của VieNeu ([cười], [thở dài], [hắng giọng]).
- Nhịp nhanh theo từng câu (offline 5.25 đơn vị âm tiết/giây, cắt khoảng lặng nội câu >0.32s về 0.16s,
  nâng cao độ pitch_ratio=1.02 qua FFmpeg WSOLA), cho phép tinh chỉnh wps / pause_after / tts_text / seed
  cho từng segment hoặc từng câu cụ thể trong script.json.
- Đo tự động từng câu & từng đoạn với faster-whisper + librosa; câu trượt tự đổi seed thu lại (tối đa 3 lần).

Chạy: /Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/voice.py [--only s3,s7.2] [--missing] [--reuse]
  --only s3,s7.2 : sinh lại toàn bộ đoạn s3 hoặc chỉ câu thứ 2 của đoạn s7 (1-based)
  --reuse        : không gọi lại VieNeu, dựng lại nhịp/tempo/pause từ audio/_sents/*_raw.wav + đo lại + xuất words/cues
  --calibrate a.wav:text ... : in hồ sơ giọng (chỉ dùng khi đổi chuẩn series)
Đầu ra: audio/<id>.wav, audio/voice.wav, public/voice.wav, qa/timeline.json, qa/voice_report.json, src/data/words.json, src/data/cues.json
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import random
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

try:
    import numpy as np
    import soundfile as sf
    from scipy.signal import resample_poly
except ImportError:
    np = None  # type: ignore[assignment]
    sf = None  # type: ignore[assignment]
    resample_poly = None  # type: ignore[assignment]

_SCRIPT_ROOT = Path(__file__).resolve().parent.parent
ROOT = _SCRIPT_ROOT if (_SCRIPT_ROOT / "script.json").exists() else (
    Path.cwd() if (Path.cwd() / "script.json").exists() else _SCRIPT_ROOT
)
SR = 48000


def _load_std() -> dict:
    for cand in (
        ROOT / "standards/voice_standard.json",
        _SCRIPT_ROOT / "standards/voice_standard.json",
        _SCRIPT_ROOT.parent / "standards/voice_standard.json",
    ):
        if cand.exists():
            return json.loads(cand.read_text())
    raise FileNotFoundError(f"standards/voice_standard.json not found from {ROOT}")


def _load_pacing() -> dict:
    for cand in (
        ROOT / "standards/pacing.json",
        _SCRIPT_ROOT / "standards/pacing.json",
        _SCRIPT_ROOT.parent / "standards/pacing.json",
    ):
        if cand.exists():
            return json.loads(cand.read_text())
    raise FileNotFoundError(f"standards/pacing.json not found from {ROOT}")


STD = _load_std()
_RHYTHM_OVERRIDE_KEYS = (
    "target_ups",
    "phonation_ups",
    "blend_raw",
    "inside_pause_threshold_s",
    "inside_pause_target_s",
    "sentence_gap_s",
)


def _effective_rhythm(script: dict | None = None, pa: dict | None = None) -> dict:
    r = dict(STD["rhythm"])
    if isinstance(script, dict) and script.get("length") == "long_16x9":
        if pa is None:
            try:
                pa = _load_pacing()
            except FileNotFoundError:
                pa = {}
        ep_cfg = (pa or {}).get("episode_long_16x9") or {}
        for k in _RHYTHM_OVERRIDE_KEYS:
            if k in ep_cfg:
                r[k] = ep_cfg[k]
    return r
EN_SPAN_RE = re.compile(r"<en>(.*?)</en>", re.I | re.S)
TAG_RE = re.compile(r"\[([^\]]+)\]")
SENT_SPLIT_RE = re.compile(r"(?<=[.!?…])\s+(?=[^\s])")


def strip_acc(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def strip_markup(s: str) -> str:
    """Bỏ tag <en>...</en> (giữ chữ bên trong) và bỏ tag biểu cảm [...] để hiển thị phụ đề / so khớp ASR."""
    s = re.sub(r"</?en>", "", s, flags=re.I)
    s = TAG_RE.sub(" ", s)
    return " ".join(s.split())


def norm(w: str) -> str:
    """Bỏ dấu: dùng khi so từ kịch bản với từ whisper nghe."""
    return strip_acc(re.sub(r"[^\w]", "", w.lower(), flags=re.UNICODE))


def norm_keep(w: str) -> str:
    """Giữ dấu: dùng cho anchor cues/fx, khớp với tAt() trong engine.ts."""
    return re.sub(r"[^\w]", "", w.lower(), flags=re.UNICODE)


def apply_bilingual(text: str, english_terms: list[str]) -> str:
    """Tự bọc <en>...</en> cho các từ trong danh sách english mà không bọc chồng lên <en> có sẵn."""
    terms = sorted({t.strip() for t in english_terms if t and t.strip()}, key=len, reverse=True)
    if not terms:
        return text
    protected: list[str] = []

    def _save(m: re.Match) -> str:
        protected.append(m.group(0))
        return f"\x00EN{len(protected) - 1}\x00"

    masked = EN_SPAN_RE.sub(_save, text)
    pat = re.compile(r"(?<![\w<])(?:" + "|".join(map(re.escape, terms)) + r")(?![\w>])")
    masked = pat.sub(lambda m: f"<en>{m.group(0)}</en>", masked)
    for idx, orig in enumerate(protected):
        masked = masked.replace(f"\x00EN{idx}\x00", orig)
    return masked


def syllable_units(tts_text: str) -> float:
    """Đếm đơn vị âm tiết: mỗi tiếng Việt = 1; từ tiếng Anh trong <en>...</en> tính theo cụm nguyên âm."""
    s = TAG_RE.sub(" ", tts_text)
    total = 0.0
    pos = 0
    for m in EN_SPAN_RE.finditer(s):
        total += len(re.findall(r"[^\W_]+", s[pos:m.start()], re.UNICODE))
        for ew in re.findall(r"[A-Za-z0-9']+", m.group(1)):
            syls = len(re.findall(r"[aeiouyAEIOUY]+", ew))
            if ew.lower().endswith("e") and not ew.lower().endswith("le") and syls > 1:
                syls -= 1
            total += max(1, syls)
        pos = m.end()
    total += len(re.findall(r"[^\W_]+", s[pos:], re.UNICODE))
    return max(1.0, total)


def count_emotions(tts_text: str) -> int:
    allowed = {x.lower() for x in STD["text"].get("allowed_tags", [])}
    return sum(1 for t in TAG_RE.findall(tts_text) if t.strip().lower() in allowed)


def split_spoken_sentences(text: str) -> list[str]:
    """Tách câu theo dấu kết câu (. ! ? … ...), gộp các mảnh chỉ chứa tag biểu cảm vào câu liền kề."""
    norm_dots = re.sub(r"\.{3,}", "…", text.strip())
    raw = [x.strip() for x in SENT_SPLIT_RE.split(norm_dots) if x.strip()]
    if not raw:
        return [text.strip()] if text.strip() else []
    merged: list[str] = []
    carry = ""
    for part in raw:
        has_words = bool(re.findall(r"[^\W_]+", strip_markup(part), re.UNICODE))
        if not has_words:
            if merged:
                merged[-1] = merged[-1] + " " + part
            else:
                carry = (carry + " " + part).strip()
        else:
            if carry:
                part = carry + " " + part
                carry = ""
            merged.append(part)
    if carry:
        if merged:
            merged[-1] = merged[-1] + " " + carry
        else:
            merged.append(carry)
    return merged


def rhythm_trim(audio: np.ndarray, thr_s: float = 0.32, target_s: float = 0.16) -> np.ndarray:
    """Cắt im lặng đầu/cuối (cửa sổ 5ms, đệm 10ms) và rút khoảng lặng nội câu > thr_s về target_s."""
    win = 240  # 5 ms @ 48 kHz
    if len(audio) <= win * 2:
        return audio
    active = [i for i in range(0, len(audio) - win, win) if np.max(np.abs(audio[i:i + win])) > 210 / 32768]
    if not active:
        return audio
    audio = audio[max(0, active[0] - 480):min(len(audio), active[-1] + win + 480)].copy()
    keep = round((target_s / 2.0) * SR)
    xf = round(0.01 * SR)
    pieces, cursor, start = [], 0, None
    for i in range(0, len(audio), win):
        silent = np.max(np.abs(audio[i:i + win])) < 145 / 32768
        if silent and start is None:
            start = i
        elif not silent and start is not None:
            if i - start > thr_s * SR:
                seg_a = audio[cursor:min(len(audio), start + keep)].copy()
                if len(seg_a) > xf:
                    seg_a[-xf:] *= np.linspace(1.0, 0.0, xf)
                pieces.append(seg_a)
                cursor = max(0, i - keep)
            start = None
    tail = audio[cursor:].copy()
    if pieces and len(tail) > xf:
        tail[:xf] *= np.linspace(0.0, 1.0, xf)
    pieces.append(tail)
    out = np.concatenate(pieces)
    fade = min(len(out) // 4, int(SR * 0.01))
    if fade > 0:
        out[:fade] *= np.linspace(0.0, 1.0, fade)
        out[-fade:] *= np.linspace(1.0, 0.0, fade)
    return out.astype(np.float32)


def _atempo_chain(factor: float) -> str:
    parts = []
    f = float(factor)
    while f < 0.5:
        parts.append("atempo=0.5")
        f /= 0.5
    while f > 2.0:
        parts.append("atempo=2.0")
        f /= 2.0
    parts.append(f"atempo={f:.6f}")
    return ",".join(parts)


def style_sentence(
    raw_wav: np.ndarray,
    sent_tts: str,
    wps_override: float | None = None,
    pitch_override: float | None = None,
    rhythm: dict | None = None,
):
    """Áp nhịp nhanh theo từng câu (offline 5.25 ups / 5.65 ups long_16x9 + pitch 1.02 qua FFmpeg WSOLA)."""
    R = rhythm or STD["rhythm"]
    tr = rhythm_trim(raw_wav, R["inside_pause_threshold_s"], R["inside_pause_target_s"])
    raw_dur = max(len(tr) / SR, 0.08)
    u = syllable_units(sent_tts)
    n_emo = count_emotions(sent_tts)
    clean_inner = re.sub(r"[.!?…]+$", "", strip_markup(re.sub(r"\.{3,}", "…", sent_tts)).strip())
    n_clauses = len(re.findall(r"[,;:…]", clean_inner))
    short_pad = R["short_sentence_pad_s"] if u <= 4 else 0.0

    req_ups = float(wps_override) if wps_override is not None else float(R["target_ups"])
    phon_ups = req_ups * (float(R["phonation_ups"]) / float(R["target_ups"]))
    model_dur = u / phon_ups + n_clauses * float(R["clause_pad_s"]) + short_pad + n_emo * float(R["emotion_cue_s"])
    if wps_override is not None:
        target_dur = model_dur
    else:
        blend = float(R.get("blend_raw", 0.2))
        target_dur = (1.0 - blend) * model_dur + blend * raw_dur

    lo_t, hi_t = R["tempo_clamp"]
    if wps_override is not None:
        lo_t, hi_t = min(lo_t, 0.65), max(hi_t, 1.65)
    tempo = float(np.clip(raw_dur / max(target_dur, 0.22), lo_t, hi_t))
    pitch = float(pitch_override if pitch_override is not None else R["pitch_ratio"])
    atempo_val = tempo / pitch

    if abs(tempo - 1.0) < 1e-3 and abs(pitch - 1.0) < 1e-3:
        out = tr.copy()
    else:
        sr_set = round(SR * pitch)
        af = f"asetrate={sr_set},aresample={SR},{_atempo_chain(atempo_val)}"
        raw_bytes = subprocess.run(
            ["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
             "-af", af, "-f", "f32le", "pipe:1"],
            input=tr.astype("<f4").tobytes(),
            stdout=subprocess.PIPE,
            check=True,
        ).stdout
        out = np.frombuffer(raw_bytes, dtype="<f4").copy()

    fade = min(len(out) // 4, int(SR * 0.01))
    if fade > 0:
        out[:fade] *= np.linspace(0.0, 1.0, fade)
        out[-fade:] *= np.linspace(1.0, 0.0, fade)
    return out.astype(np.float32), {
        "units": round(u, 2),
        "emotions": n_emo,
        "raw_trim_s": round(raw_dur, 3),
        "target_s": round(target_dur, 3),
        "out_s": round(len(out) / SR, 3),
        "tempo": round(tempo, 3),
        "pitch_ratio": round(pitch, 3),
    }


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
    n_emo = count_emotions(text)
    clean = strip_markup(text)
    a = " ".join(norm(x) for x in spell_numbers(" ".join(w["w"] for w in words)).split() if norm(x))
    b = " ".join(norm(x) for x in clean.split() if norm(x))
    if not b:
        return 1.0
    sm = difflib.SequenceMatcher(None, a, b)
    if n_emo <= 0:
        return sm.ratio()
    matched = sum(blk.size for blk in sm.get_matching_blocks())
    adj_a = max(len(b), len(a) - 6 * n_emo)
    return min(1.0, (2.0 * matched) / max(1, adj_a + len(b)))


def text_problems(t: str) -> list[str]:
    """Luật chữ gửi vào engine (cũng được script_lint SC-15..17 kiểm)."""
    r, bad = STD["text"], []
    clean_no_tags = strip_markup(t)
    if r["no_digits"] and re.search(r"\d", clean_no_tags):
        bad.append("có chữ số — viết số thành chữ trong text hoặc tts_text")
    if r.get("no_ellipsis") and ("..." in clean_no_tags or "…" in clean_no_tags):
        bad.append("có '…'")
    allowed = {x.lower() for x in r.get("allowed_tags", [])}
    tags = [x.strip() for x in TAG_RE.findall(t)]
    bad_tags = [x for x in tags if x.lower() not in allowed]
    if bad_tags:
        bad.append(f"tag biểu cảm {bad_tags} không hợp lệ (chỉ dùng: {sorted(allowed)})")
    # kiểm cân bằng thẻ <en>...</en>
    stripped_valid_en = EN_SPAN_RE.sub("", t)
    if re.search(r"</?en\b", stripped_valid_en, flags=re.I):
        bad.append("thẻ <en>...</en> không đóng/mở cân bằng hoặc lồng nhau")
    word_count = len(clean_no_tags.split())
    if word_count > r["max_words_per_call"]:
        bad.append(f"{word_count} từ > {r['max_words_per_call']} trong một đoạn")
    return bad


def seed_for(title: str, sid: str, sent_idx: int, attempt: int, base_seed: int) -> int:
    if attempt == 0 and sent_idx == 0 and base_seed is not None:
        # deterministic per (title, sid, sent_idx) anchored on STD seed
        pass
    h = int(hashlib.sha1(f"{base_seed}|{title}|{sid}|s{sent_idx}|{attempt}".encode()).hexdigest()[:8], 16)
    return h


def holes(w, thr_db=-38, min_s=0.08):
    """Các khoảng lặng bên trong một đoạn: [(bắt đầu, dài)]."""
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


def measure(w, text, aw, rhythm: dict | None = None):
    """Đặc trưng âm học một đoạn/câu: tốc độ (đơn vị âm tiết/giây trừ thời lượng cue biểu cảm), f0, centroid, hole, ASR."""
    import librosa
    R = rhythm or STD["rhythm"]
    y = resample_poly(w, 1, 3)
    f0, vf, _ = librosa.pyin(y, fmin=65, fmax=400, sr=16000, frame_length=1024, hop_length=160)
    v = f0[vf & ~np.isnan(f0)]
    cent = float(np.median(librosa.feature.spectral_centroid(y=y, sr=16000)))
    hs = holes(w)
    u = syllable_units(text)
    n_emo = count_emotions(text)
    eff_dur = max(0.15, (len(w) / SR) - n_emo * float(R["emotion_cue_s"]))
    return {
        "rate_wps": round(u / eff_dur, 3),
        "f0_hz": round(float(np.median(v)) if len(v) else 0.0, 1),
        "centroid_hz": round(cent, 1),
        "max_hole_s": max([d for _, d in hs] or [0.0]),
        "asr_similarity": round(similarity(aw, text), 3),
    }


def line_checks(m, target_wps: float | None = None, default_target_wps: float | None = None):
    """So một đoạn với hồ sơ giọng (hoặc wps đích riêng của đoạn / nhịp hiệu dụng của tập)."""
    P, L = STD["profile"], STD["line_checks"]
    base_rate = float(default_target_wps) if default_target_wps is not None else float(P["rate_wps"])
    ref_rate = float(target_wps) if target_wps is not None else base_rate
    vals = {
        "asr_similarity": m["asr_similarity"],
        "rate_vs_profile": m["rate_wps"] / max(ref_rate, 0.1) - 1,
        "f0_vs_profile_st": 12 * np.log2(max(m["f0_hz"], 1) / P["f0_hz"]),
        "timbre_vs_profile": m["centroid_hz"] / P["centroid_hz"] - 1,
        "max_hole_s": m["max_hole_s"],
    }
    return {k: (round(float(v), 3), L[k], bool(L[k][0] <= v <= L[k][1])) for k, (v, ) in ((k, (vals[k],)) for k in vals)}


def resolve_segment_sentences(
    seg: dict,
    global_english: list[str],
    rhythm: dict | None = None,
    script_wps: float | None = None,
) -> list[dict]:
    """Chuẩn hoá danh sách câu trong một segment (hỗ trợ cả tách tự động lẫn mảng seg['sentences'] tinh chỉnh từng câu)."""
    R = rhythm or STD["rhythm"]
    eng = list(global_english) + list(seg.get("english", []))
    seg_wps = seg.get("wps", script_wps)
    seg_pitch = seg.get("pitch")
    if seg.get("sentences"):
        out = []
        raw_list = seg["sentences"]
        for j, item in enumerate(raw_list):
            if isinstance(item, str):
                s_tts = apply_bilingual(item, eng)
                out.append({
                    "idx": j + 1,
                    "tts": s_tts,
                    "wps": seg_wps,
                    "pitch": seg_pitch,
                    "gap_after": float(R["sentence_gap_s"]) if j + 1 < len(raw_list) else 0.0,
                    "seed": None,
                })
            else:
                raw_txt = item.get("tts_text", item.get("text", ""))
                s_tts = apply_bilingual(raw_txt, eng + list(item.get("english", [])))
                default_gap = float(R["sentence_gap_s"]) if j + 1 < len(raw_list) else 0.0
                out.append({
                    "idx": j + 1,
                    "tts": s_tts,
                    "wps": item.get("wps", seg_wps),
                    "pitch": item.get("pitch", seg_pitch),
                    "gap_after": float(item.get("pause_after", default_gap)) if j + 1 < len(raw_list) else 0.0,
                    "seed": item.get("seed"),
                })
        return out
    spoken = apply_bilingual(seg.get("tts_text", seg["text"]), eng)
    parts = split_spoken_sentences(spoken)
    return [
        {
            "idx": j + 1,
            "tts": p,
            "wps": seg_wps,
            "pitch": seg_pitch,
            "gap_after": float(R["sentence_gap_s"]) if j + 1 < len(parts) else 0.0,
            "seed": seg.get("seed") if len(parts) == 1 else None,
        }
        for j, p in enumerate(parts)
    ]


def map_words(display_script_text: str, asr_words: list[dict], t_off: float, seg_end: float) -> list[dict]:
    """Gán thời gian cho từng từ hiển thị (đã bỏ tag <en> và [...]) khớp với từ whisper nghe được."""
    clean_disp = re.sub(r"\.{3,}", "…", strip_markup(display_script_text))
    toks = clean_disp.split()
    if not toks:
        return []
    sn = [norm(t) for t in toks]
    an = [norm(x["w"]) for x in asr_words]
    sm = difflib.SequenceMatcher(None, sn, an, autojunk=False)
    anchor = {}
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            anchor[blk.a + k] = asr_words[blk.b + k]
    first = asr_words[0]["s"] if asr_words else 0.0
    last = asr_words[-1]["e"] if asr_words else max(0.05, seg_end - t_off)
    n = len(toks)
    starts = [None] * n
    ends = [None] * n
    for i, a in anchor.items():
        starts[i], ends[i] = a["s"], a["e"]
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


def parse_only_spec(spec: str | None) -> dict[str, set[int] | None] | None:
    """Phân tích --only s3,s7.2 -> {'s3': None (cả đoạn), 's7': {2}}."""
    if not spec:
        return None
    targets: dict[str, set[int] | None] = {}
    for raw in spec.split(","):
        item = raw.strip()
        if not item:
            continue
        if "." in item:
            sid, sidx = item.split(".", 1)
            if targets.get(sid) is not None or sid not in targets:
                targets.setdefault(sid, set()).add(int(sidx))
        else:
            targets[item] = None
    return targets


def seg_sha(
    seg: dict,
    global_english: list[str],
    rhythm: dict | None = None,
    script_wps: float | None = None,
) -> str:
    sents = resolve_segment_sentences(seg, global_english, rhythm=rhythm, script_wps=script_wps)
    payload = json.dumps(sents, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(payload.encode()).hexdigest()[:12]



def voice_bus_between_words(words, cues):
    """between_words_db of the processed voice bus (same chain + measure as mix.py / audio_qa.py), whole episode
    and per segment (worst first) so a failure names the lines to re-take."""
    import json as _json
    import audiolib as A
    tg = _json.loads((ROOT / "standards/mix_targets.json").read_text())
    v, vsr = sf.read(ROOT / "audio" / "voice.wav", always_2d=False)
    if v.ndim > 1:
        v = v.mean(axis=1)
    if vsr != A.SR:
        v = resample_poly(v, A.SR, vsr)
    n = int(A.SR * (cues["total"] + 3.0))
    buf = np.zeros(max(n, len(v)))
    buf[: len(v)] = v
    segs = sorted(cues["seg_starts"].items(), key=lambda kv: kv[1])
    bounds = [(k, a, segs[i + 1][1] if i + 1 < len(segs) else cues["total"]) for i, (k, a) in enumerate(segs)]
    bus, info = A.voice_chain(buf, tg["processing"]["voice"], words, bounds)
    # between_words_db counts only frames above -120 dBFS, so it depends on the bus level. The mastered mix always
    # lands the voice stem's speech at about -16 dBFS RMS (5 episodes: -15.8..-16.1); measure at that level.
    if info["speak"].any():
        bus = bus * 10 ** ((A.MIX_SPEECH_RMS_DB - A.rms_db(bus[info["speak"]])) / 20)
    total = A.between_words_db(bus, info["speak"])
    per = {}
    for k, a, b in bounds:
        sl = slice(int(a * A.SR), int(b * A.SR))
        val = A.between_words_db(bus[sl], info["speak"][sl])
        if val > -99:
            per[k] = round(val, 2)
    return total, dict(sorted(per.items(), key=lambda kv: -kv[1]))

# Valid pure-ASCII (unaccented, thanh ngang) Vietnamese syllable pattern for --preflight English detection
_VN_ONSET = r"(?:ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|[bcdghklmnprstvx])?"
_VN_RHYME = (
    r"(?:oai|oay|oao|oeo|uya|uyu|"
    r"oa(?:ch|ng|nh|[cmnpt])?|oe[nt]?|uy(?:ch|nh|[npt])?|oo(?:ng|c)|"
    r"a(?:ch|ng|nh|[cmnpt])|e(?:ng|[cmnpt])|i(?:ch|nh|[mnpt])|o(?:ng|[cmnpt])|u(?:ng|[cmnpt])|"
    r"ai|ao|au|ay|eo|ia|iu|oi|ua|ui|[aeiouy])"
)
_VN_ASCII_SYL_RE = re.compile(r"^" + _VN_ONSET + _VN_RHYME + r"$")
_VN_ASSIMILATED_LOANWORDS = {
    "centimet", "milimet", "kilomet", "xentimet", "kilogam", "miligam", "mililit", "hecta", "cacao", "tivi",
}
_EN_VN_SHAPE_COLLISIONS = {
    "chat", "hit", "hot", "kit", "map", "min", "net", "pay", "pop", "rap", "rich",
    "set", "tap", "tip", "top", "trap", "trim", "trip", "vip",
}


def _looks_unwrapped_english(word: str) -> bool:
    lw = word.lower()
    if lw in _VN_ASSIMILATED_LOANWORDS:
        return False
    if lw in _EN_VN_SHAPE_COLLISIONS:
        return True
    return not bool(_VN_ASCII_SYL_RE.match(lw))


def run_preflight(script: dict, voice: str, allow_voice: bool = False, as_json: bool = False) -> int:
    """Zero-TTS deterministic preflight sanitizer for script.json (runs in <0.3s on system python3)."""
    text_rules = STD.get("text", {})
    allowed_tags = {x.lower() for x in text_rules.get("allowed_tags", [])}
    max_words_seg = int(text_rules.get("max_words_per_call", 45))
    global_english = list(script.get("english", []))
    eff_rhythm = _effective_rhythm(script)
    script_wps = script.get("wps")
    segments = script.get("segments", [])

    errors: list[dict] = []
    warnings: list[dict] = []
    total_sentences = 0
    unwrapped_en_all: set[str] = set()

    if voice != "Hải Đăng" and not allow_voice:
        errors.append({
            "seg": "_episode",
            "code": "invalid_voice",
            "message": f"voice '{voice}' != 'Hải Đăng' (use --allow-voice only if requested by user)",
        })

    if not segments:
        errors.append({"seg": "_episode", "code": "empty_segments", "message": "script.json has no segments"})

    for idx, seg in enumerate(segments):
        sid = str(seg.get("id") or f"#{idx + 1}")
        raw_text = seg.get("text")
        if not isinstance(raw_text, str) or not raw_text.strip():
            errors.append({"seg": sid, "code": "missing_text", "message": "missing or empty 'text'"})
            continue
        if "tts_text" in seg and (not isinstance(seg.get("tts_text"), str) or not seg["tts_text"].strip()):
            errors.append({"seg": sid, "code": "empty_tts_text", "message": "explicit 'tts_text' is empty"})

        if "sentences" in seg:
            for j, st in enumerate(seg.get("sentences", []), 1):
                st_txt = st if isinstance(st, str) else (st.get("tts_text", st.get("text", "")) if isinstance(st, dict) else "")
                if not isinstance(st_txt, str) or not st_txt.strip():
                    errors.append({"seg": f"{sid}.{j}", "code": "empty_sentence", "message": f"sentence {j} has empty text/tts_text"})

        seg_eng = global_english + list(seg.get("english", []))
        # Also validate raw seg['text'] for unbalanced <en>, digits outside <en>, and unknown [tags],
        # because full voice.py checks text_problems(s['text']) before synthesis.
        text_masked_en = EN_SPAN_RE.sub(" ", raw_text)
        if re.search(r"</?en\b", text_masked_en, flags=re.I):
            errors.append({"seg": sid, "code": "unbalanced_en", "message": "unbalanced or nested <en>...</en> in text"})
        text_no_en_no_tag = TAG_RE.sub(" ", text_masked_en)
        if text_rules.get("no_digits", True) and "tts_text" not in seg and "sentences" not in seg:
            # handled per-sentence below; if tts_text overrides text, still flag digits in raw text since voice.py rejects them
            pass
        elif text_rules.get("no_digits", True):
            raw_text_digits = re.findall(r"\d+", text_no_en_no_tag)
            if raw_text_digits:
                errors.append({
                    "seg": sid,
                    "code": "raw_digits_in_text",
                    "message": f"raw digits {raw_text_digits} in 'text' outside <en> (voice.py validates both text & tts_text — spell in Vietnamese words)",
                })

        sent_specs = resolve_segment_sentences(seg, global_english, rhythm=eff_rhythm, script_wps=script_wps)
        if not sent_specs:
            errors.append({"seg": sid, "code": "no_sentences", "message": "resolved 0 spoken sentences"})
            continue

        seg_word_count = len(strip_markup(" ".join(sp["tts"] for sp in sent_specs)).split())
        if seg_word_count > max_words_seg:
            errors.append({
                "seg": sid,
                "code": "max_words_per_call",
                "message": f"{seg_word_count} words > {max_words_seg} max_words_per_call in segment",
            })

        for sp in sent_specs:
            total_sentences += 1
            loc = f"{sid}.{sp['idx']}"
            s_tts = sp["tts"]

            # Check unbalanced <en>
            masked_en = EN_SPAN_RE.sub(" ", s_tts)
            if re.search(r"</?en\b", masked_en, flags=re.I):
                errors.append({"seg": loc, "code": "unbalanced_en", "message": "unbalanced or nested <en>...</en> tag"})

            # Check unknown [tag] emotion markers
            tags = [t.strip() for t in TAG_RE.findall(s_tts)]
            bad_tags = [t for t in tags if t.lower() not in allowed_tags]
            if bad_tags:
                errors.append({
                    "seg": loc,
                    "code": "unknown_tag",
                    "message": f"unknown emotion tag(s) {bad_tags} (allowed: {sorted(allowed_tags)})",
                })

            # Strip <en>...</en> and [tag] to inspect Vietnamese spoken body
            vn_body = TAG_RE.sub(" ", masked_en)

            # 1. Raw ASCII digits outside <en>...</en>
            digits = re.findall(r"\d+", vn_body)
            if digits and text_rules.get("no_digits", True):
                errors.append({
                    "seg": loc,
                    "code": "raw_digits",
                    "message": f"raw digits {digits} outside <en> — write in Vietnamese words in tts_text",
                })

            # 2. Unwrapped ASCII English words ([A-Za-z]{3,} not in english list / <en> / [tag])
            eng_lower = {e.strip().lower() for e in seg_eng if isinstance(e, str) and e.strip()}
            en_hits = []
            for tok in re.findall(r"[^\W_]+", vn_body, re.UNICODE):
                if tok.isascii() and tok.isalpha() and len(tok) >= 3 and tok.lower() not in eng_lower:
                    if _looks_unwrapped_english(tok):
                        en_hits.append(tok)
                        unwrapped_en_all.add(tok)
            if en_hits:
                uniq = sorted(set(en_hits), key=str.lower)
                warnings.append({
                    "seg": loc,
                    "code": "unwrapped_english",
                    "words": uniq,
                    "message": f"unwrapped ASCII English word(s) {uniq} — add to 'english' list or wrap in <en>...</en>",
                })

            # 3. Overly long spoken sentence (> 26 words or > 34 syllable units)
            clean_sent = strip_markup(s_tts)
            w_cnt = len(clean_sent.split())
            u_cnt = round(syllable_units(s_tts), 1)
            if w_cnt > 26 or u_cnt > 34:
                warnings.append({
                    "seg": loc,
                    "code": "long_sentence",
                    "words": w_cnt,
                    "units": u_cnt,
                    "message": f"long spoken sentence ({w_cnt} words, {u_cnt} units; target <=26 words / <=34 units) — split sentence to avoid WSOLA retries",
                })

    payload = {
        "ok": len(errors) == 0,
        "voice": voice,
        "segments": len(segments),
        "sentences": total_sentences,
        "error_count": len(errors),
        "warning_count": len(warnings),
        "unwrapped_english": sorted(unwrapped_en_all, key=str.lower),
        "errors": errors,
        "warnings": warnings,
    }
    if as_json:
        print(json.dumps(payload, ensure_ascii=False, indent=1))
    else:
        status = "PASS" if payload["ok"] else "FAIL"
        print(
            f"voice preflight [{status}]: {len(segments)} segments, {total_sentences} sentences · "
            f"{len(errors)} error(s), {len(warnings)} warning(s)"
        )
        for e in errors[:20]:
            print(f"  ERROR [{e['seg']}] ({e['code']}): {e['message']}")
        if len(errors) > 20:
            print(f"  ... +{len(errors) - 20} more error(s)")
        for w in warnings[:20]:
            print(f"  WARN  [{w['seg']}] ({w['code']}): {w['message']}")
        if len(warnings) > 20:
            print(f"  ... +{len(warnings) - 20} more warning(s)")
    return 0 if payload["ok"] else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=None)
    ap.add_argument("--reuse", action="store_true", help="dựng lại nhịp/tempo/pause từ audio/_sents/*_raw.wav, không gọi lại VieNeu")
    ap.add_argument("--calibrate", nargs="+", default=None, help="wav:text ... -> in hồ sơ giọng (đổi chuẩn series)")
    ap.add_argument("--missing", action="store_true", help="chỉ sinh các đoạn/câu chưa có audio")
    ap.add_argument("--only", default=None, help="sinh lại đoạn hoặc câu cụ thể (vd: s3,s7.2)")
    ap.add_argument("--allow-voice", action="store_true", help="cho phép giọng khác Hải Đăng (chỉ khi người dùng yêu cầu)")
    ap.add_argument("--preflight", action="store_true", help="kiểm tra nhanh kịch bản trước khi gọi TTS (không tải VieNeu/Whisper)")
    ap.add_argument("--json", action="store_true", help="xuất JSON (dùng cùng --preflight)")
    args = ap.parse_args()

    script = json.loads((ROOT / "script.json").read_text())
    voice = args.voice or script.get("voice", "")
    if args.preflight:
        raise SystemExit(run_preflight(script, voice, allow_voice=args.allow_voice, as_json=args.json))
    if np is None or sf is None or resample_poly is None:
        raise SystemExit("voice.py synthesis requires VieNeu venv (numpy/soundfile/scipy) — run with /Users/Shared/Tools/VieNeu-TTS/.venv/bin/python")
    if voice != "Hải Đăng" and not args.allow_voice:
        raise SystemExit(f"giọng '{voice}' không phải Hải Đăng — luật nhà. Dùng --allow-voice chỉ khi người dùng yêu cầu.")
    PA = _load_pacing()
    if script.get("length") == "long":  # opt-in band, approved in brief.md (script_lint SC-27)
        PA["episode"] = PA["episode_long"]
    elif script.get("length") == "long_16x9":  # 10-min 16:9 band (sv-02-long-form)
        PA["episode"] = PA["episode_long_16x9"]
    ep_cfg = PA["episode"]
    eff_rhythm = _effective_rhythm(script, PA)
    script_wps = script.get("wps")
    default_pause = script.get("pause_after", ep_cfg.get("default_pause_after_s", PA["voice"]["default_pause_after_s"]))
    global_english = script.get("english", [])
    sents_dir = ROOT / "audio" / "_sents"
    for d in (ROOT / "audio", sents_dir, ROOT / "public", ROOT / "qa", ROOT / "src/data"):
        d.mkdir(parents=True, exist_ok=True)
    only_map = parse_only_spec(args.only)

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
    bad_text = {}
    for s in script["segments"]:
        probs = text_problems(s["text"])
        if "tts_text" in s:
            probs += text_problems(s["tts_text"])
        for j, st in enumerate(s.get("sentences", []), 1):
            st_txt = st if isinstance(st, str) else st.get("tts_text", st.get("text", ""))
            probs += [f"câu {j}: {p}" for p in text_problems(st_txt)]
        if probs:
            bad_text[s["id"]] = probs
    if bad_text:
        raise SystemExit("chữ gửi vào giọng sai chuẩn (voice_standard.json → text):\n" + "\n".join(f"  {k}: {v}" for k, v in bad_text.items()))

    alog_path = ROOT / "qa" / "voice_attempts.json"
    attempts_log = json.loads(alog_path.read_text()) if alog_path.exists() else {}

    tts = None
    preset = None
    if not args.reuse:
        import torch
        from vieneu import Vieneu
        tts = Vieneu(precision=E["precision"])
        preset = tts.get_preset_voice(voice) if voice in getattr(tts, "_preset_voices", {}) else voice

    title = script.get("title", "")
    base_seed = int(script.get("voice_seed", E.get("seed", 20261111)))

    for seg in script["segments"]:
        sid = seg["id"]
        sent_specs = resolve_segment_sentences(seg, global_english, rhythm=eff_rhythm, script_wps=script_wps)
        need_seg = True
        if only_map is not None and sid not in only_map:
            need_seg = False
        if args.missing and (ROOT / "audio" / f"{sid}.wav").exists() and all((sents_dir / f"{sid}_{sp['idx']:02d}_raw.wav").exists() for sp in sent_specs):
            need_seg = False

        if not need_seg and not args.reuse and (ROOT / "audio" / f"{sid}.wav").exists():
            continue

        only_sents = only_map.get(sid) if only_map is not None else None
        seg_pieces = []
        sent_logs = []
        prev_entry = attempts_log.get(sid, {})
        prev_sents = {x["idx"]: x for x in prev_entry.get("sentences", [])} if isinstance(prev_entry, dict) else {}

        for sp in sent_specs:
            j = sp["idx"]
            raw_path = sents_dir / f"{sid}_{j:02d}_raw.wav"
            styled_path = sents_dir / f"{sid}_{j:02d}.wav"
            hash_obj = sp if eff_rhythm == STD["rhythm"] else {**sp, "_rhythm_ups": eff_rhythm["target_ups"], "_blend": eff_rhythm.get("blend_raw")}
            sp_hash = hashlib.sha1(json.dumps(hash_obj, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:10]
            prev_s = prev_sents.get(j, {})
            prev_tries = prev_s.get("tries", []) if isinstance(prev_s, dict) else []
            prev_passed = bool(prev_tries) and not prev_tries[-1].get("fails")
            unchanged_cached = (
                only_map is None
                and not getattr(args, "force", False)
                and raw_path.exists()
                and styled_path.exists()
                and prev_s.get("sp_hash") == sp_hash
                and prev_passed
            )
            regen_this = (
                not args.reuse
                and not unchanged_cached
                and need_seg
                and (only_sents is None or j in only_sents or not raw_path.exists())
            )

            tries = prev_sents.get(j, {}).get("tries", [])
            style_meta = prev_sents.get(j, {}).get("style", {})

            if regen_this:
                import torch
                tries = []
                best_raw = None
                best_styled = None
                best_fails_n = 999
                for attempt in range(E["max_attempts"]):
                    sd = int(sp["seed"]) + attempt if sp["seed"] is not None else seed_for(title, sid, j, attempt, base_seed)
                    torch.manual_seed(sd)
                    np.random.seed(sd % (2 ** 32))
                    random.seed(sd)
                    raw_w = np.asarray(
                        tts.infer(
                            text=sp["tts"],
                            voice=preset,
                            use_ref_codes=bool(E.get("use_ref_codes", True)),
                            temperature=E["temperature"],
                            top_k=E["top_k"],
                            top_p=E["top_p"],
                            repetition_penalty=E["repetition_penalty"],
                        ),
                        dtype=np.float32,
                    )
                    styled_w, s_meta = style_sentence(raw_w, sp["tts"], sp["wps"], sp["pitch"], rhythm=eff_rhythm)
                    aw_s = asr(wm, styled_w)
                    m_s = measure(styled_w, sp["tts"], aw_s, rhythm=eff_rhythm)
                    ch_s = line_checks(m_s, target_wps=sp["wps"], default_target_wps=eff_rhythm["target_ups"])
                    # ở mức câu lẻ ngắn (<= 4 âm tiết), chỉ bắt ASR & hole để tránh nhiễu f0 trên câu 2 từ
                    if syllable_units(sp["tts"]) <= 4:
                        fails_s = [k for k, (_, _, ok) in ch_s.items() if not ok and k in ("asr_similarity", "max_hole_s")]
                    else:
                        fails_s = [k for k, (_, _, ok) in ch_s.items() if not ok]
                    tries.append({"attempt": attempt, "seed": sd, "fails": fails_s, **m_s, "tempo": s_meta["tempo"]})
                    print(
                        f"{sid}.{j} lần {attempt + 1}: {len(styled_w) / SR:.2f}s (tempo {s_meta['tempo']:.2f}x) "
                        f"{m_s['rate_wps']} ups f0 {m_s['f0_hz']} sim {m_s['asr_similarity']} "
                        f"-> {'ĐẠT' if not fails_s else 'trượt ' + ','.join(fails_s)}",
                        flush=True,
                    )
                    if len(fails_s) < best_fails_n:
                        best_fails_n = len(fails_s)
                        best_raw = raw_w
                        best_styled = styled_w
                        style_meta = s_meta
                    if not fails_s:
                        break
                    sf.write(ROOT / "audio" / f"{sid}_s{j}_try{attempt}.wav", styled_w, SR)
                sf.write(raw_path, best_raw, SR)
                sf.write(styled_path, best_styled, SR)
                cur_styled = best_styled
            elif raw_path.exists() and (args.reuse or not styled_path.exists() or prev_sents.get(j, {}).get("sp_hash") != sp_hash):
                raw_w, _ = sf.read(raw_path, dtype="float32")
                cur_styled, style_meta = style_sentence(raw_w, sp["tts"], sp["wps"], sp["pitch"], rhythm=eff_rhythm)
                sf.write(styled_path, cur_styled, SR)
            elif styled_path.exists():
                cur_styled, _ = sf.read(styled_path, dtype="float32")
            else:
                raise SystemExit(f"thiếu {raw_path} — chạy lại scripts/voice.py không có --reuse")

            seg_pieces.append(cur_styled)
            if sp["gap_after"] > 0:
                seg_pieces.append(np.zeros(round(sp["gap_after"] * SR), dtype=np.float32))
            sent_logs.append({"idx": j, "tts": sp["tts"], "gap_after": sp["gap_after"], "sp_hash": sp_hash, "style": style_meta, "tries": tries})

        seg_wav = np.concatenate(seg_pieces) if seg_pieces else np.zeros(int(0.1 * SR), dtype=np.float32)
        sf.write(ROOT / "audio" / f"{sid}.wav", seg_wav, SR)
        max_tries = max((len(x["tries"]) for x in sent_logs), default=1)
        attempts_log[sid] = {
            "text_sha": seg_sha(seg, global_english, rhythm=eff_rhythm, script_wps=script_wps),
            "tries": [{"attempt": k} for k in range(max(1, max_tries))],
            "sentences": sent_logs,
        }
        alog_path.write_text(json.dumps(attempts_log, ensure_ascii=False, indent=1))

    # ---- ghép cả tập + timeline + words ----
    t = 0.0
    chunks, timeline, words = [], [], []
    for seg in script["segments"]:
        sid = seg["id"]
        w, sr = sf.read(ROOT / "audio" / f"{sid}.wav", dtype="float32")
        assert sr == SR
        dur = len(w) / SR
        aw = asr(wm, w)
        mapped = map_words(seg["text"], aw, t, t + dur)
        seg_words = [{**m, "seg": sid} for m in mapped]
        words += seg_words

        sent_specs = resolve_segment_sentences(seg, global_english, rhythm=eff_rhythm, script_wps=script_wps)
        spoken_joined = " ".join(sp["tts"] for sp in sent_specs)
        # trừ các khoảng gap_after nội đoạn khi đo tốc độ nói của đoạn để so với nhịp mục tiêu (5.25 ups hoặc 5.65 ups long_16x9)
        intra_gaps = sum(sp["gap_after"] for sp in sent_specs)
        m = measure(w, spoken_joined, aw, rhythm=eff_rhythm)
        if intra_gaps > 0:
            u_tot = syllable_units(spoken_joined)
            n_emo_tot = count_emotions(spoken_joined)
            eff_speak_s = max(0.15, dur - intra_gaps - n_emo_tot * float(eff_rhythm["emotion_cue_s"]))
            m["rate_wps"] = round(u_tot / eff_speak_s, 3)

        # nếu đoạn hoặc các câu trong đoạn đặt wps riêng thì so rate với trung bình có trọng số của đoạn đó
        if any(sp["wps"] is not None for sp in sent_specs):
            u_weights = [syllable_units(sp["tts"]) for sp in sent_specs]
            sp_rates = [float(sp["wps"] or eff_rhythm["target_ups"]) for sp in sent_specs]
            seg_target_wps = sum(uw * rw for uw, rw in zip(u_weights, sp_rates)) / max(1.0, sum(u_weights))
        else:
            seg_target_wps = None

        ch = line_checks(m, target_wps=seg_target_wps, default_target_wps=eff_rhythm["target_ups"])
        # nếu có khoảng nghỉ câu nội đoạn có chủ đích (>0.4s) thì không báo lỗi max_hole_s do chính gap_after đó
        max_custom_gap = max([sp["gap_after"] for sp in sent_specs] or [0.0])
        if max_custom_gap > STD["line_checks"]["max_hole_s"][1] and not ch["max_hole_s"][2]:
            if m["max_hole_s"] <= max_custom_gap + 0.08:
                ch["max_hole_s"] = (ch["max_hole_s"][0], ch["max_hole_s"][1], True)

        cur_sha = seg_sha(seg, global_english, rhythm=eff_rhythm, script_wps=script_wps)
        logged_sha = attempts_log.get(sid, {}).get("text_sha")
        sent_logs = attempts_log.get(sid, {}).get("sentences", [])
        n_attempts = max([len(x.get("tries", [])) for x in sent_logs] or [len(attempts_log.get(sid, {}).get("tries", []))] or [1])

        clean_disp = strip_markup(seg["text"])
        timeline.append({
            "id": sid,
            "text": seg["text"],
            "spoken": spoken_joined,
            "start": round(t, 3),
            "end": round(t + dur, 3),
            "asr": " ".join(x["w"] for x in aw),
            "similarity": round(similarity(aw, spoken_joined), 3),
            "wps": round(len(clean_disp.split()) / max(dur, 0.1), 2),
            "measure": m,
            "checks": {k: {"value": v, "range": r, "ok": ok} for k, (v, r, ok) in ch.items()},
            "fails": [k for k, (_, _, ok) in ch.items() if not ok],
            "attempts": n_attempts,
            "text_sha_ok": logged_sha in (None, cur_sha),
            "sentences": [
                {"idx": x["idx"], "tts": x["tts"], "gap_after": x["gap_after"], **x.get("style", {})}
                for x in sent_logs
            ],
        })
        print(sid, f"{t:.2f}-{t + dur:.2f}", "|", timeline[-1]["asr"], "| trượt: " + ",".join(timeline[-1]["fails"]) if timeline[-1]["fails"] else "")
        pause_s = float(seg.get("pause_after", default_pause))
        chunks += [w, np.zeros(int(SR * pause_s), dtype=np.float32)]
        t += dur + pause_s

    voice_wav = np.concatenate(chunks) if chunks else np.zeros(int(0.1 * SR), dtype=np.float32)
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
    cues["voice_end"] = round(timeline[-1]["end"], 3) if timeline else 0.0
    cues["total"] = round(t, 3)

    (ROOT / "qa" / "timeline.json").write_text(json.dumps({"voice": voice, "total": round(t, 3), "segments": timeline}, ensure_ascii=False, indent=2))

    # ---- line + episode checks (voice_standard.json) and pacing (pacing.json) ----
    failed = {x["id"]: x["fails"] for x in timeline if x["fails"]}
    ms = [x["measure"] for x in timeline]
    f0s = np.array([m["f0_hz"] for m in ms if m["f0_hz"] > 0])
    # loại các đoạn có wps override chủ đích khỏi rate_cv để không phạt việc tác giả cố ý giảm nhịp ở câu Turn
    default_rates = np.array([
        x["measure"]["rate_wps"]
        for x, seg in zip(timeline, script["segments"])
        if seg.get("wps") is None and not any(isinstance(st, dict) and st.get("wps") is not None for st in seg.get("sentences", []))
    ])
    if not len(default_rates):
        default_rates = np.array([m["rate_wps"] for m in ms])
    cents = np.array([m["centroid_hz"] for m in ms])
    sent_tried = [
        len(s.get("tries", []))
        for x in timeline
        for s in (attempts_log.get(x["id"], {}).get("sentences") or [])
        if s.get("tries")
    ]
    tried = sent_tried if sent_tried else [x["attempts"] for x in timeline if x["attempts"]]
    EC = STD["episode_checks"]
    ep_vals = {
        "f0_spread_st": float(np.std(12 * np.log2(f0s / np.median(f0s)))) if len(f0s) else 99.0,
        "rate_cv": float(default_rates.std() / max(default_rates.mean(), 1e-6)) if len(default_rates) else 0.0,
        "timbre_cv": float(cents.std() / max(cents.mean(), 1e-6)) if len(cents) else 0.0,
        "retry_share": float(np.mean([a > 1 for a in tried])) if tried else 0.0,
    }
    # G3 measures the voice bus exactly as G6 will (audiolib.voice_chain): noise / reverb tail between words.
    # Before v3.7 this was first seen at G6 and sent the episode back through G2 -> G3 -> G5.
    bw_total, bw_segs = voice_bus_between_words(words, cues)
    ep_vals["between_words_db"] = bw_total
    voice_end = timeline[-1]["end"] if timeline else 0.0
    pauses_s = sum(float(s.get("pause_after", default_pause)) for s in script["segments"][:-1])
    total_units = sum(syllable_units(x["spoken"]) for x in timeline)
    emo_total_s = sum(count_emotions(x["spoken"]) * float(eff_rhythm["emotion_cue_s"]) for x in timeline)
    pace_vals = {
        "voice_s": voice_end,
        "overall_wps": total_units / max(voice_end - emo_total_s, 0.1),
        "pause_share": pauses_s / max(voice_end, 0.1),
        "segments": len(timeline),
    }
    pace_rng = {
        "voice_s": ep_cfg["voice_s"],
        "overall_wps": ep_cfg.get("overall_wps", PA["voice"]["overall_wps"]),
        "pause_share": ep_cfg.get("pause_share", PA["voice"]["pause_share"]),
        "segments": ep_cfg["segments"],
    }
    episode_checks = [{"group": "voice", "check": k, "value": round(v, 3), "range": EC[k], "ok": EC[k][0] <= v <= EC[k][1]} for k, v in ep_vals.items()]
    episode_checks += [{"group": "pacing", "check": k, "value": round(v, 3), "range": pace_rng[k], "ok": pace_rng[k][0] <= v <= pace_rng[k][1]} for k, v in pace_vals.items()]
    stale = [x["id"] for x in timeline if not x["text_sha_ok"]]
    report = {
        "voice": voice,
        "standard": STD["version"],
        "pacing": PA["version"],
        "engine": E,
        "rhythm": STD["rhythm"],
        "effective_rhythm": eff_rhythm,
        "total": round(t, 3),
        "words": len(words),
        "units": round(total_units, 1),
        "wps": round(pace_vals["overall_wps"], 2),
        "script_sha": hashlib.sha256((ROOT / "script.json").read_bytes()).hexdigest()[:16],
        "voice_sha": hashlib.sha256((ROOT / "audio" / "voice.wav").read_bytes()).hexdigest()[:16],
        "standard_sha": hashlib.sha256((ROOT / "standards/voice_standard.json").read_bytes()).hexdigest()[:16],
        "pacing_sha": hashlib.sha256((ROOT / "standards/pacing.json").read_bytes()).hexdigest()[:16],
        "failed_lines": failed,
        "stale_lines": stale,
        "episode_checks": episode_checks,
        "between_words_by_seg": bw_segs,
        "segments": [
            {k: x[k] for k in ("id", "start", "end", "similarity", "wps", "asr", "measure", "checks", "fails", "attempts", "sentences")}
            for x in timeline
        ],
    }
    (ROOT / "qa" / "voice_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    bad_ep = [f"{c['group']}.{c['check']}={c['value']} ngoài {c['range']}" for c in episode_checks if not c["ok"]]
    print(f"voice report: {len(timeline)} đoạn, {voice_end:.1f}s, {report['wps']} đơn vị/giây, đoạn trượt: {failed or 'không'}, cả tập: {bad_ep or 'đạt'}")
    bw_c = next(c for c in episode_checks if c["check"] == "between_words_db")
    if not bw_c["ok"]:
        worst = [k for k, v in bw_segs.items() if v > bw_c["range"][1]][:8] or list(bw_segs)[:5]
        print(f"=> nhiễu/đuôi vang giữa các từ {bw_c['value']} dB (> {bw_c['range'][1]}): tạo lại các đoạn tệ nhất  --only " + ",".join(worst))
    if failed:
        print("=> sửa chữ (tts_text / sentences) của các đoạn trượt rồi:  --only " + ",".join(failed))
    if stale:
        print("=> chữ đã đổi sau khi sinh giọng:  --only " + ",".join(stale))
    (ROOT / "src/data/words.json").write_text(json.dumps(words, ensure_ascii=False))
    (ROOT / "src/data/cues.json").write_text(json.dumps(cues, ensure_ascii=False, indent=2))
    print("CUES", json.dumps({k: v for k, v in cues.items() if k != "seg_starts"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
