#!/usr/bin/env python3
"""Post-encode 30fps transition flicker & blank-flash CI verifier (v6.2.1).

Decodes the delivered MP4 once at low resolution (aspect-agnostic 9:16 & 16:9) in streaming
O(N_shots) memory and inspects every shot cut in qa/shots.json for two delivery-breaking glitches:
  - DL-01: Stale previous-set backdrop bleeding across a set transition (typical when SVG <image>
           is mounted without <RasterPlate> / delayRender or keyed <LayerG>).
  - DL-02: Blank / solid-color unrendered flash frame immediately after a cut.

Usage:
  python scripts/transition_qa.py [--video out/final.mp4] [--shots qa/shots.json] [--out qa/transition_qa.json]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

for _st in (sys.stdout, sys.stderr):
    if hasattr(_st, "reconfigure"):
        try:
            _st.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

try:
    import numpy as np
except ImportError as exc:
    sys.stderr.write(f"transition_qa.py requires numpy ({exc}). Run with SV_PY or VieNeu venv Python.\n")
    sys.exit(1)

RULE_STALE_BG = "DL-01"
RULE_BLANK_FLASH = "DL-02"

# Frames intentionally covered by Film.tsx transition overlays (flash/wipe/whip/iris) before checking
TR_SKIP_FRAMES = {
    "cut": 1,
    "flash": 7,
    "whipL": 8,
    "whipR": 8,
    "wipe": 10,
    "iris": 12,
}


def _sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _probe_video(mp4: Path) -> tuple[int, int, float]:
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate",
        "-of", "json", str(mp4),
    ]
    raw = subprocess.check_output(cmd)
    info = json.loads(raw.decode("utf-8", errors="replace"))
    streams = info.get("streams") or []
    if not streams:
        raise RuntimeError(f"no video stream found in {mp4}")
    st = streams[0]
    w = int(st.get("width") or 1080)
    h = int(st.get("height") or 1920)
    rfr = str(st.get("r_frame_rate") or "30/1")
    if "/" in rfr:
        num, den = rfr.split("/", 1)
        fps = float(num) / max(1.0, float(den))
    else:
        fps = float(rfr)
    return w, h, fps


def _l1(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.mean(np.abs(a.astype(np.float32) - b.astype(np.float32))))


def analyze_transitions(mp4: Path, shots_path: Path, out_path: Path, fps_override: float | None = None) -> dict:
    if not mp4.is_file():
        raise FileNotFoundError(f"video file not found: {mp4}")
    if not shots_path.is_file():
        raise FileNotFoundError(f"shots table not found: {shots_path}")

    shots = json.loads(shots_path.read_text(encoding="utf-8"))
    if not isinstance(shots, list) or not shots:
        raise ValueError(f"{shots_path} must contain a non-empty list of shots")

    vw, vh, probed_fps = _probe_video(mp4)
    fps = float(fps_override) if fps_override else probed_fps
    if fps <= 0:
        fps = 30.0

    # Aspect-agnostic low-res decode (~16,128 px/frame -> ~48 KB/frame)
    dw, dh = (168, 96) if vw > vh else (96, 168)
    top_h = max(8, int(dh * 0.45))

    # Pre-compute the exact set of frame indices needed so RAM stays O(N_shots) even for 10+ min episodes
    needed: set[int] = set()
    shot_windows: list[dict] = []
    for idx, s in enumerate(shots):
        t0 = float(s.get("t0", 0.0))
        t1 = float(s.get("t1", t0 + 1.0))
        tr = str(s.get("tr") or "cut")
        f0 = max(0, int(round(t0 * fps)))
        f1 = max(f0 + 1, int(round(t1 * fps)) - 1)
        k_start = TR_SKIP_FRAMES.get(tr, 1)
        span = max(1, f1 - f0)
        # Pick steady reference past any transition overlay and away from initial frames
        f_ref = min(f1, f0 + min(max(k_start + 6, 18), max(k_start, span // 2)))
        needed.add(f_ref)

        is_set_cut = idx > 0 and s.get("set") != shots[idx - 1].get("set")
        f_prev = max(0, f0 - 2)
        if idx > 0:
            needed.add(f_prev)
            for k in range(k_start, min(16, max(k_start, f1 - f0))):
                needed.add(f0 + k)
        shot_windows.append({
            "idx": idx,
            "shot": s.get("i", idx),
            "set": s.get("set"),
            "prev_set": shots[idx - 1].get("set") if idx > 0 else None,
            "tr": tr,
            "f0": f0,
            "f1": f1,
            "f_ref": f_ref,
            "f_prev": f_prev,
            "k_start": k_start,
            "is_set_cut": is_set_cut,
        })

    frame_bytes = dw * dh * 3
    cmd = [
        "ffmpeg", "-v", "error", "-i", str(mp4),
        "-vf", f"scale={dw}:{dh}",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdout is not None and proc.stderr is not None

    frames: dict[int, np.ndarray] = {}
    n_frames = 0
    try:
        while True:
            buf = proc.stdout.read(frame_bytes)
            if not buf or len(buf) < frame_bytes:
                break
            if n_frames in needed:
                frames[n_frames] = np.frombuffer(buf, dtype=np.uint8).reshape((dh, dw, 3)).copy()
            n_frames += 1
    finally:
        stderr_txt = proc.stderr.read().decode("utf-8", errors="replace").strip()
        rc = proc.wait()

    if rc != 0 or n_frames == 0:
        raise RuntimeError(f"ffmpeg decode failed (rc={rc}, frames={n_frames}): {stderr_txt}")

    stale_issues: list[dict] = []
    flash_issues: list[dict] = []
    set_transitions = 0

    for sw in shot_windows:
        if sw["idx"] == 0:
            continue
        f0 = sw["f0"]
        f1 = min(sw["f1"], n_frames - 1)
        f_ref = min(sw["f_ref"], n_frames - 1)
        f_prev = min(sw["f_prev"], n_frames - 1)
        if f_ref not in frames or f_prev not in frames:
            continue
        curr_frame = frames[f_ref]
        curr_top = curr_frame[:top_h]
        curr_std = float(np.std(curr_frame.astype(np.float32)))
        prev_top = frames[f_prev][:top_h]

        if sw["is_set_cut"]:
            set_transitions += 1
        set_diff = _l1(prev_top, curr_top) if sw["is_set_cut"] else 0.0

        k_start = sw["k_start"]
        k_end = min(16, f1 - f0)
        for k in range(k_start, k_end):
            f = f0 + k
            # Avoid false positives on episode fade-in (first ~0.35s) or fade-out (last ~0.9s)
            if f < 10 or f >= max(10, n_frames - 27) or f not in frames:
                continue
            fr = frames[f]
            fr_top = fr[:top_h]
            if sw["is_set_cut"] and set_diff > 10.0:
                d_prev = _l1(fr_top, prev_top)
                d_curr = _l1(fr_top, curr_top)
                if d_prev + 3.0 < d_curr:
                    stale_issues.append({
                        "shot": sw["shot"],
                        "prev_set": sw["prev_set"],
                        "set": sw["set"],
                        "frame": f,
                        "offset_f": k,
                        "t": round(f / fps, 3),
                        "d_prev": round(d_prev, 2),
                        "d_curr": round(d_curr, 2),
                    })
            fr_std = float(np.std(fr.astype(np.float32)))
            if fr_std < 7.5 and curr_std > 15.0:
                flash_issues.append({
                    "shot": sw["shot"],
                    "set": sw["set"],
                    "frame": f,
                    "offset_f": k,
                    "t": round(f / fps, 3),
                    "std": round(fr_std, 2),
                })

    errors: list[str] = []
    if stale_issues:
        sample = stale_issues[0]
        errors.append(
            f"[{RULE_STALE_BG}] {len(stale_issues)} stale-backdrop frame(s) leaked across set cuts "
            f"(first at shot #{sample['shot']} {sample['prev_set']}->{sample['set']} frame {sample['frame']}, "
            f"d_prev={sample['d_prev']} < d_curr={sample['d_curr']}) — mount raster plates with <RasterPlate> from src/kit.tsx"
        )
    if flash_issues:
        sample = flash_issues[0]
        errors.append(
            f"[{RULE_BLANK_FLASH}] {len(flash_issues)} blank/unrendered flash frame(s) detected after shot cuts "
            f"(first at shot #{sample['shot']} set={sample['set']} frame {sample['frame']}, std={sample['std']})"
        )

    result = {
        "ok": len(errors) == 0,
        "video": mp4.as_posix(),
        "final_sha": _sha256_file(mp4),
        "shots_sha": _sha256_file(shots_path),
        "width": vw,
        "height": vh,
        "fps": round(fps, 3),
        "total_frames": n_frames,
        "shots": len(shots),
        "set_transitions": set_transitions,
        "stale_bg_frames": len(stale_issues),
        "blank_flash_frames": len(flash_issues),
        "errors": errors,
        "stale_samples": stale_issues[:20],
        "flash_samples": flash_issues[:20],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify 30fps post-encode set transitions for stale-backdrop flicker (DL-01) and blank flashes (DL-02).")
    ap.add_argument("--video", default="out/final.mp4", help="Rendered MP4 path (default: out/final.mp4)")
    ap.add_argument("--shots", default="qa/shots.json", help="Shot table JSON path (default: qa/shots.json)")
    ap.add_argument("--out", default="qa/transition_qa.json", help="Output report JSON path (default: qa/transition_qa.json)")
    ap.add_argument("--fps", type=float, default=None, help="Override frame rate (defaults to ffprobe stream fps)")
    args = ap.parse_args()

    try:
        res = analyze_transitions(Path(args.video), Path(args.shots), Path(args.out), args.fps)
    except Exception as exc:
        sys.stderr.write(f"transition_qa error: {exc}\n")
        return 1

    if res["ok"]:
        print(
            f"transition_qa: PASS ({res['total_frames']} frames, {res['set_transitions']} set transitions, "
            f"0 stale-bg, 0 blank-flash) -> {args.out}"
        )
        return 0
    for e in res["errors"]:
        print(f"transition_qa: FAIL {e}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
