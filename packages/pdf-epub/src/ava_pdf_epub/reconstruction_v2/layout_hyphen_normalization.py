"""Normalize only explicit qualified hyphen decisions, after raw source checks."""

from dataclasses import dataclass

from ..contracts.common import text_digest
from ..contracts.layout_hyphen import LayoutHyphenCandidate, LayoutHyphenDisposition
from ..contracts.layout_hyphen_checks import qualify_layout_hyphens
from ..contracts.layout_hyphen_derivation import LayoutHyphenDerivation
from ..contracts.layout_normalization import LayoutNormalizationMap
from ..contracts.normalization import NormalizationMap, NormalizationSegment
from .layout_hyphen_mapping import LayoutChangeKind, layout_hyphen_segments


@dataclass(frozen=True)
class LayoutHyphenNormalization:
    text: str
    normalization: NormalizationMap | LayoutNormalizationMap | None
    removals: list[tuple[int, int]]


def normalize_layout_hyphens(
    source: str,
    source_sha256: str,
    candidates: list[LayoutHyphenCandidate],
    dispositions: list[LayoutHyphenDisposition],
    *,
    text: str | None = None,
    normalization: NormalizationMap | None = None,
    derivations: list[LayoutHyphenDerivation] | None = None,
) -> LayoutHyphenNormalization:
    qualify_layout_hyphens(source, source_sha256, candidates, dispositions)
    literal = source if text is None else text
    if not candidates:
        if derivations:
            raise ValueError("Layout-hyphen derivations have no group candidates")
        if normalization is not None:
            if normalization.source_text != source:
                raise ValueError("Base normalization belongs to another literal observation")
            normalization.validate_canonical(literal)
        elif literal != source:
            raise ValueError("Changed literal observation requires an explicit base map")
        return LayoutHyphenNormalization(literal, normalization, [])
    if normalization is None:
        if literal != source:
            raise ValueError("Changed literal observation requires an explicit base map")
        normalization = NormalizationMap(
            source_text=source,
            source_sha256=text_digest(source),
            segments=[
                NormalizationSegment(
                    source_start=0,
                    source_end=len(source),
                    canonical_start=0,
                    canonical_end=len(source),
                    kind="identity",
                )
            ],
        )
    normalization = NormalizationMap.model_validate(normalization.model_dump())
    if normalization.source_text != source:
        raise ValueError("Base normalization belongs to another literal observation")
    normalization.validate_canonical(literal)
    decisions = {d.candidate_id: d.disposition for d in dispositions}
    source_ranges: list[tuple[int, int, LayoutChangeKind, str]] = [
        (
            c.source_start + (decisions[c.id] == "literal"),
            c.source_end,
            "line_wrap" if decisions[c.id] == "literal" else "layout_hyphen",
            c.id,
        )
        for c in candidates
    ]
    removals = [
        (normalization.source_boundary(start), normalization.source_boundary(end))
        for start, end, _, _ in source_ranges
    ]
    parts, at = [], 0
    for start, end in removals:
        parts.append(literal[at:start])
        at = end
    parts.append(literal[at:])
    canonical = "".join(parts)
    mapping = LayoutNormalizationMap(
        schema_version="ava-source-normalization-2",
        source_text=source,
        source_sha256=text_digest(source),
        source_pdf_sha256=source_sha256,
        candidates=candidates,
        dispositions=dispositions,
        derivations=derivations or [],
        segments=layout_hyphen_segments(normalization, source_ranges, removals, len(literal)),
    )
    mapping.validate_canonical(canonical)
    return LayoutHyphenNormalization(canonical, mapping, removals)
