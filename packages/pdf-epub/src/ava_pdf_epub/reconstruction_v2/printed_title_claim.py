"""A validated role selects one whole source heading, without granting credit authority."""

from typing import Any

from ..contracts.common import text_digest
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
        raise ValueError("Classified printed title whole text changed")
    return printed_claim("title", text.strip(), block) if role == "title" else None
