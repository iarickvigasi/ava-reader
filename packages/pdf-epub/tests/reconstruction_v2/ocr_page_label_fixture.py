"""Adapt the independently source-labeled native fixture to one accepted OCR owner."""

from pypdf import PdfReader

from . import test_literal_page_label as fixture


def ocr_page_label_fixture(test):
    helper = fixture.LiteralPageLabelTests()
    test.addCleanup(helper.doCleanups)
    root, source, checkpoint, owner, caller, _ = helper.fixture()
    line = checkpoint.observation.lines[0]
    owner = owner.model_copy(
        update={"method": "ocr", "native_line_ids": [], "text": line.text, "box": line.box}
    )
    reader = PdfReader(source, strict=True)
    test.addCleanup(reader.close)
    annotation = reader.pages[0]["/Annots"][0].get_object()
    return root, source, checkpoint, owner, caller, reader, annotation
