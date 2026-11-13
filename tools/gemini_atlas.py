#!/usr/bin/env python3
"""Build the Cat Hero atlas from the Gemini reference + walk/run strips.

    python3 tools/gemini_atlas.py

Sources:
  out/gemini/character-reference.jpg  (side view -> idle, loaf -> rest/sleep)
  out/gemini/walk-strip.jpg           (8 frames)
  out/gemini/run-strip.jpg            (6 frames)

Output: out/gemini/cat-atlas.{png,json}, built on top of out/gemini/base-assets.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

from strip_atlas import frames_from_strip, grey_of, key_magenta, to_cell

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out" / "gemini"
BASE = ROOT / "out" / "gemini" / "base-assets"


def panel_boxes(rgba, bg):
    """Split the reference image into its separate cat panels."""
    rows = bg.shape[0]
    row_sum = (~bg).sum(axis=1)
    bands, start = [], None
    for y, c in enumerate(row_sum):
        if c > 3 and start is None:
            start = y
        elif c <= 3 and start is not None:
            if y - start > 50:
                bands.append((start, y - 1))
            start = None
    if start is not None:
        bands.append((start, rows - 1))

    boxes = []
    for y0, y1 in bands:
        col_sum = (~bg[y0:y1 + 1]).sum(axis=0)
        groups, start = [], None
        for x, c in enumerate(col_sum):
            if c > 3 and start is None:
                start = x
            elif c <= 3 and start is not None:
                if x - start > 80:
                    groups.append((start, x - 1))
                start = None
        if start is not None and len(col_sum) - start > 80:
            groups.append((start, len(col_sum) - 1))
        for x0, x1 in groups:
            ys = np.where((~bg[y0:y1 + 1, x0:x1 + 1]).any(axis=1))[0]
            boxes.append((x0, y0 + int(ys.min()), x1 + 1, y0 + int(ys.max()) + 1))
    return boxes


def bob(tile, dy=-1):
    out = Image.new("RGBA", tile.size, (0, 0, 0, 0))
    out.alpha_composite(tile, (0, dy))
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    clips = {}
    for anim, path in (("walk", OUT / "walk-strip.jpg"), ("run", OUT / "run-strip.jpg")):
        clips[anim] = [to_cell(t) for t in frames_from_strip(str(path))]

    ref = Image.open(OUT / "character-reference.jpg")
    rgba, bg = key_magenta(ref)
    boxes = panel_boxes(rgba, bg)
    if len(boxes) != 5:
        raise SystemExit(f"expected 5 reference panels, found {len(boxes)}: {boxes}")
    # top row: front, side-left, back; bottom row: side-right, loaf
    side = rgba.crop(boxes[3])
    loaf = rgba.crop(boxes[4])
    idle = to_cell(side)
    clips["idle"] = [idle, bob(idle, -1)]
    rest = to_cell(loaf)
    clips["rest"] = [rest]
    clips["sleep"] = [rest, bob(rest, -1)]

    # No jump strip was supplied. The game picks four jump frames by vy, so map
    # four run poses into those slots for now: push-off, extended, tucked, land.
    clips["jump"] = [clips["run"][i] for i in (0, 2, 4, 5)]

    atlas = Image.open(BASE / "cat-atlas.png").convert("RGBA")
    meta = json.load(open(BASE / "cat-atlas.json"))
    height = atlas.height + 96 * 2 * len(clips)
    width = max(atlas.width, max(len(v) for v in clips.values()) * 96)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(atlas, (0, 0))

    y = atlas.height
    report = {}
    for anim, cells in clips.items():
        for variant, tiles in (("black", cells), ("grey", [grey_of(t.copy()) for t in cells])):
            rects = []
            for i, tile in enumerate(tiles):
                canvas.alpha_composite(tile, (i * 96, y))
                rects.append({"x": i * 96, "y": y, "w": 96, "h": 96, "foot": 7})
            meta.setdefault(variant, {})[anim] = rects
            y += 96
            report[f"{variant}.{anim}"] = len(rects)

    meta["_gemini_atlas"] = {
        "source": "Gemini reference + walk/run strips",
        "animations": {a: len(v) for a, v in clips.items()},
    }
    canvas.save(OUT / "cat-atlas.png")
    (OUT / "cat-atlas.json").write_text(json.dumps(meta, indent=1))
    print("wrote", OUT / "cat-atlas.png", canvas.size)
    print(report)


if __name__ == "__main__":
    main()
