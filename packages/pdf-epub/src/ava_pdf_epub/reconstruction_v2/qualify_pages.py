"""Require all source pages and all dispatched regions before whole-book reconstruction."""

import hashlib
from collections.abc import Sequence
from pathlib import Path

from .accept_response import accept_response
from .blank_page import blank_page
from .conservation import native_conservation
from .furniture import furniture_ids
from .native_layout_policy import NativeLayoutPolicy, validate_layout_policy
from .native_line_offsets import NativeLineOffset
from .native_page import native_page
from .prepared_native_layout import NativeLayoutPreparedPage
from .prepared_types import AnyPreparedPage, layout_policy
from .recognition_contract import RecognitionResponse
from .segments import Segment


def qualify_pages(
    source: Path,
    scratch: Path,
    pages: Sequence[AnyPreparedPage],
    responses: list[RecognitionResponse],
    *,
    source_layout_policy: NativeLayoutPolicy | None = None,
    source_line_maps: dict[str, NativeLineOffset] | None = None,
) -> dict[int, list[Segment]]:
    policy = validate_layout_policy(source_layout_policy)
    if any(layout_policy(page) != policy for page in pages):
        raise ValueError("Prepared page layout policy differs from reconstruction input")
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if not pages or [p.observation.number for p in pages] != list(
        range(1, pages[0].source_page_count + 1)
    ):
        raise ValueError("Prepared source pages must be complete and ordered")
    if any(
        p.profile_id != pages[0].profile_id
        or any(t.profile_id != p.profile_id for t in p.tasks)
        or p.source_sha256 != digest
        or p.source_byte_length != source.stat().st_size
        or p.source_page_count != len(pages)
        for p in pages
    ):
        raise ValueError("Prepared pages do not belong to the immutable source")
    tasks = [task for page in pages for task in page.tasks]
    lookup = {r.task_id: r for r in responses}
    if len(lookup) != len(responses) or set(lookup) != {task.task_id for task in tasks}:
        raise ValueError("Recognition task coverage is incomplete or contains unexpected receipts")
    furniture = furniture_ids((p.observation for p in pages), pages[0].profile_id)
    output: dict[int, list[Segment]] = {}
    for page in pages:
        render = scratch / page.observation.render_path
        if render.resolve().parent != (scratch / "renders").resolve():
            raise ValueError("Page render must belong to private render directory")
        if hashlib.sha256(render.read_bytes()).hexdigest() != page.observation.render_sha256:
            raise ValueError("Page render content identity changed")
        if blank_page(page.observation, scratch):
            output[page.observation.number] = []
            continue
        mappings: list[NativeLineOffset] = []
        content = native_page(
            page.observation,
            page.tables,
            furniture,
            [t.region_box for t in page.tasks],
            page.profile_id,
            source_layout_policy=policy,
            source_line_maps=mappings,
        )
        if isinstance(page, NativeLayoutPreparedPage):
            if mappings != page.native_line_maps:
                raise ValueError("Native layout source line map changed after preparation")
            if mappings and source_line_maps is None:
                raise ValueError("Native layout source line maps require an assembly owner")
            if source_line_maps is not None:
                for mapping in mappings:
                    if mapping.line_id in source_line_maps:
                        raise ValueError("Native source line map crosses page ownership")
                    source_line_maps[mapping.line_id] = mapping
        native_conservation(page.observation, content, [t.region_box for t in page.tasks])
        for task in page.tasks:
            accepted = accept_response(task, lookup[task.task_id])
            names = {
                s.id: f"page{page.observation.number}-{task.task_id[10:22]}-{i}"
                for i, s in enumerate(accepted)
            }
            content.extend(
                s.model_copy(
                    update={
                        "id": names[s.id],
                        "related_to": names.get(s.related_to) if s.related_to else None,
                    }
                )
                for s in accepted
            )
        if not content:
            raise ValueError("Recognition omitted a nonblank source page")
        output[page.observation.number] = content
    return output
