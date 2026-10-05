"""Send ambiguous native structure for source-bound review; known excluded grids stop early."""

from pathlib import Path
from typing import Literal

from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from ..contracts.source import Box
from .geometry import rectangle
from .graphic_recognition_regions import graphic_recognition_regions
from .make_task import make_task
from .native_page import native_page
from .native_review import NativeReviewRequired
from .observations import PageObservation
from .observe_tables import TableObservation
from .recognition_contract import RecognitionTask
from .segments import Segment
from .table_grid import measured_table_grid


def route_native(
    page: PageObservation,
    tables: list[TableObservation],
    regions: list[Box],
    source_hash: str,
    scratch: Path,
    profile_id: ProfileId = LEGACY_PROFILE,
) -> tuple[list[Segment], list[RecognitionTask]]:
    try:
        grids = [measured_table_grid(table) for table in tables]
    except ValueError:
        raise ValueError("Essential table exceeds the supported grid profile") from None
    prompt_version: Literal["ava-prose-region-15", "ava-prose-region-16"] = (
        "ava-prose-region-16"
        if any(c.row_span > 1 or c.column_span > 1 for grid in grids for c in grid)
        else "ava-prose-region-15"
    )
    table_evidence = (
        [
            {
                "box": table.box.model_dump(),
                "cells": [
                    {
                        "source_cell_id": f"p{page.number}-table{index}-cell{c.row}-{c.column}",
                        "row": c.row,
                        "column": c.column,
                        "row_span": c.row_span,
                        "column_span": c.column_span,
                        "box": c.box.model_dump(),
                    }
                    for c in grid
                ],
            }
            for index, (table, grid) in enumerate(zip(tables, grids, strict=True))
        ]
        if prompt_version == "ava-prose-region-16"
        else None
    )
    try:
        from .geometry import overlap

        regions = graphic_recognition_regions(page, tables, regions)
        if table_evidence and any(overlap(t.box, r) > 0 for t in tables for r in regions):
            raise NativeReviewRequired("Visual recognition must contain the complete merged table")
        segments = native_page(page, tables, set(), regions, profile_id)
        if any(segment.kind == "unsupported" for segment in segments):
            raise NativeReviewRequired("Native structural interpretation requires review")
    except NativeReviewRequired:
        box = rectangle((0, 0, page.width_pt, page.height_pt), page.width_pt, page.height_pt)
        return [], [
            make_task(
                page,
                source_hash,
                box,
                scratch,
                purpose="pdf_structure_repair",
                profile_id=profile_id,
                prompt_version=prompt_version,
                table_evidence=table_evidence,
            )
        ]
    return segments, [
        make_task(
            page,
            source_hash,
            box,
            scratch,
            profile_id=profile_id,
            prompt_version=prompt_version,
            table_evidence=table_evidence,
        )
        for box in regions
    ]
