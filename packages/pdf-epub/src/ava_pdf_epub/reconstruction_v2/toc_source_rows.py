"""A visible contents header and repeated aligned author-linked folios witness a TOC column."""

from pypdf import PdfReader

from .geometry import overlap
from .native_line_visibility import complete_visible_line
from .observations import PageObservation
from .structure_claims import title_key
from .toc_link_folios import toc_link_folios


def toc_source_rows(reader: PdfReader, page: PageObservation) -> set[str]:
    headers = [
        line
        for line in page.lines
        if title_key(line.text) in {"contents", "table of contents", "зміст"}
        and complete_visible_line(line)
        and not any(g.source_artifact for g in line.glyphs)
        and not any(overlap(g.box, line.box) for g in page.graphics)
        and not any(overlap(r.box, line.box) for r in page.required_regions)
    ]
    if len(headers) != 1:
        return set()
    rows = toc_link_folios(reader, page)
    candidates = [
        (line, target)
        for line, target in rows.values()
        if line.box.y0 > headers[0].box.y1 and line.box.x0 > page.width_pt / 2
    ]
    supported: set[str] = set()
    for anchor, _ in candidates:
        aligned = sorted(
            [
                (line, target)
                for line, target in candidates
                if abs(line.box.x1 - anchor.box.x1)
                <= min(g.size for g in [*line.glyphs, *anchor.glyphs]) / 2
            ],
            key=lambda item: item[0].box.y0,
        )
        if (
            len(aligned) < 3
            or len({target for _, target in aligned}) < 3
            or any(
                b.box.y0 < a.box.y1 for (a, _), (b, _) in zip(aligned, aligned[1:], strict=False)
            )
        ):
            continue
        supported.update(line.id for line, _ in aligned)
    return supported
