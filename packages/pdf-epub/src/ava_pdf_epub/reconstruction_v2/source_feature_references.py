"""Index source-local body appearances once; candidates do not scan all book prose."""

from bisect import bisect_left
from collections import defaultdict

from .segments import Segment
from .source_feature_geometry import same_column

BodyReferences = dict[int, list[tuple[list[float], list[Segment]]]]


def source_body_references(segments: list[Segment]) -> BodyReferences:
    groups: dict[tuple[int, int], list[Segment]] = defaultdict(list)
    for s in segments:
        if (
            s.kind == "paragraph"
            and len(s.text) >= 80
            and (
                not s.style
                or (
                    s.style.align in {None, "start", "left", "justify"}
                    and s.style.italic is not True
                    and s.style.block_indent_em in {None, 0}
                )
            )
        ):
            groups[(s.page, round(s.box.x0 / 8))].append(s)
    result: BodyReferences = defaultdict(list)
    for (page, _), rows in groups.items():
        rows.sort(key=lambda s: (s.box.y0, s.id))
        result[page].append(([s.box.y0 for s in rows], rows))
    return result


def local_body_reference(target: Segment, references: BodyReferences) -> Segment | None:
    candidates: list[Segment] = []
    for ys, rows in references.get(target.page, []):
        at = bisect_left(ys, target.box.y0)
        candidates.extend(
            s for s in rows[max(0, at - 2) : at + 3] if s.id != target.id and same_column(target, s)
        )
    return (
        min(candidates, key=lambda s: (abs(s.box.y0 - target.box.y0), s.id)) if candidates else None
    )
