"""Whole-source repetition corroborates only small isolated marginal Artifact images."""

from collections import Counter
from pathlib import Path

from ..worker_observation import observe
from .attempt_exchange import json_bytes
from .borderless_tables import borderless_tables
from .conservation import native_conservation
from .geometry import overlap
from .page_checkpoints import PageCheckpoints
from .protocol import prepared_result
from .protocol_output import encode_packet
from .raster_regions import raster_regions
from .route_native import route_native
from .source_feature_contract import FEATURE_POLICY
from .validate_tasks import validate_tasks


def qualify_embedded_images(pages: PageCheckpoints, scratch: Path, policy: str | None) -> None:
    if policy != FEATURE_POLICY:
        return
    counts: Counter[tuple[object, ...]] = Counter()
    candidates = {}
    for page in pages:
        p = page.observation
        if set(p.risks) - {"language_uncertain"} or not p.lines:
            continue
        tables = page.tables or borderless_tables(p)
        local: Counter[tuple[object, ...]] = Counter()
        for index, graphic in enumerate(p.graphics):
            a, b = graphic.source_image, graphic.box
            if (
                a is None
                or graphic.kind != "image"
                or not (b.y1 <= p.height_pt * 0.08 or b.y0 >= p.height_pt * 0.92)
                or b.x1 - b.x0 > p.width_pt * 0.35
                or b.y1 - b.y0 > p.height_pt * 0.06
                or ((b.x1 - b.x0) * (b.y1 - b.y0) > p.width_pt * p.height_pt * 0.02)
            ):
                continue
            if any(overlap(b, table.box) > 0 for table in tables):
                continue
            if any(overlap(b, line.box) > 0 for line in p.lines) or any(
                other is not graphic and overlap(b, other.box) > 0 for other in p.graphics
            ):
                continue
            key = (a.sha256, a.width, a.height, p.width_pt, p.height_pt, b.x0, b.y0, b.x1, b.y1)
            candidates[(p.number, index)] = key
            local[key] += 1
        counts.update(k for k, n in local.items() if n == 1)
    qualified = {key for key, n in counts.items() if n >= 3}
    for index in range(len(pages)):
        page = pages[index]
        graphics = []
        changed = False
        for position, graphic in enumerate(page.observation.graphics):
            if candidates.get((page.observation.number, position)) in qualified:
                assert graphic.source_image is not None
                graphic = graphic.model_copy(
                    update={
                        "source_image": graphic.source_image.model_copy(update={"qualified": True})
                    }
                )
                changed = True
            graphics.append(graphic)
        if not changed:
            continue
        observation = page.observation.model_copy(update={"graphics": graphics})
        regions = raster_regions(observation, scratch, page.profile_id)
        native, tasks = route_native(
            observation, page.tables, regions, page.source_sha256, scratch, page.profile_id
        )
        native_conservation(observation, native, [t.region_box for t in tasks])
        result = page.model_copy(
            update={"observation": observation, "native_segments": native, "tasks": tasks}
        )
        encode_packet(prepared_result(result).model_dump(mode="json"), 8 * 1024 * 1024)
        validate_tasks(
            json_bytes(
                {"mode": "validate_tasks", "tasks": [t.model_dump(mode="json") for t in tasks]}
            )
        )
        pages.qualify(index, result)
        observe("page", result)
