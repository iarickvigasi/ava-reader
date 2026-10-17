"""Authored full-title, half-title, contributor and chapter source comparison controls."""

import hashlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.observations import PageObservation
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.printed_title_v2_contract import FrontmatterTitleResponse
from ava_pdf_epub.reconstruction_v2.printed_title_v2_task import frontmatter_title_task
from ava_pdf_epub.reconstruction_v2.refinement_digest import observation_digest

from .metadata_helpers import heading, metadata_state, paragraph

TITLE = "The Quiet River"


def frontmatter_fixture(scratch: Path, *, complete_ocr_cover=False):
    state = metadata_state(
        [
            heading(
                TITLE if complete_ocr_cover else "the",
                method="ocr",
                chapter_start=True,
                chapter_role="frontmatter",
            ),
            heading("A. Walker", method="ocr"),
            heading("quiet river", method="ocr"),
            heading(TITLE, page=2, level=2),
            heading("Other books from Example Press", page=3),
            heading(TITLE, page=4, level=2),
            paragraph("An exploration of walks beside water", page=4),
            paragraph("A. Walker", page=4),
            heading("Copyright", page=5),
            paragraph("Publisher: Example Press", page=5),
            heading("Contents", page=6),
            heading("1. Walking", page=7, chapter_start=True, chapter_role="bodymatter"),
            paragraph("Body prose stays intact and is not bibliographic authority.", page=7),
        ]
    )
    state.source_title_policy = "ava-frontmatter-title-1"
    segments = list(state.segments.values())
    pages = {}
    for number in range(1, 8):
        image = Image.new("RGB", (900, 1400), "white")
        draw = ImageDraw.Draw(image)
        for segment in segments:
            if segment.page == number:
                draw.text(
                    (segment.box.x0 * 2, segment.box.y0 * 2),
                    segment.text,
                    fill="black",
                    font=ImageFont.load_default(size=24),
                )
        relative = f"page-{number}.png"
        image.save(scratch / relative)
        data = (scratch / relative).read_bytes()
        observed = PageObservation(
            number=number,
            width_pt=450,
            height_pt=700,
            rotation=0,
            render_path=relative,
            render_sha256=hashlib.sha256(data).hexdigest(),
            render_width=900,
            render_height=1400,
            lines=[],
            graphics=[],
            risks=[],
        )
        pages[number] = PreparedPage(
            schema_version="ava-prepared-page-1",
            profile_id="ava-pdf-prose-en-uk-v3",
            source_sha256="a" * 64,
            source_byte_length=1,
            source_page_count=7,
            observation=observed,
            tables=[],
            native_segments=[],
            tasks=[],
        )
    task = frontmatter_title_task(segments, pages, scratch, "a" * 64, observation_digest(segments))
    assert task is not None
    return task, pages, segments, state


def frontmatter_response(task, selected_id="observed-5", *, cover=False):
    node = next((n for n in task.nodes if n.id == selected_id), None)
    evidence = [
        c.id
        for c in task.crops
        if node
        and (
            (c.part == "title" and c.node_id == node.id)
            or (c.part == "context" and c.page == node.page)
        )
    ]
    corroboration = None
    if cover:
        ids = [n.id for n in task.nodes if n.page == 1]
        corroboration = dict(
            node_ids=ids,
            evidence_ids=[
                c.id
                for c in task.crops
                if (c.part == "title" and c.node_id in ids) or (c.part == "context" and c.page == 1)
            ],
        )
    return FrontmatterTitleResponse(
        schema_version="ava-printed-title-response-2",
        task_id=task.task_id,
        source_sha256=task.source_sha256,
        observation_sha256=task.observation_sha256,
        image_sha256=task.image.sha256,
        selected_node_id=node.id if node else None,
        selected_text_sha256=text_digest(node.text) if node else None,
        evidence_ids=evidence,
        cover=corroboration,
    )


def authored_frontmatter_pdf(path: Path) -> None:
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import ArrayObject, DecodedStreamObject, DictionaryObject, NameObject

    writer = PdfWriter()
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    font_id = writer._add_object(font)
    rows = [
        [(TITLE, 24, 80, 620)],
        [(TITLE, 24, 80, 620)],
        [("More books from Example Press", 18, 80, 620)],
        [
            (TITLE, 24, 80, 620),
            ("An exploration of walks", 12, 80, 560),
            ("Ada Walker", 12, 80, 520),
        ],
    ]
    for page_rows in rows:
        page = writer.add_blank_page(width=450, height=700)
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_id})}
        )
        stream = DecodedStreamObject()
        stream.set_data(
            "\n".join(
                f"BT /F1 {size} Tf {x} {y} Td ({text}) Tj ET" for text, size, x, y in page_rows
            ).encode()
        )
        page[NameObject("/Contents")] = writer._add_object(stream)
    source = PdfReader(Path(__file__).parent / "fixtures" / "unnumbered-chapters.pdf")
    for index, page in enumerate(source.pages):
        copied = writer.add_page(page)
        if index:
            prose = DecodedStreamObject()
            prose.set_data(
                "\n".join(
                    f"BT /F1 12 Tf 50 {440 - row * 18} Td "
                    "(The reader walks beside the water and sees the quiet trees.) Tj ET"
                    for row in range(10)
                ).encode()
            )
            copied[NameObject("/Contents")] = ArrayObject(
                [copied.raw_get("/Contents"), writer._add_object(prose)]
            )
    for label, index in [
        ("Cover", 0),
        ("Half title", 1),
        ("Title: " + TITLE, 3),
        ("Contents", 4),
        ("The Harbour", 5),
        ("The Orchard", 6),
    ]:
        writer.add_outline_item(label, index)
    writer.write(path)


def authored_frontmatter_receipts(tasks, *, selected=True):
    from ava_pdf_epub.reconstruction_v2.printed_title_v2_contract import FrontmatterTitleTask
    from ava_pdf_epub.reconstruction_v2.refinement_contract import (
        BookRefinementResponse,
        BookRefinementTask,
    )

    responses = []
    for task in tasks:
        if isinstance(task, FrontmatterTitleTask):
            responses.append(frontmatter_response(task, "p4-line0" if selected else None))
            continue
        assert isinstance(task, BookRefinementTask)
        decisions = []
        for ident in task.metadata_ids:
            node = next(n for n in task.nodes if n.id == ident)
            role = "author" if node.text_excerpt == "Ada Walker" else None
            decisions.append(
                dict(
                    node_id=ident,
                    text_sha256=node.text_sha256,
                    role=role,
                    start=0 if role else None,
                    end=len(node.text_excerpt) if role else None,
                    evidence_ids=[
                        c.id for c in task.crops if c.node_id == ident and c.part == "head"
                    ],
                )
            )
        responses.append(
            BookRefinementResponse(
                schema_version="ava-book-refinement-response-3",
                task_id=task.task_id,
                source_sha256=task.source_sha256,
                observation_sha256=task.observation_sha256,
                image_sha256=task.image.sha256,
                decisions=[],
                joins=[],
                unresolved=[],
                metadata_decisions=decisions,
            )
        )
    return responses
