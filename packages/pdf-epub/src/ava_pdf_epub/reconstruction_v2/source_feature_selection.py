"""Bounded appearance-local selection; uninspected appearances never inherit another answer."""

from typing import Literal

from .assembly_state import AssemblyState
from .page_checkpoints import PreparedPageMap
from .segments import Segment
from .source_feature_contract import Feature, SourceFeatureRequest
from .source_feature_geometry import feature_column
from .source_feature_node import feature_node
from .source_feature_peers import optional_heading_peer
from .source_feature_references import local_body_reference, source_body_references
from .source_feature_task_contract import SourceFeatureNode

MAX_FEATURE_CATALOGUE = 256
MAX_FEATURE_DECISIONS = 24


def source_feature_selection(
    segments: list[Segment], pages: PreparedPageMap, state: AssemblyState
) -> tuple[list[SourceFeatureRequest], dict[str, SourceFeatureNode], list[Segment]]:
    references = source_body_references(segments)
    missing_context: list[Segment] = []
    requests: list[SourceFeatureRequest] = []
    nodes: dict[str, SourceFeatureNode] = {}
    for segment in segments:
        if (
            segment.method != "ocr"
            or segment.structure_candidate
            or segment.kind not in {"paragraph", "quote", "heading"}
        ):
            continue
        reference = local_body_reference(segment, references)
        if reference is None:
            if segment.kind == "quote" or (segment.style and segment.style.italic is True):
                from .source_refusal import refuse_segment

                refuse_segment(pages[segment.page], segment)
            if segment.kind == "heading" or len(segment.text) < 80:
                if len(requests) + len(missing_context) < MAX_FEATURE_CATALOGUE:
                    missing_context.append(segment)
                else:
                    state.unrequested_optional_features += 1
            continue
        style = segment.style
        role_candidate = segment.kind == "paragraph" and (
            segment.box.x0 - reference.box.x0 > 3 or (style is not None and style.italic is True)
        )
        isolated = role_candidate or (
            len(segment.text) < 80
            and segment.box.x1 - segment.box.x0 < (reference.box.x1 - reference.box.x0) * 0.9
        )
        if segment.kind == "paragraph" and not isolated:
            continue
        if len(requests) + len(missing_context) >= MAX_FEATURE_CATALOGUE:
            state.unrequested_optional_features += 1
            if role_candidate or segment.kind == "quote":
                from .source_refusal import refuse_segment

                refuse_segment(pages[segment.page], segment)
            continue
        roles: list[Literal["paragraph", "quote"]] = (
            ["paragraph", "quote"] if role_candidate or segment.kind == "quote" else []
        )
        features: list[Feature] = ["family", "weight", "italic", "relative_size"]
        if roles:
            features = ["paragraph_role", *features, "first_line_indent", "block_inset"]
        column = feature_column(segment, reference, pages[segment.page])
        refs = [reference]
        peer = optional_heading_peer(segment, segments, column)
        if peer is not None:
            refs.append(peer)
        request = SourceFeatureRequest(
            node_id=segment.id,
            page=segment.page,
            source_box=segment.box,
            column_box=column,
            requested_features=features,
            allowed_roles=roles,
            reference_ids=[s.id for s in refs],
            selection_reason="declared_quote"
            if segment.kind == "quote"
            else "isolated_prose"
            if roles
            else "heading_comparison"
            if segment.kind == "heading"
            else "appearance_comparison",
        )
        requests.append(request)
        for s in [segment, *refs]:
            nodes[s.id] = feature_node(s, reference.id if s.id == segment.id else None)
    # Essential role requests first; optional styles beyond the dispatch bound remain unknown.
    requests.sort(key=lambda q: (not q.allowed_roles, q.page, q.source_box.y0, q.node_id))
    return requests, nodes, missing_context
