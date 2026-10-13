"""Compose existing pair decisions across a true join without changing canonical text."""

from typing import Literal

from ..contracts.common import text_digest
from ..contracts.layout_normalization import LayoutNormalizationMap
from ..contracts.normalization import NormalizationMap, NormalizationSegment
from .layout_hyphen_baseline import restored_layout_baseline
from .layout_hyphen_derivation import derive_layout_hyphen
from .layout_hyphen_normalization import normalize_layout_hyphens


def compose_layout_normalizations(
    left_source: str,
    left_text: str,
    left_normalization: NormalizationMap | LayoutNormalizationMap | None,
    right_source: str,
    right_text: str,
    right_normalization: NormalizationMap | LayoutNormalizationMap | None,
    *,
    separator: Literal["", " ", "\n"],
    source_sha256: str,
) -> LayoutNormalizationMap:
    if separator not in {"", " ", "\n"}:
        raise ValueError("Composition separator is not an exact supported layout join")
    if not any(
        isinstance(m, LayoutNormalizationMap) for m in (left_normalization, right_normalization)
    ):
        raise ValueError("Layout composition requires an existing version2 map")
    left, first = restored_layout_baseline(
        left_source, left_text, left_normalization, source_sha256
    )
    right, second = restored_layout_baseline(
        right_source, right_text, right_normalization, source_sha256
    )
    source = left_source + "\n" + right_source
    raw_offset, restored_offset = len(left_source) + 1, len(left) + len(separator)
    segments = list(first.segments)
    segments.append(
        NormalizationSegment(
            source_start=len(left_source),
            source_end=raw_offset,
            canonical_start=len(left),
            canonical_end=restored_offset,
            kind="identity" if separator == "\n" else "line_wrap",
        )
    )
    segments.extend(
        NormalizationSegment(
            source_start=s.source_start + raw_offset,
            source_end=s.source_end + raw_offset,
            canonical_start=s.canonical_start + restored_offset,
            canonical_end=s.canonical_end + restored_offset,
            kind=s.kind,
        )
        for s in second.segments
    )
    baseline = NormalizationMap(
        source_text=source, source_sha256=text_digest(source), segments=segments
    )
    restored = left + separator + right
    baseline.validate_canonical(restored)
    rebound = []
    for mapping, offset in ((left_normalization, 0), (right_normalization, raw_offset)):
        if not isinstance(mapping, LayoutNormalizationMap):
            continue
        for origin in mapping.derivations:
            rebound.append(
                derive_layout_hyphen(
                    source,
                    origin.source_text,
                    origin.source_candidate,
                    origin.source_disposition,
                    origin.source_offset + offset,
                )
            )
    rebound.sort(key=lambda item: item.candidate.source_start)
    result = normalize_layout_hyphens(
        source,
        source_sha256,
        [item.candidate for item in rebound],
        [item.disposition for item in rebound],
        text=restored,
        normalization=baseline,
        derivations=[item.derivation for item in rebound],
    )
    if result.text != left_text + separator + right_text:
        raise ValueError("Layout composition changed already normalized canonical text")
    if not isinstance(result.normalization, LayoutNormalizationMap):
        raise ValueError("Layout composition lost explicit normalization authority")
    return result.normalization
