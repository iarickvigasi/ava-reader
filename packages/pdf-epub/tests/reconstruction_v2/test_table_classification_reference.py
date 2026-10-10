"""Qualified tables cannot distort body/heading roles when printer ink is excluded."""

import unittest

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE
from ava_pdf_epub.reconstruction_v2.classify_lines import classify_lines
from ava_pdf_epub.reconstruction_v2.observations import Glyph, NativeLine

from .test_pdf_links import observation


def line(ident, text, size, top):
    box = dict(coordinate_space="page_points_top_left", x0=20, y0=top, x1=80, y1=top + 8)
    return NativeLine(
        id=ident,
        text=text,
        box=box,
        glyphs=[Glyph(text=text, box=box, size=size, font="Serif", visible=True)],
        style=dict(id=ident, bold=False),
    )


class TableClassificationReferenceTests(unittest.TestCase):
    def classify(self, content, *, profile=BILINGUAL_PROFILE):
        table = [line(f"cell-{i}", "C1", 8, 50 + i) for i in range(4)]
        graphic = line("graphic-label", "tiny", 4, 80)
        page = observation().model_copy(update={"lines": [*content, *table, graphic]})
        ids = {s.id for s in table}
        return {s.id: s.kind for s in classify_lines(page, ids | {graphic.id}, set(), profile, ids)}

    def test_title_caption_roles_and_legacy_default_are_distinct(self):
        content = [line("title", "Table Notebook", 20, 4), line("caption", "Table 1.", 10, 20)]
        self.assertEqual({"title": "heading", "caption": "caption"}, self.classify(content))
        self.assertEqual(
            {"title": "paragraph", "caption": "caption"},
            self.classify(content, profile=LEGACY_PROFILE),
        )

    def test_table_only_and_lone_centered_title_use_qualified_cell_size(self):
        self.assertEqual({}, self.classify([]))
        self.assertEqual(
            {"title": "heading"}, self.classify([line("title", "Table Notebook", 20, 4)])
        )

    def test_ordinary_or_mixed_prose_is_not_promoted_by_smaller_table_or_graphic_ink(self):
        body = line("body", "These values stay in ordinary prose.", 11, 30)
        self.assertEqual({"body": "paragraph"}, self.classify([body]))
        title = line("title", "Table Notebook", 20, 4)
        caption = line("caption", "Table 1.", 10, 20)
        self.assertEqual(
            {"title": "heading", "caption": "caption", "body": "paragraph"},
            self.classify([title, caption, body]),
        )
