"""Reserve essential roles within the finite catalogue without changing legacy order."""

from .segments import Segment
from .source_feature_references import BodyReferences, local_body_reference


def essential_feature_reservation(
    segments: list[Segment], references: BodyReferences, nonquotes: set[str], current: bool
) -> set[str]:
    if not current:
        return set()
    essential, missing = set(), False
    for segment in segments:
        if (
            segment.method != "ocr"
            or segment.structure_candidate
            or segment.kind not in {"paragraph", "quote"}
            or segment.id in nonquotes
        ):
            continue
        reference = local_body_reference(segment, references)
        italic = segment.style is not None and segment.style.italic is True
        if reference is None:
            if segment.kind == "quote" or italic:
                essential.add(segment.id)
                missing = True
        elif segment.kind == "quote" or italic or segment.box.x0 - reference.box.x0 > 3:
            essential.add(segment.id)
    # Reserve only when the new route is needed; never reorder existing task nodes.
    return essential if missing else set()
