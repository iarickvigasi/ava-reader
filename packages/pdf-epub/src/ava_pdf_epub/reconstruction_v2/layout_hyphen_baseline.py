"""Restore only named deletions for composition; every other exact transform survives."""

from typing import Literal

from ..contracts.common import text_digest
from ..contracts.layout_normalization import LayoutNormalizationMap
from ..contracts.normalization import NormalizationMap, NormalizationSegment
from .normalization_map import line_wrap_map


def restored_layout_baseline(
    source: str,
    text: str,
    normalization: NormalizationMap | LayoutNormalizationMap | None,
    source_sha256: str,
) -> tuple[str, NormalizationMap]:
    if normalization is None:
        normalization = NormalizationMap.model_validate(line_wrap_map(source, text))
    elif isinstance(normalization, NormalizationMap):
        normalization = NormalizationMap.model_validate(normalization.model_dump())
    else:
        normalization = LayoutNormalizationMap.model_validate(normalization.model_dump())
    if normalization.source_text != source:
        raise ValueError("Composition map belongs to another literal source")
    normalization.validate_canonical(text)
    if isinstance(normalization, NormalizationMap):
        return text, normalization
    if normalization.source_pdf_sha256 != source_sha256:
        raise ValueError("Composition map belongs to another source PDF")
    if {d.source_candidate.id for d in normalization.derivations} != {
        c.id for c in normalization.candidates
    }:
        raise ValueError("Composition requires complete original pair derivations")
    parts: list[str] = []
    segments: list[NormalizationSegment] = []
    kind: Literal["identity", "nfc", "ligature", "line_wrap"]
    at = 0
    for item in normalization.segments:
        if item.candidate_id is not None:
            piece = source[item.source_start : item.source_end]
            kind = "identity"
        elif item.kind == "layout_hyphen":
            raise ValueError("Composition cannot restore an undeclared hyphen")
        else:
            piece = text[item.canonical_start : item.canonical_end]
            kind = item.kind
        segments.append(
            NormalizationSegment(
                source_start=item.source_start,
                source_end=item.source_end,
                canonical_start=at,
                canonical_end=at + len(piece),
                kind=kind,
            )
        )
        parts.append(piece)
        at += len(piece)
    restored = "".join(parts)
    base = NormalizationMap(
        source_text=source, source_sha256=text_digest(source), segments=segments
    )
    base.validate_canonical(restored)
    return restored, base
