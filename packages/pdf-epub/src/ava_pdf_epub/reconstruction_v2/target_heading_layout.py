"""A numbered principal title may end with one complete smaller italic subtitle."""

from .complete_fragment_lines import complete_fragment_lines
from .geometry import union
from .numbered_heading_layout import numbered_heading_layout
from .observations import PageObservation
from .ocr_glyph_fragments import Fragment
from .ocr_glyph_stream import single_stream
from .source_gutters import crosses_source_gutter


def target_heading_layout(page: PageObservation, parts: list[Fragment]) -> str | None:
    if len(parts) < 2 or not complete_fragment_lines(parts):
        return None
    positions = {line.id: i for i, line in enumerate(page.lines)}
    indices = [positions[line.id] for line, _ in parts]
    if indices != list(range(indices[0], indices[-1] + 1)):
        return None
    first = parts[0][1][0][1]
    split = 0
    for line, values in parts:
        if (
            line.style.bold is not True
            or line.style.italic is True
            or any(g.font != first.font or abs(g.size - first.size) > 0.000001 for _, g in values)
        ):
            break
        split += 1
    principal = parts[:split]
    title = numbered_heading_layout(page, principal)
    if title is None:
        return None
    extra = parts[split:]
    if not extra:
        return title
    face = extra[0][1][0][1]
    if (
        not face.font
        or not 0 < face.size < first.size
        or not single_stream(extra)
        or crosses_source_gutter(page, extra)
        or any(line.style.bold is not True or line.style.italic is not True for line, _ in extra)
        or any(
            g.font != face.font or abs(g.size - face.size) > 0.000001
            for _, values in extra
            for _, g in values
        )
    ):
        return None
    start = union([g.box for _, g in principal[1][1]])
    last = union([g.box for _, g in principal[-1][1]])
    subtitle = union([g.box for _, g in extra[0][1]])
    if (
        not 0 <= subtitle.x0 - start.x0 <= 2 * first.size
        or not 0 <= subtitle.y0 - last.y1 <= 2 * first.size
        or any(
            not 0
            <= union([g.box for _, g in after]).y0 - union([g.box for _, g in before]).y1
            <= 2 * face.size
            for (_, before), (_, after) in zip(extra, extra[1:], strict=False)
        )
        or any(
            abs(union([g.box for _, g in values]).x0 - subtitle.x0) > face.size / 4
            for _, values in extra
        )
    ):
        return None
    return " ".join(line.text.strip() for line, _ in parts)
