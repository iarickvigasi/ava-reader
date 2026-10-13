"""All offset carriers use the same deletion map; cross-page integration remains separate."""

import unittest

from ava_pdf_epub.contracts.offsets import codepoint_to_utf16
from ava_pdf_epub.reconstruction_v2.layout_hyphen_normalization import normalize_layout_hyphens
from ava_pdf_epub.reconstruction_v2.layout_hyphen_offsets import (
    layout_hyphen_offset,
    layout_hyphen_range,
)

from .layout_hyphen_fixtures import PDF_SHA, authored_hyphens


class LayoutHyphenOffsetTests(unittest.TestCase):
    def test_unicode_crlf_and_multiple_reference_carriers_map_together(self):
        source = "😀 é possess- \r\n  ing¹ gym-lovers"
        candidates, decisions = authored_hyphens(source, [(0, "layout")])
        result = normalize_layout_hyphens(source, PDF_SHA, candidates, decisions)
        self.assertEqual("😀 é possessing¹ gym-lovers", result.text)
        start, end = source.index("possess"), source.index("¹")
        for carrier in ("style", "link", "note", "source-feature"):
            with self.subTest(carrier=carrier):
                a, b = layout_hyphen_range(
                    start, end, result.removals, len(source), referenced=carrier != "style"
                )
                self.assertEqual("possessing", result.text[a:b])
        note = layout_hyphen_offset(source.index("¹"), result.removals, len(source))
        self.assertEqual("¹", result.text[note])
        self.assertEqual(note + 1, codepoint_to_utf16(result.text)[note])
        for offset in (0, source.index("possess"), source.index("ing"), len(source)):
            self.assertEqual(
                layout_hyphen_offset(offset, result.removals, len(source)),
                result.normalization.source_boundary(offset),
            )

    def test_collapsed_reference_refuses_but_layout_only_style_can_drop(self):
        source = "possess-\ning"
        candidates, decisions = authored_hyphens(source, [(0, "layout")])
        result = normalize_layout_hyphens(source, PDF_SHA, candidates, decisions)
        first, last = result.removals[0]
        with self.assertRaisesRegex(ValueError, "referenced"):
            layout_hyphen_range(first, last, result.removals, len(source), referenced=True)
        self.assertEqual(
            (first, first),
            layout_hyphen_range(first, last, result.removals, len(source), referenced=False),
        )

    def test_cross_page_right_start_is_exact_midword_without_text_search(self):
        source = "😀 possess-\ning desir-\nable"
        candidates, decisions = authored_hyphens(
            source, [(0, "layout"), (1, "layout")], pages={0: 1, 1: 2, 2: 3}
        )
        result = normalize_layout_hyphens(source, PDF_SHA, candidates, decisions)
        self.assertEqual("😀 possessing desirable", result.text)
        page2 = layout_hyphen_offset(candidates[0].right.source_start, result.removals, len(source))
        page3 = layout_hyphen_offset(candidates[1].right.source_start, result.removals, len(source))
        self.assertEqual("ing", result.text[page2 : page2 + 3])
        self.assertEqual("able", result.text[page3 : page3 + 4])
        self.assertEqual(page2, result.normalization.source_boundary(candidates[0].source_end))
        self.assertEqual(page3, result.normalization.source_boundary(candidates[1].source_end))
        # Flatten source-coordinate aliases first, then transform once. Offsets
        # relative to page2 cannot be shifted with the global deletion map.
        raw_page2 = candidates[0].right.source_start
        page3_alias_delta = candidates[1].right.source_start - raw_page2
        self.assertEqual(
            page3, layout_hyphen_offset(raw_page2 + page3_alias_delta, result.removals, len(source))
        )
        self.assertNotEqual(
            source[: candidates[0].left.source_end], result.text[: candidates[0].left.source_end]
        )

    def test_offsets_refuse_foreign_bounds_and_overlapping_ranges(self):
        for value, ranges in (
            (True, [(1, 2)]),
            (11, [(1, 2)]),
            (5, [(2, 5), (4, 6)]),
            (5, [(5, 4)]),
            (5, [(True, 4)]),
        ):
            with self.subTest(value=value, ranges=ranges), self.assertRaises(ValueError):
                layout_hyphen_offset(value, ranges, 10)
