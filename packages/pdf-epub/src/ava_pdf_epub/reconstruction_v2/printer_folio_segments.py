"""Keep printer inference tied to complete qualified native segment ownership."""

from collections import Counter
from collections.abc import Sequence

from ..contracts.profiles import BILINGUAL_PROFILE
from .prepared import PreparedPage
from .printer_folios import printer_folio_labels
from .segments import Segment


def printer_folio_segments(
    prepared: Sequence[PreparedPage], qualified: dict[int, list[Segment]], linked_ids: set[str]
) -> dict[str, tuple[str, int]]:
    result: dict[str, tuple[str, int]] = {}
    for checkpoint in prepared:
        if checkpoint.profile_id != BILINGUAL_PROFILE:
            continue
        page = checkpoint.observation
        labels = printer_folio_labels(page)
        lines = {line.id: line for line in page.lines if line.id in labels}
        segments = qualified[page.number]
        owners = Counter(ident for segment in segments for ident in segment.native_line_ids)
        for segment in segments:
            if (
                segment.method != "native"
                or len(segment.native_line_ids) != 1
                or not (
                    segment.kind == "furniture"
                    or segment.kind == "credit"
                    and segment.id in linked_ids
                )
            ):
                continue
            ident = segment.native_line_ids[0]
            line = lines.get(ident)
            if (
                line is not None
                and owners[ident] == 1
                and segment.text == line.text
                and segment.box == line.box
            ):
                result[segment.id] = (labels[ident], page.number)
    return result
