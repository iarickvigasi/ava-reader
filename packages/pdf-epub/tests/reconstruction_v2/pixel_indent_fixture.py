"""Real authored text pixels provide independent source geometry for OCR controls."""

import hashlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.segments import Segment

from .source_indent_fixture import page


def pixel_page(path: Path, groups):
    image = Image.new("L", (500, 300), 255)
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=14)
    segments = []
    for ident, positions, style in groups:
        boxes = []
        for x, y in positions:
            text = "Several distinct printed words establish this line."
            draw.text((x, y), text, font=font, fill=0)
            x0, y0, x1, y1 = draw.textbbox((x, y), text, font=font)
            boxes.append(Box(coordinate_space="page_points_top_left", x0=x0, y0=y0, x1=x1, y1=y1))
        segments.append(
            Segment(
                id=ident,
                page=1,
                kind="paragraph",
                method="ocr",
                style=style,
                text=text,
                box=Box(
                    coordinate_space="page_points_top_left",
                    x0=min(b.x0 for b in boxes),
                    y0=boxes[0].y0,
                    x1=max(b.x1 for b in boxes),
                    y1=boxes[-1].y1,
                ),
            )
        )
    image.save(path)
    observed = page([], path.name, hashlib.sha256(path.read_bytes()).hexdigest(), 500, 300)
    prepared = PreparedPage(
        schema_version="ava-prepared-page-1",
        source_sha256="a" * 64,
        source_byte_length=100,
        source_page_count=1,
        observation=observed,
        tables=[],
        native_segments=[],
        tasks=[],
    )
    return prepared, segments
