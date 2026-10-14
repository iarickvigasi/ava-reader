"""Canonicalize only complete source-owned partitions, never their line membership."""

from .native_structure_fields import NativeStructureGroup
from .native_structure_versions import AnyNativeStructureTask


def source_ordered_native_groups(
    task: AnyNativeStructureTask, groups: list[NativeStructureGroup]
) -> list[NativeStructureGroup]:
    expected = [
        (region.source.id, ident)
        for region in task.regions
        if region.artifact_id is None
        for ident in region.line_ids
    ]
    ordinal = {pair: index for index, pair in enumerate(expected)}
    starts: list[tuple[int, NativeStructureGroup]] = []
    for group in groups:
        positions = []
        for ident in group.line_ids:
            position = ordinal.get((group.region_id, ident))
            if position is None:
                raise ValueError(
                    "Native structure group source order/coverage/region ownership differs"
                )
            positions.append(position)
        if not positions or positions != list(range(positions[0], positions[0] + len(positions))):
            raise ValueError(
                "Native structure group source order/coverage/region ownership differs"
            )
        starts.append((positions[0], group))
    ordered = [group for _, group in sorted(starts, key=lambda item: item[0])]
    observed = [(group.region_id, ident) for group in ordered for ident in group.line_ids]
    if observed != expected:
        raise ValueError("Native structure group source order/coverage/region ownership differs")
    return ordered
