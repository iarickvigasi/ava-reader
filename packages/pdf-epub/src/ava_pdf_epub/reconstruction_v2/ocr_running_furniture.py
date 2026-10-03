"""Resolve inconsistent OCR roles only for corroborated repeated marginal text."""

from collections import defaultdict
from collections.abc import Sequence

from .assembly_state import AssemblyState
from .findings import Finding
from .page_checkpoints import page_geometry
from .prepared import PreparedPage
from .segments import Segment


def corroborate_running_furniture(
    prepared: Sequence[PreparedPage],
    qualified: dict[int, list[Segment]],
    state: AssemblyState,
) -> dict[int, list[Segment]]:
    groups: dict[tuple[str, str], list[tuple[Segment, tuple[float, ...]]]] = defaultdict(list)
    for index in range(len(prepared)):
        page = page_geometry(prepared, index)
        width, height = page.width_pt, page.height_pt
        for segment in qualified[page.number]:
            if (
                segment.method != "ocr"
                or segment.kind not in {"heading", "furniture"}
                or len(segment.text.strip()) < 6
                or segment.spans
                or segment.related_to
                or segment.chapter_start
                or segment.chapter_role
            ):
                continue
            box = segment.box
            margin = (
                "top"
                if box.y1 <= height * 0.08
                else ("bottom" if box.y0 >= height * 0.92 else None)
            )
            if margin is not None:
                groups[segment.text.strip(), margin].append(
                    (segment, (box.x0 / width, box.y0 / height, box.x1 / width, box.y1 / height))
                )
    confirmed: set[str] = set()
    for entries in groups.values():
        pages = {segment.page for segment, _ in entries}
        if (
            len(pages) < max(3, (len(prepared) + 1) // 2)
            or len(pages) != len(entries)
            or not any(segment.kind == "furniture" for segment, _ in entries)
            or any(
                max(box[i] for _, box in entries) - min(box[i] for _, box in entries) > 0.01
                for i in range(4)
            )
        ):
            continue
        confirmed.update(segment.id for segment, _ in entries if segment.kind == "heading")
    output: dict[int, list[Segment]] = {}
    for number, segments in qualified.items():
        output[number] = []
        for segment in segments:
            if segment.id in confirmed:
                segment = segment.model_copy(update={"kind": "furniture", "heading_level": None})
                state.structure_findings.append(
                    Finding(
                        code="OCR_RUNNING_FURNITURE_CORROBORATED",
                        severity="information",
                        page=number,
                        message=(
                            "Exact repeated marginal OCR text agrees "
                            "with an observed furniture peer."
                        ),
                    )
                )
            output[number].append(segment)
    return output
