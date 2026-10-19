"""Authored native line/source-owner fixtures; no PDF, provider or generated response needed."""

from collections.abc import Mapping, Sequence

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.layout_prefix_cut_v3 import PrefixCutReceipt
from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.observations import NativeLine
from ava_pdf_epub.reconstruction_v2.refinement_digest import observation_digest
from ava_pdf_epub.reconstruction_v2.segments import Segment
from ava_pdf_epub.reconstruction_v2.word_wrap_catalogue import prepare_word_wrap_catalogue
from ava_pdf_epub.reconstruction_v2.word_wrap_owners import catalogue_owners

from .word_wrap_fixture_pages import word_wrap_fixture_pages

SOURCE_SHA256 = "a" * 64


def authored_source(
    rows: Sequence[tuple[int, str]],
    *,
    role: str = "paragraph",
    prefixes: Mapping[int, str] | None = None,
    language: str = "en",
):
    lines, receipts = [], {}
    prefixes = prefixes or {}
    for index, (page, text) in enumerate(rows):
        box = Box(
            coordinate_space="page_points_top_left",
            x0=10,
            y0=10 + index * 2,
            x1=190,
            y1=11 + index * 2,
        )
        line = NativeLine(
            id=f"p{page}-l{index}", text=text, box=box, glyphs=[], style=Style(id="body")
        )
        lines.append(line)
        if index in prefixes:
            prefix = prefixes[index]
            marker = prefix.rstrip(" \t")
            receipts[line.id] = PrefixCutReceipt(
                line_id=line.id,
                raw_prefix=prefix,
                raw_prefix_sha256=text_digest(prefix),
                original_line_sha256=text_digest(text),
                role=role,
                label=marker.strip("[]()."),
                marker_text=marker,
            )
    original = "\n".join(line.text for line in lines)
    retained = "\n".join(
        line.text[len(prefixes.get(index, "")) :] for index, line in enumerate(lines)
    )
    values = dict(
        id="final-owner",
        page=rows[0][0],
        box=lines[0].box.model_dump(),
        kind=role,
        text=retained.replace("\n", " "),
        source_text=retained,
        style=Style(id="body").model_dump(),
        native_line_ids=[line.id for line in lines],
        method="native",
    )
    if role == "heading":
        values["heading_level"] = 2
    if role == "note":
        values.update(note_label="1", note_role="footnote")
    if role == "list_item":
        values.update(list_ordered=True, list_start=1, list_depth=1)
    segment = Segment.model_validate(values)
    pages, source_pages = word_wrap_fixture_pages(lines, sorted({page for page, _ in rows}))
    owners = catalogue_owners([segment], pages, source_pages, receipts, language)
    assert owners[0].original_text == original
    return owners, pages, segment, source_pages, receipts


def word_wrap_batch(count: int = 1):
    owners, pages, segment, _, _ = authored_source(
        [(1, "form-") for _ in range(count)] + [(1, "ation.")]
    )
    return prepare_word_wrap_catalogue(
        owners,
        pages,
        source_sha256=SOURCE_SHA256,
        profile_id="ava-pdf-prose-en-v2",
        observation_sha256=observation_digest([segment]),
    )
