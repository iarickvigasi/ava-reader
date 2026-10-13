"""Independently authored source lines, glyph faces and single/two-column expectations."""

import base64
import hashlib
import io

from PIL import Image

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.layout_hyphen import LayoutHyphenCandidate, LayoutHyphenLine
from ava_pdf_epub.contracts.source import Box, SourceRegion
from ava_pdf_epub.reconstruction_v2.font_style import font_style
from ava_pdf_epub.reconstruction_v2.native_structure_contract import NativeStructureResponse
from ava_pdf_epub.reconstruction_v2.native_structure_fields import NativeStructureRegion
from ava_pdf_epub.reconstruction_v2.observations import Glyph, NativeLine, PageObservation
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionImage

SOURCE = "a" * 64


def box(x0, y0, x1, y1):
    return Box(
        coordinate_space="page_points_top_left",
        x0=float(x0),
        y0=float(y0),
        x1=float(x1),
        y1=float(y1),
    )


def line(ident, text, x=40, y=40, faces=None):
    parts = faces or [(text, "Times-Roman")]
    glyphs, cursor = [], float(x)
    for words, font in parts:
        end = cursor + len(words) * 5
        glyphs.append(
            Glyph(text=words, box=box(cursor, y, end, y + 10), font=font, size=10.0, visible=True)
        )
        cursor = end
    return NativeLine(
        id=ident,
        text=text,
        box=box(x, y, cursor, y + 10),
        glyphs=glyphs,
        style=font_style(glyphs, ident + "-style"),
    )


def page(lines, graphics=()):
    stream = io.BytesIO()
    Image.new("RGB", (600, 800), "white").save(stream, format="PNG")
    data = stream.getvalue()
    digest = hashlib.sha256(data).hexdigest()
    image = RecognitionImage(
        media_type="image/png",
        sha256=digest,
        byte_length=len(data),
        width=600,
        height=800,
        base64=base64.b64encode(data).decode(),
    )
    observation = PageObservation(
        number=1,
        width_pt=600.0,
        height_pt=800.0,
        rotation=0,
        render_path="renders/p1.png",
        render_sha256=digest,
        render_width=600,
        render_height=800,
        lines=lines,
        graphics=list(graphics),
        risks=[],
    )
    return observation, image


def region(ident, lines, *, band=0, column=0, role="content", artifact=None, bounds=None):
    bounds = bounds or box(
        min(source.box.x0 for source in lines),
        min(source.box.y0 for source in lines),
        max(source.box.x1 for source in lines),
        max(source.box.y1 for source in lines),
    )
    return NativeStructureRegion(
        source=SourceRegion(
            id=ident,
            box=bounds,
            band=band,
            column=column,
            role=role,
            route="render" if artifact else "native",
        ),
        line_ids=[source.id for source in lines],
        artifact_id=artifact,
    )


def response(task, groups, dispositions=(), references=()):
    return NativeStructureResponse.model_validate(
        dict(
            schema_version="ava-native-structure-response-1",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            observation_sha256=task.observation_sha256,
            render_sha256=task.image.sha256,
            groups=groups,
            boundary_dispositions=list(dispositions),
            references=list(references),
            unresolved=[],
            language="en",
        )
    )


def wrap_candidate(left, right, region_id="body"):
    source = left.text + "\n" + right.text
    split = len(left.text)
    return LayoutHyphenCandidate(
        schema_version="ava-layout-hyphen-candidate-1",
        id="wrap-one",
        source_sha256=SOURCE,
        source_text_sha256=text_digest(source),
        source_start=split - 1,
        source_end=split + 1,
        left=LayoutHyphenLine(
            line_id=left.id,
            page=1,
            region_id=region_id,
            box=left.box,
            source_start=0,
            source_end=split,
            method="native",
        ),
        right=LayoutHyphenLine(
            line_id=right.id,
            page=1,
            region_id=region_id,
            box=right.box,
            source_start=split + 1,
            source_end=len(source),
            method="native",
        ),
        role="paragraph",
        boundary="line",
        preserve_line_breaks=False,
        consecutive=True,
    )


def superscript_line(ident="p1-line0", text="Caller1 and trans-", y=40):
    source = line(
        ident,
        text,
        y=y,
        faces=[("Caller", "Times-Roman"), ("1", "Times-Roman"), (text[7:], "Times-Roman")],
    )
    glyphs = list(source.glyphs)
    marked = glyphs[1]
    glyphs[1] = marked.model_copy(
        update={"size": 7.0, "box": box(marked.box.x0, y - 6, marked.box.x1, y + 1)}
    )
    return source.model_copy(
        update={"glyphs": glyphs, "box": box(source.box.x0, y - 6, source.box.x1, y + 10)}
    )


def native_structure_wire_fixture():
    from ava_pdf_epub.contracts.layout_hyphen import LayoutHyphenDisposition, candidate_digest
    from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure

    lines = [
        superscript_line(),
        line("p1-line1", "cription follows.", y=60),
        line("p1-note", "1. A source note.", y=100),
    ]
    observation, image = page(lines)
    candidate = wrap_candidate(*lines[:2])
    task = prepare_native_structure(
        observation,
        SOURCE,
        image,
        [region("body", lines[:2]), region("notes", lines[2:], band=1)],
        candidates=[candidate],
    )
    answer = response(
        task,
        [
            dict(
                id="body-one",
                region_id="body",
                kind="paragraph",
                line_ids=[source.id for source in lines[:2]],
            ),
            dict(
                id="note-one",
                region_id="notes",
                kind="note",
                line_ids=[lines[2].id],
                note_label="1",
                note_role="footnote",
            ),
        ],
        [
            LayoutHyphenDisposition(
                candidate_id=candidate.id,
                candidate_sha256=candidate_digest(candidate),
                disposition="literal",
            )
        ],
        [dict(span_id=task.eligible_callouts[0].span_id, role="note_callout")],
    )
    return task, answer
