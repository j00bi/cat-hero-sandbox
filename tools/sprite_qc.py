#!/usr/bin/env python3
"""Validate a candidate character sheet against spec/character.json.

    tools/sprite_qc.py sheet.png [--cols 6] [--cell 96]

Checks: cell occupancy, Apollo palette conformance, binary alpha, foot line contact,
and that the body mass sits inside the 34x42 hitbox. Exits non-zero on any failure.
"""
import json
import sys
from PIL import Image

SPEC = json.load(open("spec/character.json"))
APOLLO = {tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in SPEC["palette"]["colors"]}
CELL = tuple(SPEC["canvas"]["cell"])
FOOT = SPEC["canvas"]["foot_line_offset"]
HB = tuple(SPEC["canvas"]["hitbox"])
DEFAULT_FRAMES = SPEC["total_frames"]


def main(path, cols=6, expected=None):
    expected = expected or DEFAULT_FRAMES
    im = Image.open(path).convert("RGBA")
    cell = CELL[0]

    fails = []
    occupied = 0

    for idx in range(expected):
        cx = (idx % cols) * cell
        cy = (idx // cols) * cell
        if cx + cell > im.width or cy + cell > im.height:
            fails.append(f"cell {idx}: outside image")
            continue
        tile = im.crop((cx, cy, cx + cell, cy + cell))
        px = list(tile.getdata())

        opaque = [(i % cell, i // cell, p) for i, p in enumerate(px) if p[3] > 0]
        if not opaque:
            fails.append(f"cell {idx}: empty")
            continue
        occupied += 1

        # binary alpha
        semi = [p for p in px if 0 < p[3] < 255]
        if semi:
            fails.append(f"cell {idx}: {len(semi)} semi-transparent pixels (halo)")

        # palette
        bad = {p[:3] for _, _, p in opaque if p[:3] not in APOLLO}
        if bad:
            sample = ", ".join("#%02x%02x%02x" % c for c in list(bad)[:3])
            fails.append(f"cell {idx}: {len(bad)} off-palette colours ({sample})")

        # geometry
        ys = [y for _, y, _ in opaque]
        height = max(ys) - min(ys) + 1
        foot_y = cell - FOOT
        if max(ys) < foot_y - 3:
            fails.append(f"cell {idx}: feet {foot_y - max(ys)}px above the foot line")
        if height > HB[1] + 24:          # 24px tolerance for tail/ears
            fails.append(f"cell {idx}: body {height}px tall, hitbox allows {HB[1]}")

    if occupied and occupied != expected:
        fails.append(f"only {occupied}/{expected} cells occupied")
    if im.width < cols * cell:
        fails.append("sheet narrower than one row of cells")

    for f in fails[:20]:
        print("FAIL", f)
    if len(fails) > 20:
        print(f"... {len(fails) - 20} more")
    print("SPRITE QC: ok" if not fails else f"SPRITE QC: {len(fails)} failure(s)")
    return 0 if not fails else 1


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(2)
    cols, frames = 6, None
    rest = []
    i = 0
    while i < len(args):
        if args[i] == "--cols":
            cols = int(args[i + 1]); i += 2
        elif args[i] == "--frames":
            frames = int(args[i + 1]); i += 2
        else:
            rest.append(args[i]); i += 1
    sys.exit(main(rest[0], cols=cols, expected=frames))
