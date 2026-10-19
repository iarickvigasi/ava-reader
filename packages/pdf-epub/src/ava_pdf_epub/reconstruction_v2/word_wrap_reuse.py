"""Only exact unchanged native source decisions can avoid a new lexical comparison."""

from collections.abc import Sequence

from ..contracts.layout_hyphen import candidate_digest
from ..contracts.layout_hyphen_classification_v3 import NativeStructureHyphenClassificationReceipt
from ..contracts.layout_hyphen_v3 import LayoutHyphenCandidateV2


def reusable_word_wrap_authority(
    candidate: LayoutHyphenCandidateV2,
    prior: Sequence[NativeStructureHyphenClassificationReceipt],
    *,
    has_cuts: bool,
) -> NativeStructureHyphenClassificationReceipt | None:
    if has_cuts:
        return None
    matches = []
    for raw in prior:
        receipt = NativeStructureHyphenClassificationReceipt.model_validate(raw.model_dump())
        original = receipt.original_candidate
        if receipt.candidate_id != original.id:
            raise ValueError("Prior native word-wrap authority candidate identity differs")
        if original.id != candidate.id:
            continue
        if receipt.source_candidate_sha256 != candidate_digest(original):
            raise ValueError("Prior native word-wrap authority candidate digest differs")
        if receipt.decision == "unresolved":
            raise ValueError("Prior native word-wrap classification remains unresolved")
        if original.model_dump(exclude={"schema_version"}) != candidate.model_dump(
            exclude={"schema_version"}
        ):
            continue
        matches.append(receipt)
    if len(matches) > 1:
        raise ValueError("Word-wrap pair has repeated native classification authority")
    return matches[0] if matches else None
