#!/usr/bin/env python3
"""Generate the original pixel-art atlas used by battle weapon effects."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


ATLAS_W = 384
ATLAS_H = 176
FRAME_LAYOUT = {
    "shell": (0, 0, 16, 8, 4),
    "missile": (64, 0, 24, 12, 4),
    "laser": (160, 0, 24, 8, 4),
    "impact": (256, 0, 32, 32, 4),
    "explosion-medium": (0, 64, 48, 48, 6),
    "explosion-heavy": (0, 112, 64, 64, 6),
}


def rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], color: str) -> None:
    draw.rectangle(box, fill=color)


def shell_frame(frame: int) -> Image.Image:
    image = Image.new("RGBA", (16, 8), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    rect(draw, (2, 2, 11, 5), "#202628")
    rect(draw, (4, 1, 10, 1), "#59605e")
    rect(draw, (4, 6, 10, 6), "#101516")
    rect(draw, (11, 3, 14, 4), "#f0ce72")
    flame = ("#a83724", "#ee5b2f", "#ffad3f", "#fff0a2")[frame]
    rect(draw, (0, 3, 2 + (frame & 1), 4), flame)
    return image


def missile_frame(frame: int) -> Image.Image:
    image = Image.new("RGBA", (24, 12), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    rect(draw, (8, 4, 19, 7), "#d9d7c9")
    rect(draw, (11, 3, 18, 3), "#f5f0d7")
    rect(draw, (19, 5, 22, 6), "#b73129")
    rect(draw, (8, 2, 12, 3), "#8f9a91")
    rect(draw, (8, 8, 12, 9), "#59645f")
    flame_len = (3, 5, 7, 4)[frame]
    rect(draw, (8 - flame_len, 5, 7, 6), "#d94125")
    rect(draw, (9 - max(2, flame_len - 2), 5, 7, 5), "#ffb23e")
    return image


def laser_frame(frame: int) -> Image.Image:
    image = Image.new("RGBA", (24, 8), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    tail = frame % 2
    rect(draw, (tail, 3, 21, 4), "#d32f46")
    rect(draw, (5 + tail, 2, 20, 5), "#ff6c60")
    rect(draw, (9 + tail, 3, 23, 4), "#ffe2b8")
    rect(draw, (1, 3, 4 + tail, 4), "#7b2940")
    return image


def impact_frame(frame: int) -> Image.Image:
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    radii = (4, 8, 12, 9)
    radius = radii[frame]
    center = 16
    ray = radius + (5 if frame < 3 else 2)
    color = ("#fff2b0", "#ffc14a", "#ef5a2c", "#8f2d28")[frame]
    rect(draw, (center - ray, center - 1, center + ray, center + 1), color)
    rect(draw, (center - 1, center - ray, center + 1, center + ray), color)
    rect(draw, (center - radius, center - radius, center + radius, center + radius), "#e34a2d")
    inner = max(2, radius // 2)
    rect(draw, (center - inner, center - inner, center + inner, center + inner), "#ffb53e")
    if frame < 3:
        rect(draw, (center - 2, center - 2, center + 2, center + 2), "#fff7c7")
    return image


def explosion_frame(size: int, frame: int, heavy: bool) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    center = size // 2
    peak = size // 2 - 3
    curve = (0.24, 0.52, 0.82, 1.0, 0.78, 0.48)[frame]
    radius = max(3, round(peak * curve))
    dark = "#781f24" if heavy else "#8b2a22"
    rect(draw, (center - radius, center - 3, center + radius, center + 3), dark)
    rect(draw, (center - 3, center - radius, center + 3, center + radius), dark)
    diagonal = max(2, round(radius * 0.68))
    rect(draw, (center - diagonal, center - diagonal, center + diagonal, center + diagonal), "#e04427")
    middle = max(2, round(radius * 0.44))
    rect(draw, (center - middle, center - middle, center + middle, center + middle), "#ff9c32")
    core = max(1, round(radius * 0.2))
    if frame < 5:
        rect(draw, (center - core, center - core, center + core, center + core), "#fff0a8")
    if frame >= 3:
        smoke = "#3b3534" if heavy else "#514640"
        offset = max(3, radius // 2)
        rect(draw, (center - radius, center - offset, center - radius + 5, center - offset + 5), smoke)
        rect(draw, (center + radius - 5, center + offset - 5, center + radius, center + offset), smoke)
        rect(draw, (center - 4, center - radius, center + 3, center - radius + 5), smoke)
    return image


def render_frame(kind: str, frame: int, width: int, height: int) -> Image.Image:
    if kind == "shell":
        return shell_frame(frame)
    if kind == "missile":
        return missile_frame(frame)
    if kind == "laser":
        return laser_frame(frame)
    if kind == "impact":
        return impact_frame(frame)
    return explosion_frame(width, frame, kind == "explosion-heavy")


def main() -> None:
    out_dir = Path(__file__).resolve().parents[1] / "src" / "assets" / "game" / "battle"
    out_dir.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))
    frames: dict[str, object] = {}
    tags: list[dict[str, object]] = []
    tag_index = 0

    for kind, (start_x, start_y, width, height, count) in FRAME_LAYOUT.items():
        tag_from = tag_index
        for frame in range(count):
            x = start_x + frame * width
            rendered = render_frame(kind, frame, width, height)
            if rendered.size != (width, height):
                raise RuntimeError(f"invalid frame size for {kind}/{frame}: {rendered.size}")
            if not rendered.getbbox():
                raise RuntimeError(f"empty battle effect frame {kind}/{frame}")
            atlas.alpha_composite(rendered, (x, start_y))
            name = f"{kind}/{frame}"
            frames[name] = {
                "frame": {"x": x, "y": start_y, "w": width, "h": height},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": width, "h": height},
                "sourceSize": {"w": width, "h": height},
                "duration": 80 if kind in {"shell", "missile", "laser"} else 70,
            }
            tag_index += 1
        tags.append({"name": kind, "from": tag_from, "to": tag_index - 1, "direction": "forward"})

    png_path = out_dir / "effects-original.png"
    json_path = out_dir / "effects-original.json"
    atlas.save(png_path, optimize=True)
    json_path.write_text(
        json.dumps(
            {
                "frames": frames,
                "meta": {
                    "app": "mecha-boy original battle effects builder",
                    "version": "1.0",
                    "image": png_path.name,
                    "format": "RGBA8888",
                    "size": {"w": atlas.width, "h": atlas.height},
                    "scale": "1",
                    "frameTags": tags,
                },
            },
            ensure_ascii=True,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {png_path} ({atlas.width}x{atlas.height})")
    print(f"wrote {json_path} ({len(frames)} frames)")


if __name__ == "__main__":
    main()
