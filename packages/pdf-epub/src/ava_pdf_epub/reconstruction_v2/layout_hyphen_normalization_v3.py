"""Apply only classified body ranges after independently proved structural source cuts."""

from dataclasses import dataclass

from ..contracts.common import text_digest
from ..contracts.layout_hyphen_authority_v3 import LayoutHyphenAuthorityV3
from ..contracts.layout_hyphen_v3 import LayoutOwnerRole
from ..contracts.layout_normalization_v3 import LayoutNormalizationMapV3
from ..contracts.layout_prefix_cut_v3 import LayoutSourceCut
from ..contracts.normalization import NormalizationMap
from .layout_hyphen_mapping import LayoutChangeKind, layout_hyphen_segments
from .normalization_map import line_wrap_map


@dataclass(frozen=True)
class LayoutHyphenNormalizationV3:
    text: str
    normalization: LayoutNormalizationMapV3
    removals: list[tuple[int, int]]


def normalize_layout_hyphens_v3(
    source: str,
    source_sha256: str,
    owner_role: LayoutOwnerRole,
    authorities: list[LayoutHyphenAuthorityV3],
    *,
    text: str | None = None,
    normalization: NormalizationMap | None = None,
    original_source_text: str | None = None,
    source_cuts: list[LayoutSourceCut] | None = None,
) -> LayoutHyphenNormalizationV3:
    literal = source if text is None else text
    base = NormalizationMap.model_validate(
        normalization.model_dump() if normalization is not None else line_wrap_map(source, literal)
    )
    if base.source_text != source:
        raise ValueError("Base normalization belongs to another body source")
    base.validate_canonical(literal)
    ranges: list[tuple[int, int, LayoutChangeKind, str]] = []
    for authority in authorities:
        start, end, kind = authority.body_range()
        if kind not in {"line_wrap", "layout_hyphen"}:
            raise ValueError("Unknown layout-hyphen body transformation")
        ranges.append((start, end, kind, authority.candidate.id))
    removals = [
        (base.source_boundary(start), base.source_boundary(end)) for start, end, _, _ in ranges
    ]
    pieces, previous = [], 0
    for start, end in removals:
        pieces.append(literal[previous:start])
        previous = end
    pieces.append(literal[previous:])
    canonical = "".join(pieces)
    mapping = LayoutNormalizationMapV3(
        schema_version="ava-source-normalization-3",
        source_text=source,
        source_sha256=text_digest(source),
        source_pdf_sha256=source_sha256,
        owner_role=owner_role,
        original_source_text=original_source_text,
        source_cuts=source_cuts or [],
        authorities=authorities,
        input_segments=base.segments,
        input_text_sha256=text_digest(literal),
        input_text_length=len(literal),
        segments=layout_hyphen_segments(base, ranges, removals, len(literal)),
    )
    mapping.validate_canonical(canonical)
    return LayoutHyphenNormalizationV3(canonical, mapping, removals)
