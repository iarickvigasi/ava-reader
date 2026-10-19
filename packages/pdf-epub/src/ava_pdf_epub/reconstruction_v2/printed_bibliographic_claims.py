"""Keep a raw source-node decision attached to its checked final content owner."""

from typing import Any

from .assembly_state import AssemblyState
from .printed_claim import printed_claim


def printed_bibliographic_claims(
    state: AssemblyState,
    eligible: set[str],
) -> list[dict[str, Any]]:
    output = []
    for block in state.blocks:
        if block["id"] not in eligible:
            continue
        for source_id, (role, raw_text) in state.bibliographic_roles.items():
            owner = state.bibliographic_claim_owners.get(source_id, source_id)
            if owner != block["id"] or role is None:
                continue
            text = state.bibliographic_projections.get(source_id, raw_text).strip()
            if not text:
                continue
            field = (
                "contributor" if role in {"author", "translator", "editor", "illustrator"} else role
            )
            claim = printed_claim(field, text, block)
            if field == "contributor":
                claim["contributor_role"] = role
            output.append(claim)
    return output
