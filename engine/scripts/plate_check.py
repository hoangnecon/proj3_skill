"""Visible-detail & perceptual quality check of rendered set plates (lint SE-13 + RSI v4.3.0).
Counts what the camera actually SEES, so shapes hidden off-frame or under other shapes do not count.

  python3 scripts/plate_check.py qa/design/set_<id>.png ...   -> updates qa/design/plate_stats.json

The plate (minus the 120 px SetPlate title band, dynamically cropped for both 9:16 and 16:9) is cut into
180 px cells. A cell is EMPTY when < 0.3 % of its pixels sit on an edge (luminance step > 40) — a flat wall,
a bare floor. Ceiling (top row) and floor (bottom row) may be plain; the rows in between are where the story
is read, so they must be filled.
Calibration (v2): ex-lobby 0, ex-machine 0, ex-corridor 1, ex-car 7, ex-basement 8 empty middle cells;
a "few boxes" set scores 15+. Lint: > 8 error, > 5 warning.

Perceptual quality metrics (RSI v4.3.0 + v6.2.0 Art Direction CI):
  - grid_3x3_edge_pct     : flattened 9-float Rule-of-Thirds matrix [A1, B1, C1, A2, B2, C2, A3, B3, C3]
  - clutter_max_3x3       : max edge % in any 3x3 cell (flagged > 16.0% as visually chaotic)
  - center_mg_edge_pct    : edge % in B2 (33%..66% X, 33%..66% Y midground staging cell)
  - contrast_std          : luminance std dev across the cropped plate (flagged < 22.0 as flat/washed-out)
  - lr_balance_delta      : abs(left_half_edge_pct - right_half_edge_pct) (flagged > 7.5% as lopsided)
  - color_clusters        : count of 8x8x8 quantized RGB bins holding >= 0.25% of cropped pixels
  - cross_set_max_sim     : max pairwise 32x32 RGB+luminance similarity against any other set_*.png in qa/design/
  - cross_set_most_similar: set id of the most visually similar other plate (or null if <= 1 plate)
  - quality_flags         : human-readable warning strings for any perceptual threshold breach
"""
import json
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

CELL = 180
TITLE_BAR_PX = 120
CELL_NAMES_3X3 = ("A1", "B1", "C1", "A2", "B2", "C2", "A3", "B3", "C3")

CLUTTER_MAX_3X3_THR = 16.0
CONTRAST_STD_MIN = 22.0
LR_BALANCE_MAX = 7.5
COLOR_CLUSTER_MIN_SHARE = 0.0025  # 0.25% of cropped pixels in 8x8x8 RGB cube (512 bins)
SIM_SIZE = (32, 32)
_RESAMPLE = getattr(Image, "Resampling", Image).BILINEAR


def _crop_plate(img: Image.Image) -> Image.Image:
    w, h = img.size
    title_y = max(CELL, h - TITLE_BAR_PX)
    return img.crop((0, 0, w, min(h, title_y)))


def _color_clusters(im_rgb: np.ndarray) -> int:
    q = np.clip(im_rgb, 0, 255).astype(np.int32) // 32
    bins = q[..., 0] * 64 + q[..., 1] * 8 + q[..., 2]
    counts = np.bincount(bins.ravel(), minlength=512)
    min_px = max(1.0, float(bins.size) * COLOR_CLUSTER_MIN_SHARE)
    return int(np.sum(counts >= min_px))


def _plate_signature(plate_path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray, bool]:
    with Image.open(plate_path) as raw:
        cropped = _crop_plate(raw.convert("RGB"))
        small = np.asarray(cropped.resize(SIM_SIZE, _RESAMPLE), dtype=np.float64)
    rgb = small.reshape(-1)
    lum = small.mean(axis=2).reshape(-1)
    rgb_c = rgb - rgb.mean()
    lum_c = lum - lum.mean()
    rgb_n = float(np.linalg.norm(rgb_c))
    lum_n = float(np.linalg.norm(lum_c))
    is_flat = rgb_n < 1e-6 or lum_n < 1e-6
    rgb_u = rgb_c / rgb_n if rgb_n >= 1e-6 else np.zeros_like(rgb_c)
    lum_u = lum_c / lum_n if lum_n >= 1e-6 else np.zeros_like(lum_c)
    return rgb, rgb_u, lum_u, is_flat


def _pairwise_sim(
    sig_a: tuple[np.ndarray, np.ndarray, np.ndarray, bool],
    sig_b: tuple[np.ndarray, np.ndarray, np.ndarray, bool],
) -> float:
    rgb_a, rgb_ua, lum_ua, flat_a = sig_a
    rgb_b, rgb_ub, lum_ub, flat_b = sig_b
    l1_sim = 1.0 - float(np.abs(rgb_a - rgb_b).mean()) / 255.0
    if flat_a and flat_b:
        return max(0.0, min(1.0, l1_sim))
    if flat_a or flat_b:
        return 0.0
    corr = 0.5 * float(np.dot(rgb_ua, rgb_ub)) + 0.5 * float(np.dot(lum_ua, lum_ub))
    return max(0.0, min(1.0, 0.5 * corr + 0.5 * l1_sim))


out = Path("qa/design/plate_stats.json")
out.parent.mkdir(parents=True, exist_ok=True)
stats = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {}

for p in sys.argv[1:]:
    p = Path(p)
    im_full = np.asarray(Image.open(p).convert("RGB")).astype(int)
    title_y = max(CELL, im_full.shape[0] - TITLE_BAR_PX)
    im = im_full[:title_y]
    lum = im.mean(axis=2)
    edge = np.maximum(np.abs(np.diff(lum, axis=1))[:-1, :], np.abs(np.diff(lum, axis=0))[:, :-1]) > 40
    H, W = edge.shape
    grid = np.array([
        [edge[r:r + CELL, c:c + CELL].mean() for c in range(0, W - CELL + 1, CELL)]
        for r in range(0, H - CELL + 1, CELL)
    ])
    empty = grid < 0.003

    # 3x3 Rule-of-Thirds perceptual edge density (A1..C3 row-major)
    ys = [0, H // 3, (2 * H) // 3, H]
    xs = [0, W // 3, (2 * W) // 3, W]
    grid_3x3_edge_pct = [
        round(float(edge[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].mean() * 100.0), 2)
        for r in range(3)
        for c in range(3)
    ]
    clutter_max_3x3 = round(float(max(grid_3x3_edge_pct)), 2)
    worst_idx = int(np.argmax(grid_3x3_edge_pct))
    worst_cell = CELL_NAMES_3X3[worst_idx]
    center_mg_edge_pct = grid_3x3_edge_pct[4]  # B2 (33%..66% X, 33%..66% Y)
    contrast_std = round(float(lum.std()), 2)

    mid_x = W // 2
    left_edge_pct = float(edge[:, :mid_x].mean() * 100.0)
    right_edge_pct = float(edge[:, mid_x:].mean() * 100.0)
    lr_balance_delta = round(abs(left_edge_pct - right_edge_pct), 2)

    quality_flags: list[str] = []
    if clutter_max_3x3 > CLUTTER_MAX_3X3_THR:
        quality_flags.append(
            f"clutter_max_3x3={clutter_max_3x3}% > {CLUTTER_MAX_3X3_THR}% in {worst_cell} (visually chaotic region)"
        )
    if contrast_std < CONTRAST_STD_MIN:
        quality_flags.append(
            f"contrast_std={contrast_std} < {CONTRAST_STD_MIN} (flat/washed-out plate)"
        )
    if lr_balance_delta > LR_BALANCE_MAX:
        side = "left" if left_edge_pct > right_edge_pct else "right"
        quality_flags.append(
            f"lr_balance_delta={lr_balance_delta}% > {LR_BALANCE_MAX}% ({side}-heavy lopsided framing)"
        )

    sid = p.stem[len("set_"):] if p.stem.startswith("set_") else p.stem
    color_clusters = _color_clusters(im)
    stats[sid] = {
        "empty_mid": int(empty[1:-1].sum()),
        "empty_all": int(empty.sum()),
        "cells": int(empty.size),
        "edge_pct": round(float(edge.mean() * 100), 2),
        "rows": "".join(str(int(x)) for x in empty.sum(axis=1)),
        "mtime": p.stat().st_mtime,
        # when design.mjs last confirmed this plate matches the source (a same-picture re-render keeps the file
        # time, so lint SE-13 compares this, not mtime, with sets.tsx)
        "measured": time.time(),
        "grid_3x3_edge_pct": grid_3x3_edge_pct,
        "clutter_max_3x3": clutter_max_3x3,
        "center_mg_edge_pct": center_mg_edge_pct,
        "contrast_std": contrast_std,
        "lr_balance_delta": lr_balance_delta,
        "color_clusters": color_clusters,
        "cross_set_max_sim": 0.0,
        "cross_set_most_similar": None,
        "quality_flags": quality_flags,
    }
    flag_str = f" | FLAGS: {'; '.join(quality_flags)}" if quality_flags else ""
    print(
        f"plate {sid}: {stats[sid]['empty_mid']} empty mid (rows {stats[sid]['rows']}) "
        f"· edge {stats[sid]['edge_pct']}% · max3x3 {clutter_max_3x3}% ({worst_cell}) "
        f"· B2 {center_mg_edge_pct}% · contrast {contrast_std} · lrΔ {lr_balance_delta}% "
        f"· clusters {color_clusters}{flag_str}"
    )

# Pairwise cross-set structural similarity across ALL distinct non-grid set_*.png on disk in qa/design/
plate_files: dict[str, Path] = {}
for pf in sorted(out.parent.glob("set_*.png")):
    if pf.stem.endswith("_grid"):
        continue
    pf_sid = pf.stem[len("set_"):]
    if pf_sid:
        plate_files[pf_sid] = pf

if len(plate_files) >= 2:
    sigs: dict[str, tuple[np.ndarray, np.ndarray, np.ndarray, bool]] = {}
    for pf_sid, pf_path in plate_files.items():
        try:
            sigs[pf_sid] = _plate_signature(pf_path)
        except Exception:
            continue
    sig_ids = list(sigs.keys())
    for sid_a in sig_ids:
        best_sim = 0.0
        best_other: str | None = None
        sig_a = sigs[sid_a]
        for sid_b in sig_ids:
            if sid_b == sid_a:
                continue
            sim = _pairwise_sim(sig_a, sigs[sid_b])
            if best_other is None or sim > best_sim:
                best_sim = sim
                best_other = sid_b
        if sid_a in stats and isinstance(stats[sid_a], dict):
            stats[sid_a]["cross_set_max_sim"] = round(float(best_sim), 4)
            stats[sid_a]["cross_set_most_similar"] = best_other
else:
    for pf_sid in plate_files:
        if pf_sid in stats and isinstance(stats[pf_sid], dict):
            stats[pf_sid]["cross_set_max_sim"] = 0.0
            stats[pf_sid]["cross_set_most_similar"] = None

out.write_text(json.dumps(stats, indent=1), encoding="utf-8")
