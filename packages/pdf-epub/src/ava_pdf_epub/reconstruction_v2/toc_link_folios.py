"""Original admitted actions corroborate complete detached source-folio lines."""

from pypdf import PdfReader

from ..pdf_navigation import pdf_navigation
from .annotation_regions import upright_box
from .geometry import area, overlap
from .native_line_visibility import complete_visible_line
from .observations import NativeLine, PageObservation
from .page_label_semantics import source_destination
from .toc_page_label import toc_page_label


def toc_link_folios(reader: PdfReader, page: PageObservation) -> dict[str, tuple[NativeLine, int]]:
    annotations = reader.pages[page.number - 1].get("/Annots", [])
    annotations = annotations.get_object() if hasattr(annotations, "get_object") else annotations
    if not isinstance(annotations, list) or len(annotations) > 256:
        return {}
    rows: dict[str, tuple[NativeLine, int]] = {}
    for reference in annotations:
        annotation = reference.get_object()
        if annotation.get("/Subtype") != "/Link":
            continue
        target = pdf_navigation(reader, annotation)
        if target.page is None or not source_destination(reader, annotation, target):
            continue
        label = toc_page_label(reader, target.page)
        if label is None:
            continue
        caller = upright_box(reader.pages[page.number - 1], [float(v) for v in annotation["/Rect"]])
        if not caller.within(page.width_pt, page.height_pt):
            continue
        for line in page.lines:
            glyphs = [g for g in line.glyphs if g.text.strip()]
            if (
                line.text.strip() != label
                or not glyphs
                or not complete_visible_line(line)
                or "".join(g.text for g in glyphs) != label
                or any(
                    g.source_artifact
                    or area(g.box) <= 0
                    or overlap(g.box, caller) / area(g.box) < 0.9
                    for g in glyphs
                )
                or any(overlap(g.box, line.box) for g in page.graphics)
                or any(overlap(r.box, line.box) for r in page.required_regions)
            ):
                continue
            previous = rows.get(line.id)
            if previous is not None and previous[1] != target.page:
                return {}
            rows[line.id] = (line, target.page)
    return rows
