"""Printed source labels constrain already-qualified note/list role decisions."""

import re

from .list_markers import MARKER, marker_value
from .native_structure_fields import NativeStructureGroup, NativeStructureLine
from .native_structure_ornaments import BASELINE_TOLERANCE
from .word_list_markers import word_list_ordinal


def _printed_note(group: NativeStructureGroup, text: str) -> None:
    marker = re.match(r"^\[([^]\s]{1,20})\]\s+", text) or re.match(r"^(\d+)\.\s+", text)
    if marker:
        if group.note_label not in {marker[1], marker[0].rstrip()}:
            raise ValueError("Native structure note label conflicts with the printed source")
    elif not re.match(re.escape(group.note_label or "") + r"(?:[.)]\s|\s)", text):
        raise ValueError("Native structure note label is absent from the printed source")


def _printed_marker(
    group: NativeStructureGroup, text: str, following_text: str, *, allow_words: bool = False
) -> None:
    marker, following = MARKER.match(text), MARKER.match(following_text)
    word = word_list_ordinal(text) if allow_words else None
    if marker is None and word is None:
        raise ValueError("Native structure list marker differs from its printed source")
    start = (
        marker_value(marker["marker"], following["marker"] if following else None)
        if marker
        else word
    )
    if group.list_ordered != (start is not None) or group.list_start != start:
        raise ValueError("Native structure list number differs from its printed source")


def _marker_source_text(group: NativeStructureGroup, lines: dict[str, NativeStructureLine]) -> str:
    first = lines[group.line_ids[0]]
    text = first.text.lstrip()
    if MARKER.match(text):
        return text
    previous = first.box
    for ident in group.line_ids[1:]:
        following = lines[ident]
        box = following.box
        if (
            abs(first.box.y0 - box.y0) > BASELINE_TOLERANCE
            or abs(first.box.y1 - box.y1) > BASELINE_TOLERANCE
            or previous.x1 > box.x0
        ):
            break
        # Marker proof may use a separately extracted body on the same physical
        # row; the original text, IDs and spans remain the assembly authority.
        text += " " + following.text
        previous = box
    return text
