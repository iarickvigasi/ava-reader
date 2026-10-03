"""Keep linked running text before furniture removal; geometry is verified later."""

from collections.abc import Sequence
from pathlib import Path

from pypdf import PdfReader

from .annotation_regions import upright_box
from .assembly_state import AssemblyState
from .findings import Finding
from .geometry import overlap
from .page_checkpoints import page_geometry
from .prepared import PreparedPage
from .segments import Segment


def preserve_linked_furniture(
    source: Path,
    prepared: Sequence[PreparedPage],
    qualified: dict[int, list[Segment]],
    state: AssemblyState,
) -> dict[int, list[Segment]]:
    reader = PdfReader(source, strict=True)
    output: dict[int, list[Segment]] = {}
    for index in range(len(prepared)):
        number = page_geometry(prepared, index).number
        page = reader.pages[number - 1]
        boxes = [
            upright_box(page, [float(v) for v in annotation["/Rect"]])
            for ref in page.get("/Annots", [])
            if (annotation := ref.get_object()).get("/Subtype") == "/Link"
        ]
        output[number] = []
        for segment in qualified[number]:
            if (
                segment.kind == "furniture"
                and segment.text
                and (
                    any(span.url for span in segment.spans)
                    or any(overlap(segment.box, box) for box in boxes)
                )
            ):
                segment = segment.model_copy(update={"kind": "credit"})
                state.structure_findings.append(
                    Finding(
                        code="PDF_LINKED_FURNITURE_PRESERVED",
                        severity="information",
                        page=number,
                        message=(
                            "Linked running text is retained as a source credit "
                            "before link verification."
                        ),
                    )
                )
            output[number].append(segment)
    return output
