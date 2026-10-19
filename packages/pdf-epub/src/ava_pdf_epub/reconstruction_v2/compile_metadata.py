"""Compile current printed facts after all source and paid-decision identities are fixed."""

from typing import Any

from .assembly_state import AssemblyState
from .metadata_equivalence import metadata_evidence, metadata_key
from .subtitle_composition import compose_subtitles


def compile_metadata(claims: list[dict[str, Any]], state: AssemblyState) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    seen: dict[tuple[str, ...], int] = {}
    selected = state.segments.get(state.frontmatter_title[0]) if state.frontmatter_title else None
    title_page = selected.page if selected is not None else None
    for claim in compose_subtitles(claims, state):
        key = metadata_key(claim)
        if key is None or key not in seen:
            if key is not None:
                seen[key] = len(output)
            output.append(dict(claim))
            continue
        existing = output[seen[key]]
        # Keep source spelling, preferring its independent printed title-page witness.
        if (
            title_page is not None
            and _on_page(claim, title_page)
            and not _on_page(existing, title_page)
        ):
            existing["value"] = claim["value"]
        existing["evidence"] = metadata_evidence([existing, claim])
    return output


def _on_page(claim: dict[str, Any], page: int) -> bool:
    return any(e["page"] == page for e in claim.get("evidence", []))
