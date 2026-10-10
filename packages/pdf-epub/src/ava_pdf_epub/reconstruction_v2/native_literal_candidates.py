"""Retain isolated indented line groups for review, without guessing poetry from punctuation."""

from statistics import median

from .paragraphs import _join
from .reading_order import Placement


def native_literal_candidates(ordered: list[Placement]) -> list[Placement]:
    output: list[Placement] = []
    metrics = {}
    for column in {p.column for p in ordered}:
        body = [
            p.segment
            for p in ordered
            if p.column == column
            and p.segment.kind == "paragraph"
            and not p.segment.structure_candidate
            and len(p.segment.text) >= 60
        ]
        if len(body) >= 4:
            metrics[column] = (
                median(s.box.x1 - s.box.x0 for s in body),
                min(s.box.x0 for s in body),
            )
    index = 0
    while index < len(ordered):
        first = ordered[index]
        segment = first.segment
        if first.column not in metrics:
            output.append(first)
            index += 1
            continue
        width, margin = metrics[first.column]
        height = max(1, segment.box.y1 - segment.box.y0)
        previous = ordered[index - 1] if index else None
        isolated = (
            previous is None
            or previous.column != first.column
            or (segment.box.y0 - previous.segment.box.y1 >= height)
        )
        if not isolated:
            output.append(first)
            index += 1
            continue
        width_limit = width * (1.05 if segment.text.lstrip().startswith(("«", "“", '"')) else 0.85)
        group: list[Placement] = []
        for offset in range(index, len(ordered)):
            current = ordered[offset]
            s = current.segment
            if (
                current.column != first.column
                or s.page != segment.page
                or s.method != "native"
                or s.kind not in {"paragraph", "verse"}
                or s.structure_candidate
                or len(s.native_line_ids) != 1
                or not s.text.strip()
                or s.box.x1 - s.box.x0 > width_limit
                or s.box.x0 - margin < height * 0.7
                or abs(s.box.x0 - segment.box.x0) > 3
                or (group and not 0 <= s.box.y0 - group[-1].segment.box.y1 <= height * 1.2)
            ):
                break
            group.append(current)
            if len(group) > 12:
                break
        following = ordered[index + len(group)] if index + len(group) < len(ordered) else None
        separated = (
            following is None
            or following.column != first.column
            or (bool(group) and following.segment.box.y0 - group[-1].segment.box.y1 >= height)
        )
        if isolated and separated and 3 <= len(group) <= 12:
            literal = segment.model_copy(update={"kind": "verse"})
            for line in group[1:]:
                literal = _join(literal, line.segment)
            literal = literal.model_copy(update={"structure_candidate": True})
            output.append(Placement(literal, first.band, first.column))
            index += len(group)
        else:
            output.append(first)
            index += 1
    return output
