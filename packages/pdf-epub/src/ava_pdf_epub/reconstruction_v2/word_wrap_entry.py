"""Bind one qualified physical pair to its original owner and retained body coordinates."""

from collections.abc import Sequence

from ..contracts.common import text_digest
from ..contracts.layout_hyphen_classification_v3 import NativeStructureHyphenClassificationReceipt
from ..contracts.layout_prefix_cut_v3 import LayoutSourceCut
from .word_wrap_candidate import word_wrap_candidate
from .word_wrap_context import word_wrap_entry_context
from .word_wrap_cut_checks import retained_source_offset
from .word_wrap_fields import WordWrapEntry
from .word_wrap_reuse import reusable_word_wrap_authority
from .word_wrap_source_contract import WordWrapOwner


def qualified_word_wrap_entry(
    owner: WordWrapOwner,
    index: int,
    entry_id: str,
    source_sha256: str,
    prior: Sequence[NativeStructureHyphenClassificationReceipt],
) -> tuple[WordWrapEntry | None, str | None]:
    left, right = owner.lines[index : index + 2]
    cuts = [
        LayoutSourceCut(
            source_start=cut.source_start - left.source_start,
            source_end=cut.source_end - left.source_start,
            receipt=cut.receipt,
        )
        for cut in owner.cuts
        if cut.receipt.line_id in {left.line_id, right.line_id}
    ]
    try:
        candidate = word_wrap_candidate(owner, left, right, source_sha256)
        context = word_wrap_entry_context(left.text + "\n" + right.text, candidate, cuts)
    except ValueError as error:
        return None, "split_word_exceeds_context" if "bounded context" in str(error) else (
            "unsupported_boundary"
        )
    reused = reusable_word_wrap_authority(candidate, prior, has_cuts=bool(cuts))
    return WordWrapEntry.model_validate(
        dict(
            id=entry_id,
            owner_id=owner.id,
            owner_source_sha256=text_digest(owner.source_text),
            owner_original_sha256=text_digest(owner.original_text),
            source_pair=left.text + "\n" + right.text,
            candidate=candidate.model_dump(),
            owner_source_offset=retained_source_offset(owner, left.source_start),
            original_owner_source_offset=left.source_start,
            pair_cuts=[cut.model_dump() for cut in cuts],
            reused_authority=reused.model_dump() if reused else None,
            left=left.model_dump(),
            right=right.model_dump(),
            role=owner.role,
            language=owner.language,
            context=context,
        )
    ), None
