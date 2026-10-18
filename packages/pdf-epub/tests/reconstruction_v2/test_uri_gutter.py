"""A right-column suffix cannot wrap into a different physical source column."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.pdf_navigation import pdf_navigation
from ava_pdf_epub.reconstruction_v2.source_gutters import crosses_source_gutter
from ava_pdf_epub.reconstruction_v2.source_uri_caller import source_uri_caller
from ava_pdf_epub.reconstruction_v2.uri_original_group import uri_original_group
from ava_pdf_epub.reconstruction_v2.uri_source_parts import uri_source_parts

from .uri_caller_fixture import fixture


class UriGutterTests(unittest.TestCase):
    def test_positive_original_column_evidence_vetoes_a_false_uri_wrap(self):
        with tempfile.TemporaryDirectory() as d:
            f = fixture(Path(d), cross_gutter=True)
            self.addCleanup(f.reader.close)
            annotation, caller = f.annotation(0)
            target = pdf_navigation(f.reader, annotation)
            group = uri_original_group(
                f.reader, target, annotation, f.checkpoint.observation, caller
            )
            parts = uri_source_parts(f.checkpoint.observation, group)
            self.assertTrue(
                crosses_source_gutter(
                    f.checkpoint.observation, [(part.line, list(part.values)) for part in parts]
                )
            )
            self.assertIsNone(
                source_uri_caller(f.reader, target, annotation, caller, f.context, f.state)
            )
            self.assertIsNone(f.state.pending_uri_link)
            with patch(
                "ava_pdf_epub.reconstruction_v2.source_uri_caller.crosses_source_gutter",
                return_value=False,
            ):
                self.assertIsNotNone(
                    source_uri_caller(f.reader, target, annotation, caller, f.context, f.state)
                )
            f.state.release_observations()
