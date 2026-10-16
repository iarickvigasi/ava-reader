"""A compound title must not project unremovable ancestor decorations."""

import unittest

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.compound_heading_style_update import compound_style_update

from .test_compound_headings import claim, heading, resolve


class CompoundDecorationTests(unittest.TestCase):
    def test_initial_decorated_base_requires_review(self):
        for field in ("underline", "strike_through"):
            with self.subTest(field=field):
                items = [
                    heading("number", "1", style=Style(id="first", **{field: True})),
                    heading("title", "Opening", 40, style=Style(id="next", **{field: False})),
                ]
                with self.assertRaisesRegex(ValueError, "block decoration requires source review"):
                    resolve(items, [claim("1 Opening")])

    def test_later_base_decoration_also_requires_review(self):
        for field in ("underline", "strike_through"):
            with self.subTest(field=field):
                items = [
                    heading("number", "1", style=Style(id="first", **{field: False})),
                    heading("title", "Opening", 40, style=Style(id="next", **{field: False})),
                ]
                result, _, state = resolve(items, [claim("1 Opening")])
                revised = result[0].model_copy(
                    update={"style": result[0].style.model_copy(update={field: True})}
                )
                with self.assertRaisesRegex(ValueError, "block decoration requires source review"):
                    compound_style_update(revised, state)

    def test_positive_component_decoration_on_neutral_base_stays_local(self):
        for field in ("underline", "strike_through"):
            with self.subTest(field=field):
                items = [
                    heading("number", "1", style=Style(id="first", **{field: False})),
                    heading("title", "Opening", 40, style=Style(id="next", **{field: True})),
                ]
                result, _, state = resolve(items, [claim("1 Opening")])
                for title in (result[0], compound_style_update(result[0], state)):
                    self.assertFalse(getattr(title.style, field))
                    self.assertEqual("1\nOpening", title.text)
                    self.assertEqual([(0, 1), (2, 9)], [(s.start, s.end) for s in title.spans])
                    self.assertFalse(getattr(title.spans[0].style, field))
                    self.assertTrue(getattr(title.spans[1].style, field))
