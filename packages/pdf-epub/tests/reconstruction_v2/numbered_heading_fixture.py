"""Authored separated chapter ordinal/title and optional source subtitle."""

from dataclasses import dataclass

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject

from ava_pdf_epub.pdf_navigation import pdf_navigation
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.pdf_link_target import page_target

from .test_ocr_link_context import line
from .test_pdf_links import box, observation, segment


@dataclass
class HeadingFixture:
    source: object
    reader: object
    page: object
    owners: list
    target: object

    def resolve(self, *, page=None, owners=None, target=None):
        return page_target(
            target or self.target,
            self.owners if owners is None else owners,
            self.reader,
            page or self.page,
            source_continuation_policy=POLICY,
        )


def fixture(root, *, subtitle=True):
    source = root / "chapter.pdf"
    writer = PdfWriter()
    for _ in range(2):
        writer.add_blank_page(width=120, height=100)
    title = "5 Rivers and roads at dusk -" + (" quiet bridges" if subtitle else "")
    writer.add_outline_item(title, 0)
    writer.add_annotation(
        1,
        DictionaryObject(
            {
                NameObject("/Subtype"): NameObject("/Link"),
                NameObject("/Rect"): ArrayObject([NumberObject(x) for x in (0, 0, 20, 10)]),
                NameObject("/A"): DictionaryObject(
                    {
                        NameObject("/S"): NameObject("/GoTo"),
                        NameObject("/D"): ArrayObject(
                            [
                                writer.pages[0].indirect_reference,
                                NameObject("/XYZ"),
                                NumberObject(-10),
                                NumberObject(105),
                                NumberObject(0),
                            ]
                        ),
                    }
                ),
            }
        ),
    )
    writer.write(source)
    lines = [
        line("ordinal", "5", 4, 10),
        line("title", "Rivers and roads", 20, 10),
        line("continued", "at dusk –", 20, 22),
    ]
    lines = [
        item.model_copy(update={"style": item.style.model_copy(update={"bold": True})})
        for item in lines
    ]
    owners = [
        segment("chapter", "5 Rivers and roads\nat dusk –", 1).model_copy(
            update={"box": box(4, 10, 84, 32)}
        )
    ]
    if subtitle:
        sub = line("subtitle", "quiet bridges", 28, 36)
        sub = sub.model_copy(
            update={
                "glyphs": [g.model_copy(update={"size": 10, "font": "italic"}) for g in sub.glyphs]
            }
        )
        lines.append(sub)
        owners.append(segment("subtitle", "quiet bridges", 2).model_copy(update={"box": sub.box}))
    tail = line("body", "Reading continues.", 4, 65)
    lines.append(tail)
    owners.append(segment("body", tail.text).model_copy(update={"box": tail.box}))
    page = observation().model_copy(update={"width_pt": 120, "render_width": 120, "lines": lines})
    reader = PdfReader(source)
    target = pdf_navigation(reader, reader.pages[1]["/Annots"][0].get_object())
    return HeadingFixture(source, reader, page, owners, target)
