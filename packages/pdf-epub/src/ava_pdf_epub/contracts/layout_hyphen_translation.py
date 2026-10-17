"""Only exact affine translation may derive a group-bound hyphen decision."""

from .common import text_digest, unique
from .layout_hyphen import LayoutHyphenCandidate, LayoutHyphenDisposition, candidate_digest
from .layout_hyphen_derivation import LayoutHyphenDerivation


def translated_hyphen_candidate(
    source: str, derivation: LayoutHyphenDerivation
) -> LayoutHyphenCandidate:
    derivation = LayoutHyphenDerivation.model_validate(derivation.model_dump())
    candidate, offset = derivation.source_candidate, derivation.source_offset
    if source[offset : offset + len(derivation.source_text)] != derivation.source_text:
        raise ValueError("Layout-hyphen source pair differs from its exact group slice")
    return LayoutHyphenCandidate.model_validate(
        candidate.model_copy(
            update={
                "source_text_sha256": text_digest(source),
                "source_start": candidate.source_start + offset,
                "source_end": candidate.source_end + offset,
                "left": candidate.left.model_copy(
                    update={
                        "source_start": candidate.left.source_start + offset,
                        "source_end": candidate.left.source_end + offset,
                    }
                ),
                "right": candidate.right.model_copy(
                    update={
                        "source_start": candidate.right.source_start + offset,
                        "source_end": candidate.right.source_end + offset,
                    }
                ),
            }
        ).model_dump()
    )


def validate_hyphen_derivations(
    source: str,
    candidates: list[LayoutHyphenCandidate],
    dispositions: list[LayoutHyphenDisposition],
    derivations: list[LayoutHyphenDerivation],
) -> None:
    unique([d.source_candidate.id for d in derivations], "layout-hyphen derivation")
    bound = {c.id: c for c in candidates}
    decisions = {d.candidate_id: d for d in dispositions}
    for derivation in derivations:
        original = derivation.source_disposition
        expected = translated_hyphen_candidate(source, derivation)
        if expected.id not in bound or expected.id not in decisions:
            raise ValueError("Layout-hyphen derivation names a foreign group candidate")
        if candidate_digest(expected) != candidate_digest(bound[expected.id]):
            raise ValueError("Layout-hyphen derivation changed source witnesses or coordinates")
        actual = decisions[expected.id]
        if (
            actual.disposition != original.disposition
            or actual.candidate_sha256 != candidate_digest(expected)
        ):
            raise ValueError("Layout-hyphen derivation changed the original reading decision")
