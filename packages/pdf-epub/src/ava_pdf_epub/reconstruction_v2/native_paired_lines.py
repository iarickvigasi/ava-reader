"""Keep corroborated repeated comparison lines as paragraphs, not invented poetry/tables."""

from math import isclose
from statistics import median

from .reading_order import Placement
from .segments import Segment


def _same_style(a: Segment, b: Segment) -> bool:
    if a.style is None or b.style is None:
        return False
    size_a, size_b = a.style.relative_size, b.style.relative_size
    sizes_match = size_a == size_b or (
        size_a is not None
        and size_b is not None
        and isclose(size_a, size_b, rel_tol=1e-9, abs_tol=1e-9)
    )
    return sizes_match and a.style.model_dump(exclude={"id", "relative_size"}) == (
        b.style.model_dump(exclude={"id", "relative_size"})
    )


def _lines(segment: Segment) -> list[str]:
    return (segment.source_text or segment.text).split("\n")


def preserve_paired_lines(joined: list[Placement], observed: list[Placement]) -> list[Placement]:
    output = list(joined)
    source_lines = {
        s.native_line_ids[0]: s for p in observed if len((s := p.segment).native_line_ids) == 1
    }
    for column in {p.column for p in observed}:
        body = [
            p.segment
            for p in observed
            if p.column == column
            and p.segment.kind == "paragraph"
            and not p.segment.structure_candidate
            and len(p.segment.text) >= 60
        ]
        if len(body) < 4:
            continue
        margin = min(s.box.x0 for s in body)
        width = median(s.box.x1 - s.box.x0 for s in body)
        candidates: list[int] = []
        for index, placement in enumerate(joined):
            s = placement.segment
            height = (s.box.y1 - s.box.y0) / max(1, len(s.native_line_ids))
            lines = _lines(s)
            native = [source_lines[ident] for ident in s.native_line_ids if ident in source_lines]
            if (
                placement.column == column
                and s.method == "native"
                and s.kind == "paragraph"
                and not s.structure_candidate
                and len(s.native_line_ids) == len(lines) == 2
                and len(native) == 2
                and _same_style(native[0], native[1])
                and abs(native[0].box.x0 - native[1].box.x0) <= 3
                and all(line.strip() for line in lines)
                and s.text == " ".join(lines)
                and s.box.x0 - margin >= height * 0.7
                and s.box.x1 - s.box.x0 <= width * 0.95
            ):
                candidates.append(index)
        # Exact repeated pairs corroborate a display run; ordinary prose wrapping is unchanged.
        for seed in candidates:
            first = joined[seed].segment
            group = [
                i
                for i in candidates
                if abs(joined[i].segment.box.x0 - first.box.x0) <= 3
                and _same_style(joined[i].segment, first)
            ]
            repeated = {
                tuple(_lines(joined[i].segment))
                for i in group
                if _lines(joined[i].segment)[0] == _lines(joined[i].segment)[1]
            }
            if len(group) < 5 or len(repeated) < 2:
                continue
            selected = set(group)
            # A single source line at an adjacent page edge can be half of a printed pair.
            for index in group:
                for neighbour in (index - 1, index + 1):
                    if not 0 <= neighbour < len(joined):
                        continue
                    p, s = joined[neighbour], joined[neighbour].segment
                    pair = joined[index].segment
                    height = pair.box.y1 - pair.box.y0
                    gap = max(s.box.y0 - pair.box.y1, pair.box.y0 - s.box.y1)
                    if (
                        p.column == column
                        and s.method == "native"
                        and s.kind == "paragraph"
                        and not s.structure_candidate
                        and len(s.native_line_ids) == 1
                        and "\n" not in s.text
                        and _same_style(s, first)
                        and abs(s.box.x0 - first.box.x0) <= 3
                        and s.box.x1 - s.box.x0 <= width * 0.95
                        and 0 <= gap <= height * 2
                    ):
                        selected.add(neighbour)
            for index in selected:
                p = joined[index]
                s = p.segment
                updated = Segment.model_validate(
                    {
                        **s.model_dump(),
                        "text": s.source_text or s.text,
                        "preserve_line_breaks": True,
                    }
                )
                output[index] = Placement(updated, p.band, p.column)
    return output
