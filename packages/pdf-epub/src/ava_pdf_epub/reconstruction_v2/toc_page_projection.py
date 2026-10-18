"""All-or-nothing source partition, then ordinary complete-peer glyph validation."""

from pypdf import PdfReader

from .geometry import union
from .observations import PageObservation
from .ocr_glyph_owner import eligible_glyph_owner
from .ocr_literal_glyph_map import literal_fragment_map
from .segments import Segment
from .toc_projection_ink import toc_projection_ink
from .toc_projection_types import TocOwnerProjection
from .toc_source_entries import toc_source_entries


def toc_page_projection(
    reader: PdfReader, page: PageObservation, owners: list[Segment], policy: str | None
) -> list[TocOwnerProjection] | None:
    ink = toc_projection_ink(page)
    if ink is None:
        return None
    entries = toc_source_entries(reader, page, ink)
    if entries is None or len(entries) != len(owners):
        return None
    full = {(line.id, i) for line, values in ink for i, _ in values}
    selected = [(line.id, i) for e in entries for line, values in e.fragments for i, _ in values]
    if len(set(selected)) != len(selected) or set(selected) != full:
        return None
    texts = [
        "".join(c for _, v in e.fragments for _, g in v for c in g.text if not c.isspace())
        for e in entries
    ]
    accepted = ["".join(c for c in s.text if not c.isspace()) for s in owners]
    if texts != accepted or len(set(texts)) != len(texts):
        return None
    projected = [
        s.model_copy(update={"box": union([g.box for _, v in e.fragments for _, g in v])})
        for s, e in zip(owners, entries, strict=True)
    ]
    result = []
    for raw, owner, entry in zip(owners, projected, entries, strict=True):
        if (
            raw.model_dump(exclude={"box"}) != owner.model_dump(exclude={"box"})
            or not eligible_glyph_owner(page, owner, projected, policy)
            or literal_fragment_map(page, owner, projected, entry.fragments) is None
        ):
            return None
        result.append(TocOwnerProjection(raw, owner, entry))
    return result
