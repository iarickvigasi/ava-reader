"""Retain explicit source selection without rewriting content, hierarchy, or styles."""

from typing import Any

from ..contracts.common import document_digest
from .assembly_state import AssemblyState
from .findings import Finding
from .printed_title_v2_contract import FrontmatterTitleResponse, FrontmatterTitleTask
from .printed_title_v2_response import accept_frontmatter_title


def apply_frontmatter_title(
    task: FrontmatterTitleTask, response: FrontmatterTitleResponse, state: AssemblyState
) -> None:
    if state.source_title_policy != "ava-frontmatter-title-1" or state.frontmatter_title_compared:
        raise ValueError("Complete title authority is absent or repeated")
    accept_frontmatter_title(task, response)
    state.frontmatter_title_compared = True
    if response.selected_node_id is not None:
        assert response.selected_text_sha256 is not None
        state.frontmatter_title = (response.selected_node_id, response.selected_text_sha256)
    else:
        state.structure_findings.append(
            Finding(
                code="FRONTMATTER_TITLE_UNRESOLVED",
                severity="review",
                message="Source comparison did not identify one complete printed title.",
            )
        )
    nodes = {n.id: n for n in task.nodes}
    if response.cover is not None:
        state.frontmatter_cover = [
            (ident, nodes[ident].text_sha256) for ident in response.cover.node_ids
        ]
    state.refinement_evidence.append(
        dict(
            task_sha256=document_digest(task),
            response_sha256=document_digest(response),
            observation_sha256=task.observation_sha256,
            task_id=task.task_id,
            node_ids=[node.id for node in task.nodes],
        )
    )


def corroborated_cover_evidence(state: AssemblyState) -> list[dict[str, Any]]:
    from ..contracts.common import text_digest
    from ..contracts.layout_normalization_v3 import LayoutNormalizationMapV3

    evidence = []
    for ident, digest in state.frontmatter_cover:
        block = next((b for b in state.blocks if b["id"] == ident), None)
        if block is None or block["kind"] != "heading":
            raise ValueError("Corroborated cover heading is absent")
        text = block["content"]["text"]
        if text_digest(text) != digest:
            mapping = LayoutNormalizationMapV3.model_validate(block["content"].get("normalization"))
            mapping.validate_canonical(text)
            if mapping.input_text_sha256 != digest or mapping.owner_role != "heading":
                raise ValueError("Corroborated cover source text changed")
        if not block["evidence"] or any(e["page"] != 1 for e in block["evidence"]):
            raise ValueError("Corroborated cover owner is not on the first source page")
        evidence.extend(block["evidence"])
    return evidence
