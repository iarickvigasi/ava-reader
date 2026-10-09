"""Reuse counts follow real verified caches, while tampering retains its original refusal."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from admission.appearance_fixture import annotated_document
from admission.helpers import save

from ava_pdf_epub.annotation_view import annotation_view
from ava_pdf_epub.reconstruction_v2.page_checkpoints import PageCheckpoints

from .test_ocr_font_faces import checkpoint
from .test_pdf_links import observation
from .test_worker_observation import emitted
from .worker_observation_fixture import observation_context


class WorkerCacheObservationTests(unittest.TestCase):
    def test_checkpoint_decode_hits_still_reverify_bytes_and_geometry_is_not_decode_reuse(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            collector = observation_context(root)
            try:
                stored = PageCheckpoints(root)
                stored.append(checkpoint(observation()))
                stored[0]
                stored[0]
                stored.geometry(0)
                self.assertEqual(dict(hits=1, misses=1), collector.reuse["checkpoint_decode"])
                file = root / "page-0001.json"
                file.write_bytes(
                    file.read_bytes().replace(
                        b'"source_byte_length":100', b'"source_byte_length":101'
                    )
                )
                with self.assertRaisesRegex(ValueError, "identity changed"):
                    stored[0]
                self.assertEqual(dict(hits=1, misses=1), collector.reuse["checkpoint_decode"])
            finally:
                emitted(collector)

    def test_annotation_view_hits_are_actual_source_policy_and_output_bound_reuse(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = save(annotated_document("/Text"), directory)
            collector = observation_context(root, source.read_bytes())
            try:
                first = annotation_view(source, root)
                with patch(
                    "ava_pdf_epub.annotation_view.PdfReader", side_effect=AssertionError("parse")
                ):
                    self.assertEqual(first, annotation_view(source, root))
                self.assertEqual(dict(hits=1, misses=1), collector.reuse["annotation_view"])
                first.write_bytes(b"tampered")
                with self.assertRaisesRegex(ValueError, "PDF_ANNOTATION_VIEW_CACHE_INVALID"):
                    annotation_view(source, root)
                self.assertEqual(dict(hits=1, misses=1), collector.reuse["annotation_view"])
            finally:
                emitted(collector)
