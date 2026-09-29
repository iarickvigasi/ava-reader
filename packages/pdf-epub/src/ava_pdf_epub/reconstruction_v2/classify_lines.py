"""Conservative source roles from native typography; later graph checks resolve relationships."""

import re
from statistics import median

from .font_style import glyph_size
from .line_spans import line_spans
from .observations import NativeLine, PageObservation
from .segments import Segment


def classify_lines(page: PageObservation, excluded: set[str], furniture: set[str]) -> list[Segment]:
    lines = [line for line in page.lines if line.id not in excluded]
    sizes = [glyph_size(line.glyphs) for line in lines if line.id not in furniture]
    body = median(sizes) if sizes else 11
    result = []
    for line in lines:
        data = _classify(line, body)
        if line.id in furniture:
            data = {"kind": "furniture"}
        style = line.style.model_copy(
            update={"relative_size": max(0.5, min(3, glyph_size(line.glyphs) / body))}
        )
        result.append(
            Segment.model_validate(
                {
                    "id": line.id,
                    "page": page.number,
                    "box": line.box.model_dump(),
                    "text": line.text,
                    "source_text": line.text,
                    "style": style.model_dump(),
                    "spans": [s.model_dump() for s in line_spans(line)],
                    "native_line_ids": [line.id],
                    "method": "native",
                    **data,
                }
            )
        )
    return result


def _classify(line: NativeLine, body: float) -> dict[str, object]:
    text = line.text.strip()
    large = glyph_size(line.glyphs) >= body * 1.35
    if large or (line.style.bold and len(text.split()) <= 8 and len(text) < 70 and "." not in text):
        chapter = bool(re.match(r"^(?:chapter\b|[0-9]+[.)]\s|[IVXLCDM]+[.)]?\s)", text, re.I))
        return {
            "kind": "heading",
            "heading_level": 1 if large else 2,
            "chapter_start": chapter,
            "chapter_role": "bodymatter" if chapter else None,
        }
    if re.match(r"^(?:figure|fig\.|plate|illustration|table)\s*[A-Z]?\d+", text, re.I):
        return {"kind": "caption"}
    if re.match(r"^(?:credit|source|photo(?:graph)? by|illustration by)\s*:", text, re.I):
        return {"kind": "credit"}
    if line.style.family == "monospace":
        return {"kind": "code"}
    if re.fullmatch(r"[\s*·•—–-]{3,}", text):
        return {"kind": "separator"}
    return {"kind": "paragraph"}
