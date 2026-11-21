"""Visible-detail & perceptual quality check of rendered set plates (lint SE-13 + RSI v4.3.0).
Counts what the camera actually SEES, so shapes hidden off-frame or under other shapes do not count.

  python3 scripts/plate_check.py qa/design/set_<id>.png ...   -> updates qa/design/plate_stats.json

The plate (minus the 120 px SetPlate title band, dynamically cropped for both 9:16 and 16:9) is cut into
180 px cells. A cell is EMPTY when < 0.3 % of its pixels sit on an edge (luminance step > 40) — a flat wall,
a bare floor. Ceiling (top row) and floor (bottom row) may be plain; the rows in between are where the story
is read, so they must be filled.
Calibration (v2): ex-lobby 0, ex-machine 0, ex-corridor 1, ex-car 7, ex-basement 8 empty middle cells;
a "few boxes" set scores 15+. Lint: > 8 error, > 5 warning.

Perceptual quality metrics (RSI v4.3.0):
  - grid_3x3_edge_pct : flattened 9-float Rule-of-Thirds matrix [A1, B1, C1, A2, B2, C2, A3, B3, C3]
  - clutter_max_3x3   : max edge % in any 3x3 cell (flagged > 16.0% as visually chaotic)
  - center_mg_edge_pct: edge % in B2 (33%..66% X, 33%..66% Y midground staging cell)
  - contrast_std      : luminance std dev across the cropped plate (flagged < 22.0 as flat/washed-out)
  - lr_balance_delta  : abs(left_half_edge_pct - right_half_edge_pct) (flagged > 7.5% as lopsided)
  - quality_flags     : human-readable warning strings for any perceptual threshold breach
"""
import json
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

CELL = 180
TITLE_BAR_PX = 120
CELL_NAMES_3X3 = ("A1", "B1", "C1", "A2", "B2", "C2", "A3", "B3", "C3")

CLUTTER_MAX_3X3_THR = 16.0
CONTRAST_STD_MIN = 22.0
LR_BALANCE_MAX = 7.5

out = Path("qa/design/plate_stats.json")
out.parent.mkdir(parents=True, exist_ok=True)
stats = json.loads(out.read_text()) if out.exists() else {}

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
        "quality_flags": quality_flags,
    }
    flag_str = f" | FLAGS: {'; '.join(quality_flags)}" if quality_flags else ""
    print(
        f"plate {sid}: {stats[sid]['empty_mid']} empty mid (rows {stats[sid]['rows']}) "
        f"· edge {stats[sid]['edge_pct']}% · max3x3 {clutter_max_3x3}% ({worst_cell}) "
        f"· B2 {center_mg_edge_pct}% · contrast {contrast_std} · lrΔ {lr_balance_delta}%{flag_str}"
    )

out.write_text(json.dumps(stats, indent=1))
