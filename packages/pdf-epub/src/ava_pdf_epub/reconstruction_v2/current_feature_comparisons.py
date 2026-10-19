"""Reserve the actual title slot before allocating current book-wide appearance comparisons."""

import hashlib
from collections.abc import Sequence
from pathlib import Path

from .assembly_state import AssemblyState
from .page_checkpoints import PreparedPageMap
from .prepared_types import AnyPreparedPage
from .printed_title_v2_contract import FrontmatterTitleTask
from .printed_title_v2_task import frontmatter_title_task
from .refinement_contract import AnyRefinementTask
from .refinement_digest import observation_digest
from .segments import Segment
from .source_feature_selection import MAX_FEATURE_CATALOGUE
from .source_feature_tasks import source_feature_tasks
from .source_role_contract import SourceRoleTask


def current_feature_comparisons(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    segments: list[Segment],
    state: AssemblyState,
    prior_tasks: int,
) -> list[AnyRefinementTask | FrontmatterTitleTask | SourceRoleTask]:
    title = frontmatter_title_task(
        segments,
        PreparedPageMap(prepared),
        scratch,
        hashlib.sha256(source.read_bytes()).hexdigest(),
        observation_digest(segments),
    )
    tasks: list[AnyRefinementTask | FrontmatterTitleTask | SourceRoleTask] = list(
        source_feature_tasks(
            source,
            scratch,
            prepared,
            segments,
            state,
            prior_tasks + int(title is not None),
            decision_limit=MAX_FEATURE_CATALOGUE,
            include_unreferenced_roles=True,
        )
    )
    if title is not None:
        tasks.append(title)
    return tasks
