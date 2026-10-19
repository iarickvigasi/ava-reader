"""Prove immutable observed-line conservation independently of task eligibility."""

from collections.abc import Sequence

from ..contracts.common import unique
from .observations import PageObservation
from .word_wrap_source_contract import WordWrapOwner


def word_wrap_source_index(
    owners: Sequence[WordWrapOwner],
    pages: Sequence[PageObservation],
) -> dict[str, tuple[WordWrapOwner, int]]:
    checked = [WordWrapOwner.model_validate(owner.model_dump()) for owner in owners]
    unique([owner.id for owner in checked], "word-wrap final owner")
    unique([str(page.number) for page in pages], "word-wrap observed page")
    unique([line.id for page in pages for line in page.lines], "word-wrap observed line")
    observed = {(page.number, line.id): line for page in pages for line in page.lines}
    positions = {}
    for owner in checked:
        for index, line in enumerate(owner.lines):
            original = observed.get((line.page, line.line_id))
            if original is None or original.text != line.text or original.box != line.box:
                raise ValueError("Word-wrap final owner witness differs from native observation")
            if line.line_id in positions:
                raise ValueError("Word-wrap native source line has multiple final owners")
            positions[line.line_id] = (owner, index)
    return positions
