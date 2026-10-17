"""Reobserve origin at native derivation; serialized start alone is not provenance."""

from collections.abc import Sequence

from .furniture import furniture_ids
from .native_page import native_page
from .native_review import NativeReviewRequired
from .prepared_types import AnyPreparedPage
from .recognition_contract import RecognitionTask
from .segments import Segment


def continuation_alignment_origins(
    prepared: Sequence[AnyPreparedPage], owners: list[Segment]
) -> dict[str, str]:
    if not owners:
        return {}
    furniture = furniture_ids((page.observation for page in prepared), prepared[0].profile_id)
    result: dict[str, str] = {}
    for number in sorted({owner.page for owner in owners}):
        page = prepared[number - 1]
        origins: dict[str, str] = {}
        try:
            observed = native_page(
                page.observation,
                page.tables,
                furniture,
                [task.region_box for task in page.tasks if isinstance(task, RecognitionTask)],
                page.profile_id,
                source_layout_policy=getattr(page, "source_layout_policy", None),
                source_line_maps=[],
                alignment_origins=origins,
            )
        except NativeReviewRequired:
            continue  # Unknown provenance cannot authorize a presentation candidate.
        for owner in (owner for owner in owners if owner.page == number):
            lines = set(owner.native_line_ids)
            matched = [segment for segment in observed if lines & set(segment.native_line_ids)]
            if (
                not lines
                or not matched
                or not lines <= {line for segment in matched for line in segment.native_line_ids}
            ):
                continue
            choices = {origins.get(segment.id) for segment in matched}
            if len(choices) == 1 and None not in choices:
                result[owner.id] = next(iter(choices))  # type: ignore[assignment]
    return result
