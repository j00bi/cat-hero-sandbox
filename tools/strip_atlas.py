#!/usr/bin/env python3
"""Cut a magenta-background animation strip into 96x96 game frames.

    python3 tools/strip_atlas.py out/gemini/walk-strip.jpg --anim walk --base out/autosprite/base-assets
    python3 tools/strip_atlas.py out/gemini/run-strip.jpg  --anim run  --base out/autosprite/base-assets

The strip is segmented by background-free columns, every frame is registered to
one shared baseline, scaled to fit 92x84 inside the cell, snapped to Apollo and
appended to a clean copy of the atlas (black + derived grey).
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SPEC = json.load(open(ROOT / "spec" / "character.json"))
APOLLO = [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in SPEC["palette"]["colors"]]


def nearest(p):
    best, bd = APOLLO[0], 1 << 30
    for a in APOLLO:
        d = (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2 + (p[2] - a[2]) ** 2
        if d < bd:
            bd, best = d, a
    return best


def key_magenta(im):
    """Transparent everywhere the JPEG is magenta (including the soft shadow)."""
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    bg = (r > 120) & (b > 120) & (g * 2 < np.minimum(r, b) + 20)
    rgba = np.dstack([a, np.where(bg, 0, 255)]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA"), bg


def segment(mask, min_width=60):
    cols = mask.sum(axis=0)
    groups, start = [], None
    for x, c in enumerate(cols):
        if c > 3 and start is None:
            start = x
        elif c <= 3 and start is not None:
            groups.append((start, x - 1))
            start = None
    if start is not None:
        groups.append((start, len(cols) - 1))
    return [g for g in groups if g[1] - g[0] >= min_width]


def snap(tile):
    px = tile.load()
    for y in range(tile.height):
        for x in range(tile.width):
            r, g, b, a = px[x, y]
            if a < 128:
                px[x, y] = (0, 0, 0, 0)
            else:
                q = nearest((r, g, b))
                px[x, y] = (q[0], q[1], q[2], 255)
    return tile


def grey_of(tile):
    out = tile.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r > b + 24 and g > b + 12:      # amber eyes stay amber
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum > 185:
                continue
            if lum < 16:
                q = (0x15, 0x1D, 0x28)
            elif lum < 34:
                q = (0x20, 0x2E, 0x37)
            elif lum < 66:
                q = (0x39, 0x4A, 0x50)
            elif lum < 118:
                q = (0x57, 0x72, 0x77)
            else:
                q = (0x81, 0x97, 0x96)
            px[x, y] = (q[0], q[1], q[2], 255)
    return out


def frames_from_strip(path):
    im = Image.open(path)
    rgba, bg = key_magenta(im)
    groups = segment(~bg)
    if not groups:
        raise SystemExit(f"{path}: no frames found")
    boxes = []
    for x0, x1 in groups:
        sub = ~bg[:, x0:x1 + 1]
        ys, _ = np.where(sub)
        boxes.append((x0, x1, int(ys.min()), int(ys.max())))
    y0 = min(b[2] for b in boxes)
    y1 = max(b[3] for b in boxes)
    width = max(b[1] - b[0] + 1 for b in boxes)
    raw = []
    for x0, x1, _fy0, _fy1 in boxes:
        crop = rgba.crop((x0, y0, x1 + 1, y1 + 1))
        tile = Image.new("RGBA", (width, y1 - y0 + 1), (0, 0, 0, 0))
        tile.alpha_composite(crop, ((width - crop.width) // 2, 0))
        raw.append(tile)
    return raw


def to_cell(tile, cell=96, max_w=92, max_h=84, bottom=88):
    s = min(max_w / tile.width, max_h / tile.height)
    w, h = max(1, round(tile.width * s)), max(1, round(tile.height * s))
    small = tile.resize((w, h), Image.LANCZOS)
    out = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    out.alpha_composite(small, ((cell - w) // 2, bottom - h))
    return snap(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strip", action="append", required=True,
                    metavar="ANIM=PATH", help="repeatable, e.g. walk=out/gemini/walk-strip.jpg")
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--base", default=str(ROOT / "out" / "autosprite" / "base-assets"))
    ap.add_argument("--out", default=str(ROOT / "out" / "gemini"))
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    clips = {}
    for spec in args.strip:
        if "=" not in spec:
            raise SystemExit("--strip wants ANIM=PATH")
        anim, path = spec.split("=", 1)
        raw = frames_from_strip(path)
        cells = [to_cell(t) for t in raw]
        if args.scale != 1.0:
            scaled = []
            for t in cells:
                bbox = t.getbbox()
                content = t.crop(bbox)
                nw, nh = round(content.width * args.scale), round(content.height * args.scale)
                content = content.resize((nw, nh), Image.NEAREST)
                c = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
                c.alpha_composite(content, ((96 - nw) // 2, 88 - nh))
                scaled.append(c)
            cells = scaled
        clips[anim] = cells
        print(f"{path}: {len(cells)} {anim} frames")

        prev = Image.new("RGB", (len(cells) * 96, 96), (231, 213, 179))
        for i, t in enumerate(cells):
            prev.paste(t, (i * 96, 0), t)
        prev.resize((prev.width * 2, 192), Image.NEAREST).save(out_dir / f"{anim}-strip.png")

    if not args.base:
        return

    base = Path(args.base)
    atlas = Image.open(base / "cat-atlas.png").convert("RGBA")
    meta = json.load(open(base / "cat-atlas.json"))
    if meta.get("_strip_atlas"):
        raise SystemExit("base atlas already has strip rows")

    height = atlas.height + 192 * len(clips)
    width = max(atlas.width, max(len(c) for c in clips.values()) * 96)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(atlas, (0, 0))
    y = atlas.height
    report = {}
    for anim, cells in clips.items():
        for variant, tiles in (("black", cells), ("grey", [grey_of(t.copy()) for t in cells])):
            rects = []
            for i, t in enumerate(tiles):
                canvas.alpha_composite(t, (i * 96, y))
                rects.append({"x": i * 96, "y": y, "w": 96, "h": 96, "foot": 7})
            meta.setdefault(variant, {})[anim] = rects
            y += 96
            report[f"{variant}.{anim}"] = len(rects)
    meta["_strip_atlas"] = {"source": "gemini strips",
                            "animations": {a: len(c) for a, c in clips.items()}}
    canvas.save(out_dir / "cat-atlas.png")
    (out_dir / "cat-atlas.json").write_text(json.dumps(meta, indent=1))
    print("wrote", out_dir / "cat-atlas.png", canvas.size, report)


if __name__ == "__main__":
    main()
