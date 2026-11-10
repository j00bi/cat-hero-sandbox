#!/usr/bin/env python3
"""Cut a generated sheet into game-ready frames.

    tools/cut_sheet.py sheet.jpg --cols 8 --rows 5 [--cell 96] [--fuzz 60]

Does what the preview needs:
  1. samples the corner colour as chroma key and removes it with a colour-distance fuzz
  2. deletes long horizontal rules (the baseline lines models like to draw)
  3. slices the grid, crops each cell to its content
  4. scales content to the game footprint (87x66 max), bottom-aligned on the foot line
  5. snaps every pixel to the nearest Apollo colour
  6. writes <name>-atlas.png and <name>-contact.png
"""
import argparse
import json
import os
from collections import Counter

from PIL import Image

SPEC = json.load(open(os.path.join(os.path.dirname(__file__), "..", "spec", "character.json")))
APOLLO = [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in SPEC["palette"]["colors"]]
CELL = 96
FOOT = 8
MAX_W, MAX_H = 87, 66


def nearest(p):
    return min(APOLLO, key=lambda a: (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2 + (p[2] - a[2]) ** 2)


def key_background(im, fuzz):
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    corners = [im.getpixel(p)[:3] for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
    bg = Counter(corners).most_common(1)[0][0]
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) <= fuzz:
                px[x, y] = (0, 0, 0, 0)
    return im, bg


def drop_rules(im, threshold=0.55):
    px = im.load()
    w, h = im.size
    removed = 0
    for y in range(h):
        solid = sum(1 for x in range(w) if px[x, y][3] > 0 and sum(px[x, y][:3]) < 330)
        if solid > w * threshold:
            for x in range(w):
                px[x, y] = (0, 0, 0, 0)
            removed += 1
    return removed


def cut(im, cols, rows):
    w, h = im.size
    cw, ch = w / cols, h / rows
    out = Image.new("RGBA", (cols * CELL, rows * CELL), (0, 0, 0, 0))
    placed = 0
    for ry in range(rows):
        for cx_ in range(cols):
            tile = im.crop((int(cx_ * cw), int(ry * ch), int((cx_ + 1) * cw), int((ry + 1) * ch)))
            bbox = tile.getbbox()
            if not bbox:
                continue
            body = tile.crop(bbox)
            scale = min(MAX_W / body.width, MAX_H / body.height, 1.0)
            nw, nh = max(1, int(body.width * scale)), max(1, int(body.height * scale))
            body = body.resize((nw, nh), Image.LANCZOS)

            dst = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
            dx = (CELL - nw) // 2
            dy = CELL - FOOT - nh
            dst.paste(body, (dx, dy), body)

            # palette snap + binary alpha
            px = dst.load()
            for y in range(CELL):
                for x in range(CELL):
                    if dst.getpixel((x, y))[3] > 110:
                        q = nearest(dst.getpixel((x, y))[:3])
                        px[x, y] = (q[0], q[1], q[2], 255)
                    else:
                        px[x, y] = (0, 0, 0, 0)

            out.paste(dst, (cx_ * CELL, ry * CELL))
            placed += 1
    return out, placed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--cols", type=int, default=8)
    ap.add_argument("--rows", type=int, default=5)
    ap.add_argument("--fuzz", type=int, default=60)
    args = ap.parse_args()

    im, bg = key_background(Image.open(args.src), args.fuzz)
    rules = drop_rules(im)
    sheet, placed = cut(im, args.cols, args.rows)

    base = os.path.splitext(args.src)[0]
    sheet.save(base + "-atlas.png")

    # contact sheet on the game background, 3x
    contact = Image.new("RGB", (sheet.width * 3, sheet.height * 3), (16, 20, 31))
    big = sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST)
    contact.paste(big, (0, 0), big)
    contact.save(base + "-contact.png")

    print(f"key #{bg[0]:02x}{bg[1]:02x}{bg[2]:02x}  rules removed {rules}  frames {placed}/{args.cols*args.rows}")
    print("wrote", base + "-atlas.png", "and", base + "-contact.png")


if __name__ == "__main__":
    main()
