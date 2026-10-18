"""An authored destination has unrelated hidden source ink elsewhere on its page."""

from dataclasses import dataclass

from pypdf import PdfReader, PdfWriter

from ava_pdf_epub.pdf_navigation import NavigationTarget
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.pdf_links import page_target

from .ocr_glyph_fixture import columns
from .test_ocr_link_context import line


@dataclass
class VisibleTargetFixture:
    reader: object
    page: object
    owners: list
    target: object

    def prove(self, *, page=None, owners=None, policy=POLICY):
        return page_target(
            self.target,
            self.owners if owners is None else owners,
            self.reader,
            page or self.page,
            source_continuation_policy=policy,
        )


def fixture(root):
    source = root / "source.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.write(source)
    page, owners = columns()
    hidden = line("hidden", "*", 0, 70)
    hidden.glyphs[0] = hidden.glyphs[0].model_copy(update={"visible": False})
    page = page.model_copy(
        update={"risks": ["glyph_without_visible_ink"], "lines": [*page.lines, hidden]}
    )
    return VisibleTargetFixture(
        PdfReader(source), page, owners, NavigationTarget(page=1, left=0, top=80)
    )
