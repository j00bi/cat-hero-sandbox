#!/usr/bin/env python3
"""Cut a generated sheet by finding the characters, not by trusting a grid.

    tools/auto_cut.py out/tuxedo-a.jpg [--cell 96] [--fuzz 60] [--scale 4]

Models space sprites unevenly, so equal-cell slicing decapitates cats. This keys the
background, removes drawn rules, labels connected components, groups them into rows,
and writes one clean cell per sprite — 87x66 max, feet on the foot line, Apollo only.
"""
import argparse
import json
import os
from collections import Counter, deque

import numpy as np
from PIL import Image

SPEC = json.load(open(os.path.join(os.path.dirname(__file__), "..", "spec", "character.json")))
APOLLO = [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in SPEC["palette"]["colors"]]
CELL, FOOT, MAX_W, MAX_H = 96, 8, 87, 66


def nearest(p):
    return min(APOLLO, key=lambda a: (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2 + (p[2] - a[2]) ** 2)


def keyed(path, fuzz):
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    bg = Counter([im.getpixel(p)[:3] for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]).most_common(1)[0][0]
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) <= fuzz:
                px[x, y] = (0, 0, 0, 0)
    # drop horizontal rules: any row containing one long continuous ink run
    for y in range(h):
        best = run = 0
        for x in range(w):
            if px[x, y][3] > 0 and sum(px[x, y][:3]) < 400:
                run += 1
                best = max(best, run)
            else:
                run = 0
        if best > w * 0.22:          # a rule, not a cat
            for yy in (y - 1, y, y + 1):
                if 0 <= yy < h:
                    for x in range(w):
                        px[x, yy] = (0, 0, 0, 0)
    return im, bg


def row_bands(im, rows):
    """Split the sheet into `rows` horizontal bands at the emptiest lines."""
    a = np.asarray(im)[:, :, 3] > 0
    H = a.shape[0]
    prof = a.sum(axis=1).astype(float)
    prof = np.convolve(prof, np.ones(5) / 5, mode="same")
    cand = sorted(((prof[y], y) for y in range(60, H - 60)))
    splits = []
    for _, y in cand:
        if all(abs(y - s) > 120 for s in splits):
            splits.append(y)
        if len(splits) == rows - 1:
            break
    edges = [0] + sorted(splits) + [H]
    return [(edges[i], edges[i + 1]) for i in range(len(edges) - 1)]


def cells_in_band(im, y0, y1, n):
    """Divide a band into n equal slots across its content extent, then trim each.
    Models space sprites unevenly, but they are ordered left to right."""
    a = np.asarray(im)[:, :, 3] > 0
    band = a[y0:y1]
    cols = np.where(band.any(axis=0))[0]
    if len(cols) == 0:
        return []
    x0, x1 = cols.min(), cols.max() + 1
    w = (x1 - x0) / n
    out = []
    for k in range(n):
        sx0, sx1 = int(x0 + k * w), int(x0 + (k + 1) * w)
        sub = band[:, sx0:sx1]
        ys = np.where(sub.any(axis=1))[0]
        if len(ys) == 0:
            continue
        out.append((int(sub.any(axis=0).argmax()) + sx0, y0 + int(ys.min()),
                    sx1, y0 + int(ys.max()) + 1))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--fuzz", type=int, default=60)
    ap.add_argument("--rows", default="8,8,4,4,4", help="frames per row, comma separated")
    args = ap.parse_args()

    im, bg = keyed(args.src, args.fuzz)
    counts = [int(v) for v in args.rows.split(",")]
    bands = row_bands(im, len(counts))
    segs = []
    for (y0, y1), n in zip(bands, counts):
        segs.extend(cells_in_band(im, y0, y1, n))
    rows = []
    for (x0, y0, x1, y1) in segs:
        cy = (y0 + y1) / 2
        if rows and abs(cy - rows[-1]["cy"]) < (y1 - y0) * 0.6:
            rows[-1]["boxes"].append((x0, y0, x1, y1))
        else:
            rows.append({"cy": cy, "boxes": [(x0, y0, x1, y1)]})
    for r in rows:
        r["boxes"].sort(key=lambda b: b[0])

    cols = max(len(r["boxes"]) for r in rows)
    sheet = Image.new("RGBA", (cols * CELL, len(rows) * CELL), (0, 0, 0, 0))

    for ry, row in enumerate(rows):
        for cx, box in enumerate(row["boxes"]):
            body = im.crop(box)
            bbox = body.getbbox()
            if not bbox:
                continue
            body = body.crop(bbox)
            k = min(MAX_W / body.width, MAX_H / body.height, 1.0)
            body = body.resize((max(1, int(body.width * k)), max(1, int(body.height * k))), Image.LANCZOS)
            cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
            cell.paste(body, ((CELL - body.width) // 2, CELL - FOOT - body.height), body)
            px = cell.load()
            for y in range(CELL):
                for x in range(CELL):
                    p = cell.getpixel((x, y))
                    px[x, y] = (*nearest(p[:3]), 255) if p[3] > 110 else (0, 0, 0, 0)
            sheet.paste(cell, (cx * CELL, ry * CELL))

    base = os.path.splitext(args.src)[0]
    sheet.save(base + "-atlas.png")

    contact = Image.new("RGB", (sheet.width * 2, sheet.height * 2), (16, 20, 31))
    big = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    contact.paste(big, (0, 0), big)
    contact.save(base + "-contact.png")

    print(f"key #{bg[0]:02x}{bg[1]:02x}{bg[2]:02x}  rows {len(rows)}  boxes {[len(r['boxes']) for r in rows]}")
    print("wrote", base + "-atlas.png", base + "-contact.png")


if __name__ == "__main__":
    main()
