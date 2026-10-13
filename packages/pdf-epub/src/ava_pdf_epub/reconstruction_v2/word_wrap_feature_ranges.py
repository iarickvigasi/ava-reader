"""Lexical deletions may move an OCR receipt, but may never rewrite its witnessed text."""

from ..contracts.common import text_digest
from ..contracts.layout_normalization_v3 import LayoutNormalizationMapV3
from .assembly_state import AssemblyState
from .internal_links import _resolve
from .layout_projection_v3 import project_fragment


def verify_word_wrap_feature_ranges(
    state: AssemblyState,
    changes: dict[str, tuple[list[tuple[int, int]], str]],
) -> None:
    for evidence in state.source_feature_evidence:
        owner, offset = _resolve(evidence["node_id"], state)
        if owner not in changes:
            continue
        removals, text = changes[owner]
        end = offset + evidence["text_length"]
        original = text[offset:end]
        if (
            len(original) != evidence["text_length"]
            or text_digest(original) != evidence["text_sha256"]
        ):
            raise ValueError("OCR appearance original source range differs")
        mapping = state.normalization_maps[owner]
        if not isinstance(mapping, LayoutNormalizationMapV3):
            raise ValueError("OCR appearance projection has no lexical map")
        projected = project_fragment(
            text,
            offset,
            end,
            removals,
            normalization=mapping,
            expected_fragment=original,
            expected_sha256=evidence["text_sha256"],
            referenced=True,
        )
        if projected.text != original:
            raise ValueError("Native lexical decisions changed an OCR appearance witness")
