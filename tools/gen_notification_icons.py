#!/usr/bin/env python3
"""Draw the charging bolt and USB trident used by the charging banner and
the USB dashboard, at 128px so they stay sharp at the size the shell draws
notification icons (about 0.62 of a ~140px row). The originals were 24px.

White glyphs shading to light grey towards the bottom, as the originals were.
Drawn at 8x and scaled down.

    python3 tools/gen_notification_icons.py images
"""
import sys
from PIL import Image, ImageDraw

SS = 8
N = 128
S = N * SS


def shade(mask):
    grad = Image.new("RGBA", (S, S))
    px = grad.load()
    for y in range(S):
        t = y / (S - 1)
        v = int(255 - 40 * t)
        for x in range(S):
            px[x, y] = (v, v, v, 255)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(grad, (0, 0), mask)
    return out.resize((N, N), Image.LANCZOS)


def P(*pts):
    return [(x * SS, y * SS) for x, y in pts]


def bolt():
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).polygon(P((78, 8), (34, 70), (60, 70), (46, 120), (96, 52), (68, 52), (86, 8)), fill=255)
    return shade(m)


def usb():
    m = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(m)
    w = 7 * SS  # stroke
    cx = 64
    # arrow head and stem
    d.polygon(P((cx, 4), (cx - 12, 22), (cx + 12, 22)), fill=255)
    d.line(P((cx, 20), (cx, 104)), fill=255, width=w)
    # left arm ending in a dot
    d.line(P((cx, 84), (34, 66), (34, 50)), fill=255, width=w, joint="curve")
    d.ellipse(P((25, 36), (43, 54)), fill=255)
    # right arm ending in a square
    d.line(P((cx, 72), (92, 56), (92, 40)), fill=255, width=w, joint="curve")
    d.rectangle(P((84, 26), (100, 42)), fill=255)
    # base
    d.ellipse(P((cx - 13, 98), (cx + 13, 124)), fill=255)
    return shade(m)


if __name__ == "__main__":
    d = sys.argv[1]
    bolt().save(f"{d}/notification-charging.png")
    usb().save(f"{d}/notification-usb.png")
