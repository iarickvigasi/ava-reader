"""Authored wire observations for tests; never repairs or accepts provider output."""

from typing import Any


def wire_segment(task: Any = None, **values: Any) -> dict[str, Any]:
    result = dict(
        id="s0001",
        page=1,
        method="ocr",
        kind="paragraph",
        text="A😀B",
        box=dict(coordinate_space="render_normalized_1000", x0=0, y0=0, x1=1000, y1=1000),
        style=None,
        spans=[],
        heading_level=None,
        chapter_start=False,
        chapter_role=None,
        note_label=None,
        note_role=None,
        list_ordered=None,
        list_start=None,
        list_depth=None,
        continues_from_previous=False,
        continues_to_next=False,
        cells=[],
        related_to=None,
        alt="",
    )
    result.update(values)
    if task is not None:
        raw = task if isinstance(task, dict) else task.model_dump()
        crop = raw["region_box"]
        box = result["box"]
        if box["coordinate_space"] != "page_points_top_left":
            raise ValueError("Authored test expects point-space source observations")
        result["box"] = dict(
            coordinate_space="render_normalized_1000",
            x0=(box["x0"] - crop["x0"]) / (crop["x1"] - crop["x0"]) * 1000,
            x1=(box["x1"] - crop["x0"]) / (crop["x1"] - crop["x0"]) * 1000,
            y0=(box["y0"] - crop["y0"]) / (crop["y1"] - crop["y0"]) * 1000,
            y1=(box["y1"] - crop["y0"]) / (crop["y1"] - crop["y0"]) * 1000,
        )
    return result
