"""Preserve visible annotation regions before choosing native or recognized text."""

from pathlib import Path
from typing import Any

from ..contracts.profiles import ProfileId
from .annotation_regions import annotation_regions
from .annotation_spans import apply_annotation_spans
from .native_page import native_page
from .observations import PageObservation
from .observe_tables import TableObservation


def observe_annotations(
    original: Any,
    observation: PageObservation,
    tables: list[TableObservation],
    scratch: Path,
    profile: ProfileId,
) -> PageObservation:
    required = annotation_regions(original, observation=observation, scratch=scratch)
    observation = observation.model_copy(update={"required_regions": required})
    native_marks = bool(required) and all(r.kind == "inline_style" for r in required)
    if native_marks and not observation.risks:
        try:
            apply_annotation_spans(
                observation,
                native_page(observation, tables, set(), [], profile),
                scratch,
                profile_id=profile,
            )
        except ValueError:
            native_marks = False
    else:
        native_marks = False
    if not native_marks:
        observation = observation.model_copy(
            update={"risks": [*observation.risks, "visible_annotation"]}
        )
    return observation
