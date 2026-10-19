"""Rebind accepted pair authority locally while preserving the original provider receipt."""

from dataclasses import dataclass

from ..contracts.layout_hyphen import (
    LayoutHyphenCandidate,
    LayoutHyphenDisposition,
    candidate_digest,
)
from ..contracts.layout_hyphen_derivation import LayoutHyphenDerivation
from ..contracts.layout_hyphen_translation import translated_hyphen_candidate


@dataclass(frozen=True)
class DerivedLayoutHyphen:
    candidate: LayoutHyphenCandidate
    disposition: LayoutHyphenDisposition
    derivation: LayoutHyphenDerivation


def derive_layout_hyphen(
    source: str,
    pair_source: str,
    candidate: LayoutHyphenCandidate,
    disposition: LayoutHyphenDisposition,
    source_offset: int,
) -> DerivedLayoutHyphen:
    receipt = LayoutHyphenDerivation(
        source_text=pair_source,
        source_candidate=candidate,
        source_disposition=disposition,
        source_offset=source_offset,
    )
    derived = translated_hyphen_candidate(source, receipt)
    local = LayoutHyphenDisposition(
        candidate_id=derived.id,
        candidate_sha256=candidate_digest(derived),
        disposition=disposition.disposition,
    )
    return DerivedLayoutHyphen(derived, local, receipt)
