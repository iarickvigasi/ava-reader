"""A body-prefix clip requires the exact typed printed-marker receipt."""

from typing import TYPE_CHECKING

from ..contracts.layout_prefix_cut_v3 import PrefixCutReceipt
from ..contracts.layout_source_cuts_v3 import exact_source_cut_text, source_cut_offset
from .word_wrap_source_contract import WordWrapSourceLine

if TYPE_CHECKING:
    from .word_wrap_source_contract import WordWrapOwner


def validate_word_wrap_cut(
    cut: int, receipt: PrefixCutReceipt | None, line: WordWrapSourceLine
) -> None:
    if cut == 0:
        if receipt is not None:
            raise ValueError("Uncut word-wrap source has a prefix-cut receipt")
        return
    if receipt is None or (
        len(receipt.raw_prefix) != cut
        or receipt.line_id != line.line_id
        or receipt.original_line_sha256 != line.text_sha256
        or line.text[:cut] != receipt.raw_prefix
    ):
        raise ValueError("Word-wrap prefix-cut receipt differs from the original source line")


def validate_word_wrap_owner_cuts(owner: "WordWrapOwner") -> None:
    lines = {line.line_id: line for line in owner.lines}
    pieces, cursor = [], 0
    for cut in owner.cuts:
        line = lines.get(cut.receipt.line_id)
        if (
            line is None
            or cut.source_start != line.source_start
            or not (cursor <= cut.source_start < cut.source_end < line.source_end)
        ):
            raise ValueError("Word-wrap owner cut is outside its original source line")
        validate_word_wrap_cut(cut.source_end - cut.source_start, cut.receipt, line)
        pieces.append(owner.original_text[cursor : cut.source_start])
        cursor = cut.source_end
    pieces.append(owner.original_text[cursor:])
    if owner.source_text != "".join(pieces):
        raise ValueError("Word-wrap owner body differs from its exact printed-marker cuts")
    if owner.source_text != exact_source_cut_text(owner.original_text, owner.cuts, role=owner.role):
        raise ValueError("Word-wrap owner cut role differs")


def retained_source_offset(owner: "WordWrapOwner", original: int) -> int:
    if not 0 <= original <= len(owner.original_text):
        raise ValueError("Word-wrap original source offset is outside its owner")
    return source_cut_offset(original, owner.cuts, len(owner.original_text))
