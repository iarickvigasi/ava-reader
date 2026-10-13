"""Prepare one page only; the trusted coordinator dispatches any recognition task."""

from pathlib import Path

from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from ..worker_observation import observe
from .annotation_regions import annotation_regions
from .annotation_spans import apply_annotation_spans
from .blank_page import blank_page
from .language_route import language_uncertain
from .native_colour_witness import make_witness
from .native_line_offsets import mapped_native_ids, native_line_offsets
from .native_page import native_page
from .observe_page import observe_page
from .observe_tables import observe_tables
from .prepared import PreparedPage
from .prepared_native_layout import NativeLayoutPreparedPage
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
    capture = None
    if (
        preparation.source_layout_policy is not None
        and not has_visible
        and parsed.original_reader is not None
    ):
        try:
            from .native_colour_capture import colour_capture

            capture = colour_capture(
                parsed.view,
                page_number,
                parsed.view_reader.pages[page_number - 1],
                parsed.view_reader,
                original=parsed.original,
                original_reader=parsed.original_reader,
            )
        except (ImportError, AttributeError):
            capture = None  # Optional tool absence cannot break old import/routing.
    observation = observe_page(
        parsed.view,
        parsed.view_reader,
        page,
        page_number,
        scratch,
        capture_paint=preparation.source_feature_policy is not None,
        colour_capture=capture,
        existing_render=existing_render,
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
    if preparation.source_layout_policy is not None:
        prepared_native = NativeLayoutPreparedPage.model_validate(
            {
                **prepared.model_dump(),
                "schema_version": "ava-prepared-page-2",
                "source_layout_policy": preparation.source_layout_policy,
                "native_line_maps": [
                    m.model_dump()
                    for m in native_line_offsets(observation, segments, mapped_native_ids(segments))
                ],
                **(
                    {
                        "native_colour_witness": make_witness(
                            preparation, observation, segments, capture
                        ).model_dump()
                    }
                    if capture is not None and capture.valid and capture.raw_glyph_sha256
                    else {}
                ),
            }
        )
        observe("page", prepared_native)
        return prepared_native
    observe("page", prepared)
    return prepared
