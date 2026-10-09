"""Prepare one page only; the trusted coordinator dispatches any recognition task."""

from pathlib import Path

from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from ..worker_observation import observe
from .annotation_regions import annotation_regions
from .annotation_spans import apply_annotation_spans
from .blank_page import blank_page
from .language_route import language_uncertain
from .native_page import native_page
from .observe_page import observe_page
from .observe_tables import observe_tables
from .prepared import PreparedPage
from .raster_regions import raster_regions
from .route_native import route_native
from .source_preparation import ParsedPage, SourcePreparation


def prepare_page(
    source: Path, scratch: Path, page_number: int, profile_id: ProfileId = LEGACY_PROFILE
) -> PreparedPage:
    with SourcePreparation(source, scratch, profile_id) as preparation:
        return prepare_from_source(preparation, page_number)


def prepare_from_source(preparation: SourcePreparation, page_number: int) -> PreparedPage:
    with preparation.page(page_number) as parsed:
        return _prepare_page(preparation, parsed, page_number)


def _prepare_page(
    preparation: SourcePreparation, parsed: ParsedPage, page_number: int
) -> PreparedPage:
    scratch, profile_id = preparation.scratch, preparation.profile_id
    has_visible = "visible" in parsed.kinds
    page = parsed.page
    observation = observe_page(parsed.view, parsed.view_reader, page, page_number, scratch)
    if language_uncertain(observation.lines, profile_id):
        observation = observation.model_copy(
            update={"risks": [*observation.risks, "language_uncertain"]}
        )
    bounds = tuple(float(v) for v in page.cropbox)
    if len(bounds) != 4:
        raise ValueError("Invalid page crop")
    tables = observe_tables(page, observation.lines, bounds)
    if has_visible:
        required = annotation_regions(parsed.original, observation=observation, scratch=scratch)
        observation = observation.model_copy(update={"required_regions": required})
        native_marks = bool(required) and all(r.kind == "inline_style" for r in required)
        if native_marks and not observation.risks:
            try:
                apply_annotation_spans(
                    observation,
                    native_page(observation, tables, set(), [], profile_id),
                    scratch,
                    profile_id=profile_id,
                )
            except ValueError:
                native_marks = False
        else:
            native_marks = False
        if not native_marks:
            observation = observation.model_copy(
                update={"risks": [*observation.risks, "visible_annotation"]}
            )
    blank = blank_page(observation, scratch)
    if blank and observation.required_regions:
        raise ValueError("PDF_ANNOTATION_RENDER_FAILED")
    regions = [] if blank else raster_regions(observation, scratch, profile_id)
    segments, tasks = (
        ([], [])
        if blank
        else route_native(observation, tables, regions, preparation.sha256, scratch, profile_id)
    )
    prepared = PreparedPage(
        schema_version="ava-prepared-page-1",
        profile_id=profile_id,
        source_sha256=preparation.sha256,
        source_byte_length=preparation.size,
        source_page_count=preparation.count,
        observation=observation,
        tables=tables,
        native_segments=segments,
        tasks=tasks,
    )
    observe("page", prepared)
    return prepared
