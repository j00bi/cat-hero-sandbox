#!/usr/bin/env python3
"""Turn a raw generated strip into a QC-ready sheet.

    tools/prep_sheet.py out/walk.png --cols 8 --rows 1 [--cell 96] [--bg "231,213,179"]

Steps: crop to the declared grid, nearest-neighbour downscale to cell size, drop the
background to transparent, snap every remaining pixel to the nearest Apollo colour.
Writes <name>-sheet.png next to the input.
"""
import argparse
import json
import os
from PIL import Image

SPEC = json.load(open(os.path.join(os.path.dirname(__file__), "..", "spec", "character.json")))
APOLLO = [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in SPEC["palette"]["colors"]]


def nearest(p):
    best, bd = APOLLO[0], 1 << 30
    for a in APOLLO:
        d = (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2 + (p[2] - a[2]) ** 2
        if d < bd:
            bd, best = d, a
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, default=1)
    ap.add_argument("--cell", type=int, default=SPEC["canvas"]["cell"][0])
    ap.add_argument("--bg", default="231,213,179", help="background RGB to key out")
    ap.add_argument("--tolerance", type=int, default=26)
    args = ap.parse_args()

    bg = tuple(int(v) for v in args.bg.split(","))
    im = Image.open(args.src).convert("RGB")

    tw, th = args.cols * args.cell, args.rows * args.cell
    im = im.resize((tw, th), Image.LANCZOS)

    px = im.load()
    out = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    op = out.load()

    keyed = 0
    for y in range(th):
        for x in range(tw):
            p = px[x, y]
            if all(abs(p[i] - bg[i]) <= args.tolerance for i in range(3)):
                keyed += 1
                continue
            q = nearest(p)
            op[x, y] = (q[0], q[1], q[2], 255)

    dst = os.path.splitext(args.src)[0] + "-sheet.png"
    out.save(dst)
    total = tw * th
    print(f"{dst}  {tw}x{th}  cells {args.cols}x{args.rows}  keyed {100*keyed/total:.1f}% background")
    print("next: python3 tools/sprite_qc.py " + dst)


if __name__ == "__main__":
    main()
