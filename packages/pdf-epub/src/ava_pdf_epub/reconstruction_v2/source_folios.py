"""Printed page labels require visible marginal evidence; physical indices are not substitutes."""

import re
from statistics import median

from .font_style import glyph_size
from .prepared import PreparedPage
from .segments import Segment


def source_folios(
    prepared: list[PreparedPage], segments: dict[int, list[Segment]]
) -> dict[str, int]:
    labels: dict[str, int] = {}
    for checkpoint in prepared:
        page = checkpoint.observation
        texts = [s.text.strip() for s in segments[page.number] if s.kind == "furniture"]
        if not page.risks:
            body = median(glyph_size(line.glyphs) for line in page.lines) if page.lines else 11
            texts += [
                line.text.strip()
                for line in page.lines
                if (line.box.y0 < page.height_pt * 0.08 or line.box.y1 > page.height_pt * 0.92)
                and glyph_size(line.glyphs) <= body * 1.1
            ]
        for label in set(texts):
            if re.fullmatch(r"\d{1,5}|[ivxlcdmIVXLCDM]{1,12}", label):
                key = label.casefold()
                prior = {name.casefold(): value for name, value in labels.items()}
                if (key in prior and prior[key] != page.number) or any(
                    value == page.number and name.casefold() != key
                    for name, value in labels.items()
                ):
                    raise ValueError("Ambiguous printed page labels require source review")
                labels[label] = page.number
    return labels
