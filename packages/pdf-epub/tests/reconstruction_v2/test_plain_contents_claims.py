"""Unchanged plain/multiline OCR rows have exact unique independent source corroboration."""

import unittest

from ava_pdf_epub.reconstruction_v2.plain_contents_claims import plain_contents_claims
from ava_pdf_epub.reconstruction_v2.structure_claims import StructureClaim

from .metadata_helpers import heading, metadata_state, paragraph


class PlainContentsTests(unittest.TestCase):
    def test_multiline_and_roman_rows_retain_exact_source_ranges(self):
        state = metadata_state(
            [
                heading("Contents", page=6),
                paragraph("Preface vii", page=6, method="ocr"),
                paragraph("1. The Harbour and\nthe Orchard 1", page=6, method="ocr"),
            ]
        )
        outline = [
            StructureClaim("Preface", None, pdf_page=8),
            StructureClaim("1. The Harbour and the Orchard", None, pdf_page=10),
        ]
        claims = plain_contents_claims(list(state.segments.values()), outline, {"vii": 8, "1": 10})
        self.assertEqual(2, len(claims))
        self.assertEqual("1. The Harbour and\nthe Orchard", claims[1].title)
        self.assertEqual(0, claims[1].source_offset)
        self.assertEqual("vii", claims[0].printed_page)
        for claim in claims:
            text = state.segments[claim.source_id].text
            self.assertEqual(
                claim.title, text[claim.source_offset : claim.source_offset + len(claim.title)]
            )

    def test_duplicate_outline_conflicting_destination_or_missing_folio_refuses(self):
        state = metadata_state([heading("Contents", page=1), paragraph("Harbour 2", method="ocr")])
        segments = list(state.segments.values())
        good = StructureClaim("Harbour", None, pdf_page=2)
        for outline, folios in [
            ([good, good], {"2": 2}),
            ([good], {"2": 3}),
            ([good], {}),
            ([StructureClaim("Different", None, pdf_page=2)], {"2": 2}),
        ]:
            with self.assertRaisesRegex(ValueError, "unique exact"):
                plain_contents_claims(segments, outline, folios)
        with self.assertRaisesRegex(ValueError, "Repeated"):
            plain_contents_claims(segments + [segments[1]], [good], {"2": 2})

    def test_dotted_native_and_body_rows_remain_outside_new_plain_path(self):
        state = metadata_state(
            [
                heading("Contents", page=1),
                paragraph("Harbour .... 2", method="ocr"),
                paragraph("Harbour 2"),
                heading("Harbour", page=2, chapter_start=True, chapter_role="bodymatter"),
                paragraph("Narrative year 2024", page=2, method="ocr"),
            ]
        )
        self.assertEqual([], plain_contents_claims(list(state.segments.values()), [], {}))

    def test_dash_alias_comparison_retains_both_labels_and_rejects_math_minus(self):
        from ava_pdf_epub.reconstruction_v2.navigation_alias_key import dash_alias_offsets

        state = metadata_state(
            [heading("Contents", page=1), paragraph("Harbour – Orchard 2", method="ocr")]
        )
        outline = [StructureClaim("Harbour - Orchard", None, pdf_page=2)]
        claims = plain_contents_claims(list(state.segments.values()), outline, {"2": 2})
        self.assertEqual("Harbour – Orchard", claims[0].title)
        self.assertEqual("Harbour - Orchard", outline[0].title)
        self.assertEqual([8], dash_alias_offsets(claims[0].title, outline[0].title))
        for other in ["Harbour − Orchard", "Harbour: Orchard"]:
            with self.assertRaisesRegex(ValueError, "unique exact"):
                plain_contents_claims(
                    list(state.segments.values()),
                    [StructureClaim(other, None, pdf_page=2)],
                    {"2": 2},
                )

    def test_outline_proven_body_start_bounds_plain_rows_without_provisional_chapter_flag(self):
        state = metadata_state(
            [
                heading("Contents", page=1),
                paragraph("Harbour 2", method="ocr"),
                paragraph("Narrative ends in 2024", page=2, method="ocr"),
            ]
        )
        outline = [StructureClaim("Harbour", None, pdf_page=2)]
        claims = plain_contents_claims(list(state.segments.values()), outline, {"2": 2})
        self.assertEqual(["Harbour"], [claim.title for claim in claims])
