"""Only consecutive end/start source rows may join a physically wrapped URI."""

from .observations import PageObservation
from .uri_group_types import UriSourcePart
from .uri_text_boundary import uri_boundary_after, uri_boundary_before


def uri_wrap_order(
    page: PageObservation, parts: list[UriSourcePart], raw_uri: str
) -> list[UriSourcePart] | None:
    ordered = sorted(parts, key=lambda p: (p.line.box.y0, p.line.box.x0))
    if len({p.line.id for p in ordered}) != len(ordered):
        return None
    rows = sorted(page.lines, key=lambda line: (line.box.y0, line.box.x0))
    positions = {line.id: i for i, line in enumerate(rows)}
    for previous, current in zip(ordered, ordered[1:], strict=False):
        size = min(g.size for part in (previous, current) for _, g in part.values)
        if (
            positions[current.line.id] != positions[previous.line.id] + 1
            or previous.end != len(previous.line.text.rstrip())
            or current.start != len(current.line.text) - len(current.line.text.lstrip())
            or not 0 <= current.line.box.y0 - previous.line.box.y1 <= size * 2
        ):
            return None
    if (
        "".join(p.text for p in ordered) != raw_uri
        or not uri_boundary_before(ordered[0].line.text, ordered[0].start)
        or not uri_boundary_after(ordered[-1].line.text, ordered[-1].end)
    ):
        return None
    return ordered
