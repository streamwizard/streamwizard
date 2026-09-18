"""Placeholder banner artwork for the theme catalog in src/themes.ts.

Original, abstract backgrounds (gradients, grids, noise), so nothing here needs
a licence. Run from the package root: python3 scripts/generate-themes.py
Needs Pillow. Output is deterministic (seeded), so a rerun gives the same files.
"""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "assets" / "themes"
W, H = 1090, 254  # 2x the recommended 545x127
GW, GH = 545, 127  # gifs stay 1x to keep them small
FRAMES = 16


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, stops, angle=0.0):
    """Linear gradient through `stops` (hex colours) at `angle` degrees."""
    w, h = size
    colors = [hex_rgb(s) for s in stops]
    dx, dy = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    span = abs(w * dx) + abs(h * dy)
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = ((x - w / 2) * dx + (y - h / 2) * dy) / span + 0.5
            t = min(max(t, 0.0), 1.0) * (len(colors) - 1)
            i = min(int(t), len(colors) - 2)
            px[x, y] = lerp(colors[i], colors[i + 1], t - i)
    return img


def glow(img, center, radius, color, strength=0.6):
    layer = Image.new("RGB", img.size, (0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cx, cy = center
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=hex_rgb(color))
    layer = layer.filter(ImageFilter.GaussianBlur(radius / 2))
    return Image.blend(img, Image.composite(layer, img, layer.convert("L")), strength)


def vignette(img, strength=0.45):
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse([-w * 0.2, -h * 0.9, w * 1.2, h * 1.9], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(h / 3))
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    return Image.composite(img, Image.blend(img, dark, strength), mask)


def grain(img, rng, amount=10):
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            n = rng.randint(-amount, amount)
            r, g, b = px[x, y]
            px[x, y] = (min(255, max(0, r + n)), min(255, max(0, g + n)), min(255, max(0, b + n)))
    return img


def save_png(name, img):
    img.save(OUT / f"{name}.png", optimize=True)


def save_gif(name, frames, duration=90):
    palette_frames = [f.convert("P", palette=Image.ADAPTIVE, colors=64) for f in frames]
    palette_frames[0].save(
        OUT / f"{name}.gif", save_all=True, append_images=palette_frames[1:], duration=duration, loop=0, optimize=True
    )


# --- static themes ----------------------------------------------------------


def classic():
    img = gradient((W, H), ["#2a0f5c", "#9146ff", "#c4a1ff"], 20)
    img = glow(img, (W * 0.8, H * 0.2), 260, "#ffffff", 0.25)
    save_png("classic", vignette(img, 0.35))


def classic_blurple():
    img = gradient((W, H), ["#23272a", "#5865f2", "#8ea1ff"], 15)
    save_png("classic-blurple", vignette(glow(img, (W * 0.15, H * 0.9), 300, "#eb459e", 0.3), 0.35))


def classic_midnight():
    img = gradient((W, H), ["#05060f", "#141a3a", "#2b1a4f"], 0)
    save_png("classic-midnight", vignette(glow(img, (W * 0.5, H * 1.1), 380, "#9146ff", 0.45), 0.3))


def anime_sakura():
    rng = random.Random(11)
    img = gradient((W, H), ["#ffd1e3", "#ff9ec4", "#c77dff"], 25)
    draw = ImageDraw.Draw(img, "RGBA")
    for _ in range(70):
        x, y, r = rng.randint(0, W), rng.randint(0, H), rng.randint(5, 16)
        draw.ellipse([x, y, x + r * 1.6, y + r], fill=(255, 255, 255, rng.randint(70, 170)))
    save_png("anime-sakura", img.filter(ImageFilter.GaussianBlur(0.6)))


def anime_sunset():
    img = gradient((W, H), ["#1b1035", "#7b2d8e", "#ff6b6b", "#ffd166"], 90)
    draw = ImageDraw.Draw(img, "RGBA")
    draw.ellipse([W * 0.62, H * 0.35, W * 0.62 + 210, H * 0.35 + 210], fill=(255, 224, 138, 235))
    for i in range(6):  # horizon bands cut through the sun
        y = H * 0.62 + i * 16
        draw.rectangle([0, y, W, y + 5 + i], fill=(27, 16, 53, 210))
    save_png("anime-sunset", img)


def gaming_arcade():
    img = gradient((W, H), ["#0b0221", "#2d0b59", "#ff2e97"], 90)
    draw = ImageDraw.Draw(img, "RGBA")
    horizon = H * 0.55
    for i in range(1, 14):
        y = horizon + (H - horizon) * (i / 13) ** 2
        draw.line([0, y, W, y], fill=(0, 240, 255, 150), width=2)
    for i in range(-14, 15):
        draw.line([W / 2 + i * 22, horizon, W / 2 + i * 150, H], fill=(0, 240, 255, 130), width=2)
    save_png("gaming-arcade", glow(img, (W / 2, horizon), 200, "#ff2e97", 0.35))


def gaming_pixels():
    rng = random.Random(7)
    palette = ["#0f172a", "#1e293b", "#22c55e", "#16a34a", "#0ea5e9", "#1e3a5f"]
    img = Image.new("RGB", (W, H), hex_rgb("#0f172a"))
    draw = ImageDraw.Draw(img)
    cell = 32
    for y in range(0, H, cell):
        for x in range(0, W, cell):
            weights = [6, 6, 1, 1, 1, 3]
            draw.rectangle([x, y, x + cell - 3, y + cell - 3], fill=hex_rgb(rng.choices(palette, weights)[0]))
    save_png("gaming-pixels", vignette(img, 0.5))


def lofi_dusk():
    rng = random.Random(3)
    img = gradient((W, H), ["#2b2d5b", "#6d5a8c", "#e8a598", "#f6d8ae"], 90)
    draw = ImageDraw.Draw(img, "RGBA")
    x = 0
    while x < W:  # skyline silhouette
        bw, bh = rng.randint(40, 110), rng.randint(30, 120)
        draw.rectangle([x, H - bh, x + bw, H], fill=(28, 24, 52, 255))
        for wy in range(H - bh + 10, H - 8, 18):
            for wx in range(x + 8, x + bw - 8, 16):
                if rng.random() < 0.3:
                    draw.rectangle([wx, wy, wx + 6, wy + 8], fill=(255, 214, 140, 220))
        x += bw + rng.randint(0, 8)
    save_png("lofi-dusk", grain(img, rng, 8))


def lofi_paper():
    rng = random.Random(5)
    img = gradient((W, H), ["#efe3cf", "#e4d2b4", "#d9bf9b"], 10)
    draw = ImageDraw.Draw(img, "RGBA")
    for cx, cy, r, color in [(W * 0.2, H * 0.3, 150, "#c98b6b"), (W * 0.75, H * 0.7, 190, "#7d9a8c"), (W * 0.5, H * 0.1, 90, "#e0b35a")]:
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*hex_rgb(color), 120))
    save_png("lofi-paper", grain(img.filter(ImageFilter.GaussianBlur(1.5)), rng, 12))


def glitch_rgb():
    rng = random.Random(13)
    base = gradient((W, H), ["#08080c", "#14141f"], 90)
    shapes = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(shapes)
    for _ in range(26):
        x, y = rng.randint(0, W), rng.randint(0, H)
        draw.rectangle([x, y, x + rng.randint(60, 380), y + rng.randint(3, 22)], fill=rng.randint(120, 255))
    r = Image.composite(Image.new("RGB", (W, H), (255, 0, 80)), base, shapes.transform((W, H), Image.AFFINE, (1, 0, 9, 0, 1, 0)))
    b = Image.composite(Image.new("RGB", (W, H), (0, 220, 255)), base, shapes.transform((W, H), Image.AFFINE, (1, 0, -9, 0, 1, 0)))
    mixed = Image.blend(r, b, 0.5)
    save_png("glitch-rgb", Image.composite(Image.new("RGB", (W, H), (245, 245, 255)), mixed, shapes.point(lambda v: 255 if v > 210 else 0)))


def glitch_scanlines():
    img = gradient((W, H), ["#001a12", "#003d2b", "#00ff9c"], 0)
    img = Image.blend(img, Image.new("RGB", (W, H), (0, 10, 6)), 0.55)
    draw = ImageDraw.Draw(img, "RGBA")
    for y in range(0, H, 6):
        draw.rectangle([0, y, W, y + 2], fill=(0, 0, 0, 120))
    save_png("glitch-scanlines", vignette(img, 0.5))


def space_nebula():
    rng = random.Random(21)
    img = gradient((W, H), ["#03010a", "#0d0628", "#1a0b3d"], 30)
    for cx, cy, r, color in [(W * 0.3, H * 0.6, 260, "#7b2ff7"), (W * 0.65, H * 0.3, 220, "#f72585"), (W * 0.85, H * 0.8, 180, "#4cc9f0")]:
        img = glow(img, (cx, cy), r, color, 0.5)
    draw = ImageDraw.Draw(img, "RGBA")
    for _ in range(220):
        x, y, s = rng.randint(0, W), rng.randint(0, H), rng.choice([1, 1, 1, 2, 3])
        draw.ellipse([x, y, x + s, y + s], fill=(255, 255, 255, rng.randint(90, 255)))
    save_png("space-nebula", img)


def minimal_slate():
    img = gradient((W, H), ["#1f2933", "#323f4b"], 0)
    ImageDraw.Draw(img).rectangle([0, H - 10, W, H], fill=hex_rgb("#9146ff"))
    save_png("minimal-slate", img)


def minimal_cream():
    img = gradient((W, H), ["#faf6ef", "#f1e9dc"], 0)
    ImageDraw.Draw(img).rectangle([0, 0, 14, H], fill=hex_rgb("#1f2933"))
    save_png("minimal-cream", img)


# --- animated themes --------------------------------------------------------


def anime_speedlines():
    rng = random.Random(17)
    lines = [(rng.uniform(0, math.tau), rng.uniform(0.06, 0.28), rng.uniform(0, 1)) for _ in range(120)]
    base = gradient((GW, GH), ["#fff1a8", "#ff8a3d", "#ff3d6e"], 0)
    frames = []
    for f in range(FRAMES):
        img = base.copy()
        draw = ImageDraw.Draw(img, "RGBA")
        for angle, start, phase in lines:
            t = (phase + f / FRAMES) % 1
            inner, outer = GW * (start + t * 0.12), GW * 1.2
            cx, cy = GW / 2, GH / 2
            draw.line(
                [cx + math.cos(angle) * inner, cy + math.sin(angle) * inner * 0.5, cx + math.cos(angle) * outer, cy + math.sin(angle) * outer * 0.5],
                fill=(255, 255, 255, 170), width=2,
            )
        frames.append(img)
    save_gif("anime-speedlines", frames, 60)


def gaming_neon_grid():
    base = gradient((GW, GH), ["#0b0221", "#2d0b59", "#ff2e97"], 90)
    horizon = GH * 0.5
    frames = []
    for f in range(FRAMES):
        img = base.copy()
        draw = ImageDraw.Draw(img, "RGBA")
        for i in range(12):
            t = ((i + f / FRAMES) / 12) ** 2
            y = horizon + (GH - horizon) * t
            draw.line([0, y, GW, y], fill=(0, 240, 255, 160), width=1)
        for i in range(-14, 15):
            draw.line([GW / 2 + i * 11, horizon, GW / 2 + i * 75, GH], fill=(0, 240, 255, 130), width=1)
        frames.append(img)
    save_gif("gaming-neon-grid", frames, 70)


def lofi_rain():
    rng = random.Random(9)
    drops = [(rng.randint(0, GW), rng.randint(0, GH), rng.randint(8, 18)) for _ in range(80)]
    base = gradient((GW, GH), ["#1d2438", "#3b4a6b", "#6b7fa3"], 90)
    base = glow(base, (GW * 0.8, GH * 0.4), 70, "#ffd68a", 0.4)
    step = GH / FRAMES  # one full loop moves a drop exactly the banner height
    frames = []
    for f in range(FRAMES):
        img = base.copy()
        draw = ImageDraw.Draw(img, "RGBA")
        for x, y, length in drops:
            yy = (y + f * step) % GH
            draw.line([x, yy, x - 3, yy + length], fill=(220, 235, 255, 120), width=1)
        frames.append(img)
    save_gif("lofi-rain", frames, 70)


def glitch_signal():
    rng = random.Random(29)
    base = gradient((GW, GH), ["#0a0a12", "#1b1030", "#0a0a12"], 0)
    draw = ImageDraw.Draw(base, "RGBA")
    for y in range(0, GH, 4):
        draw.rectangle([0, y, GW, y + 1], fill=(255, 255, 255, 14))
    frames = []
    for _ in range(FRAMES):
        img = base.copy()
        for _ in range(rng.randint(2, 5)):  # tear a few horizontal slices sideways
            y, h, shift = rng.randint(0, GH - 12), rng.randint(3, 12), rng.randint(-40, 40)
            band = img.crop((0, y, GW, y + h))
            img.paste(band, (shift, y))
            tint = Image.new("RGB", (GW, h), rng.choice([(255, 0, 80), (0, 220, 255), (145, 70, 255)]))
            img.paste(Image.blend(band, tint, 0.45), (shift, y))
        frames.append(img)
    save_gif("glitch-signal", frames, 110)


def space_stars():
    rng = random.Random(31)
    stars = [(rng.randint(0, GW), rng.randint(0, GH), rng.uniform(0, 1), rng.choice([1, 1, 2])) for _ in range(140)]
    base = glow(gradient((GW, GH), ["#02030d", "#0b1030", "#1b1145"], 35), (GW * 0.7, GH * 0.5), 110, "#4361ee", 0.4)
    frames = []
    for f in range(FRAMES):
        img = base.copy()
        draw = ImageDraw.Draw(img, "RGBA")
        for x, y, phase, size in stars:
            alpha = int(90 + 165 * (0.5 + 0.5 * math.sin(math.tau * (phase + f / FRAMES))))
            draw.ellipse([x, y, x + size, y + size], fill=(255, 255, 255, alpha))
        frames.append(img)
    save_gif("space-stars", frames, 100)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for make in [
        classic, classic_blurple, classic_midnight, anime_sakura, anime_sunset, gaming_arcade, gaming_pixels,
        lofi_dusk, lofi_paper, glitch_rgb, glitch_scanlines, space_nebula, minimal_slate, minimal_cream,
        anime_speedlines, gaming_neon_grid, lofi_rain, glitch_signal, space_stars,
    ]:
        make()
        print("made", make.__name__)
