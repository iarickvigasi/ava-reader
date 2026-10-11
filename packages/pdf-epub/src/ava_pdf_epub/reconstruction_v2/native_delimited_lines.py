"""Preserve source-delimited activity rows as paragraphs without inventing poetry or markers."""

from .font_style import glyph_size
from .list_markers import MARKER
from .native_paired_lines import _same_style
from .observations import PageObservation
from .paragraphs import _join
from .reading_order import Placement
from .segments import Segment

MAX_LINES = 24
MAX_ITEMS = 12


def _plain(segment: Segment) -> bool:
    return (
        segment.method == "native"
        and segment.kind == "paragraph"
        and not segment.structure_candidate
        and not segment.preserve_line_breaks
        and len(segment.native_line_ids) == 1
        and bool(segment.text.strip())
        and MARKER.match(segment.text) is None
    )


def _complete(text: str) -> bool:
    return text.rstrip().rstrip('"’”)]').endswith((".", "!", "?"))


def preserve_delimited_lines(ordered: list[Placement], page: PageObservation) -> list[Placement]:
    output: list[Placement] = []
    rows = {line.id: line for line in page.lines}
    index = 0
    while index < len(ordered):
        first = ordered[index]
        start = first.segment
        previous = ordered[index - 1] if index else None
        if (
            previous is None
            or not _plain(previous.segment)
            or not previous.segment.text.rstrip().endswith(":")
            or not _plain(start)
            or previous.column != first.column
            or (first.column != 0 and previous.band != first.band)
            or previous.segment.page != start.page
            or not _same_style(previous.segment, start)
            or start.native_line_ids[0] not in rows
        ):
            output.append(first)
            index += 1
            continue
        size = glyph_size(rows[start.native_line_ids[0]].glyphs)
        inset = (start.box.x0 - previous.segment.box.x0) / size
        intro_gap = start.box.y0 - previous.segment.box.y1
        aligned_display = abs(inset) <= 0.15 and size <= intro_gap <= size * 3
        if not (0.7 <= inset <= 6 or aligned_display):
            output.append(first)
            index += 1
            continue
        group: list[Placement] = []
        separators: list[str] = []
        item_count = 1
        for current in ordered[index : index + MAX_LINES + 1]:
            segment = current.segment
            tail = group[-1].segment if group else previous.segment
            if (
                not _plain(segment)
                or current.column != first.column
                or (first.column != 0 and current.band != first.band)
                or segment.page != start.page
                or not _same_style(start, segment)
                or not 0 <= segment.box.y0 - tail.box.y1 <= size * (1.2 if group else 3)
            ):
                break
            new_item = bool(group and tail.text.rstrip().endswith(";"))
            if new_item and abs(segment.box.x0 - start.box.x0) > size * 0.15:
                break
            if (
                not new_item
                and not previous.segment.box.x0 <= segment.box.x0 <= start.box.x0 + size * 0.15
            ):
                break
            if group:
                separators.append("\n" if new_item else " ")
            item_count += bool(new_item)
            group.append(current)
            if _complete(segment.text):
                break
        if (
            3 <= item_count <= MAX_ITEMS
            and 3 <= len(group) <= MAX_LINES
            and _complete(group[-1].segment.text)
        ):
            # Intro alignment only selects display rows; page evidence owns indentation.
            combined = start.model_copy(update={"preserve_line_breaks": True})
            for current, separator in zip(group[1:], separators, strict=True):
                combined = _join(combined, current.segment, separator)
            output.append(Placement(combined, first.band, first.column))
            index += len(group)
        else:
            output.append(first)
            index += 1
    return output
