"""Fresh authored PDF observations with one explicitly unknown OCR heading family."""

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.segments import Segment

from .test_compound_headings import workspace
from .test_native_literal import source_pdf


def fixture(root):
    source = root / "source.pdf"
    source_pdf(source, "quote", lines=["Known opening", "Visible subtitle"], body=[])
    prepared = prepare_page(source, root, 1)
    items = [
        Segment(
            id=f"owner-{i}",
            page=1,
            box=line.box,
            kind="heading",
            heading_level=1,
            text=line.text,
            method="ocr",
            style=Style(
                id="observed",
                family=None if i == 2 else "serif",
                bold=False,
                italic=False,
                relative_size=2,
            ),
        )
        for i, line in enumerate(prepared.observation.lines)
    ]
    assert [s.text for s in items] == ["Preface", "Known opening", "Visible subtitle"]
    state = workspace(items)
    state.source_continuation_policy = POLICY
    return source, prepared, items, state
