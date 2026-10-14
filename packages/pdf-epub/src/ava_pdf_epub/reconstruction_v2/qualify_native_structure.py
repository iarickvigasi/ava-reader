"""Opt-in replacement of safe whole-page structure repairs; OCR tasks remain unchanged."""

from collections.abc import Sequence
from pathlib import Path

from ..contracts.layout_hyphen import LayoutHyphenCandidate
from ..worker_observation import observe
from .borderless_tables import borderless_tables
from .furniture import furniture_ids
from .native_review import NativeReviewRequired
from .native_structure_hyphen_candidates import source_hyphen_candidates
from .native_structure_policy import AnyNativeStructurePolicy, validate_structure_policy
from .native_structure_regions import native_structure_regions
from .native_structure_render import native_structure_render
from .native_structure_source import prepare_native_structure, qualified_native_lines
from .native_structure_source_validation import graphics_are_preserved
from .native_structure_versions import AnyNativeStructureTask
from .native_word_wrap_policy import NativeWordWrapPolicy, validate_word_wrap_policy
from .page_checkpoints import PageCheckpoints
from .prepared_native_layout import NativeLayoutPreparedPage
from .prepared_native_structure import NativeStructurePreparedPage
from .prepared_native_structure_v2 import NativeStructure2PreparedPage
from .recognition_contract import RecognitionTask


def qualify_native_structure(
    pages: PageCheckpoints,
    scratch: Path,
    policy: str | None,
    *,
    source_normalization_policy: NativeWordWrapPolicy | None = None,
) -> None:
    selected = validate_structure_policy(policy)
    if selected is None:
        return
    if (
        selected == "ava-native-structure-2"
        and validate_word_wrap_policy(source_normalization_policy) is None
    ):
        raise ValueError("Native2 qualification requires captured sparse normalization authority")
    if pages.source_layout_policy is None:
        raise ValueError("Native structure qualification requires native layout authority")
    if not pages:
        return
    furniture = furniture_ids((page.observation for page in pages), pages[0].profile_id)
    for index in range(len(pages)):
        page = pages[index]
        if isinstance(page, NativeStructurePreparedPage):
            if page.source_structure_policy != selected:
                raise ValueError("Native structure checkpoint policy differs")
            continue
        if not isinstance(page, NativeLayoutPreparedPage):
            raise ValueError("Native structure qualification requires layout2 checkpoints")
        replacement = replacement_native_structure_task(
            page, scratch, furniture, structure_policy=selected
        )
        values = {
            **page.model_dump(),
            "schema_version": "ava-prepared-page-5"
            if selected == "ava-native-structure-2"
            else "ava-prepared-page-3",
            **(
                {"source_normalization_policy": source_normalization_policy}
                if selected == "ava-native-structure-2"
                else {}
            ),
            "source_structure_policy": selected,
            **(
                {
                    "tasks": [replacement[0].model_dump()],
                    "layout_hyphen_candidates": [c.model_dump() for c in replacement[1]],
                }
                if replacement is not None
                else {}
            ),
        }
        result = (
            NativeStructure2PreparedPage.model_validate(values)
            if selected == "ava-native-structure-2"
            else NativeStructurePreparedPage.model_validate(values)
        )
        pages.qualify(index, result)
        observe("page", result)


def replacement_native_structure_task(
    page: NativeLayoutPreparedPage,
    scratch: Path,
    furniture: set[str],
    *,
    candidates: Sequence[LayoutHyphenCandidate] | None = None,
    structure_policy: AnyNativeStructurePolicy = "ava-native-structure-1",
) -> tuple[AnyNativeStructureTask, list[LayoutHyphenCandidate]] | None:
    observation = page.observation
    if len(page.tasks) != 1 or not isinstance(page.tasks[0], RecognitionTask):
        return None
    legacy = page.tasks[0]
    box = legacy.region_box
    if legacy.purpose != "pdf_structure_repair" or (
        box.coordinate_space != "page_points_top_left"
        or box.x0 != 0
        or box.y0 != 0
        or box.x1 != observation.width_pt
        or box.y1 != observation.height_pt
    ):
        return None
    if (
        page.tables
        or borderless_tables(observation)
        or qualified_native_lines(observation, page.profile_id) is None
        or any(s.kind not in {"figure", "aside"} for s in page.native_segments)
        or not graphics_are_preserved(observation, page.native_segments)
    ):
        return None
    try:
        regions = native_structure_regions(observation, page.native_segments, furniture)
    except (NativeReviewRequired, ValueError):
        return None  # Ambiguous/overlapping source bands preserve the established recognition task.
    pinned = (
        list(candidates)
        if candidates is not None
        else source_hyphen_candidates(observation, regions, page.source_sha256, page.profile_id)
    )
    task = prepare_native_structure(
        observation,
        page.source_sha256,
        native_structure_render(observation, scratch),
        regions,
        profile_id=page.profile_id,
        preserved_segments=page.native_segments,
        furniture=furniture,
        candidates=pinned,
        structure_policy=structure_policy,
    )
    return (task, pinned) if task is not None else None
