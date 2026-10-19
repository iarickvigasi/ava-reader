"""Authored paragraph and literal margins, independent of recovery implementation."""

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.recover_native_indents import recover_native_indents

from .source_indent_fixture import line, page, segment


def paragraph(ident, margin=40, delta=20, top=20, number=1):
    rows = [line(ident + "-a", margin + delta, top), line(ident + "-b", margin, top + 15)]
    value = segment(ident, rows, Style(id=ident, align="start", bold=False, italic=False))
    return value.model_copy(update={"page": number}), rows


def single(ident="single", left=60, top=100, number=1):
    row = line(ident, left, top)
    value = segment(ident, [row], Style(id=ident, align="start", bold=False, italic=False))
    return value.model_copy(update={"page": number}), [row]


def recover(groups):
    segments = [s for s, _ in groups]
    checkpoints = []
    for number in sorted({s.page for s in segments}):
        rows = [row for s, lines in groups if s.page == number for row in lines]
        observation = page(rows).model_copy(update={"number": number})
        checkpoints.append(
            PreparedPage(
                schema_version="ava-prepared-page-1",
                source_sha256="a" * 64,
                source_byte_length=10,
                source_page_count=max(s.page for s in segments),
                observation=observation,
                tables=[],
                native_segments=[s for s in segments if s.page == number],
                tasks=[],
            )
        )
    state = AssemblyState()
    return recover_native_indents(segments, checkpoints, state), state
