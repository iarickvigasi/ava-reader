"""A visible source apostrophe has the same scalar width as its observed ASCII substitute."""

from .test_ocr_link_context import line
from .test_pdf_links import observation
from .test_refinement_grouping import segment


def quoted(source="😀 we’re", observed="😀 we're"):
    native = line("quoted", source, 0, 20)
    page = observation().model_copy(update={"lines": [native]})
    owner = segment("quote-owner", observed).model_copy(update={"box": native.box})
    return page, owner
