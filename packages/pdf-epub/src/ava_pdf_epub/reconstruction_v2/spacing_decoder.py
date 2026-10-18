"""Bounded second-decoder strings; release every native PDF handle on all paths."""

import importlib
from contextlib import ExitStack
from pathlib import Path

from .observations import PageObservation
from .spacing_hyphen import corroborate_terminal_hyphen, hyphen_markers
from .spacing_padding import qualify_decoder_padding


def spacing_proposals(source: Path, observation: PageObservation) -> list[str]:
    pdfium = importlib.import_module("pypdfium2")
    with ExitStack() as resources:
        document = pdfium.PdfDocument(source)
        resources.callback(document.close)
        page = document[observation.number - 1]
        resources.callback(page.close)
        text = page.get_textpage()
        resources.callback(text.close)
        proposals = [
            text.get_text_bounded(
                errors="strict",
                left=line.box.x0,
                right=line.box.x1,
                bottom=observation.height_pt - line.box.y1,
                top=observation.height_pt - line.box.y0,
            )
            for line in observation.lines
        ]
        if any(
            value != line.text and value.strip(" ") == line.text
            for line, value in zip(observation.lines, proposals, strict=True)
        ):
            proposals = qualify_decoder_padding(proposals, observation, text, pdfium.raw)
        if not any(value.endswith("\x02") for value in proposals):
            return proposals
        markers = hyphen_markers(text, pdfium.raw, observation.height_pt)
        return [
            corroborate_terminal_hyphen(line, value, markers, observation)
            for line, value in zip(observation.lines, proposals, strict=True)
        ]
