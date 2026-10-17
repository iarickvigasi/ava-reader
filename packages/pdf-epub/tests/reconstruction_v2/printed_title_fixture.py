"""An authored booklet/render, with independent expected title roles and no original book data."""

import hashlib
from pathlib import Path
from typing import Literal

from PIL import Image, ImageDraw, ImageFont

from ava_pdf_epub.reconstruction_v2.observations import PageObservation
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.printed_title_contract import PrintedTitleResponse
from ava_pdf_epub.reconstruction_v2.printed_title_task import printed_title_task
from ava_pdf_epub.reconstruction_v2.refinement_digest import observation_digest

from .metadata_helpers import body, metadata_state, paragraph


def title_fixture(scratch: Path, method: Literal["native", "ocr"] = "native"):
    state = metadata_state(
        [
            body("The Quiet River")
            | dict(method=method, style=dict(id="title", align="center", relative_size=1.5)),
            paragraph("A source booklet about quiet walks.") | dict(method=method),
            body("1. Walking") | dict(method=method),
        ]
    )
    segments = list(state.segments.values())
    for block in state.blocks:
        block["evidence"][0]["method"] = method
    image = Image.new("RGB", (900, 1400), "white")
    draw = ImageDraw.Draw(image)
    for segment in segments:
        draw.text(
            (segment.box.x0 * 2, segment.box.y0 * 2),
            segment.text,
            fill="black",
            font=ImageFont.load_default(size=30),
        )
    image.save(scratch / "page.png", format="PNG")
    sha = hashlib.sha256((scratch / "page.png").read_bytes()).hexdigest()
    observed = PageObservation(
        number=1,
        width_pt=450.0,
        height_pt=700.0,
        rotation=0,
        render_path="page.png",
        render_sha256=sha,
        render_width=900,
        render_height=1400,
        lines=[],
        graphics=[],
        risks=[],
    )
    prepared = PreparedPage(
        schema_version="ava-prepared-page-1",
        profile_id="ava-pdf-prose-en-uk-v3",
        source_sha256="a" * 64,
        source_byte_length=1,
        source_page_count=1,
        observation=observed,
        tables=[],
        native_segments=segments if method == "native" else [],
        tasks=[],
    )
    task = printed_title_task(
        segments, {1: prepared}, scratch, prepared.source_sha256, observation_digest(segments)
    )
    if task is None:
        raise AssertionError("Authored opening title should be compared")
    return task, prepared, segments, state


def title_response(task, role: Literal["title"] | None = "title"):
    return PrintedTitleResponse(
        schema_version="ava-printed-title-response-1",
        task_id=task.task_id,
        source_sha256=task.source_sha256,
        observation_sha256=task.observation_sha256,
        image_sha256=task.image.sha256,
        decision=dict(
            node_id=task.node.id,
            text_sha256=task.node.text_sha256,
            evidence_ids=[crop.id for crop in task.crops],
            role=role,
        ),
    )
