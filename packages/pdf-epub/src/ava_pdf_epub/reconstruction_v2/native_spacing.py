"""Derive finite reflow spacing/indent/alignment from source lines without embedding print fonts."""

from statistics import median

from .font_style import glyph_size
from .line_spacing import baseline, line_height
from .native_indent import native_indent
from .observations import PageObservation
from .reading_order import reading_order
from .segments import Segment


def native_spacing(page: PageObservation, segments: list[Segment]) -> list[Segment]:
    lookup = {line.id: line for line in page.lines}
    columns = {p.segment.id: (p.band, p.column) for p in reading_order(segments, page.width_pt)}
    output = []
    for index, segment in enumerate(segments):
        lines = [lookup[ident] for ident in segment.native_line_ids if ident in lookup]
        # A constructed aside's native font proof establishes no paragraph/frame spacing.
        if not lines or not segment.style or segment.kind == "aside":
            output.append(segment)
            continue
        size = median(glyph_size(line.glyphs) for line in lines)
        indent, block_indent = native_indent(page, segments, columns, segment, lines, size)
        if segment.style.indent_em is not None:
            indent = segment.style.indent_em
        if segment.style.block_indent_em is not None:
            block_indent = segment.style.block_indent_em
        center = not segment.preserve_line_breaks and all(
            abs((line.box.x0 + line.box.x1) / 2 - page.width_pt / 2) < 3 for line in lines
        )
        align = (
            "center"
            if center and segment.box.x1 - segment.box.x0 < page.width_pt * 0.8
            else "start"
        )
        align = segment.style.align or align
        if align == "center":
            if segment.style.indent_em is None:
                indent = 0
            if segment.style.block_indent_em is None:
                block_indent = None
        kind = segment.kind
        first_indented = indent is not None and indent >= 1.2
        single_inset = len(lines) == 1 and block_indent is not None and block_indent >= 1.2
        if kind == "paragraph" and segment.style.italic and (first_indented or single_inset):
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
                "space_before_em": segment.style.space_before_em,
                "space_after_em": segment.style.space_after_em
                if segment.style.space_after_em is not None
                else after,
                "line_height": segment.style.line_height
                if segment.style.line_height is not None
                else leading,
            }
        )
        output.append(segment.model_copy(update={"kind": kind, "style": style}))
    return output
