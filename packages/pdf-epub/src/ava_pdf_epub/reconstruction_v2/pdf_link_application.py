"""Map annotations on unchanged page owners before whole-book structure joins."""

from collections.abc import Sequence
from pathlib import Path

from pypdf import PdfReader

from ..pdf_navigation import pdf_navigation
from .annotation_regions import upright_box
from .assembly_state import AssemblyState
from .findings import Finding
from .geometry import overlap
from .native_link_resolution import NativeLinkResolution
from .pdf_glyph_ranges import glyph_ranges
from .pdf_link_marks import apply_link_marks
from .pdf_link_page import LinkPage
from .pdf_native_caller import native_pdf_caller
from .pdf_ocr_caller import ocr_pdf_caller
from .prepared_types import AnyPreparedPage
from .segments import Segment


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
                for reference in reader.pages[number - 1].get("/Annots", []):
                    annotation = reference.get_object()
                    if annotation.get("/Subtype") != "/Link":
                        continue
                    target = pdf_navigation(reader, annotation)
                    rect = upright_box(
                        reader.pages[number - 1], [float(v) for v in annotation["/Rect"]]
                    )
                    native = any(
                        overlap(line.box, rect)
                        and any(line.id in s.native_line_ids for s in context.owners)
                        for line in checkpoint.observation.lines
                    )
                    if native and any(
                        s.method == "ocr" and s.text and overlap(s.box, rect)
                        for s in context.owners
                    ):
                        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
                    if native:
                        try:
                            ranges = glyph_ranges(
                                checkpoint.observation,
                                context.owners,
                                rect,
                                source_line_maps=state.native_line_maps,
                            )
                        except ValueError as error:
                            if (
                                str(error) != "PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW"
                                or scratch is None
                            ):
                                raise
                            ranges = native_pdf_caller(
                                reader,
                                target,
                                annotation,
                                rect,
                                context,
                                state,
                                scratch,
                                resolution,
                            )
                    else:
                        ranges = ocr_pdf_caller(
                            reader, target, annotation, rect, context, state, scratch, source
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
                    apply_link_marks(ranges, target, result, indexes, reader, prepared, state)
        return result
    finally:
        reader.close()
