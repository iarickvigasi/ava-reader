"""Real parsed source, an OCR paragraph and an exact independently styled URL span."""

from dataclasses import dataclass

from pypdf import PdfReader

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.annotation_regions import upright_box
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.geometry import union
from ava_pdf_epub.reconstruction_v2.native_layout_policy import NATIVE_LAYOUT_POLICY
from ava_pdf_epub.reconstruction_v2.pdf_link_page import LinkPage
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_from_source
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan, Segment
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from ava_pdf_epub.reconstruction_v2.source_preparation import SourcePreparation

from .uri_pdf_fixture import uri_pdf


@dataclass
class UriFixture:
    source: object
    checkpoint: object
    reader: object
    owners: list
    context: object
    state: object
    start: int
    end: int

    def annotation(self, index):
        annotation = self.reader.pages[0]["/Annots"][index].get_object()
        return annotation, upright_box(
            self.reader.pages[0], [float(v) for v in annotation["/Rect"]]
        )


def fixture(root, *, raw="www.example.test/chapter.htm", url=None, cross_gutter=False):
    source = root / "source.pdf"
    first, last = uri_pdf(source, raw=raw, cross_gutter=cross_gutter)
    with SourcePreparation(
        source,
        root / "scratch",
        BILINGUAL_PROFILE,
        source_feature_policy=FEATURE_POLICY,
        source_layout_policy=NATIVE_LAYOUT_POLICY,
    ) as preparation:
        checkpoint = prepare_from_source(preparation, 1)
    text = (
        "An unrelated paragraph belongs to the ordinary surrounding prose. Visit "
        + first
        + "\n"
        + last
    )
    start = text.index(first)
    end = len(text)
    text += ". Reading continues here."
    owner = Segment(
        id="visual",
        page=1,
        method="ocr",
        kind="paragraph",
        text=text,
        box=union([row.box for row in checkpoint.observation.lines]),
        spans=[
            ObservedSpan(
                start=start, end=end, url=url or "http://" + raw, style=Style(id="em", italic=True)
            )
        ],
    )
    reader = PdfReader(source, strict=True)
    state = AssemblyState(source_continuation_policy=POLICY)
    return UriFixture(
        source, checkpoint, reader, [owner], LinkPage(checkpoint, [owner]), state, start, end
    )
