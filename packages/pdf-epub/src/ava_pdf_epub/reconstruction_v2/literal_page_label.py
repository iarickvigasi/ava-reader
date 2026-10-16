"""Author-declared page labels corroborate a native index reference, never its text."""

import re
from collections.abc import Mapping
from typing import Any

from pypdf import PdfReader

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget, pdf_navigation
from .geometry import area, overlap
from .native_line_offsets import NativeLineOffset, mapped_line_offset
from .observations import PageObservation
from .ocr_link_context import complete_visible_line
from .segments import Segment


def _source_destination(reader: PdfReader, annotation: Any, target: NavigationTarget) -> bool:
    if (
        not isinstance(annotation, dict)
        or annotation.get("/Subtype") != "/Link"
        or "/AA" in annotation
    ):
        return False
    action = annotation.get("/A")
    action = action.get_object() if action is not None and hasattr(action, "get_object") else action
    if action is None:
        direct = "/Dest" in annotation
    else:
        direct = (
            isinstance(action, dict)
            and action.get("/S") in {"/GoTo", "/JavaScript"}
            and "/Next" not in action
            and "/Dest" not in annotation
        )
    # The existing parser admits only an exact constant page-jump spelling;
    # JavaScript is never executed or interpreted beyond that fixed grammar.
    return direct and pdf_navigation(reader, annotation) == target


def explicit_decimal_label(reader: PdfReader, target: NavigationTarget) -> str | None:
    if (
        target.url is not None
        or target.page is None
        or target.top is not None
        or target.left is not None
        or not 1 <= target.page <= len(reader.pages)
    ):
        return None
    root = reader.trailer["/Root"]
    if not isinstance(root, dict):
        return None
    tree = root.get("/PageLabels")
    tree = tree.get_object() if tree is not None and hasattr(tree, "get_object") else tree
    if not isinstance(tree, dict) or "/Kids" in tree:
        return None
    numbers = tree.get("/Nums")
    if (
        not isinstance(numbers, list)
        or not numbers
        or len(numbers) % 2
        or numbers[0] != 0
        or len(numbers) > 2 * len(reader.pages)
    ):
        return None
    selected = None
    previous = -1
    for index in range(0, len(numbers), 2):
        start, rule = numbers[index : index + 2]
        if (
            isinstance(start, bool)
            or not isinstance(start, int)
            or not previous < start < len(reader.pages)
        ):
            return None
        previous = start
        if start <= target.page - 1:
            selected = (start, rule.get_object() if hasattr(rule, "get_object") else rule)
    if selected is None:
        return None
    start, rule = selected
    if not isinstance(rule, dict) or rule.get("/S") != "/D" or rule.get("/P", "") != "":
        return None
    initial = rule.get("/St", 1)
    if isinstance(initial, bool) or not isinstance(initial, int) or initial < 1:
        return None
    label = str(initial + target.page - 1 - start)
    try:
        labels = reader.page_labels
    except (TypeError, ValueError, KeyError, IndexError):
        return None
    if labels[target.page - 1] != label or labels.count(label) != 1:
        return None
    return label


def literal_page_label_range(
    reader: PdfReader,
    target: NavigationTarget,
    page: PageObservation,
    segments: list[Segment],
    caller: Box,
    mappings: Mapping[str, NativeLineOffset] | None,
    *,
    annotation: Any,
) -> list[tuple[str, int, int]] | None:
    if not _source_destination(reader, annotation, target):
        return None
    label = explicit_decimal_label(reader, target)
    if (
        label is None
        or set(page.risks) - {"language_uncertain"}
        or page.rotation
        or page.required_regions
        or not caller.within(page.width_pt, page.height_pt)
        or any(overlap(g.box, caller) for g in page.graphics)
        or len({line.id for line in page.lines}) != len(page.lines)
        or len({s.id for s in segments}) != len(segments)
    ):
        return None
    lines = [
        line
        for line in page.lines
        if any(g.text.strip() and overlap(g.box, caller) for g in line.glyphs)
    ]
    if len(lines) != 1:
        return None
    line = lines[0]
    if not complete_visible_line(line) or any(g.source_artifact for g in line.glyphs):
        return None
    owners = [s for s in segments if line.id in s.native_line_ids]
    if len(owners) != 1:
        return None
    owner = owners[0]
    if (
        owner.method != "native"
        or owner.page != page.number
        or owner.kind in {"table", "figure", "furniture", "unsupported"}
        or owner.source_marginal_furniture
        or any(s is not owner and s.text and overlap(s.box, caller) for s in segments)
    ):
        return None
    at = mapped_line_offset(line, owner, mappings)
    if at is None:
        return None
    tokens = [token for token in re.finditer(r"\S+", line.text) if token.group() == label + ","]
    if len(tokens) != 1:
        return None
    token = tokens[0]
    boundary = token.end() - 1
    selected: set[int] = set()
    comma = False
    cursor = 0
    for glyph in line.glyphs:
        offset = line.text.find(glyph.text, cursor)
        cursor = offset + len(glyph.text)
        if not glyph.text.strip():
            continue
        if not glyph.box.within(page.width_pt, page.height_pt) or area(glyph.box) <= 0:
            return None
        fraction = overlap(glyph.box, caller) / area(glyph.box)
        if token.start() <= offset < boundary:
            if (
                cursor > boundary
                or fraction < 0.9
                or overlap(glyph.box, owner.box) / area(glyph.box) < 0.9
            ):
                return None
            selected.update(range(offset, cursor))
        elif offset == boundary and glyph.text == ",":
            # The exact declared destination label, not this midpoint, provides
            # boundary authority. The midpoint only refuses a comma-centered link.
            center_x = (glyph.box.x0 + glyph.box.x1) / 2
            center_y = (glyph.box.y0 + glyph.box.y1) / 2
            if (
                not 0 < fraction < 0.9
                or caller.x0 <= center_x <= caller.x1
                and caller.y0 <= center_y <= caller.y1
            ):
                return None
            comma = True
        elif fraction > 0:
            return None
    if not comma or selected != set(range(token.start(), boundary)):
        return None
    return [(owner.id, at + token.start(), at + boundary)]
