"""Bounded second-decoder strings; release every native PDF handle on all paths."""

import importlib
from contextlib import ExitStack
from pathlib import Path

from .observations import PageObservation


def spacing_proposals(source: Path, observation: PageObservation) -> list[str]:
    pdfium = importlib.import_module("pypdfium2")
    with ExitStack() as resources:
        document = pdfium.PdfDocument(source)
        resources.callback(document.close)
        page = document[observation.number - 1]
        resources.callback(page.close)
        text = page.get_textpage()
        resources.callback(text.close)
        return [
            text.get_text_bounded(
                errors="strict",
                left=line.box.x0,
                right=line.box.x1,
                bottom=observation.height_pt - line.box.y1,
                top=observation.height_pt - line.box.y0,
            )
            for line in observation.lines
        ]
