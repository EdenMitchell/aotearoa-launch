#!/usr/bin/env python3
"""Crop generated chroma-key sprite sheets into predictable game-ready PNGs.

The chroma-key removal itself is handled by the imagegen skill helper. This
script finds the separated sprites by transparent column gaps, fits each one
onto a stable transparent canvas, and writes optimized PNGs for Phaser.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


def separated_objects(image: Image.Image, expected: int) -> list[Image.Image]:
    alpha = image.getchannel("A")
    columns = [alpha.crop((x, 0, x + 1, image.height)).getbbox() is not None for x in range(image.width)]
    runs: list[tuple[int, int]] = []
    start: int | None = None

    for x, occupied in enumerate(columns + [False]):
        if occupied and start is None:
            start = x
        elif not occupied and start is not None:
            if x - start >= 24:
                runs.append((start, x))
            start = None

    if len(runs) != expected:
        raise ValueError(f"Expected {expected} separated objects, found {len(runs)}: {runs}")

    objects: list[Image.Image] = []
    for left, right in runs:
        segment = image.crop((left, 0, right, image.height))
        bbox = segment.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError("Generated object unexpectedly has no opaque pixels")
        objects.append(segment.crop(bbox))
    return objects


def fit_canvas(sprite: Image.Image, size: tuple[int, int], padding: int) -> Image.Image:
    available = (size[0] - padding * 2, size[1] - padding * 2)
    scale = min(available[0] / sprite.width, available[1] / sprite.height)
    resized = sprite.resize(
        (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2))
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Lanczos resizing can blend a trace of the green key back into a handful
    # of antialiased edge pixels. These generated sprites intentionally contain
    # no green materials, so remove only strongly green-dominant partial pixels.
    cleaned = image.copy()
    pixels = cleaned.load()
    for y in range(cleaned.height):
        for x in range(cleaned.width):
            red, green, blue, alpha = pixels[x, y]
            if 0 < alpha < 255 and green > red * 1.45 and green > blue * 1.45 and green > 80:
                pixels[x, y] = (red, max(red, blue), blue, alpha)
    cleaned.save(path, "PNG", optimize=True)


def process(input_dir: Path, output_dir: Path) -> None:
    weights = separated_objects(Image.open(input_dir / "weights-alpha.png").convert("RGBA"), 3)
    for name, sprite in zip(("light", "medium", "heavy"), weights, strict=True):
        save_png(fit_canvas(sprite, (320, 320), 10), output_dir / f"weight-{name}.png")

    rack_image = Image.open(input_dir / "rack-alpha.png").convert("RGBA")
    rack = separated_objects(rack_image, 1)[0]
    save_png(fit_canvas(rack, (1280, 256), 10), output_dir / "counterweight-rack.png")

    component_sizes = ((512, 512), (768, 160), (384, 384))
    component_names = ("frame", "beam", "basket")
    for palette in ("classic", "sunburst", "coral", "cosmic"):
        sheet = Image.open(input_dir / f"trebuchet-{palette}-alpha.png").convert("RGBA")
        components = separated_objects(sheet, 3)
        for component, name, size in zip(components, component_names, component_sizes, strict=True):
            save_png(
                fit_canvas(component, size, 8),
                output_dir / f"trebuchet-{palette}-{name}.png",
            )

    backdrop_names = (
        "rookie-grove",
        "sunset-sprint",
        "crystal-cavern",
        "moonshot-canopy",
        "golden-arena",
        "timed-blast",
        "jungle-workshop",
    )
    for name in backdrop_names:
        source = input_dir / f"{name}-source.png"
        if not source.exists():
            continue
        image = Image.open(source).convert("RGB")
        fitted = ImageOps.fit(image, (1280, 720), Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        fitted.save(output_dir / f"{name}.webp", "WEBP", quality=88, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    process(args.input_dir, args.output_dir)


if __name__ == "__main__":
    main()
