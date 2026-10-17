"""Authored source-line witnesses and explicit reading decisions, without a provider."""

import re

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.layout_hyphen import (
    LayoutHyphenCandidate,
    LayoutHyphenDisposition,
    LayoutHyphenLine,
    candidate_digest,
)
from ava_pdf_epub.contracts.source import Box

PDF_SHA = "a" * 64


def authored_hyphens(source, readings, *, pages=None, method="native"):
    lines, at = [], 0
    for index, raw in enumerate(source.splitlines(keepends=True)):
        text = raw.rstrip("\r\n")
        page = (pages or {}).get(index, 1)
        lines.append(
            LayoutHyphenLine(
                line_id=f"p{page}-line{index}",
                method=method,
                page=page,
                region_id=f"p{page}-content",
                box=Box(
                    coordinate_space="page_points_top_left",
                    x0=10.0,
                    y0=float(index * 20 + 10),
                    x1=250.0,
                    y1=float(index * 20 + 20),
                ),
                source_start=at,
                source_end=at + len(text),
            )
        )
        at += len(raw)
    candidates, dispositions = [], []
    wraps = list(re.finditer(r"-[ \t]*(?:\r\n|\r|\n)[ \t]*", source))
    for ordinal, disposition in readings:
        match = wraps[ordinal]
        left = next(line for line in lines if line.source_start <= match.start() < line.source_end)
        right = next(line for line in lines if line.source_start <= match.end() < line.source_end)
        candidate = LayoutHyphenCandidate(
            schema_version="ava-layout-hyphen-candidate-1",
            id=f"hyphen{ordinal}",
            source_sha256=PDF_SHA,
            source_text_sha256=text_digest(source),
            source_start=match.start(),
            source_end=match.end(),
            left=left,
            right=right,
            role="paragraph",
            boundary="page" if left.page != right.page else "line",
            preserve_line_breaks=False,
            consecutive=True,
        )
        candidates.append(candidate)
        dispositions.append(
            LayoutHyphenDisposition(
                candidate_id=candidate.id,
                candidate_sha256=candidate_digest(candidate),
                disposition=disposition,
            )
        )
    return candidates, dispositions
