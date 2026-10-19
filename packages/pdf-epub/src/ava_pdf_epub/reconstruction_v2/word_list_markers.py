"""Read finite printed word ordinals only after a list role has been qualified.

Do not add these to MARKER: ordinary paragraphs beginning First are not list proof.
Labels remain canonical text with their original styles, spans and source positions.
"""

import re

from .assembly_state import AssemblyState
from .segments import Segment

_WORDS = (
    "first second third fourth fifth sixth seventh eighth ninth tenth "
    "eleventh twelfth thirteenth fourteenth fifteenth sixteenth seventeenth "
    "eighteenth nineteenth twentieth"
).split()
_ORDINALS = {word: number for number, word in enumerate(_WORDS, 1)}
_PREFIX = re.compile(r"^(" + "|".join(_WORDS) + r")(?=\s+\S)", re.IGNORECASE)


def word_list_ordinal(text: str) -> int | None:
    marker = _PREFIX.match(text)
    return _ORDINALS[marker[1].lower()] if marker else None


def retain_word_marker(segment: Segment, state: AssemblyState) -> bool:
    ordinal = word_list_ordinal(segment.text) if segment.kind == "list_item" else None
    if ordinal is None:
        return False
    if not segment.list_ordered or segment.list_start != ordinal:
        raise ValueError("Printed word-list ordinal differs from its source")
    # Label, typography and locators stay in selectable canonical text. A generated
    # numeral would duplicate/change the source; a cross-line cut would lose proof.
    state.marker_styles[segment.id] = "none"
    return True
