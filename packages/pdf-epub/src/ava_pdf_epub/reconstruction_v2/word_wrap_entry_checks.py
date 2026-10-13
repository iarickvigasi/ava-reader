"""Revalidate every private pair and original line witness before dispatch or application."""

from typing import TYPE_CHECKING

from ..contracts.layout_hyphen_v3 import qualify_layout_hyphen_candidate_v2
from .word_wrap_context import word_wrap_entry_context
from .word_wrap_cut_checks import validate_word_wrap_cut
from .word_wrap_reuse import reusable_word_wrap_authority

if TYPE_CHECKING:
    from .word_wrap_fields import WordWrapEntry


def validate_word_wrap_entry(entry: "WordWrapEntry") -> None:
    candidate, left, right = entry.candidate, entry.left, entry.right
    if entry.original_owner_source_offset != left.source_start:
        raise ValueError("Word-wrap pair original owner source offset differs")
    if entry.source_pair != left.text + "\n" + right.text:
        raise ValueError("Word-wrap pair differs from its immutable full source lines")
    qualify_layout_hyphen_candidate_v2(entry.source_pair, candidate, source_cuts=entry.pair_cuts)
    if candidate.role != entry.role:
        raise ValueError("Word-wrap candidate final role differs")
    if candidate.left.method != "native" or candidate.right.method != "native":
        raise ValueError("Word-wrap candidate has no native source authority")
    for witness, original, start in (
        (candidate.left, left, 0),
        (candidate.right, right, len(left.text) + 1),
    ):
        if (
            witness.line_id != original.line_id
            or witness.page != original.page
            or witness.region_id != original.region_id
            or witness.box != original.box
            or witness.source_start != start
            or witness.source_end != start + len(original.text)
        ):
            raise ValueError("Word-wrap candidate original source witness differs")
    for cut in entry.pair_cuts:
        line = left if cut.source_start == 0 else right
        expected_start = 0 if line is left else len(left.text) + 1
        if cut.source_start != expected_start:
            raise ValueError("Word-wrap pair cut is not the original line prefix")
        validate_word_wrap_cut(cut.source_end - cut.source_start, cut.receipt, line)
    if right.source_start != left.source_end + 1:
        raise ValueError("Word-wrap pair source ownership is not consecutive")
    if entry.context != word_wrap_entry_context(entry.source_pair, candidate, entry.pair_cuts):
        raise ValueError("Word-wrap context differs from the exact bounded source pair")
    if (
        entry.reused_authority is not None
        and reusable_word_wrap_authority(
            candidate, [entry.reused_authority], has_cuts=bool(entry.pair_cuts)
        )
        is None
    ):
        raise ValueError("Word-wrap entry borrows incompatible native classification authority")
