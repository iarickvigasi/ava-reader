"""Require all source pages and all dispatched regions before whole-book reconstruction."""

import hashlib
from pathlib import Path

from .accept_response import accept_response
from .blank_page import blank_page
from .conservation import native_conservation
from .furniture import furniture_ids
from .native_page import native_page
from .prepared import PreparedPage
from .recognition_contract import RecognitionResponse
from .segments import Segment


def qualify_pages(
    source: Path, scratch: Path, pages: list[PreparedPage], responses: list[RecognitionResponse]
) -> dict[int, list[Segment]]:
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if not pages or [p.observation.number for p in pages] != list(
        range(1, pages[0].source_page_count + 1)
    ):
        raise ValueError("Prepared source pages must be complete and ordered")
    if any(
        p.source_sha256 != digest
        or p.source_byte_length != source.stat().st_size
        or p.source_page_count != len(pages)
        for p in pages
    ):
        raise ValueError("Prepared pages do not belong to the immutable source")
    tasks = [task for page in pages for task in page.tasks]
    lookup = {r.task_id: r for r in responses}
    if len(lookup) != len(responses) or set(lookup) != {task.task_id for task in tasks}:
        raise ValueError("Recognition task coverage is incomplete or contains unexpected receipts")
    furniture = furniture_ids([p.observation for p in pages])
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
        content = native_page(
            page.observation, page.tables, furniture, [t.region_box for t in page.tasks]
        )
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
