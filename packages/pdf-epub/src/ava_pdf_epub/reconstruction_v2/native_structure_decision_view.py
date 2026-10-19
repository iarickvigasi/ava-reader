"""Private semantic projection, never a replacement wire receipt or source authority."""

from dataclasses import dataclass

from ..contracts.layout_hyphen import LayoutHyphenDisposition
from .native_structure_fields import NativeStructureGroup, NativeStructureReference
from .native_structure_v2_contract import NativeStructureResponse2
from .native_structure_v2_fields import (
    NativeChapterGroup2,
    NativeOrderedListGroup2,
    NativeSectionGroup2,
    NativeUnorderedListGroup2,
)


@dataclass(frozen=True)
class NativeStructureDecisionView:
    task_id: str
    source_sha256: str
    observation_sha256: str
    render_sha256: str
    groups: list[NativeStructureGroup]
    boundary_dispositions: list[LayoutHyphenDisposition]
    references: list[NativeStructureReference]
    unresolved: list[str]
    language: str


def native_structure_decision_view(
    response: NativeStructureResponse2,
) -> NativeStructureDecisionView:
    groups = []
    for group in response.groups:
        values = group.model_dump()
        if isinstance(group, (NativeChapterGroup2, NativeSectionGroup2)):
            values.pop("heading_role")
            values["chapter_start"] = isinstance(group, NativeChapterGroup2)
            if isinstance(group, NativeChapterGroup2):
                values["heading_level"] = 1
        if isinstance(group, (NativeOrderedListGroup2, NativeUnorderedListGroup2)):
            values.pop("list_role")
            values["list_ordered"] = isinstance(group, NativeOrderedListGroup2)
        # Closed2 has already rejected irrelevant attributes. Defaults below mean
        # inapplicable semantic slots, never clearing/coercing a supplied decision.
        groups.append(NativeStructureGroup.model_validate(values))
    return NativeStructureDecisionView(
        task_id=response.task_id,
        source_sha256=response.source_sha256,
        observation_sha256=response.observation_sha256,
        render_sha256=response.render_sha256,
        groups=groups,
        boundary_dispositions=response.boundary_dispositions,
        references=response.references,
        unresolved=response.unresolved,
        language=response.language,
    )
