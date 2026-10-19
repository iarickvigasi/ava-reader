"""The public preparation path qualifies new text before source maps and task identities."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.native_layout_policy import NATIVE_LAYOUT_POLICY
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_from_source
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from ava_pdf_epub.reconstruction_v2.source_preparation import SourcePreparation

from .spacing_pdf_fixture import spacing_pdf


class SpacingPreparationTests(unittest.TestCase):
    def test_current_policy_corrects_while_historical_observation_stays_fixed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.pdf"
            spacing_pdf(source)
            results = []
            for current in [False, True]:
                scratch = root / str(current)
                scratch.mkdir()
                with SourcePreparation(
                    source,
                    scratch,
                    BILINGUAL_PROFILE,
                    source_feature_policy=FEATURE_POLICY,
                    source_layout_policy=NATIVE_LAYOUT_POLICY if current else None,
                ) as prep:
                    results.append(prepare_from_source(prep, 1))
                    prep.verify_inputs()
            old, new = results
            self.assertIn("AlphaBeta", old.observation.lines[0].text)
            self.assertIn("Alpha Beta", new.observation.lines[0].text)
            self.assertEqual(new.observation.lines[0].inserted_space_offsets, [5])
            self.assertEqual(old.observation.lines[0].glyphs, new.observation.lines[0].glyphs)
            self.assertFalse(new.tasks)
            self.assertTrue(new.native_line_maps)
            self.assertEqual(new.native_segments[0].text, new.observation.lines[0].text)

    def test_physical_state_refusal_keeps_existing_ocr_route(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "rotated.pdf"
            spacing_pdf(source, matrix="1 0.2 0 1")
            with SourcePreparation(
                source,
                root,
                BILINGUAL_PROFILE,
                source_feature_policy=FEATURE_POLICY,
                source_layout_policy=NATIVE_LAYOUT_POLICY,
            ) as prep:
                page = prepare_from_source(prep, 1)
            self.assertFalse(any(line.inserted_space_offsets for line in page.observation.lines))
            self.assertTrue(page.tasks)

    def test_malformed_second_decoder_unicode_routes_to_recognition(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.pdf"
            spacing_pdf(source)
            with SourcePreparation(
                source,
                root,
                BILINGUAL_PROFILE,
                source_feature_policy=FEATURE_POLICY,
                source_layout_policy=NATIVE_LAYOUT_POLICY,
            ) as prep:
                with patch(
                    "ava_pdf_epub.reconstruction_v2.spacing_page.spacing_proposals",
                    side_effect=UnicodeDecodeError("utf-16", b"x", 0, 1, "malformed"),
                ):
                    page = prepare_from_source(prep, 1)
            self.assertIn("native_spacing_unavailable", page.observation.risks)
            self.assertTrue(page.tasks)
            self.assertFalse(page.observation.lines[0].inserted_space_offsets)
