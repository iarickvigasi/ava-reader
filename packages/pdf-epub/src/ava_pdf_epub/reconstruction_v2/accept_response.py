"""Bind untrusted provider observations to the task and conserve reliable native text."""

import json
import re

from .recognition_contract import RecognitionResponse, RecognitionTask
from .recognition_coordinates import source_segment
from .segments import Segment


def accept_response(task: RecognitionTask, response: RecognitionResponse) -> list[Segment]:
    task = RecognitionTask.model_validate(task.model_dump())
    response = RecognitionResponse.model_validate(response.model_dump())
    if (
        response.task_id != task.task_id
        or response.source_sha256 != task.source_sha256
        or response.render_sha256 != task.image.sha256
    ):
        raise ValueError("Recognition response belongs to another source/task/render")
    if response.unresolved or response.language.lower().split("-")[0] not in {"en", "english"}:
        raise ValueError("Essential recognition uncertainty or language requires source review")
    if len({s.id for s in response.segments}) != len(response.segments):
        raise ValueError("Repeated recognition segment identity")
    segments = [source_segment(segment, task.region_box) for segment in response.segments]
    for segment in segments:
        a, b = task.region_box, segment.box
        if (
            segment.page != task.page_number
            or segment.method != "ocr"
            or not (a.x0 <= b.x0 < b.x1 <= a.x1 and a.y0 <= b.y0 < b.y1 <= a.y1)
        ):
            raise ValueError("Recognition geometry/method is outside the dispatched region")
        if segment.related_to and segment.related_to not in {s.id for s in response.segments}:
            raise ValueError("Recognition relationship has no source target")
        if segment.kind == "unsupported":
            raise ValueError("Essential unsupported source content")
    evidence = json.loads(task.native_evidence)
    if evidence["reliable"]:
        for line in evidence["lines"]:
            box = line["box"]
            nearby = [
                s
                for s in segments
                if s.box.x0 < box["x1"]
                and s.box.x1 > box["x0"]
                and s.box.y0 < box["y1"]
                and s.box.y1 > box["y0"]
            ]
            observed = " ".join(
                s.text + " " + s.alt + " " + " ".join(c.text for row in s.cells for c in row)
                for s in nearby
            )
            if re.sub(r"\s+", "", line["text"]) not in re.sub(r"\s+", "", observed):
                raise ValueError("Recognition changed/omitted/reordered reliable native text")
    return segments
