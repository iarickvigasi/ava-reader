"""Complete original Link rows must agree with folios and the original unique outline."""

from pypdf import PdfReader

from ..pdf_navigation import pdf_navigation
from .annotation_regions import upright_box
from .geometry import area, overlap, union
from .observations import PageObservation
from .ocr_glyph_fragments import Fragment
from .page_label_semantics import source_destination
from .reader_outline_claims import reader_outline_claims
from .structure_claims import title_key
from .toc_outline_match import toc_claims_match
from .toc_page_label import toc_page_label
from .toc_projection_types import TocSourceEntry
from .toc_row_layout import toc_row_layout
from .toc_source_rows import toc_source_rows


def toc_source_entries(
    reader: PdfReader, page: PageObservation, ink: list[Fragment]
) -> list[TocSourceEntry] | None:
    headers = [
        (line, values)
        for line, values in ink
        if title_key(line.text) in {"contents", "table of contents", "зміст"}
    ]
    if len(headers) != 1:
        return None
    header = TocSourceEntry(None, None, None, headers)
    supported = toc_source_rows(reader, page)
    annotations = reader.pages[page.number - 1].get("/Annots", [])
    annotations = annotations.get_object() if hasattr(annotations, "get_object") else annotations
    if not supported or not isinstance(annotations, list) or len(annotations) > 256:
        return None
    claims = reader_outline_claims(reader)
    entries = [header]
    for number, reference in enumerate(annotations, 1):
        annotation = reference.get_object()
        if annotation.get("/Subtype") != "/Link":
            continue
        target = pdf_navigation(reader, annotation)
        if target.page is None or target.url or not source_destination(reader, annotation, target):
            return None
        label = toc_page_label(reader, target.page)
        caller = upright_box(reader.pages[page.number - 1], [float(v) for v in annotation["/Rect"]])
        if label is None or not caller.within(page.width_pt, page.height_pt):
            return None
        fragments = [
            (line, [(i, g) for i, g in values if overlap(g.box, caller)]) for line, values in ink
        ]
        fragments = [(line, values) for line, values in fragments if values]
        if any(
            overlap(g.box, caller) / area(g.box) < 0.9 for _, values in fragments for _, g in values
        ):
            return None
        layout = toc_row_layout(page, fragments, label)
        if (
            layout is None
            or layout.folio.id not in supported
            or not toc_claims_match(claims, layout.title, target.page, layout.ordinal)
        ):
            return None
        entries.append(TocSourceEntry(number, target.page, caller, fragments))
    return sorted(entries, key=lambda e: union([g.box for _, v in e.fragments for _, g in v]).y0)
