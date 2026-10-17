"""Bound exact context by Unicode code points without clipping either split-word fragment."""

import unicodedata
from collections.abc import Sequence

from ..contracts.layout_hyphen_v3 import LayoutHyphenCandidateV2
from ..contracts.layout_prefix_cut_v3 import LayoutSourceCut

MAX_CONTEXT_CODEPOINTS = 256


def word_wrap_entry_context(
    source_pair: str,
    candidate: LayoutHyphenCandidateV2,
    cuts: Sequence[LayoutSourceCut],
) -> str:
    pieces, cursor = [], 0
    for cut in cuts:
        pieces.append(source_pair[cursor : cut.source_start])
        cursor = cut.source_end
    pieces.append(source_pair[cursor:])
    start = candidate.source_start - sum(
        min(candidate.source_start, cut.source_end) - cut.source_start
        for cut in cuts
        if cut.source_start < candidate.source_start
    )
    end = candidate.source_end - sum(
        min(candidate.source_end, cut.source_end) - cut.source_start
        for cut in cuts
        if cut.source_start < candidate.source_end
    )
    return word_wrap_context("".join(pieces), start, end)


def word_wrap_context(source_pair: str, start: int, end: int) -> str:
    if not 0 < start < end < len(source_pair):
        raise ValueError("Word-wrap context boundary is outside the source pair")
    first, last = start, end
    while first and _word_scalar(source_pair[first - 1]):
        first -= 1
    while last < len(source_pair) and _word_scalar(source_pair[last]):
        last += 1
    if last - first > MAX_CONTEXT_CODEPOINTS:
        raise ValueError("Word-wrap split word exceeds the bounded context")
    remaining = MAX_CONTEXT_CODEPOINTS - (last - first)
    before = min(first, remaining // 2)
    after = min(len(source_pair) - last, remaining - before)
    before = min(first, remaining - after)
    return source_pair[first - before : last + after]


def _word_scalar(value: str) -> bool:
    return value.isalpha() or bool(unicodedata.combining(value)) or value in {"'", "’", "-"}
