#!/usr/bin/env python3
"""Cut a magenta (or already-cut paper) animation strip into 96x96 game frames.

    # raw Gemini strip (magenta background)
    python3 tools/strip_atlas.py --strip walk=out/gemini/walk-strip.jpg \
                                 --expect 8 --base out/autosprite/base-assets

    # already-cut 2x preview sheet (paper background) - same code path
    python3 tools/strip_atlas.py --strip walk=out/gemini/walk-strip.png \
                                 --expect 8 --base out/autosprite/base-assets

The background is detected from the border (magenta or a flat colour), the strip
is segmented by background-free columns, every frame is registered to one shared
baseline, scaled to fit 92x84 inside the cell, snapped to Apollo and appended to
a clean copy of the atlas (black + derived grey).

Trust checks, because a Gemini strip is not as clean as an AutoSprite export:

  --expect N            frame count must be exactly N (exit 2 otherwise)
  coverage              a frame with < --min-coverage of the row median pixels is
                        rejected (ghost / half-erased frame)
  density               a frame whose bbox is < --min-density of the median
                        density is rejected (speed lines / streaks widening it)
  palette               every opaque output pixel must be an Apollo colour
  foot                  the measured foot row is printed per frame; all frames
                        must land on the same baseline

Output: one JSON line per accepted frame on stdout (bbox, height, baseline,
scaled...), human notes on stderr, `<anim>-contact.png` next to the atlas.
`--dry-run` analyses and writes the contact sheet but never the atlas;
writing an atlas into `assets/` additionally requires `--install`.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SPEC = json.load(open(ROOT / "spec" / "character.json"))
APOLLO = [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in SPEC["palette"]["colors"]]
APOLLO_SET = set(APOLLO)
PAPER = (231, 213, 179)

CELL, MAX_W, MAX_H, BOTTOM = 96, 92, 84, 88


class StripError(Exception):
    """A strip that cannot be trusted. Exit code 2, like the .mjs suites."""


def nearest(p):
    best, bd = APOLLO[0], 1 << 30
    for a in APOLLO:
        d = (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2 + (p[2] - a[2]) ** 2
        if d < bd:
            bd, best = d, a
    return best


def is_magenta(px):
    return px[0] > 120 and px[2] > 120 and px[1] * 2 < min(px[0], px[2]) + 20


def detect_background(im):
    """Border colour decides how to key. Magenta for raw Gemini, else a flat
    matte (the 2x preview sheets are paper). Returns (kind, rgb, tolerance)."""
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).reshape(-1, 3)
    med = tuple(int(v) for v in np.median(edge, axis=0))
    if is_magenta(med):
        return "magenta", med, 0
    if np.all(np.abs(np.asarray(med) - np.asarray(PAPER)) <= 8):
        return "paper", med, 16
    return "flat", med, 12


def key_background(im, kind, rgb, tol):
    """Opaque mask = everything that is not background."""
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    if kind == "magenta":
        bg = (r > 120) & (b > 120) & (g * 2 < np.minimum(r, b) + 20)
    else:
        diff = np.abs(a - np.asarray(rgb, dtype=np.int16)).max(axis=2)
        bg = diff <= tol
    return Image.fromarray(np.dstack([a, np.where(bg, 0, 255)]).astype(np.uint8), "RGBA"), bg


def segment(mask, min_width=60, min_px=4):
    cols = mask.sum(axis=0)
    groups, start = [], None
    for x, c in enumerate(cols):
        if c > min_px and start is None:
            start = x
        elif c <= min_px and start is not None:
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


def frame_stats(mask, groups):
    """Per-group pixel count, bbox and density, before any scaling."""
    stats = []
    for x0, x1 in groups:
        sub = mask[:, x0:x1 + 1]
        ys = np.where(sub.any(axis=1))[0]
        xs = np.where(sub.any(axis=0))[0]
        w, h = x1 - x0 + 1, int(ys.max() - ys.min() + 1)
        px = int(sub.sum())
        stats.append({
            "x": int(x0), "y": int(ys.min()), "w": int(w), "h": h,
            "right": int(x0 + xs.max()), "bottom": int(ys.max()),
            "pixels": px, "density": px / float(max(1, w * h)),
        })
    return stats


def frames_from_strip(path, expect, min_coverage, min_density, bg="auto"):
    im = Image.open(path)
    kind, rgb, tol = detect_background(im)
    if bg != "auto":
        if bg.startswith("#"):
            rgb = tuple(int(bg[i:i + 2], 16) for i in (1, 3, 5))
            kind, tol = "flat", 12
        elif bg in ("magenta", "paper", "flat"):
            kind = bg
        else:
            raise StripError(f"--bg wants auto|magenta|paper|#rrggbb, got {bg!r}")
    rgba, bg = key_background(im, kind, rgb, tol)
    mask = ~bg
    groups = segment(mask)
    if not groups:
        raise StripError(f"{path}: no frames found (background {kind} {rgb})")
    if expect is not None and len(groups) != expect:
        raise StripError(f"{path}: frame count {len(groups)} != expected {expect} "
                         f"(background {kind}; segments {[g[0] for g in groups]})")

    stats = frame_stats(mask, groups)
    counts = sorted(s["pixels"] for s in stats)
    med_px = counts[len(counts) // 2]
    dens = sorted(s["density"] for s in stats)
    med_dens = dens[len(dens) // 2]
    for i, s in enumerate(stats):
        s["coverage_ratio"] = s["pixels"] / float(max(1, med_px))
        s["density_ratio"] = s["density"] / max(1e-6, med_dens)
        if s["coverage_ratio"] < min_coverage:
            raise StripError(f"{path}: frame {i + 1}/{len(stats)} coverage "
                             f"{s['pixels']} px is {s['coverage_ratio']:.2f}x the row median "
                             f"{med_px} (< {min_coverage}) - ghost or half-erased frame")
        if s["density_ratio"] < min_density:
            raise StripError(f"{path}: frame {i + 1}/{len(stats)} density "
                             f"{s['density']:.2f} is {s['density_ratio']:.2f}x the row median "
                             f"{med_dens:.2f} (< {min_density}) - speed line or streaks?")

    y0 = min(s["y"] for s in stats)
    y1 = max(s["bottom"] for s in stats)
    width = max(s["w"] for s in stats)
    raw = []
    for s in stats:
        crop = rgba.crop((s["x"], y0, s["x"] + s["w"], y1 + 1))
        tile = Image.new("RGBA", (width, y1 - y0 + 1), (0, 0, 0, 0))
        tile.alpha_composite(crop, ((width - crop.width) // 2, 0))
        raw.append(tile)
    return raw, stats, kind


def register_baseline(out):
    """Snap every frame onto the shared foot row.

    LANCZOS + the alpha-128 key can eat the last row of a frame, which would move
    its foot off the row the other frames sit on. Shift the cell so the lowest
    visible row is always BOTTOM - 1.
    """
    bbox = out.getbbox()
    if bbox is None:
        return out, None, None
    dy = BOTTOM - bbox[3]          # PIL bbox bottom is exclusive; land the last row on BOTTOM-1
    if dy:
        shifted = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        shifted.alpha_composite(out, (0, dy))
        out = shifted
        bbox = out.getbbox()
    return out, bbox, bbox[3] - 1


def to_cell(tile):
    s = min(MAX_W / tile.width, MAX_H / tile.height)
    w, h = max(1, round(tile.width * s)), max(1, round(tile.height * s))
    small = tile.resize((w, h), Image.LANCZOS)
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    out.alpha_composite(small, ((CELL - w) // 2, BOTTOM - h))
    out, bbox, foot = register_baseline(snap(out))
    return out, s, bbox, foot


def assert_palette(cells, anim, variant):
    bad = set()
    for t in cells:
        px = t.load()
        for y in range(t.height):
            for x in range(t.width):
                r, g, b, a = px[x, y]
                if a and (r, g, b) not in APOLLO_SET:
                    bad.add((r, g, b))
            if len(bad) > 8:
                break
    if bad:
        raise StripError(f"{anim} ({variant}): colours outside Apollo {sorted(bad)[:8]}")


def contact_sheet(anim, cells, stats, expect, path):
    """Every frame on the 96 px grid, labelled, at 2x so it is readable."""
    pad, head, label = 8, 22, 16
    n = len(cells)
    w = n * CELL + (n + 1) * pad
    h = head + CELL + label + pad
    sheet = Image.new("RGB", (w, h), PAPER)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((pad, 5), f"{anim.upper()}  {n} frames  expect {expect}", fill=(9, 10, 20), font=font)
    for i, t in enumerate(cells):
        x = pad + i * (CELL + pad)
        y = head
        draw.rectangle([x - 1, y - 1, x + CELL, y + CELL], outline=(192, 148, 115))
        cell_bg = Image.new("RGBA", (CELL, CELL), (215, 181, 148, 255))
        cell_bg.alpha_composite(t, (0, 0))
        sheet.paste(cell_bg.convert("RGB"), (x, y))
        # foot line guide
        for gx in range(x, x + CELL, 4):
            sheet.putpixel((gx, y + BOTTOM - 1), (136, 96, 64))
        s = stats[i]
        foot = s.get("foot", BOTTOM - 1)
        draw.text((x, y + CELL + 2), f"{i + 1:02d} {s['height']}px f{foot}", fill=(9, 10, 20), font=font)
        draw.text((x, y + 1), f"{s['coverage_ratio']:.2f}", fill=(136, 96, 64), font=font)
    sheet.resize((w * 2, h * 2), Image.NEAREST).save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strip", action="append", required=True,
                    metavar="ANIM=PATH", help="repeatable, e.g. walk=out/gemini/walk-strip.png")
    ap.add_argument("--expect", type=int, default=None,
                    help="required frame count per strip (exit 2 on mismatch)")
    ap.add_argument("--min-coverage", type=float, default=0.55,
                    help="reject a frame below this fraction of the row median pixels")
    ap.add_argument("--min-density", type=float, default=0.70,
                    help="reject a frame below this fraction of the row median bbox density")
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--base", default=str(ROOT / "out" / "autosprite" / "base-assets"))
    ap.add_argument("--out", default=str(ROOT / "out" / "gemini"))
    ap.add_argument("--bg", default="auto", help="auto | magenta | paper | #rrggbb")
    ap.add_argument("--dry-run", action="store_true",
                    help="analyse + contact sheet only; never write cat-atlas.*")
    ap.add_argument("--install", action="store_true",
                    help="allow writing an atlas into assets/ (bump ART_V yourself)")
    args = ap.parse_args()

    out_dir = Path(args.out)
    if out_dir.resolve() == (ROOT / "assets").resolve() and not args.install:
        raise StripError("refusing to write assets/ without --install (bump ART_V when you do)")

    clips, reports = {}, {}
    for spec in args.strip:
        if "=" not in spec:
            raise SystemExit("--strip wants ANIM=PATH")
        anim, path = spec.split("=", 1)
        raw, stats, kind = frames_from_strip(path, args.expect, args.min_coverage,
                                             args.min_density, args.bg)
        cells = []
        for i, tile in enumerate(raw):
            cell, s, bbox, foot = to_cell(tile)
            if bbox is None:
                raise StripError(f"{path}: frame {i + 1} is empty after scaling")
            if args.scale != 1.0:
                content = cell.crop(bbox)
                nw, nh = max(1, round(content.width * args.scale)), max(1, round(content.height * args.scale))
                content = content.resize((nw, nh), Image.NEAREST)
                cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
                cell.alpha_composite(content, ((CELL - nw) // 2, BOTTOM - nh))
                cell, bbox, foot = register_baseline(cell)
                s = s * args.scale
            cells.append(cell)
            st = dict(stats[i])
            st.update({
                "source_box": {"x": st["x"], "y": st["y"], "w": st["w"], "h": st["h"]},
                "anim": anim, "frame": i, "of": len(raw), "source": path,
                "background": kind, "bbox": {"x": bbox[0], "y": bbox[1], "w": bbox[2] - bbox[0], "h": bbox[3] - bbox[1]},
                "height": bbox[3] - bbox[1], "baseline": foot, "foot": foot,
                "scale": round(s, 3), "scaled": abs(s - 1.0) > 1e-6,
                "cell_empty": bbox is None,
            })
            st.pop("right", None); st.pop("bottom", None)
            st.pop("y", None); st.pop("x", None); st.pop("w", None); st.pop("h", None)
            reports.setdefault(anim, []).append(st)
            print(json.dumps(st, sort_keys=True))
        cells_snapped = [t.copy() for t in cells]
        assert_palette(cells_snapped, anim, "black")
        assert_palette([grey_of(t.copy()) for t in cells], anim, "grey")
        clips[anim] = cells
        print(f"{path}: {len(cells)} {anim} frames (background {kind})", file=sys.stderr)

    feet = {a: [r["baseline"] for r in rs] for a, rs in reports.items()}
    for anim, fs in feet.items():
        if len(set(fs)) != 1:
            raise StripError(f"{anim}: frames do not share a baseline: {sorted(set(fs))}")

    out_dir.mkdir(parents=True, exist_ok=True)
    for anim, cells in clips.items():
        for st in reports[anim]:
            st["foot"] = st["baseline"]
        contact_sheet(anim, cells, reports[anim], args.expect or len(cells), out_dir / f"{anim}-contact.png")
        print(f"wrote {out_dir / (anim + '-contact.png')}", file=sys.stderr)

    if not args.base or args.dry_run:
        print("dry run: atlas not written", file=sys.stderr)
        return

    base = Path(args.base)
    atlas = Image.open(base / "cat-atlas.png").convert("RGBA")
    meta = json.load(open(base / "cat-atlas.json"))
    if meta.get("_strip_atlas"):
        raise StripError("base atlas already has strip rows")

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
    meta["_strip_atlas"] = {"source": Path(args.strip[0].split("=", 1)[1]).name,
                            "animations": {a: len(c) for a, c in clips.items()}}
    canvas.save(out_dir / "cat-atlas.png")
    (out_dir / "cat-atlas.json").write_text(json.dumps(meta, indent=1))
    print("wrote", out_dir / "cat-atlas.png", canvas.size, report, file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except StripError as e:
        print(f"[strip] {e}", file=sys.stderr)
        sys.exit(2)
