"""A complete, same-owner compound chapter title with real outline/XYZ source authority."""

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject

from .numbered_heading_fixture import fixture as numbered_fixture
from .test_ocr_link_context import line
from .test_pdf_links import box


def fixture(root, *, printed="ﬁres and ﬂights", accepted="fires and flights"):
    f = numbered_fixture(root, subtitle=False)
    principal = line("title", printed, 20, 10)
    principal = principal.model_copy(
        update={"style": principal.style.model_copy(update={"bold": True})}
    )
    subtitle = line("subtitle", "with a ﬂea and a bandit", 28, 36)
    subtitle = subtitle.model_copy(
        update={
            "style": subtitle.style.model_copy(update={"bold": True, "italic": True}),
            "box": box(28, 36, 28 + len(subtitle.text) * 3, 44),
            "glyphs": [
                glyph.model_copy(
                    update={
                        "font": "subtitle",
                        "size": 8,
                        "box": box(28 + i * 3, 36, 31 + i * 3, 44),
                    }
                )
                for i, glyph in enumerate(subtitle.glyphs)
            ],
        }
    )
    f.page = f.page.model_copy(
        update={"lines": [f.page.lines[0], principal, f.page.lines[2], subtitle, f.page.lines[-1]]}
    )
    title = f"5  {accepted}\nat dusk –\nwith a flea and a bandit"
    f.owners[0] = f.owners[0].model_copy(update={"text": title, "box": box(4, 10, 110, 44)})
    writer = PdfWriter(clone_from=f.source)
    writer._root_object["/Outlines"]["/First"][NameObject("/Title")] = TextStringObject(
        title.replace("–", "-")
    )
    writer.write(f.source)
    f.reader = PdfReader(f.source)
    return f


def move_line(item, dx=0, dy=0):
    def moved(value):
        return value.model_copy(
            update={
                "x0": value.x0 + dx,
                "x1": value.x1 + dx,
                "y0": value.y0 + dy,
                "y1": value.y1 + dy,
            }
        )

    return item.model_copy(
        update={
            "box": moved(item.box),
            "glyphs": [g.model_copy(update={"box": moved(g.box)}) for g in item.glyphs],
        }
    )
