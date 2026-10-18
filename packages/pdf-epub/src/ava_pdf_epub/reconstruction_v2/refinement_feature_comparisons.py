"""Append existing finite-feature/title comparisons after structural groups."""

import hashlib
from collections.abc import Sequence
from pathlib import Path

from .assembly_state import AssemblyState
from .page_checkpoints import PreparedPageMap
from .prepared_types import AnyPreparedPage
from .printed_title_v2_contract import FrontmatterTitleTask
from .refinement_contract import AnyRefinementTask, PrintedTitleTask
from .refinement_digest import observation_digest
from .segments import Segment


def feature_comparisons(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    segments: list[Segment],
    state: AssemblyState,
    prior_tasks: int,
    source_feature_policy: str | None,
    source_title_policy: str | None,
) -> list[AnyRefinementTask | FrontmatterTitleTask]:
    if source_feature_policy is None:
        return []
    tasks: list[AnyRefinementTask | FrontmatterTitleTask] = []
    page_map = PreparedPageMap(prepared)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    from .printed_title_task import printed_title_task
    from .source_feature_tasks import source_feature_tasks

    tasks.extend(source_feature_tasks(source, scratch, prepared, segments, state, prior_tasks))
    title: PrintedTitleTask | FrontmatterTitleTask | None
    if source_title_policy is not None:
        from .printed_title_v2_task import frontmatter_title_task

        title = frontmatter_title_task(
            segments, page_map, scratch, digest, observation_digest(segments)
        )
    else:
        title = printed_title_task(
            segments, page_map, scratch, digest, observation_digest(segments)
        )
    if title is not None:
        tasks.append(title)
    return tasks
