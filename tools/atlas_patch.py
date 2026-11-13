#!/usr/bin/env python3
"""Patch assets/cat-atlas.{png,json} from a supplied strip.

Two fixes, both driven by measurement rather than eyeballing:

1. WALK <- the supplied run strip (out/gemini/run-strip.png).
   The old walk row came from a strip whose frames drift 132-150 px tall
   (the cat bobs and changes size frame to frame). The run strip is even:
   every frame is 146 px tall on the same baseline. Using it as the walk
   animation gives a steady silhouette and a real 6-frame cycle.

2. CHARGE -> grounded and rescaled.
   The generated hold pose is 65 px tall against 67-76 for walk, and its
   cell was stamped foot:0 instead of foot:7, which draws it 7 px above the
   ground. It is moved to its own cell, scaled to the walk median height and
   given foot:7.

Run:  python3 tools/atlas_patch.py
Then bump ART_V in game.js so browsers refetch the atlas.
"""
import json
import os
import statistics
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATLAS_PNG = os.path.join(ROOT, "assets/cat-atlas.png")
ATLAS_JSON = os.path.join(ROOT, "assets/cat-atlas.json")
RUN_STRIP = os.path.join(ROOT, "out/gemini/run-strip.png")

CELL = 96
FOOT = 7
# free rows in the sheet (nothing references them)
FREE_ROW_BLACK = 0
FREE_ROW_GREY = 96


def content_bbox(img):
    bb = img.getbbox()
    return bb  # (x0, y0, x1, y1)


def cell_of(img, c):
    return img.crop((c["x"], c["y"], c["x"] + c["w"], c["y"] + c["h"]))


def strip_frames(path, cols):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    cw = w // cols
    out = []
    for i in range(cols):
        cell = im.crop((i * cw, 0, (i + 1) * cw, h))
        out.append(cell)
    return out


def to_cell(frame, bg=None):
    """Downscale a strip frame to a 96x96 cell, keying out the cream background."""
    if bg is None:
        bg = frame.getpixel((3, 3))
    frame = frame.convert("RGBA")
    px = frame.load()
    for y in range(frame.height):
        for x in range(frame.width):
            r, g, b, a = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < 42:
                px[x, y] = (0, 0, 0, 0)
    # nearest-neighbour shrink to the cell, keeping the baseline
    small = frame.resize((CELL, CELL), Image.NEAREST)
    return small


def baseline_normalise(cell):
    """Return the cell unchanged; the strips already share one baseline."""
    return cell


def main():
    atlas = Image.open(ATLAS_PNG).convert("RGBA")
    data = json.load(open(ATLAS_JSON))

    # ---------------------------------------------------------------- walk
    frames = strip_frames(RUN_STRIP, 6)
    black_walk = data["black"]["walk"]
    row_y = black_walk[0]["y"]
    heights = []
    for i, fr in enumerate(frames):
        cell = to_cell(fr)
        bb = cell.getbbox()
        if bb:
            heights.append(bb[3] - bb[1])
        x = i * CELL
        atlas.paste((0, 0, 0, 0), (x, row_y, x + CELL, row_y + CELL))
        atlas.alpha_composite(cell, (x, row_y))
    data["black"]["walk"] = [
        {"x": i * CELL, "y": row_y, "w": CELL, "h": CELL, "foot": FOOT}
        for i in range(len(frames))
    ]

    # -------------------------------------------------------------- charge
    for set_name, row in (("black", FREE_ROW_BLACK), ("grey", FREE_ROW_GREY)):
        old = data[set_name]["charge"][0]
        cell = cell_of(atlas, old)
        bb = content_bbox(cell)
        if not bb:
            continue
        x0, y0, x1, y1 = bb
        art = cell.crop(bb)
        art_h = y1 - y0
        # target: the median height of this set's own walk cycle
        walk_h = [content_bbox(cell_of(atlas, c))[3] - content_bbox(cell_of(atlas, c))[1]
                  for c in data[set_name]["walk"]]
        target = int(statistics.median(walk_h))
        k = target / art_h if art_h else 1
        if abs(k - 1) > 0.02:
            art = art.resize((max(1, round(art.width * k)), target), Image.NEAREST)
        new = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        # keep the feet on the shared baseline (row 88) and the body centred
        bottom = 88
        cx = CELL // 2
        new.alpha_composite(art, (cx - art.width // 2, bottom - art.height))
        atlas.paste((0, 0, 0, 0), (0, row, CELL, row + CELL))
        atlas.alpha_composite(new, (0, row))
        data[set_name]["charge"] = [{"x": 0, "y": row, "w": CELL, "h": CELL, "foot": FOOT}]

    atlas.save(ATLAS_PNG)
    json.dump(data, open(ATLAS_JSON, "w"), indent=1)
    print("walk frames:", len(data["black"]["walk"]), "heights:", heights)
    print("charge ->", data["black"]["charge"][0], data["grey"]["charge"][0])


if __name__ == "__main__":
    main()
