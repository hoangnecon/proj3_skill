"""Visible-detail check of rendered set plates (lint SE-13). Counts what the camera actually SEES, so
shapes hidden off-frame or under other shapes do not count.

  python3 scripts/plate_check.py qa/design/set_<id>.png ...   -> updates qa/design/plate_stats.json

The plate (minus the title band) is cut into 180 px cells. A cell is EMPTY when < 0.3 % of its pixels sit
on an edge (luminance step > 40) — a flat wall, a bare floor. Ceiling (top row) and floor (bottom row)
may be plain; the rows in between are where the story is read, so they must be filled.
Calibration (v2): ex-lobby 0, ex-machine 0, ex-corridor 1, ex-car 7, ex-basement 8 empty middle cells;
a "few boxes" set scores 15+. Lint: > 8 error, > 5 warning.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

CELL, TITLE = 180, 1780
out = Path("qa/design/plate_stats.json")
stats = json.loads(out.read_text()) if out.exists() else {}
for p in sys.argv[1:]:
    p = Path(p)
    im = np.asarray(Image.open(p).convert("RGB")).astype(int)[:TITLE]
    lum = im.mean(axis=2)
    edge = np.maximum(np.abs(np.diff(lum, axis=1))[:-1, :], np.abs(np.diff(lum, axis=0))[:, :-1]) > 40
    H, W = edge.shape
    grid = np.array([[edge[r:r + CELL, c:c + CELL].mean() for c in range(0, W - CELL + 1, CELL)] for r in range(0, H - CELL + 1, CELL)])
    empty = grid < 0.003
    sid = p.stem[len("set_"):]
    stats[sid] = {
        "empty_mid": int(empty[1:-1].sum()),
        "empty_all": int(empty.sum()),
        "cells": int(empty.size),
        "edge_pct": round(float(edge.mean() * 100), 2),
        "rows": "".join(str(int(x)) for x in empty.sum(axis=1)),
        "mtime": p.stat().st_mtime,
        # when design.mjs last confirmed this plate matches the source (a same-picture re-render keeps the file
        # time, so lint SE-13 compares this, not mtime, with sets.tsx)
        "measured": __import__("time").time(),
    }
    print(f"plate {sid}: {stats[sid]['empty_mid']} empty cells in the middle rows (rows {stats[sid]['rows']})")
out.write_text(json.dumps(stats, indent=1))
