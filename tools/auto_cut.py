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


DARK = [(9, 10, 20), (16, 20, 31), (21, 29, 40), (32, 46, 55)]   # Apollo neutrals only

# The cat is black-and-white (or grey-and-white) with an amber eye. Restricting the
# quantiser to that subset stops anti-aliased edges snapping to Apollo's browns/reds,
# which is what put an orange fringe around every sprite.
CHARACTER = [
    (9, 10, 20), (16, 20, 31), (21, 29, 40), (32, 46, 55),      # blacks
    (57, 74, 80), (87, 114, 119), (129, 151, 150),               # greys
    (168, 181, 178), (199, 207, 204), (235, 237, 233),           # whites
    (232, 193, 112), (222, 158, 65),                             # amber eye / inner ear
]


def nearest(p):
    """Snap to Apollo, but keep edge pixels neutral: nearest-colour on a dark
    anti-aliased edge otherwise lands on Apollo's dark red and fringes the sprite."""
    lum = 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]
    pool = DARK if lum < 70 else CHARACTER
    return min(pool, key=lambda a: (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2 + (p[2] - a[2]) ** 2)


def keyed(path, fuzz):
    """Key the background by flood-filling inward from the border.

    A plain colour-distance key eats white fur when the backdrop is a light cream —
    the two are only ~55 apart. Border-connected filling keeps interior whites.
    """
    from collections import deque

    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    bg = Counter([im.getpixel(p)[:3] for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]).most_common(1)[0][0]

    def close(c):
        return abs(c[0] - bg[0]) + abs(c[1] - bg[1]) + abs(c[2] - bg[2]) <= fuzz

    seen = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close(px[x, y]) and not seen[y][x]:
                seen[y][x] = True; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if close(px[x, y]) and not seen[y][x]:
                seen[y][x] = True; q.append((x, y))

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and close(px[nx, ny]):
                seen[ny][nx] = True
                q.append((nx, ny))

    # drop long horizontal rules
    for y in range(h):
        best = run = 0
        for x in range(w):
            if px[x, y][3] > 0 and sum(px[x, y][:3]) < 400:
                run += 1
                best = max(best, run)
            else:
                run = 0
        if best > w * 0.22:
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
    if rows <= 1:
        return [(0, H)]
    cand = sorted(((prof[y], y) for y in range(40, H - 40)))
    splits = []
    for _, y in cand:
        if all(abs(y - s) > 120 for s in splits):
            splits.append(y)
        if len(splits) == rows - 1:
            break
    edges = [0] + sorted(splits) + [H]
    return [(edges[i], edges[i + 1]) for i in range(len(edges) - 1)]


def cells_in_band(im, y0, y1, n, max_merge=24):
    """Segment a band into exactly n sprites.

    Start from zero-gap column runs, then close the smallest gaps first until the count
    matches n — that keeps detached tails attached without swallowing a neighbouring cat.
    """
    a = np.asarray(im)[:, :, 3] > 0
    band = a[y0:y1]
    cols = band.any(axis=0)
    W = len(cols)

    runs, x = [], 0
    while x < W:
        if not cols[x]:
            x += 1
            continue
        x0 = x
        while x < W and cols[x]:
            x += 1
        runs.append([x0, x])

    while len(runs) > n:
        gaps = [(runs[i + 1][0] - runs[i][1], i) for i in range(len(runs) - 1)]
        gaps = [g for g in gaps if g[0] <= max_merge]
        if not gaps:
            break
        _, i = min(gaps)
        runs[i][1] = runs[i + 1][1]
        del runs[i + 1]

    if len(runs) > n:
        runs = sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:n]
        runs.sort()

    out = []
    for (sx0, sx1) in runs:
        sub = band[:, sx0:sx1]
        ys = np.where(sub.any(axis=1))[0]
        if len(ys) == 0:
            continue
        cx = np.where(sub.any(axis=0))[0]
        out.append((sx0 + int(cx.min()), y0 + int(ys.min()),
                    sx0 + int(cx.max()) + 1, y0 + int(ys.max()) + 1))
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
    idx = 0
    for n in counts:
        boxes = segs[idx:idx + n]
        idx += n
        if boxes:
            rows.append({"boxes": boxes})

    cols = max(len(r["boxes"]) for r in rows)
    sheet = Image.new("RGBA", (cols * CELL, len(rows) * CELL), (0, 0, 0, 0))

    for ry, row in enumerate(rows):
        # one scale per row: scaling each frame to its own box makes a crouch smaller
        # than a stretch and a sitting cat smaller than a standing one.
        bodies = []
        for box in row["boxes"]:
            body = im.crop(box)
            bbox = body.getbbox()
            bodies.append(body.crop(bbox) if bbox else None)
        sized = [b for b in bodies if b]
        row_k = min([min(MAX_W / b.width, MAX_H / b.height, 1.0) for b in sized] or [1.0])

        for cx, body in enumerate(bodies):
            if body is None:
                continue
            k = row_k
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
