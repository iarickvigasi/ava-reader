"""Ordinary exact boxes and explicitly captured, complete compound OCR headings stay distinct."""

from ..contracts.blocks import BlockBase, HeadingBlock
from ..contracts.common import text_digest
from .compound_feature_source import CompoundFeatureSource
from .geometry import union
from .source_feature_coverage_contract import SourceFeatureEvidence


def source_feature_geometry_matches(
    evidence: SourceFeatureEvidence, block: BlockBase, binding: CompoundFeatureSource | None
) -> bool:
    if binding is None:
        return any(
            item.method == "ocr" and item.page == evidence.page and item.box == evidence.box
            for item in block.evidence
        )
    if (
        not isinstance(block, HeadingBlock)
        or block.id != binding.canonical_block_id
        or evidence.canonical_block_id != binding.canonical_block_id
        or evidence.canonical_start != binding.canonical_start
        or binding.canonical_start != 0
        or tuple(block.evidence) != binding.evidence
        or any(e.method != "ocr" or e.page != evidence.page for e in binding.evidence)
        or union([e.box for e in binding.evidence]) != evidence.box
        or evidence.text_sha256 != binding.text_sha256
        or evidence.text_length != binding.text_length
        or len(block.content.text) != binding.text_length
    ):
        return False
    text, cursor = block.content.text, 0
    for index, (start, end, digest) in enumerate(binding.ranges):
        if (
            start != cursor
            or not start < end <= len(text)
            or text_digest(text[start:end]) != digest
        ):
            return False
        if index + 1 < len(binding.ranges) and text[end : end + 1] != "\n":
            return False
        cursor = end + 1
    return cursor - 1 == len(text)
