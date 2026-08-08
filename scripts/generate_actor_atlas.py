#!/usr/bin/env python3
"""Build the first hand-authored 16x24 actor atlas used by the Rado slice."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


FRAME_W = 16
FRAME_H = 24
DIRECTIONS = ("down", "left", "right", "up")
FRAMES = (0, 1, 2)

PALETTES = {
    "hero": {
        "hair": "#8d5a2b", "hair_dark": "#4a2d18", "skin": "#e6ad79",
        "coat": "#286ab0", "coat_light": "#4b8bd0", "shirt": "#d9d4c5",
        "accent": "#b83d32", "pants": "#3a4656", "boot": "#37281e",
    },
    "father": {
        "hair": "#c6c1b4", "hair_dark": "#696a66", "skin": "#d39a6d",
        "coat": "#39724d", "coat_light": "#579068", "shirt": "#b6aa8e",
        "accent": "#d09b37", "pants": "#344c3d", "boot": "#35271d",
    },
    "shopkeep": {
        "hair": "#3d3028", "hair_dark": "#1c1816", "skin": "#d6a071",
        "coat": "#805133", "coat_light": "#a46a42", "shirt": "#d3c8ae",
        "accent": "#d9a438", "pants": "#46352c", "boot": "#241b18",
    },
    "npc_m": {
        "hair": "#5f4328", "hair_dark": "#342317", "skin": "#dda778",
        "coat": "#3f7b58", "coat_light": "#5e9a72", "shirt": "#c9c4ae",
        "accent": "#6f4932", "pants": "#3e4851", "boot": "#2e241d",
    },
    "npc_w": {
        "hair": "#d1a330", "hair_dark": "#72551b", "skin": "#e2aa7a",
        "coat": "#a94f65", "coat_light": "#ce6f83", "shirt": "#eee0bd",
        "accent": "#315d83", "pants": "#57414a", "boot": "#39251f",
    },
    "npc_old": {
        "hair": "#d0cbc0", "hair_dark": "#6d6b67", "skin": "#cc966b",
        "coat": "#8c6c46", "coat_light": "#ad895b", "shirt": "#c8bfa8",
        "accent": "#5d6d77", "pants": "#4a4138", "boot": "#30251f",
    },
    "kid": {
        "hair": "#784421", "hair_dark": "#422514", "skin": "#e4aa76",
        "coat": "#c66a2f", "coat_light": "#e58b42", "shirt": "#e7d165",
        "accent": "#2d7693", "pants": "#3e5870", "boot": "#33231b",
    },
}

OUTLINE = "#201b19"
EYE = "#2a211d"


def rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], color: str) -> None:
    draw.rectangle(box, fill=color)


def legs(draw: ImageDraw.ImageDraw, p: dict[str, str], frame: int) -> None:
    left = 5 + (-1 if frame == 0 else 0)
    right = 9 + (1 if frame == 2 else 0)
    rect(draw, (left, 17, left + 2, 21), OUTLINE)
    rect(draw, (left + 1, 17, left + 2, 20), p["pants"])
    rect(draw, (right, 17, right + 2, 21), OUTLINE)
    rect(draw, (right, 17, right + 1, 20), p["pants"])
    rect(draw, (left, 21, left + 3, 22), p["boot"])
    rect(draw, (right - 1, 21, right + 2, 22), p["boot"])


def draw_down(draw: ImageDraw.ImageDraw, p: dict[str, str], frame: int, kind: str) -> None:
    rect(draw, (4, 1, 11, 7), OUTLINE)
    rect(draw, (5, 2, 10, 4), p["hair"])
    rect(draw, (4, 3, 5, 6), p["hair_dark"])
    rect(draw, (10, 3, 11, 6), p["hair_dark"])
    rect(draw, (5, 5, 10, 9), p["skin"])
    rect(draw, (6, 6, 6, 6), EYE)
    rect(draw, (9, 6, 9, 6), EYE)
    rect(draw, (7, 9, 8, 10), p["accent"])
    rect(draw, (3, 10, 12, 17), OUTLINE)
    rect(draw, (4, 10, 11, 16), p["coat"])
    rect(draw, (6, 10, 9, 16), p["shirt"])
    rect(draw, (4, 11, 5, 14), p["coat_light"])
    rect(draw, (2, 11, 3, 16), OUTLINE)
    rect(draw, (12, 11, 13, 16), OUTLINE)
    rect(draw, (2, 12, 2, 15), p["coat_light"])
    rect(draw, (13, 12, 13, 15), p["coat"])
    rect(draw, (2, 16, 3, 17), p["skin"])
    rect(draw, (12, 16, 13, 17), p["skin"])
    if kind == "father":
        rect(draw, (5, 7, 10, 8), p["hair_dark"])
        rect(draw, (6, 8, 9, 9), p["hair"])
    if kind == "kid":
        rect(draw, (4, 1, 11, 2), p["accent"])
        rect(draw, (3, 2, 9, 3), p["accent"])
    legs(draw, p, frame)


def draw_up(draw: ImageDraw.ImageDraw, p: dict[str, str], frame: int, kind: str) -> None:
    rect(draw, (4, 1, 11, 9), OUTLINE)
    rect(draw, (5, 2, 10, 8), p["hair"])
    rect(draw, (4, 4, 5, 8), p["hair_dark"])
    rect(draw, (10, 4, 11, 8), p["hair_dark"])
    rect(draw, (3, 9, 12, 17), OUTLINE)
    rect(draw, (4, 10, 11, 16), p["coat"])
    rect(draw, (5, 10, 10, 11), p["coat_light"])
    rect(draw, (7, 12, 8, 16), p["accent"])
    rect(draw, (2, 11, 3, 16), OUTLINE)
    rect(draw, (12, 11, 13, 16), OUTLINE)
    rect(draw, (2, 12, 2, 15), p["coat"])
    rect(draw, (13, 12, 13, 15), p["coat_light"])
    if kind == "kid":
        rect(draw, (4, 1, 11, 3), p["accent"])
    legs(draw, p, frame)


def draw_side(image: Image.Image, p: dict[str, str], frame: int, right: bool) -> None:
    base = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    rect(d, (5, 1, 11, 8), OUTLINE)
    rect(d, (5, 2, 10, 5), p["hair"])
    rect(d, (5, 4, 6, 8), p["hair_dark"])
    rect(d, (7, 5, 11, 9), p["skin"])
    rect(d, (10, 6, 10, 6), EYE)
    rect(d, (11, 7, 12, 8), p["skin"])
    rect(d, (5, 10, 11, 17), OUTLINE)
    rect(d, (6, 10, 10, 16), p["coat"])
    rect(d, (9, 11, 11, 15), p["coat_light"])
    rect(d, (10, 15, 12, 17), p["skin"])
    rect(d, (6, 9, 7, 10), p["accent"])
    legs(d, p, frame)
    if not right:
        base = base.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.alpha_composite(base)


def make_frame(kind: str, direction: str, frame: int) -> Image.Image:
    image = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    palette = PALETTES[kind]
    if direction == "down":
        draw_down(draw, palette, frame, kind)
    elif direction == "up":
        draw_up(draw, palette, frame, kind)
    else:
        draw_side(image, palette, frame, direction == "right")
    return image


def main() -> None:
    out_dir = Path(__file__).resolve().parents[1] / "src" / "assets" / "game"
    out_dir.mkdir(parents=True, exist_ok=True)
    characters = tuple(PALETTES)
    atlas = Image.new("RGBA", (FRAME_W * len(FRAMES), FRAME_H * len(DIRECTIONS) * len(characters)), (0, 0, 0, 0))
    frames: dict[str, object] = {}
    tags: list[dict[str, object]] = []
    index = 0
    for char_index, kind in enumerate(characters):
        for direction_index, direction in enumerate(DIRECTIONS):
            tag_from = index
            for frame in FRAMES:
                x = frame * FRAME_W
                y = (char_index * len(DIRECTIONS) + direction_index) * FRAME_H
                rendered = make_frame(kind, direction, frame)
                opaque_colors = {pixel[:3] for pixel in rendered.getdata() if pixel[3] > 0}
                if len(opaque_colors) < 4:
                    raise RuntimeError(f"invalid actor frame {kind}/{direction}/{frame}: {len(opaque_colors)} colors")
                atlas.alpha_composite(rendered, (x, y))
                name = f"{kind}/{direction}/{frame}"
                frames[name] = {
                    "frame": {"x": x, "y": y, "w": FRAME_W, "h": FRAME_H},
                    "rotated": False,
                    "trimmed": False,
                    "spriteSourceSize": {"x": 0, "y": 0, "w": FRAME_W, "h": FRAME_H},
                    "sourceSize": {"w": FRAME_W, "h": FRAME_H},
                    "duration": 130,
                }
                index += 1
            tags.append({"name": f"{kind}/{direction}", "from": tag_from, "to": index - 1, "direction": "forward"})

    png_path = out_dir / "actors-common.png"
    json_path = out_dir / "actors-common.json"
    atlas.save(png_path, optimize=True)
    json_path.write_text(json.dumps({
        "frames": frames,
        "meta": {
            "app": "mecha-boy hand-authored atlas builder",
            "version": "1.0",
            "image": png_path.name,
            "format": "RGBA8888",
            "size": {"w": atlas.width, "h": atlas.height},
            "scale": "1",
            "frameTags": tags,
        },
    }, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {png_path} ({atlas.width}x{atlas.height})")
    print(f"wrote {json_path} ({len(frames)} frames)")


if __name__ == "__main__":
    main()
