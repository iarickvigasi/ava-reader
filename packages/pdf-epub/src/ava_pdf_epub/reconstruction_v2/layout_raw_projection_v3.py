"""Raw fragment boundaries clamp only inside validated zero-output normalization spans."""

from ..contracts.common import document_digest, text_digest
from ..contracts.layout_normalization_v3 import LayoutNormalizationMapV3
from ..contracts.layout_projection_v3 import LayoutTextProjection, LayoutTextProjectionReceipt


def project_raw_fragment(
    mapping: LayoutNormalizationMapV3,
    canonical: str,
    start: int,
    end: int,
    *,
    expected_fragment: str,
    expected_sha256: str,
    referenced: bool = False,
) -> LayoutTextProjection:
    mapping = LayoutNormalizationMapV3.model_validate(mapping.model_dump())
    mapping.validate_canonical(canonical)
    if (
        type(start) is not int
        or type(end) is not int
        or not 0 <= start <= end <= len(mapping.source_text)
    ):
        raise ValueError("Raw fragment range outside exact body source")
    original = mapping.source_text[start:end]
    if original != expected_fragment or text_digest(original) != expected_sha256:
        raise ValueError("Original raw fragment identity differs")
    first, last = _raw_boundary(mapping, start), _raw_boundary(mapping, end)
    if referenced and first == last:
        raise ValueError("Cannot remove a referenced layout-only range")
    value = canonical[first:last]
    return LayoutTextProjection(
        text=value,
        receipt=LayoutTextProjectionReceipt(
            coordinate_space="raw_body",
            source_pdf_sha256=mapping.source_pdf_sha256,
            map_sha256=document_digest(mapping),
            source_text_sha256=mapping.source_sha256,
            source_start=start,
            source_end=end,
            source_fragment_sha256=expected_sha256,
            canonical_start=first,
            canonical_end=last,
            canonical_fragment_sha256=text_digest(value),
        ),
    )


def _raw_boundary(mapping: LayoutNormalizationMapV3, offset: int) -> int:
    for item in mapping.segments:
        if (
            item.source_start < offset < item.source_end
            and item.canonical_start == item.canonical_end
        ):
            return item.canonical_start
    return mapping.source_boundary(offset)
