"""Bounded source number resolution preserves exact text, styles and export positions."""

import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assemble_blocks import assemble_blocks
from ava_pdf_epub.reconstruction_v2.assemble_chapters import assemble_chapters
from ava_pdf_epub.reconstruction_v2.bind_printed_targets import bind_printed_targets
from ava_pdf_epub.reconstruction_v2.internal_links import internal_links

from .chapter_reference_fixture import fixture


class PrintedChapterReferenceTests(unittest.TestCase):
    def test_literal_number_uses_original_compound_with_both_source_routes(self):
        for alias in [True, False]:
            with self.subTest(alias=alias):
                items, state = fixture(alias=alias)
                before = [s.model_dump_json() for s in items]
                result = bind_printed_targets(items, state)
                self.assertEqual(before, [s.model_dump_json() for s in items])
                self.assertEqual(items[1].text, result[1].text)
                self.assertEqual(items[1].spans[0].style, result[1].spans[0].style)
                self.assertIsNone(result[1].spans[0].target_text)
                self.assertEqual(("caller", 15, 24, "number", 0), state.internal_targets[-1])
                state.segments.update({s.id: s for s in result})
                assemble_blocks(result, [], Path("."), state)
                chapters, toc = assemble_chapters(state)
                internal_links(state, {"number": chapters[0]["id"], "caller": chapters[0]["id"]})
                link = state.blocks[1]["content"]["spans"][-1]
                self.assertEqual((15, 24), (link["start"], link["end"]))
                offsets = state.blocks[1]["content"]["codepoint_utf16"]
                self.assertEqual((16, 25), (offsets[15], offsets[24]))
                self.assertEqual(("number", 0), (link["link"]["block_id"], link["link"]["offset"]))
                self.assertEqual(items[0].text, toc[0]["label"])

    def test_nonfirst_explicit_number_is_not_inferred_from_position(self):
        items, state = fixture("See Chapter 7.", number="7")
        result = bind_printed_targets(items, state)
        self.assertEqual("7\nAn opening – subtitle", result[0].text)
        self.assertEqual(("number", 0), state.internal_targets[-1][3:])

    def test_first_pass_remains_deferred_until_source_structure(self):
        items, state = fixture()
        state.source_outline_aliases.clear()
        result = bind_printed_targets(items, state, defer_missing=True)
        self.assertEqual(items, result)
        self.assertEqual([], state.internal_targets)
        with self.assertRaisesRegex(ValueError, "missing or ambiguous"):
            bind_printed_targets(result, state)
