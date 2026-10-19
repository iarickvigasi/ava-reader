"""Authored OCR fixture; no book words, paid responses or genuine engine claims."""

import base64
import io

from PIL import Image

from ava_pdf_epub.reconstruction_v2.annotation_words import HEADER
from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.recognition_cell_geometry_repair import (
    prepare_cell_geometry_repair,
)
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionTask
from ava_pdf_epub.reconstruction_v2.recognition_geometry_identity import geometry_digest
from ava_pdf_epub.reconstruction_v2.task_identity import task_identifier

from .test_cell_geometry_repair import authored


def ocr_fixture(text="Target", second=False, profile_id=None):
    parent, raw, _ = authored(broken=2 if second else 1)
    with Image.new("RGB", (1000, 1000), "white") as image, io.BytesIO() as buffer:
        image.save(buffer, format="PNG")
        content = buffer.getvalue()
    fields = parent.model_dump(mode="json")
    if profile_id is not None:
        fields["profile_id"] = profile_id
    fields["image"].update(
        width=1000,
        height=1000,
        base64=base64.b64encode(content).decode(),
        byte_length=len(content),
        sha256=geometry_digest(content),
    )
    fields["task_id"] = task_identifier(fields)
    parent = RecognitionTask.model_validate(fields)
    raw.update(task_id=parent.task_id, render_sha256=parent.image.sha256)
    raw["segments"][0]["cells"][0][0]["text"] = text
    if second:
        raw["segments"][0]["cells"][0][1]["text"] = "Other"
    return parent, prepare_cell_geometry_repair(parent, json_bytes(raw).decode())


def tsv(rows):
    return (
        "\t".join(HEADER)
        + "\n"
        + "".join(
            "\t".join(
                map(str, (5, 1, block, 1, line, ordinal, x, y, width, height, confidence, text))
            )
            + "\n"
            for block, line, ordinal, x, y, width, height, confidence, text in rows
        )
    ).encode()


def target(confidence=97, text="Target"):
    return (1, 1, 1, 20, 20, 60, 20, confidence, text)


def pinned_neighbor_fixture():
    """Valid measured table whose trusted neighbor has no response-owned box."""
    import json

    parent, task = ocr_fixture()
    fields = parent.model_dump(mode="json")
    fields["prompt_version"] = "ava-prose-region-16"
    crop = fields["region_box"]

    def measured_box(x0, x1):
        return dict(
            coordinate_space="page_points_top_left",
            x0=crop["x0"] + (crop["x1"] - crop["x0"]) * x0 / 1000,
            x1=crop["x0"] + (crop["x1"] - crop["x0"]) * x1 / 1000,
            y0=crop["y0"],
            y1=crop["y1"],
        )

    evidence = dict(
        reliable=False,
        lines=[],
        ruled_tables=[
            dict(
                box=crop,
                cells=[
                    dict(row=0, column=0, row_span=1, column_span=1, box=measured_box(0, 900)),
                    dict(
                        source_cell_id="p1-table0-cell0-1",
                        row=0,
                        column=1,
                        row_span=1,
                        column_span=1,
                        box=measured_box(900, 1000),
                    ),
                ],
            )
        ],
    )
    fields["native_evidence"] = json_bytes(evidence).decode()
    fields["native_evidence_sha256"] = geometry_digest(fields["native_evidence"].encode())
    fields["task_id"] = task_identifier(fields)
    parent = RecognitionTask.model_validate(fields)
    raw = json.loads(task.original_response_json)
    raw.update(task_id=parent.task_id, render_sha256=parent.image.sha256)
    raw["segments"][0].update(
        text="Target",
        cells=[
            [
                dict(
                    text="Target",
                    spans=[],
                    style=None,
                    header_axis=None,
                    box=dict(
                        coordinate_space="render_normalized_1000", x0=0, y0=990, x1=900, y1=10
                    ),
                ),
                dict(
                    text="",
                    spans=[],
                    style=None,
                    header_axis=None,
                    box=None,
                    source_cell_id="p1-table0-cell0-1",
                ),
            ]
        ],
    )
    return parent, prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
