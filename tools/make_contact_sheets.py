from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def build(directory: Path, output: Path, columns: int = 3, thumb_width: int = 520) -> None:
    paths = sorted(directory.glob("*.png"))
    if not paths:
        return
    images = [Image.open(path).convert("RGB") for path in paths]
    ratio = images[0].height / images[0].width
    thumb_height = round(thumb_width * ratio)
    label_height = 34
    rows = math.ceil(len(images) / columns)
    sheet = Image.new("RGB", (columns * thumb_width, rows * (thumb_height + label_height)), "#d9d9d9")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=18)
    for index, (path, image) in enumerate(zip(paths, images, strict=True)):
        x = (index % columns) * thumb_width
        y = (index // columns) * (thumb_height + label_height)
        image.thumbnail((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        paste_x = x + (thumb_width - image.width) // 2
        sheet.paste(image, (paste_x, y))
        draw.rectangle((x, y + thumb_height, x + thumb_width, y + thumb_height + label_height), fill="white")
        draw.text((x + 8, y + thumb_height + 7), path.name, fill="black", font=font)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "tmp/page-renders")
    output = Path(sys.argv[2] if len(sys.argv) > 2 else "tmp/contact-sheets")
    for directory in sorted(path for path in root.iterdir() if path.is_dir()):
        columns = 4 if len(list(directory.glob("*.png"))) > 8 else 3
        build(directory, output / f"{directory.name}.png", columns=columns)


if __name__ == "__main__":
    main()
