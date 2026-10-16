"""Create uniform candidates without guessing away known source typography."""

from ..contracts.common import document_digest
from ..contracts.styles import Style
from .continuation_boundary import JOIN_STYLE
from .continuation_presentation_contract import (
    PresentationRefinementTask,
    UniformJoinCandidate,
    candidate_digest,
)
from .legacy_refinement_contract import RefinementEdge, RefinementNode


def uniform_candidate(
    edge: RefinementEdge,
    previous: RefinementNode,
    following: RefinementNode,
    native_id: str,
    *,
    native_alignment_fallback: bool = False,
) -> UniformJoinCandidate | None:
    if (
        previous.kind != "paragraph"
        or following.kind != "paragraph"
        or previous.structure_candidate
        or following.structure_candidate
    ):
        return None
    if (
        native_id not in {previous.id, following.id}
        or not previous.observed_style
        or not following.observed_style
    ):
        return None
    a, b = previous.observed_style, following.observed_style
    native = a if native_id == previous.id else b
    # Under this captured pipeline, native_spacing infers center or supplies start.
    # Its start is a reflow fallback, not measured ragged-right source evidence.
    if native_alignment_fallback and native.align != "start":
        raise ValueError("Fallback provenance conflicts with native alignment")
    fallback = native_alignment_fallback
    common: dict[str, object] = {}
    for field in sorted(JOIN_STYLE - {"space_after_em"}):
        left, right = getattr(a, field), getattr(b, field)
        if field == "align" and fallback:
            if native_id == previous.id:
                left = None
            else:
                right = None
        if left is not None and right is not None and left != right:
            return None
        common[field] = left if left is not None else right
    if common.get("underline") is True or common.get("strike_through") is True:
        return None  # Ancestor decoration cannot be cancelled by a false inline reset.
    if any(common[key] is None for key in ("family", "bold", "relative_size", "line_height")):
        return None
    # Gap after the complete paragraph belongs to its final fragment; head indent
    # and before-gap remain on the first endpoint. No floating measurements round.
    common["space_after_em"] = b.space_after_em
    previous_style = Style.model_validate({**a.model_dump(), **common})
    next_style = Style.model_validate({**b.model_dump(), **common})
    raw = dict(
        edge_id=edge.id,
        previous_id=previous.id,
        next_id=following.id,
        previous_text_sha256=previous.text_sha256,
        next_text_sha256=following.text_sha256,
        previous_style_sha256=document_digest(a),
        next_style_sha256=document_digest(b),
        native_id=native_id,
        native_alignment_fallback=fallback,
        previous_style=previous_style.model_dump(mode="json"),
        next_style=next_style.model_dump(mode="json"),
    )
    raw["id"] = "join-style-" + candidate_digest(raw)
    return UniformJoinCandidate.model_validate(raw)


def validate_candidates(task: PresentationRefinementTask) -> None:
    nodes = {node.id: node for node in task.nodes}
    edges = {edge.id: edge for edge in task.edges}
    native = set(task.native_endpoints)
    fallback = set(task.native_alignment_fallbacks)
    if len(fallback) != len(task.native_alignment_fallbacks) or not fallback <= native:
        raise ValueError("Fallback alignment provenance has a foreign owner")
    if len(native) != len(task.native_endpoints) or native & set(task.decision_ids):
        raise ValueError("Continuation native reference is not fixed source context")
    owners = [candidate.edge_id for candidate in task.join_candidates]
    if len(set(owners)) != len(owners):
        raise ValueError("Repeated continuation presentation edge")
    referenced: set[str] = set()
    for candidate in task.join_candidates:
        edge = edges.get(candidate.edge_id)
        if edge is None or candidate.native_id not in native:
            raise ValueError("Continuation presentation has a foreign edge or reference")
        endpoints = {edge.previous_id, edge.next_id}
        if len(endpoints & native) != 1 or not endpoints - native <= set(task.decision_ids):
            raise ValueError(
                "Continuation presentation needs one fixed native and one OCR decision"
            )
        expected = uniform_candidate(
            edge,
            nodes[edge.previous_id],
            nodes[edge.next_id],
            candidate.native_id,
            native_alignment_fallback=candidate.native_id in fallback,
        )
        if expected != candidate:
            raise ValueError("Continuation presentation differs from exact source values")
        referenced.add(candidate.native_id)
    if referenced != native:
        raise ValueError("Unreferenced continuation native source")
