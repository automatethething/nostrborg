#!/usr/bin/env python3
"""Generate NostrBorg favicon and PWA icons without third-party image libraries."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
APP = ROOT / "src" / "app"

BG = (14, 17, 20, 255)
GOLD = (212, 160, 23, 255)
INK = (26, 20, 4, 255)


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, width: int, height: int, pixels: list[tuple[int, int, int, int]]) -> None:
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("BBBB", *pixels[y * width + x]) for x in range(width))
        for y in range(height)
    )
    payload = b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)),
            chunk(b"IDAT", zlib.compress(raw, 9)),
            chunk(b"IEND", b""),
        ]
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def draw_mark(size: int, *, pad: int = 0) -> list[tuple[int, int, int, int]]:
    pixels = [BG] * (size * size)
    inner = size - pad * 2
    cx = cy = size / 2
    outer_r = inner * 0.36
    inner_r = inner * 0.22
    bar_w = max(3, int(inner * 0.08))
    bar_h = int(inner * 0.42)

    for y in range(size):
        for x in range(size):
            dx = x + 0.5 - cx
            dy = y + 0.5 - cy
            dist = (dx * dx + dy * dy) ** 0.5
            if dist <= outer_r and dist >= inner_r:
                pixels[y * size + x] = GOLD
            if abs(dx) <= bar_w and abs(dy) <= bar_h / 2:
                pixels[y * size + x] = GOLD
            if pad and (x < pad * 0.2 or y < pad * 0.2 or x >= size - pad * 0.2 or y >= size - pad * 0.2):
                pixels[y * size + x] = BG
    # keep unused INK import meaningful for contrast on tiny icons
    if size <= 32:
        for y in range(int(cy - 1), int(cy + 2)):
            for x in range(int(cx - 1), int(cx + 2)):
                pixels[y * size + x] = INK if abs(x - cx) + abs(y - cy) < 1.5 else GOLD
    return pixels


def write_ico(path: Path, png_bytes: bytes, size: int) -> None:
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", size if size < 256 else 0, size if size < 256 else 0, 0, 0, 1, 32, len(png_bytes), 22)
    path.write_bytes(header + entry + png_bytes)


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    APP.mkdir(parents=True, exist_ok=True)

    write_png(PUBLIC / "icon-192.png", 192, 192, draw_mark(192))
    write_png(PUBLIC / "icon-512.png", 512, 512, draw_mark(512))
    write_png(PUBLIC / "icon-maskable-512.png", 512, 512, draw_mark(512, pad=80))

    favicon_png = PUBLIC / ".favicon-32.png"
    write_png(favicon_png, 32, 32, draw_mark(32))
    write_ico(APP / "favicon.ico", favicon_png.read_bytes(), 32)
    write_ico(PUBLIC / "favicon.ico", favicon_png.read_bytes(), 32)
    favicon_png.unlink(missing_ok=True)
    print("wrote nostrborg icons")


if __name__ == "__main__":
    main()
