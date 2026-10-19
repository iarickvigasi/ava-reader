"""A complete numbered source heading can link elsewhere without becoming its target."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.ocr_glyph_map import prove_glyph_map

from .heading_caller_fixture import fixture


class HeadingCallerTests(unittest.TestCase):
    def test_original_backlink_with_or_without_subtitle_keeps_exact_text_styles_and_target(self):
        for subtitle in (False, True):
            with self.subTest(subtitle=subtitle), tempfile.TemporaryDirectory() as directory:
                f = fixture(Path(directory), subtitle=subtitle)
                self.addCleanup(f.heading.reader.close)
                before = (
                    f.heading.page.model_dump_json(),
                    [o.model_dump_json() for o in f.heading.owners],
                    f.target,
                )
                expected = [(o.id, 0, len(o.text)) for o in f.heading.owners if o.kind == "heading"]
                self.assertEqual(expected, f.prove())
                self.assertEqual(2, f.target.page)
                self.assertEqual(
                    before,
                    (
                        f.heading.page.model_dump_json(),
                        [o.model_dump_json() for o in f.heading.owners],
                        f.target,
                    ),
                )
                self.assertIsNone(
                    prove_glyph_map(f.heading.page, f.heading.owners[0], f.heading.owners, POLICY)
                )
                with patch(
                    "ava_pdf_epub.reconstruction_v2.corroborated_caller_ranges.ocr_layout_caller",
                    return_value=None,
                ):
                    with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                        f.prove()

    def test_missing_source_outline_and_ambiguous_or_unsupported_heading_still_refuse(self):
        from pypdf.generic import NameObject

        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            self.addCleanup(f.heading.reader.close)
            for update in (
                {"text": "5 Changed title"},
                {"heading_level": 2},
                {"chapter_start": False},
                {"chapter_role": "backmatter"},
            ):
                with (
                    self.subTest(update=update),
                    self.assertRaisesRegex(ValueError, "TEXT_MAPPING"),
                ):
                    f.prove(
                        owners=[
                            f.heading.owners[0].model_copy(update=update),
                            *f.heading.owners[1:],
                        ]
                    )
            del f.heading.reader.trailer["/Root"][NameObject("/Outlines")]
            with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                f.prove()
