#!/usr/bin/env python3
"""Analyse the CAT HERO sprite sheet: find the background, label sprites, print boxes."""
import sys
from collections import deque

import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "/home/husni/.hermes/cache/images/img_6d824cfd0f3b.jpg"

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(np.int16)
h, w, _ = a.shape

# background = median of the border ring
border = np.concatenate([a[0:4].reshape(-1, 3), a[-4:].reshape(-1, 3),
                         a[:, 0:4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
bg = np.median(border, axis=0)
print("size", w, h, "bg", bg)

dist = np.abs(a - bg).sum(axis=2)
mask = dist > 60          # non-background
# kill isolated jpeg noise
print("ink pixels", int(mask.sum()), f"({mask.mean()*100:.1f}%)")

seen = np.zeros_like(mask, dtype=bool)
boxes = []
H, W = mask.shape
for y in range(H):
    row = mask[y]
    for x in np.nonzero(row & ~seen[y])[0]:
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
            if cx < minx: minx = cx
            if cx > maxx: maxx = cx
            if cy < miny: miny = cy
            if cy > maxy: maxy = cy
            for dy in (-1, 0, 1):
                ny = cy + dy
                if ny < 0 or ny >= H:
                    continue
                for dx in (-1, 0, 1):
                    nx = cx + dx
                    if nx < 0 or nx >= W:
                        continue
                    if mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
        boxes.append((minx, miny, maxx - minx + 1, maxy - miny + 1, n))

boxes.sort(key=lambda b: (b[1], b[0]))
print("components", len(boxes))
big = [b for b in boxes if b[4] > 150 and b[2] > 12 and b[3] > 12]
print("sprite-like", len(big))
for b in big:
    print(f"  x={b[0]:4d} y={b[1]:4d} w={b[2]:3d} h={b[3]:3d} area={b[4]:5d}")
