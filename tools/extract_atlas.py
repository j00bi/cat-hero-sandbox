#!/usr/bin/env python3
"""Cut the CAT HERO sprite sheet into a game atlas.

Frames are rebuilt by clustering *all* ink components in a row, so thin tails
and detached paws that survive JPEG as separate blobs still land in the frame.
"""
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path("/home/husni/.hermes/cache/images/img_6d824cfd0f3b.jpg")
OUT = Path(__file__).resolve().parent.parent / "assets"
OUT.mkdir(parents=True, exist_ok=True)

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(np.int16)
H, W, _ = a.shape

border = np.concatenate([a[0:4].reshape(-1, 3), a[-4:].reshape(-1, 3),
                         a[:, 0:4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
bg = np.median(border, axis=0)
dist = np.abs(a - bg).sum(axis=2)
mask = dist > 60
alpha_src = np.clip((dist - 22) / 38.0, 0, 1)
rgba_src = np.dstack([a, (alpha_src * 255)]).astype(np.uint8)


def components(m):
    seen = np.zeros_like(m, dtype=bool)
    out = []
    for y in range(H):
        for x in np.nonzero(m[y] & ~seen[y])[0]:
            if seen[y, x]:
                continue
            q = deque([(y, x)])
            seen[y, x] = True
            minx = maxx = x
            miny = maxy = y
            n = 0
            while q:
                cy, cx = q.popleft()
                n += 1
                minx, maxx = min(minx, cx), max(maxx, cx)
                miny, maxy = min(miny, cy), max(maxy, cy)
                for dy in (-1, 0, 1):
                    ny = cy + dy
                    if 0 <= ny < H:
                        for dx in (-1, 0, 1):
                            nx = cx + dx
                            if 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True
                                q.append((ny, nx))
            out.append((minx, miny, maxx - minx + 1, maxy - miny + 1, n))
    return out


comps = components(mask)

# --- rows come from the big bodies -----------------------------------------
bodies = [b for b in comps if b[4] > 400 and b[2] > 40 and b[3] > 35]
bodies.sort(key=lambda b: (b[1], b[0]))
rows = []
for b in bodies:
    cy = b[1] + b[3] / 2
    for r in rows:
        if abs(r["cy"] - cy) < 25:
            r["items"].append(b)
            r["cy"] = sum(i[1] + i[3] / 2 for i in r["items"]) / len(r["items"])
            break
    else:
        rows.append({"cy": cy, "items": [b]})

# --- rebuild each frame from every blob in the row --------------------------
ROW_INDEX = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6,
             7: 0, 8: 1, 9: 2, 10: 3, 11: 4, 12: 5, 13: 6}
NAMES = ["idle", "walk", "run", "jump", "bat", "rest", "sleep"]

frames = {"black": {}, "grey": {}}
sheet_rows = []
for ridx, r in enumerate(rows):
    if ridx > 12:
        continue
    variant = "black" if ridx <= 6 else "grey"
    slot = ROW_INDEX[ridx]
    if slot >= len(NAMES):
        continue
    name = NAMES[slot]

    band = [c for c in comps
            if c[2] > 3 and c[4] > 25 and c[0] > 170
            and abs((c[1] + c[3] / 2) - r["cy"]) < 34]

    # the big bodies define the frame slots; small blobs (a detached tail, a
    # paw) are attached to the nearest body instead of to their neighbour.
    slots = []
    for b in sorted(r["items"], key=lambda b: b[0]):
        slots.append({"x0": b[0], "x1": b[0] + b[2], "y0": b[1], "y1": b[1] + b[3]})
    for c in band:
        cx = c[0] + c[2] / 2
        cy = c[1] + c[3] / 2
        best, bestd = None, 1e9
        for s in slots:
            sx = min(max(cx, s["x0"]), s["x1"])
            sy = min(max(cy, s["y0"]), s["y1"])
            d = ((cx - sx) ** 2 + (cy - sy) ** 2) ** 0.5
            if d < bestd:
                best, bestd = s, d
        if best is not None and bestd < 22:
            best["x0"] = min(best["x0"], c[0])
            best["x1"] = max(best["x1"], c[0] + c[2])
            best["y0"] = min(best["y0"], c[1])
            best["y1"] = max(best["y1"], c[1] + c[3])

    clusters = slots

    cw = max(g["x1"] - g["x0"] for g in clusters)
    ch = max(g["y1"] - g["y0"] for g in clusters)
    cells = []
    feet = []
    for g in clusters:
        w, h = g["x1"] - g["x0"], g["y1"] - g["y0"]
        tile = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        crop = Image.fromarray(rgba_src[g["y0"]:g["y1"], g["x0"]:g["x1"]], "RGBA")
        tile.paste(crop, ((cw - w) // 2, ch - h))
        cells.append(tile)
        # foot line: lowest row that carries a paw-sized run of ink.  A thin
        # hanging tail must not become the ground contact point.
        arr = np.array(tile)[:, :, 3] > 40
        rows = arr.sum(axis=1)
        limit = max(6, int(rows.max() * 0.25))
        foot = 0
        for r in range(ch - 1, -1, -1):
            if rows[r] >= limit:
                foot = ch - 1 - r
                break
        feet.append(foot)
    sheet_rows.append((variant, name, cells, cw, ch, feet))

pad = 2
total_w = max(sum(c.width + pad for c in cells) + pad for _v, _n, cells, _w, _h, _f in sheet_rows)
total_h = sum(ch + pad for _v, _n, _c, _w, ch, _f in sheet_rows) + pad
atlas = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))

y_cursor = pad
for variant, name, cells, cw, ch, feet in sheet_rows:
    x_cursor = pad
    rects = []
    for c, foot in zip(cells, feet):
        atlas.paste(c, (x_cursor, y_cursor))
        rects.append({"x": x_cursor, "y": y_cursor, "w": c.width, "h": c.height, "foot": int(foot)})
        x_cursor += c.width + pad
    frames[variant][name] = rects
    y_cursor += ch + pad

atlas.save(OUT / "cat-atlas.png")
(OUT / "cat-atlas.json").write_text(json.dumps(frames, indent=1))

contact = Image.new("RGB", (atlas.width * 2 + 20, atlas.height * 2 + 20), tuple(int(c) for c in bg))
contact.paste(atlas.resize((atlas.width * 2, atlas.height * 2), Image.Resampling.NEAREST), (10, 10))
contact.save(OUT / "contact.png")

print("rows:", [(v, n, len(c)) for v, n, c, _w, _h, _f in sheet_rows])
print("atlas:", atlas.size)
