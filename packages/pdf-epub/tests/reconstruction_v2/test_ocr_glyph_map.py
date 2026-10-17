"""Exact physical entry ownership supports whitespace changes, never text repair."""

import unittest

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.ocr_glyph_map import prove_glyph_map
from ava_pdf_epub.reconstruction_v2.ocr_glyph_ranges import ocr_glyph_ranges

from .ocr_glyph_fixture import columns
from .test_pdf_links import box


class OcrGlyphMapTests(unittest.TestCase):
    def test_joined_source_row_preserves_two_column_owners_and_repeated_text(self):
        page, owners = columns()
        original = [o.model_dump() for o in owners]
        for item in owners:
            proof = prove_glyph_map(page, item, owners, POLICY)
            self.assertIsNotNone(proof)
            self.assertEqual(
                [(item.id, 7, 9)],
                ocr_glyph_ranges(
                    page, owners, box(item.box.x0 + 20, 20, item.box.x0 + 28, 30), POLICY
                ),
            )
        self.assertEqual(original, [o.model_dump() for o in owners])
        self.assertTrue(all(not o.native_line_ids and o.method == "ocr" for o in owners))

    def test_all_accepted_whitespace_is_immutable_and_offsets_follow_it(self):
        page, owners = columns()
        for text in ("noend54,", "no end 54,", "no\nend\t54,", "  no  end\n 54,  "):
            item = owners[0].model_copy(update={"text": text})
            proof = prove_glyph_map(page, item, [item, owners[1]], POLICY)
            self.assertIsNotNone(proof)
            start = text.index("54")
            self.assertEqual(
                [(item.id, start, start + 2)],
                ocr_glyph_ranges(page, [item, owners[1]], box(20, 20, 28, 30), POLICY),
            )

    def test_policy_or_routing_marker_alone_never_supplies_authority(self):
        page, owners = columns()
        for policy in (None, "ava-source-continuation-presentation-0"):
            self.assertIsNone(prove_glyph_map(page, owners[0], owners, policy))
        for risk in (
            "unreliable_glyph_mapping",
            "optional_content",
            "conditional_visibility",
            "clipped_glyph",
            "complex_graphics_state",
            "unknown",
            "nonstandard_text_rendering",
        ):
            current = page.model_copy(update={"risks": ["native_index_layout", risk]})
            self.assertIsNone(prove_glyph_map(current, owners[0], owners, POLICY))

    def test_omitted_changed_extra_or_normalized_characters_cannot_match(self):
        page, owners = columns()
        for text in ("no end54", "NOend54,", "noend55,", "noend54,!", "noendﬁ4,"):
            item = owners[0].model_copy(update={"text": text})
            self.assertIsNone(prove_glyph_map(page, item, [item, owners[1]], POLICY))
