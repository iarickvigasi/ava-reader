"""Prepare one page only; the trusted coordinator dispatches any recognition task."""

import hashlib
from pathlib import Path

import pdfplumber
from pypdf import PdfReader

from ..admission_actions import inspect_annotations, inspect_catalog
from ..annotation_kind import annotation_kind
from ..annotation_view import annotation_view
from ..contracts.profiles import LEGACY_PROFILE, ProfileId, checked_profile
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


def prepare_page(
    source: Path, scratch: Path, page_number: int, profile_id: ProfileId = LEGACY_PROFILE
) -> PreparedPage:
    checked_profile(profile_id)
    size = source.stat().st_size
    if not 0 < size <= 52428800:
        raise ValueError("Source byte bound exceeded")
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    reader = PdfReader(source)
    if reader.is_encrypted or not 1 <= len(reader.pages) <= 500:
        raise ValueError("Source is encrypted or page bound exceeded")
    if not 1 <= page_number <= len(reader.pages):
        raise ValueError("Page is outside source")
    observe("source", source_hash, len(reader.pages), page_number, profile_id)
    inspect_catalog(reader.trailer["/Root"])
    inspect_annotations(
        reader.pages[page_number - 1], page_number=page_number, page_count=len(reader.pages)
    )
    kinds = [
        annotation_kind(ref.get_object())
        for ref in reader.pages[page_number - 1].get("/Annots", [])
    ]
    observe("annotation", page_number, kinds)
    has_visible = "visible" in kinds
    view = annotation_view(source, scratch)
    view_reader = PdfReader(view)
    with pdfplumber.open(view) as document:
        page = document.pages[page_number - 1]
        observation = observe_page(view, view_reader, page, page_number, scratch)
        if language_uncertain(observation.lines, profile_id):
            observation = observation.model_copy(
                update={"risks": [*observation.risks, "language_uncertain"]}
            )
        bounds = tuple(float(v) for v in page.cropbox)
        if len(bounds) != 4:
            raise ValueError("Invalid page crop")
        tables = observe_tables(page, observation.lines, bounds)
    if has_visible:
        required = annotation_regions(
            reader.pages[page_number - 1], observation=observation, scratch=scratch
        )
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
        else route_native(observation, tables, regions, source_hash, scratch, profile_id)
    )
    prepared = PreparedPage(
        schema_version="ava-prepared-page-1",
        profile_id=profile_id,
        source_sha256=source_hash,
        source_byte_length=size,
        source_page_count=len(reader.pages),
        observation=observation,
        tables=tables,
        native_segments=segments,
        tasks=tasks,
    )
    observe("page", prepared)
    return prepared
