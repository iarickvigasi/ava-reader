"""Retain every whole source glyph touched by the exact original URI rectangles."""

from .geometry import area, overlap
from .native_line_visibility import complete_visible_line
from .observations import PageObservation
from .ocr_glyph_stream import single_stream
from .uri_group_types import OriginalUriGroup, UriSourcePart


def uri_source_parts(page: PageObservation, group: OriginalUriGroup) -> list[UriSourcePart] | None:
    if len({line.id for line in page.lines}) != len(page.lines):
        return None
    parts: list[UriSourcePart] = []
    keys: set[tuple[str, int]] = set()
    for index, box in group.boxes:
        before = len(parts)
        for line in page.lines:
            values = [
                (i, g)
                for i, g in enumerate(line.glyphs)
                if g.text.strip() and (area(g.box) <= 0 or overlap(g.box, box) / area(g.box) > 0.05)
            ]
            if not values:
                continue
            if not complete_visible_line(line) or not single_stream([(line, values)]):
                return None
            if any(
                not g.visible
                or g.source_artifact
                or area(g.box) <= 0
                or not g.box.within(page.width_pt, page.height_pt)
                or overlap(g.box, box) / area(g.box) < 0.9
                or "\ufffd" in g.text
                or "(cid:" in g.text
                for _, g in values
            ):
                return None
            first, last = values[0][0], values[-1][0]
            if [i for i, g in enumerate(line.glyphs) if first <= i <= last and g.text.strip()] != [
                i for i, _ in values
            ]:
                return None
            cursor, positions = 0, {}
            for ordinal, glyph in enumerate(line.glyphs):
                at = line.text.find(glyph.text, cursor)
                positions[ordinal] = (at, at + len(glyph.text))
                cursor = at + len(glyph.text)
            start, end = positions[first][0], positions[last][1]
            text = line.text[start:end]
            if any(c.isspace() for c in text) or text != "".join(g.text for _, g in values):
                return None
            for ordinal, _ in values:
                key = (line.id, ordinal)
                if key in keys:
                    return None
                keys.add(key)
            parts.append(UriSourcePart(index, line, tuple(values), start, end, text))
        if len(parts) == before or len(parts) > 16:
            return None
    return parts if parts else None
