"""Prepare one page only; the trusted coordinator dispatches any recognition task."""

from pathlib import Path

from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from .blank_page import blank_page
from .compile_prepared_page import compile_prepared_page
from .language_route import language_uncertain
from .observe_annotations import observe_annotations
from .observe_source_page import observe_source_page
from .observe_tables import observe_tables
from .prepared import PreparedPage
from .prepared_types import AnyPreparedPage
from .raster_regions import raster_regions
from .route_native import route_native
from .source_preparation import ParsedPage, SourcePreparation


def prepare_page(
    source: Path,
    scratch: Path,
    page_number: int,
    profile_id: ProfileId = LEGACY_PROFILE,
    *,
    source_feature_policy: str | None = None,
) -> PreparedPage:
    with SourcePreparation(
        source, scratch, profile_id, source_feature_policy=source_feature_policy
    ) as preparation:
        result = prepare_from_source(preparation, page_number)
        assert isinstance(result, PreparedPage)
        return result


def prepare_from_source(
    preparation: SourcePreparation, page_number: int, *, existing_render: Path | None = None
) -> AnyPreparedPage:
    with preparation.page(page_number) as parsed:
        return _prepare_page(preparation, parsed, page_number, existing_render=existing_render)


def _prepare_page(
    preparation: SourcePreparation,
    parsed: ParsedPage,
    page_number: int,
    *,
    existing_render: Path | None = None,
) -> AnyPreparedPage:
    scratch, profile_id = preparation.scratch, preparation.profile_id
    has_visible = "visible" in parsed.kinds
    page = parsed.page
    observation, capture = observe_source_page(
        preparation, parsed, page_number, existing_render=existing_render
    )
    if language_uncertain(observation.lines, profile_id):
        observation = observation.model_copy(
            update={"risks": [*observation.risks, "language_uncertain"]}
        )
    bounds = tuple(float(v) for v in page.cropbox)
    if len(bounds) != 4:
        raise ValueError("Invalid page crop")
    tables = observe_tables(page, observation.lines, bounds)
    if has_visible:
        observation = observe_annotations(parsed.original, observation, tables, scratch, profile_id)
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
    return compile_prepared_page(preparation, prepared, capture)
