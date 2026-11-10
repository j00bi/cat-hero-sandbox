#!/usr/bin/env python3
"""Palette + contrast gate for the restyle.

Samples the captured frames (canvas origin 160,130 in a 1280x800 shot) rather than
trusting the eye: ink-on-paper, white-on-glass and card text must all clear 4.5:1.

    tools/palette_check.py            # reads shots/restyle/*.png
"""
import sys
from collections import Counter
from PIL import Image

OX, OY, W, H = 160, 130, 960, 540
SHOTS = "shots/restyle"


def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = c
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def region(im, x, y, w, h):
    return im.crop((OX + x, OY + y, OX + x + w, OY + y + h))


def text_vs_bg(im, x, y, w, h):
    """bg = dominant colour; fg = the pixel furthest from it (works for dark-on-light
    cards and light-on-dark glass alike)."""
    px = list(region(im, x, y, w, h).getdata())
    bg = Counter(px).most_common(1)[0][0]
    fg = max(px, key=lambda p: contrast(p, bg))
    return bg, fg, contrast(fg, bg)


CHECKS = [
    ("01-title", "title card", 180, 84, 600, 336),
    ("02-select", "select card", 226, 104, 268, 344),
    ("03-play", "HUD status glass", 16, 14, 262, 50),
    ("03-play", "world plate glass", 698, 14, 246, 50),
    ("04-clear", "clear card", 260, 165, 440, 210),
    ("06-win", "win card", 190, 74, 580, 392),
    ("09-pause", "pause card", 300, 145, 360, 250),
]

fail = 0
for shot, label, x, y, w, h in CHECKS:
    try:
        im = Image.open(f"{SHOTS}/{shot}.png").convert("RGB")
    except FileNotFoundError:
        print(f"SKIP  {shot:12s} {label:20s} (no capture)")
        continue
    bg, fg, ratio = text_vs_bg(im, x, y, w, h)
    ok = ratio >= 4.5
    fail += 0 if ok else 1
    print(f"{'PASS' if ok else 'FAIL'}  {shot:10s} {label:20s} "
          f"bg #{bg[0]:02x}{bg[1]:02x}{bg[2]:02x}  fg #{fg[0]:02x}{fg[1]:02x}{fg[2]:02x}  {ratio:5.2f}:1")

# The play band must contain no glass panel: sample a horizontal line where the old
# control legend sat (y=486) and require the meadow, not the panel colour.
try:
    im = Image.open(f"{SHOTS}/03-play.png").convert("RGB")
    band = list(region(im, 0, 480, W, 26).getdata())
    glass = sum(1 for p in band if abs(p[0] - 26) < 14 and abs(p[1] - 20) < 14 and abs(p[2] - 14) < 14)
    share = 100 * glass / len(band)
    ok = share < 2.0
    fail += 0 if ok else 1
    print(f"{'PASS' if ok else 'FAIL'}  play band y480-506     glass pixels {share:.2f}% (limit 2%)")
except FileNotFoundError:
    pass

print("PALETTE: ok" if fail == 0 else f"PALETTE: {fail} failing check(s)")
sys.exit(0 if fail == 0 else 1)
