"""Authored independent whole subtitle plus two physically separate selected native lines."""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.assemble_metadata import assemble_metadata
from ava_pdf_epub.reconstruction_v2.native_line_offsets import NativeLineOffset

from .metadata_helpers import body, heading, metadata_state


def source_state():
    style = dict(id="source-subtitle", family="serif", relative_size=1.4, align="left")
    rows = [
        heading("A JOURNEY THROUGH MEASURED LINES", page=1, method="ocr"),
        heading("A Measured Book", page=2),
        heading("A journey through", page=2, style=style),
        heading("measured lines", page=2, style=style),
        (body() | dict(page=4)),
    ]
    state = metadata_state(rows)
    state.source_title_policy = "ava-frontmatter-title-1"
    selected = state.blocks[1]["id"]
    state.frontmatter_title = selected, text_digest(state.segments[selected].text)
    state.frontmatter_title_compared = True
    state.frontmatter_cover = [(state.blocks[0]["id"], text_digest(rows[0]["text"]))]
    for index in [0, 2, 3]:
        block = state.blocks[index]
        ident = block["id"]
        segment = state.segments[ident]
        if index > 0:
            segment = segment.model_copy(update=dict(native_line_ids=[f"line-{index}"]))
            state.segments[ident] = segment
            state.native_line_maps[f"line-{index}"] = NativeLineOffset(
                line_id=f"line-{index}",
                segment_id=ident,
                start=0,
                end=len(segment.text),
                text_sha256=text_digest(segment.text),
            )
        block["evidence"] = [
            dict(
                page=segment.page,
                region_id=f"r-{index}",
                method=segment.method,
                box=segment.box.model_dump(),
            )
        ]
        state.bibliographic_roles[ident] = "subtitle", segment.text
        state.bibliographic_source_ranges[ident] = (
            0,
            len(segment.text),
            len(segment.text),
            text_digest(segment.text),
            "a" * 64,
            "b" * 64,
        )
    return state


def subtitles(state):
    with patch(
        "ava_pdf_epub.reconstruction_v2.assemble_metadata.PdfReader",
        return_value=SimpleNamespace(metadata=None),
    ):
        claims = assemble_metadata(Path("authored-unused.pdf"), state, "authored")
    return [c for c in claims if c["field"] == "subtitle"]
