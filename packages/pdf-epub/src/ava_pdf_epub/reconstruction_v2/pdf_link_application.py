"""Map annotations on unchanged page owners before whole-book structure joins."""

from collections.abc import Sequence
from pathlib import Path

from pypdf import PdfReader

from ..pdf_navigation import pdf_navigation
from .annotation_regions import upright_box
from .assembly_state import AssemblyState
from .findings import Finding
from .native_link_resolution import NativeLinkResolution
from .pdf_link_caller import pdf_link_caller
from .pdf_link_marks import apply_link_marks
from .pdf_link_page import LinkPage
from .prepared_types import AnyPreparedPage
from .segments import Segment
from .source_link_refusal import source_link_step


def apply_pdf_links(
    source: Path,
    prepared: Sequence[AnyPreparedPage],
    segments: list[Segment],
    state: AssemblyState,
    scratch: Path | None = None,
) -> list[Segment]:
    reader = PdfReader(source, strict=True)
    try:
        result = list(segments)
        indexes = {s.id: i for i, s in enumerate(result)}
        for checkpoint in prepared:
            number = checkpoint.observation.number
            context = LinkPage(checkpoint, [s for s in result if s.page == number])
            with NativeLinkResolution(source, checkpoint) as resolution:
                for annotation_number, reference in enumerate(
                    reader.pages[number - 1].get("/Annots", []), start=1
                ):
                    annotation = reference.get_object()
                    if annotation.get("/Subtype") != "/Link":
                        continue
                    with source_link_step(checkpoint, annotation_number, "navigation"):
                        target = pdf_navigation(reader, annotation)
                        rect = upright_box(
                            reader.pages[number - 1], [float(v) for v in annotation["/Rect"]]
                        )
                    with source_link_step(checkpoint, annotation_number, "caller"):
                        ranges = pdf_link_caller(
                            reader,
                            target,
                            annotation,
                            rect,
                            context,
                            state,
                            scratch,
                            source,
                            resolution,
                        )
                    if target.derived_scheme:
                        state.structure_findings.append(
                            Finding(
                                code="PDF_LINK_SCHEME_DERIVED",
                                severity="information",
                                page=number,
                                message=(
                                    "A bare www host uses the HTTPS export policy; "
                                    "source bytes remain unchanged."
                                ),
                            )
                        )
                    with source_link_step(checkpoint, annotation_number, "application"):
                        apply_link_marks(ranges, target, result, indexes, reader, prepared, state)
        return result
    finally:
        reader.close()
