"""Prepare one page only; the trusted coordinator dispatches any recognition task."""

import hashlib
from pathlib import Path

import pdfplumber
from pypdf import PdfReader

from .blank_page import blank_page
from .language_route import language_uncertain
from .observe_page import observe_page
from .observe_tables import observe_tables
from .prepared import PreparedPage
from .raster_regions import raster_regions
from .route_native import route_native


def prepare_page(source: Path, scratch: Path, page_number: int) -> PreparedPage:
    size = source.stat().st_size
    if not 0 < size <= 52428800:
        raise ValueError("Source byte bound exceeded")
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    reader = PdfReader(source)
    if reader.is_encrypted or not 1 <= len(reader.pages) <= 500:
        raise ValueError("Source is encrypted or page bound exceeded")
    if not 1 <= page_number <= len(reader.pages):
        raise ValueError("Page is outside source")
    with pdfplumber.open(source) as document:
        page = document.pages[page_number - 1]
        observation = observe_page(source, reader, page, page_number, scratch)
        if language_uncertain(observation.lines):
            observation = observation.model_copy(
                update={"risks": [*observation.risks, "language_uncertain"]}
            )
        bounds = tuple(float(v) for v in page.cropbox)
        if len(bounds) != 4:
            raise ValueError("Invalid page crop")
        tables = observe_tables(page, observation.lines, bounds)
    blank = blank_page(observation, scratch)
    regions = [] if blank else raster_regions(observation, scratch)
    segments, tasks = (
        ([], []) if blank else route_native(observation, tables, regions, source_hash, scratch)
    )
    return PreparedPage(
        schema_version="ava-prepared-page-1",
        source_sha256=source_hash,
        source_byte_length=size,
        source_page_count=len(reader.pages),
        observation=observation,
        tables=tables,
        native_segments=segments,
        tasks=tasks,
    )
