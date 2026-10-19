"""Deterministically bind book decisions to original qualified source observations."""

import hashlib
from collections.abc import Sequence
from pathlib import Path

from pypdf import PdfReader

from ..contracts.profiles import BILINGUAL_PROFILE
from .assembly_state import AssemblyState
from .page_checkpoints import PreparedPageMap
from .prepared_types import AnyPreparedPage
from .printed_title_v2_contract import FrontmatterTitleTask
from .refinement_catalogue import refinement_catalogue
from .refinement_catalogue_limits import TASK_NODE_LIMIT, catalogue_limit
from .refinement_context import RefinementContext
from .refinement_contract import AnyRefinementTask
from .refinement_digest import observation_digest
from .refinement_feature_comparisons import feature_comparisons
from .refinement_preparation_policy import validate_preparation_policies
from .refinement_prompt import MIXED_HIERARCHY_PROMPT_VERSION, REFINEMENT_PROMPT_VERSION
from .refinement_task_builder import build_refinement_task
from .refinement_task_groups import task_groups
from .segments import Segment
from .source_role_contract import SourceRoleTask


def prepare_refinement(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    segments: list[Segment],
    state: AssemblyState,
    *,
    source_feature_policy: str | None = None,
    source_title_policy: str | None = None,
    source_continuation_policy: str | None = None,
) -> list[AnyRefinementTask | FrontmatterTitleTask | SourceRoleTask]:
    validate_preparation_policies(
        prepared, source_feature_policy, source_title_policy, source_continuation_policy
    )
    catalogue = refinement_catalogue(
        segments,
        state,
        include_bibliography=prepared[0].profile_id == BILINGUAL_PROFILE,
        source_title_policy=source_title_policy,
        source_author=getattr(PdfReader(source).metadata, "author", None)
        if prepared[0].profile_id == BILINGUAL_PROFILE
        else None,
    )
    if not catalogue.decisions and not catalogue.metadata_ids and source_feature_policy is None:
        return []
    structure_prompt = (
        MIXED_HIERARCHY_PROMPT_VERSION
        if any(n.candidate_original_kind == "heading" for n in catalogue.nodes)
        else REFINEMENT_PROMPT_VERSION
    )
    segment_map = {s.id: s for s in segments}
    alignment_origins: dict[str, str] = {}
    if source_continuation_policy:
        from .continuation_alignment_origins import continuation_alignment_origins

        owners = {ident for edge in catalogue.edges for ident in (edge.previous_id, edge.next_id)}
        alignment_origins = continuation_alignment_origins(
            prepared,
            [segment_map[ident] for ident in owners if segment_map[ident].method == "native"],
        )
    context = RefinementContext(
        hashlib.sha256(source.read_bytes()).hexdigest(),
        observation_digest(segments),
        prepared[0].profile_id,
        scratch,
        segment_map,
        PreparedPageMap(prepared),
        {e.previous_id for e in catalogue.edges},
        structure_prompt,
        alignment_origins,
        source_continuation_policy,
        catalogue_limit(state, source_title_policy) > TASK_NODE_LIMIT,
    )
    tasks: list[AnyRefinementTask | FrontmatterTitleTask | SourceRoleTask] = [
        build_refinement_task(catalogue, group, context)
        for group in task_groups(catalogue, context)
    ]
    tasks.extend(
        feature_comparisons(
            source,
            scratch,
            prepared,
            segments,
            state,
            len(tasks),
            source_feature_policy,
            source_title_policy,
        )
    )
    if len(tasks) > 32:
        raise ValueError("Too many refinement tasks")
    return tasks
