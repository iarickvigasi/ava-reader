"""A validated role selects one whole source heading, without granting credit authority."""

from typing import Any

from ..contracts.common import text_digest
from ..contracts.layout_normalization_v3 import LayoutNormalizationMapV3
from .assembly_state import AssemblyState
from .printed_claim import printed_claim


def printed_title_claim(state: AssemblyState) -> dict[str, Any] | None:
    if state.printed_title is None:
        return None
    ident, digest, role = state.printed_title
    block = next((b for b in state.blocks if b["id"] == ident), None)
    if block is None or block["kind"] != "heading":
        raise ValueError("Classified printed title heading is absent")
    text = block.get("content", {}).get("text", "")
    if text_digest(text) != digest:
        raw = block.get("content", {}).get("normalization")
        mapping = LayoutNormalizationMapV3.model_validate(raw)
        mapping.validate_canonical(text)
        if mapping.input_text_sha256 != digest or mapping.owner_role != "heading":
            raise ValueError(
                "Classified printed title whole text changed without checked projection"
            )
    return printed_claim("title", text.strip(), block) if role == "title" else None
