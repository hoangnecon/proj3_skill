"""Tile rendered frames into one labelled sheet. Called by scripts/qa.mjs with a JSON spec:
{"out": "...png", "cols": 6, "w": 300, "title": "...", "cells": [{"img": "...", "label": "...", "sub": "..."}]}
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONTS = ["/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]


def font(size):
    for f in FONTS:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


spec = json.loads(Path(sys.argv[1]).read_text())
cells, cols, w = spec["cells"], spec["cols"], spec["w"]
h = int(w * 1920 / 1080)
lab = 58
rows = (len(cells) + cols - 1) // cols
top = 64
sheet = Image.new("RGB", (cols * w + (cols + 1) * 8, top + rows * (h + lab + 8) + 8), (31, 47, 110))
d = ImageDraw.Draw(sheet)
d.text((12, 14), spec.get("title", ""), fill=(255, 210, 63), font=font(30))
for i, c in enumerate(cells):
    x = 8 + (i % cols) * (w + 8)
    y = top + (i // cols) * (h + lab + 8)
    sheet.paste(Image.open(c["img"]).convert("RGB").resize((w, h)), (x, y))
    d.text((x + 4, y + h + 4), c.get("label", ""), fill=(255, 255, 255), font=font(20))
    sub = c.get("sub", "")
    if sub:
        f = font(16)
        while d.textlength(sub, font=f) > w - 8 and len(sub) > 4:
            sub = sub[:-2]
        d.text((x + 4, y + h + 30), sub, fill=(180, 190, 230), font=f)
Path(spec["out"]).parent.mkdir(parents=True, exist_ok=True)
out = spec["out"]
# an evidence sheet re-rendered with the same picture keeps its old time, so sv_gate ("X is newer than
# G.review.md") asks to look again only at the sheets that really changed
import os
prev = None
if os.path.exists(out):
    try:
        prev = (Image.open(out).convert("L"), os.stat(out))
    except Exception:
        prev = None
if out.lower().endswith((".jpg", ".jpeg")):
    # QA sheets are for a model to read: light JPEG, long side <= 1600 px, normally 100-400 KB (sv-41 QA-IMG)
    m = max(sheet.size)
    if m > 1600:
        sheet = sheet.resize((round(sheet.size[0] * 1600 / m), round(sheet.size[1] * 1600 / m)), Image.LANCZOS)
    sheet.save(out, quality=int(spec.get("q", 70)), optimize=True)
else:
    sheet.save(out)
same = False
if prev is not None:
    import numpy as np
    a = np.asarray(prev[0], dtype=np.int16); b = np.asarray(Image.open(out).convert("L"), dtype=np.int16)
    same = a.shape == b.shape and int((np.abs(a - b) > 24).sum()) <= 20
    if same:
        os.utime(out, (prev[1].st_atime, prev[1].st_mtime))
print("ok", out, f"{Path(out).stat().st_size // 1024} KB" + (" (same picture: time kept)" if same else ""))
