"""Explain finite preservation/refusal without inferring a lexical disposition."""

import unicodedata
from typing import get_args

from .word_wrap_fields import WordWrapRole
from .word_wrap_source_contract import WordWrapOwner


def word_wrap_ineligibility(owner: WordWrapOwner, index: int) -> str | None:
    if owner.preserve_line_breaks or owner.role in {"verse", "code"}:
        return "preserved_line_breaks"
    if owner.role not in get_args(WordWrapRole):
        return "unsupported_role"
    if index + 1 >= len(owner.lines):
        return "no_following_owner_line"
    left, right = owner.lines[index : index + 2]
    if right.source_start != left.source_end + 1:
        return "unsupported_boundary"  # Protected OCR source between native lines stays opaque.
    right_cut = next((cut for cut in owner.cuts if cut.receipt.line_id == right.line_id), None)
    body_right = right.text[(right_cut.source_end - right_cut.source_start) if right_cut else 0 :]
    tail, head = left.text.rstrip(" \t"), body_right.lstrip(" \t")
    previous = len(tail) - 2
    while previous >= 0 and unicodedata.combining(tail[previous]):
        previous -= 1
    if previous < 0 or not tail[previous].isalpha() or not head or not head[0].isalpha():
        return "not_letter_pair"
    return None
