"""Authored observations exercise authority boundaries without provider/source-book data."""

import copy

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionTask
from ava_pdf_epub.reconstruction_v2.recognition_geometry_contract import RecognitionGeometryResponse
from ava_pdf_epub.reconstruction_v2.recognition_geometry_identity import geometry_digest
from ava_pdf_epub.reconstruction_v2.task_identity import task_identifier

from .recognition_task_fixture import task_fixture
from .response_fixtures import wire_segment


def fixture(count=1, reliable=False):
    task = task_fixture()
    parent = dict(
        schema_version="ava-recognition-response-2",
        task_id=task.task_id,
        source_sha256=task.source_sha256,
        render_sha256=task.image.sha256,
        language="en",
        unresolved=[],
        segments=[wire_segment(id=f"s{i}", text="Reliable source") for i in range(count)],
    )
    for segment in parent["segments"]:
        segment["box"].update(y0=700, y1=600)
    if reliable:
        fields = task.model_dump(mode="json")
        line_box = task.region_box.model_dump(mode="json")
        line_box["y1"] = line_box["y0"] + 40
        fields["native_evidence"] = json_bytes(
            dict(
                reliable=True,
                lines=[dict(id="native", box=line_box, text="Reliable source")],
            )
        ).decode()
        fields["native_evidence_sha256"] = geometry_digest(fields["native_evidence"].encode())
        fields["task_id"] = task_identifier(fields)
        task = RecognitionTask.model_validate(fields)
        parent["task_id"] = task.task_id
    return task, parent


def correction(task):
    box = dict(coordinate_space="render_normalized_1000", x0=0, y0=0, x1=1000, y1=1000)
    return RecognitionGeometryResponse.model_validate(
        dict(
            schema_version="ava-recognition-geometry-response-1",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            original_task_id=task.original_task_id,
            render_sha256=task.render_sha256,
            original_response_sha256=task.original_response_sha256,
            outcome="corrected",
            unresolved_reason=None,
            patches=[
                dict(segment_id=slot.segment_id, box=copy.deepcopy(box)) for slot in task.slots
            ],
        )
    )


def authored_fixture():
    from ava_pdf_epub.reconstruction_v2.recognition_geometry_repair import prepare_geometry_repair

    parent, raw = fixture()
    original_json = json_bytes(raw).decode()
    task = prepare_geometry_repair(parent, original_json)
    return parent, original_json, task, correction(task)
