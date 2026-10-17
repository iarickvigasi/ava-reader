"""Send ambiguous native structure for source-bound review; known excluded grids stop early."""

from pathlib import Path

from ..contracts.profiles import LEGACY_PROFILE, ProfileId
from ..contracts.source import Box
from ..worker_observation import observe
from .geometry import rectangle
from .graphic_recognition_regions import graphic_recognition_regions
from .index_layout import INDEX_LAYOUT_RISK
from .index_prompt import INDEX_PROMPT_VERSION
from .make_task import make_task
from .native_layout_policy import NativeLayoutPolicy
from .native_line_offsets import NativeLineOffset
from .native_page import native_page
from .native_review import NativeReviewRequired
from .observations import PageObservation
from .observe_tables import TableObservation
from .recognition_contract import RecognitionTask
from .recognition_versions import RecognitionPromptVersion
from .segments import Segment
from .table_recognition_evidence import table_recognition_evidence


def route_native(
    page: PageObservation,
    tables: list[TableObservation],
    regions: list[Box],
    source_hash: str,
    scratch: Path,
    profile_id: ProfileId = LEGACY_PROFILE,
    *,
    furniture: set[str] | None = None,
    source_layout_policy: NativeLayoutPolicy | None = None,
    source_line_maps: list[NativeLineOffset] | None = None,
) -> tuple[list[Segment], list[RecognitionTask]]:
    table_prompt, table_evidence = table_recognition_evidence(page.number, tables)
    prompt_version: RecognitionPromptVersion = table_prompt
    if INDEX_LAYOUT_RISK in page.risks and table_evidence is None:
        prompt_version = INDEX_PROMPT_VERSION
    try:
        from .geometry import overlap

        if INDEX_LAYOUT_RISK in page.risks:
            raise NativeReviewRequired("Index entry boundaries require visual structure review")
        regions = graphic_recognition_regions(page, tables, regions)
        if table_evidence and any(overlap(t.box, r) > 0 for t in tables for r in regions):
            raise NativeReviewRequired("Visual recognition must contain the complete merged table")
        segments = native_page(
            page,
            tables,
            furniture or set(),
            regions,
            profile_id,
            source_layout_policy=source_layout_policy,
            source_line_maps=source_line_maps,
        )
        if any(segment.kind == "unsupported" for segment in segments):
            raise NativeReviewRequired("Native structural interpretation requires review")
    except NativeReviewRequired:
        if source_line_maps is not None:
            source_line_maps.clear()
        observe("layout", page.number, "review_required")
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
