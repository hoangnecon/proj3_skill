"""Measurement-crop sheet for one shot (qa.mjs crops <i>). Light JPEG (≤ ~600 KB).
Each row = one moment: a small full frame with the measured boxes drawn on it, then full-resolution crops of
every actor's head, hands and feet, and of any overlap between two actors. Crops are 1:1 or larger, so a wrong
hand, a floating foot, a face under a prop or two bodies merging are visible — the contact sheet hides them.
Spec JSON: {"out", "title", "frame_size": [W, H] (optional), "rows": [{"frame", "label", "boxes": [{"label", "box": [x0,y0,x1,y1], "kind"}]}]}"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

spec = json.loads(Path(sys.argv[1]).read_text())
CH = 260  # crop cell height
TW = 200  # thumbnail width
COL = {"head": (255, 210, 0), "hands": (0, 200, 255), "feet": (120, 255, 120), "overlap": (255, 60, 60), "hero": (255, 140, 0)}


def font(n):
    for f in ["/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if Path(f).exists():
            return ImageFont.truetype(f, n)
    return ImageFont.load_default()


F, FT = font(15), font(20)
spec_frame_size = spec.get("frame_size")
rows = []
for r in spec["rows"]:
    im = Image.open(r["frame"]).convert("RGB")
    W, H = im.size
    if isinstance(spec_frame_size, (list, tuple)) and len(spec_frame_size) == 2 and spec_frame_size[0] and spec_frame_size[1]:
        fw, fh = float(spec_frame_size[0]), float(spec_frame_size[1])
    else:
        fw, fh = (1920, 1080) if W > H else (1080, 1920)
    sc = W / fw
    th = im.resize((TW, round(TW * H / W)))
    d = ImageDraw.Draw(th)
    k = TW / fw
    cells = []
    for b in r["boxes"]:
        x0, y0, x1, y1 = b["box"]
        d.rectangle([x0 * k, y0 * k, x1 * k, y1 * k], outline=COL.get(b["kind"], (255, 255, 255)), width=2)
        cx0, cy0, cx1, cy1 = [round(v * sc) for v in (max(0, x0), max(0, y0), min(fw, x1), min(fh, y1))]
        if cx1 - cx0 < 8 or cy1 - cy0 < 8:
            continue
        c = im.crop((cx0, cy0, cx1, cy1))
        z = CH / c.size[1]
        c = c.resize((max(1, round(c.size[0] * z)), CH), Image.LANCZOS)
        if c.size[0] > CH * 2:
            c = c.resize((CH * 2, round(CH * CH * 2 / c.size[0]) or 1), Image.LANCZOS)
        cells.append((b, c, z / sc if sc else z))
    w = TW + sum(c.size[0] + 8 for _, c, _ in cells) + 16
    h = max(th.size[1], CH + 26) + 30
    row = Image.new("RGB", (w, h), (22, 30, 70))
    rd = ImageDraw.Draw(row)
    rd.text((8, 4), r["label"], fill=(255, 220, 90), font=F)
    row.paste(th, (8, 26))
    x = TW + 16
    for b, c, z in cells:
        row.paste(c, (x, 26))
        rd.rectangle([x, 26, x + c.size[0] - 1, 26 + c.size[1] - 1], outline=COL.get(b["kind"], (255, 255, 255)), width=2)
        rd.text((x + 4, 26 + CH + 2), f"{b['label']} ×{z:.1f}", fill=(235, 235, 235), font=F)
        x += c.size[0] + 8
    rows.append(row)

W = max(r.size[0] for r in rows) if rows else 600
sheet = Image.new("RGB", (W, 40 + sum(r.size[1] + 6 for r in rows)), (14, 20, 52))
sd = ImageDraw.Draw(sheet)
sd.text((10, 8), spec["title"], fill=(255, 220, 90), font=FT)
y = 40
for r in rows:
    sheet.paste(r, (0, y))
    y += r.size[1] + 6
m = max(sheet.size)
if m > 2000:
    sheet = sheet.resize((round(sheet.size[0] * 2000 / m), round(sheet.size[1] * 2000 / m)), Image.LANCZOS)
sheet.save(spec["out"], quality=74, optimize=True)
print("ok", spec["out"], f"{Path(spec['out']).stat().st_size // 1024} KB")
