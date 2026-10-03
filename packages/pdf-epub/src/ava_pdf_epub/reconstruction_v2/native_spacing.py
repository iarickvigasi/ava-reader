"""Derive finite reflow spacing/indent/alignment from source lines without embedding print fonts."""

from statistics import median

from .font_style import glyph_size
from .line_spacing import baseline, line_height
from .observations import PageObservation
from .segments import Segment


def native_spacing(page: PageObservation, segments: list[Segment]) -> list[Segment]:
    lookup = {line.id: line for line in page.lines}
    margin = min((line.box.x0 for line in page.lines if len(line.text) > 30), default=0)
    output = []
    for index, segment in enumerate(segments):
        lines = [lookup[ident] for ident in segment.native_line_ids if ident in lookup]
        if not lines or not segment.style:
            output.append(segment)
            continue
        first = lines[0]
        size = median(glyph_size(line.glyphs) for line in lines)
        local_margin = (
            min(
                (
                    line.box.x0
                    for line in page.lines
                    if len(line.text) > 30 and line.box.x0 >= page.width_pt / 2
                ),
                default=margin,
            )
            if first.box.x0 >= page.width_pt / 2
            else margin
        )
        indent = max(-3, min(6, (first.box.x0 - min(local_margin, segment.box.x0)) / size))
        block_indent = None
        # Aligned multiline insets belong to the whole block. Keep first-line
        # displacement relative to that inset. Qualified paired boundary fragments
        # retain the same inset; other single lines remain ambiguous.
        if len(lines) >= 2 or segment.preserve_line_breaks:
            inset = min(line.box.x0 for line in lines) - local_margin
            if inset >= size * 0.5:
                block_indent = max(0, min(6, inset / size))
                indent = max(-3, min(6, (first.box.x0 - min(line.box.x0 for line in lines)) / size))
        center = (
            not segment.preserve_line_breaks
            and abs((segment.box.x0 + segment.box.x1) / 2 - page.width_pt / 2) < 3
        )
        align = (
            "center"
            if center and segment.box.x1 - segment.box.x0 < page.width_pt * 0.8
            else "start"
        )
        if align == "center":
            indent = 0
            block_indent = None
        kind = segment.kind
        if kind == "paragraph" and segment.style.italic and indent >= 1.2:
            kind = "quote"
        leading = line_height(lines, size)
        after = None
        if leading and index + 1 < len(segments):
            following = [
                lookup[ident] for ident in segments[index + 1].native_line_ids if ident in lookup
            ]
            if following and following[0].box.y0 > lines[-1].box.y0:
                after = max(
                    0, min(5, (baseline(following[0]) - baseline(lines[-1])) / size - leading)
                )
        style = segment.style.model_copy(
            update={
                "align": align,
                "indent_em": indent,
                "block_indent_em": block_indent,
                "space_before_em": None,
                "space_after_em": after,
                "line_height": leading,
            }
        )
        output.append(segment.model_copy(update={"kind": kind, "style": style}))
    return output
