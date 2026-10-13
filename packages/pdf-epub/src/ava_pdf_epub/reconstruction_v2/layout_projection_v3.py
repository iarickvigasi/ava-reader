"""Only proven zero-output deletions clamp fragment bounds; references never disappear."""

from ..contracts.common import document_digest, text_digest
from ..contracts.layout_normalization_v3 import LayoutNormalizationMapV3
from ..contracts.layout_projection_v3 import LayoutTextProjection, LayoutTextProjectionReceipt
from .layout_hyphen_offsets import layout_hyphen_offset
from .layout_raw_projection_v3 import project_raw_fragment as project_raw_fragment


def input_deletions_v3(mapping: LayoutNormalizationMapV3) -> list[tuple[int, int]]:
    base = mapping.input_mapping()
    return [
        (base.source_boundary(a), base.source_boundary(b))
        for authority in mapping.authorities
        for a, b, _ in [authority.body_range()]
    ]


def project_fragment(
    text: str,
    rawstart: int,
    rawend: int,
    removals: list[tuple[int, int]],
    *,
    normalization: LayoutNormalizationMapV3,
    expected_fragment: str | None = None,
    expected_sha256: str | None = None,
    referenced: bool = False,
) -> LayoutTextProjection:
    mapping = LayoutNormalizationMapV3.model_validate(normalization.model_dump())
    if text != mapping.input_text() or removals != input_deletions_v3(mapping):
        raise ValueError("Fragment projection differs from its declared input/deletion proof")
    if (
        type(rawstart) is not int
        or type(rawend) is not int
        or not 0 <= rawstart <= rawend <= len(text)
    ):
        raise ValueError("Fragment range outside exact normalization input")
    original = text[rawstart:rawend]
    if (expected_fragment is not None and expected_fragment != original) or (
        expected_sha256 is not None and text_digest(original) != expected_sha256
    ):
        raise ValueError("Original fragment identity differs")
    pieces, previous = [], 0
    for start, end in removals:
        pieces.append(text[previous:start])
        previous = end
    pieces.append(text[previous:])
    canonical = "".join(pieces)
    mapping.validate_canonical(canonical)
    first = layout_hyphen_offset(rawstart, removals, len(text))
    last = layout_hyphen_offset(rawend, removals, len(text))
    if referenced and first == last:
        raise ValueError("Cannot remove a referenced layout-only range")
    value = canonical[first:last]
    return LayoutTextProjection(
        text=value,
        receipt=LayoutTextProjectionReceipt(
            coordinate_space="normalization_input",
            source_pdf_sha256=mapping.source_pdf_sha256,
            map_sha256=document_digest(mapping),
            source_text_sha256=mapping.input_text_sha256,
            source_start=rawstart,
            source_end=rawend,
            source_fragment_sha256=text_digest(original),
            canonical_start=first,
            canonical_end=last,
            canonical_fragment_sha256=text_digest(value),
        ),
    )
