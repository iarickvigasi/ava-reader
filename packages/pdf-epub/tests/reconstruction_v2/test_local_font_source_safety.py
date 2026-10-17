"""The regional mapping exception does not admit rotated, vertical, concealed or unknown paint."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import ArrayObject, BooleanObject, FloatObject, NameObject, NumberObject

from ava_pdf_epub.reconstruction_v2.font_region_safety import font_region_safe
from ava_pdf_epub.reconstruction_v2.font_source_safety import font_source_safe

from .local_font_fixture import observed, result, source


class LocalFontSourceSafetyTests(unittest.TestCase):
    def test_only_explicit_safe_raster_state_reuses_the_existing_finite_policy(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.pdf"
            safe = {NameObject("/SA"): BooleanObject(False), NameObject("/SM"): FloatObject(0.02)}
            source(path, state=safe)
            reader = PdfReader(path)
            page = reader.pages[0]
            observation = observed()
            self.assertFalse(font_source_safe(page, reader))
            self.assertTrue(font_source_safe(page, reader, allow_raster_settings=True))
            self.assertFalse(font_region_safe(page, reader, observation, [observation.lines[0]]))
            self.assertTrue(
                font_region_safe(
                    page, reader, observation, [observation.lines[0]], allow_raster_settings=True
                )
            )
            self.assertEqual(result(path, observation)[1][0].style.family, "sans-serif")
            for key, value in [
                ("/SA", BooleanObject(True)),
                ("/SM", FloatObject(1.1)),
                ("/ca", FloatObject(0.5)),
                ("/BM", NameObject("/Multiply")),
                ("/SMask", NameObject("/None")),
                ("/Unknown", NumberObject(1)),
            ]:
                with self.subTest(key=key):
                    source(path, state=safe | {NameObject(key): value})
                    before, got, state = result(path, observation)
                    self.assertEqual(before, got)
                    self.assertEqual(state.structure_findings, [])

    def test_direct_type1_source_refuses_other_writing_modes_transforms_and_font_matrices(self):
        prefixes = [
            b"BT 0 Tz ET",
            b"BT -100 Tz ET",
            b"BT /F1 -10 Tf ET",
            b"BT 0 1 -1 0 0 0 Tm ET",
            b"-1 0 0 1 0 0 cm",
            b"BT 3 Tr ET",
            b"0 0 2 2 re W n",
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.pdf"
            for prefix in prefixes:
                with self.subTest(prefix=prefix):
                    source(path, prefix)
                    before, got, state = result(path, observed())
                    self.assertEqual(before, got)
                    self.assertEqual(state.structure_findings, [])
            for subtype in ["/Type0", "/Type3", "/Unknown"]:
                with self.subTest(subtype=subtype):
                    source(path, subtype=subtype)
                    before, got, state = result(path, observed())
                    self.assertEqual(before, got)
                    self.assertEqual(state.structure_findings, [])
            source(path, matrix=ArrayObject([NumberObject(1)] * 6))
            before, got, _ = result(path, observed())
            self.assertEqual(before, got)
