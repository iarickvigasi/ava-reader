"""Repeated contents numbers map only through exact complete visual/source context."""

import unittest

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.observations import Glyph, NativeLine, RequiredRegion
from ava_pdf_epub.reconstruction_v2.pdf_links import glyph_ranges

from .test_pdf_links import box, observation, segment


def line(ident, text, x, y):
    return NativeLine(
        id=ident,
        text=text,
        style=Style(id="source"),
        box=box(x, y, x + len(text) * 4, y + 10),
        glyphs=[
            Glyph(
                text=c,
                font="test",
                size=10,
                visible=True,
                box=box(x + i * 4, y, x + (i + 1) * 4, y + 10),
            )
            for i, c in enumerate(text)
        ],
    )


def fixture():
    lines = [
        line("first", "1 A title", 0, 20),
        line("next", "More", 10, 40),
        line("folio", "1", 80, 40),
    ]
    page = observation().model_copy(update={"lines": lines})
    owner = segment("visual", "1 A title\nMore 1").model_copy(update={"box": box(0, 20, 84, 50)})
    return page, owner


class OcrLinkContextTests(unittest.TestCase):
    def test_repeated_folio_maps_to_exact_last_character_without_native_ownership(self):
        page, owner = fixture()
        for separator in ("\n", " ", "\n\n"):
            item = owner.model_copy(update={"text": "1 A title" + separator + "More 1"})
            with self.subTest(separator=repr(separator)):
                self.assertEqual(
                    [(item.id, len(item.text) - 1, len(item.text))],
                    glyph_ranges(page, [item], box(80, 40, 84, 50), corroborate_ocr=True),
                )
                self.assertEqual(
                    [(item.id, 0, len(item.text))],
                    glyph_ranges(page, [item], box(0, 20, 84, 50), corroborate_ocr=True),
                )
                self.assertEqual([], item.native_line_ids)
                self.assertEqual("ocr", item.method)

    def test_context_cannot_rewrite_skip_reorder_or_ambiguously_own_words(self):
        page, owner = fixture()
        hidden = page.lines[0].model_copy(
            update={
                "glyphs": [g.model_copy(update={"visible": False}) for g in page.lines[0].glyphs]
            }
        )
        incomplete = page.lines[0].model_copy(update={"glyphs": page.lines[0].glyphs[1:]})
        displaced = line("intruder", "Extra", 0, 32)
        cases = [
            (page, [owner.model_copy(update={"text": text})])
            for text in (
                "1 A title\nMore 2",
                "1 A title!\nMore 1",
                "1 Atitle\nMore 1",
                "1 A  title\nMore 1",
                "1 A title\nMore 1 Extra",
                "1 A title\n1",
            )
        ]
        cases += [
            (page, [owner, owner.model_copy(update={"id": "duplicate"})]),
            (page.model_copy(update={"lines": [hidden, *page.lines[1:]]}), [owner]),
            (page.model_copy(update={"lines": [incomplete, *page.lines[1:]]}), [owner]),
            (page.model_copy(update={"lines": list(reversed(page.lines))}), [owner]),
            (page.model_copy(update={"lines": [*page.lines, displaced]}), [owner]),
            (
                page.model_copy(update={"lines": [page.lines[0], page.lines[0], *page.lines[1:]]}),
                [owner],
            ),
            (page.model_copy(update={"risks": ["unreliable_glyph_mapping"]}), [owner]),
            (
                page.model_copy(
                    update={"required_regions": [RequiredRegion(kind="text", box=box())]}
                ),
                [owner],
            ),
        ]
        for index, (observed, owners) in enumerate(cases):
            with self.subTest(case=index), self.assertRaises(ValueError):
                glyph_ranges(observed, owners, box(80, 40, 84, 50), corroborate_ocr=True)

    def test_context_does_not_relax_link_glyph_geometry(self):
        page, owner = fixture()
        for rectangle in (box(82, 40, 84, 50), box(85, 40, 89, 50)):
            with self.subTest(rectangle=rectangle), self.assertRaises(ValueError):
                glyph_ranges(page, [owner], rectangle, corroborate_ocr=True)
