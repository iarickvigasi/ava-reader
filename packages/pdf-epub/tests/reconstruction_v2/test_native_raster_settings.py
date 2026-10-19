"""Shading accuracy is not text visibility; opacity, masks and clipping stay untrusted."""

import io
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import BooleanObject, FloatObject, NameObject, NumberObject, TextStringObject

from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from ava_pdf_epub.reconstruction_v2.visibility import display_risks
from ava_pdf_epub.reconstruction_v2.visibility_state import inert_graphics_state
from tests.admission.appearance_fixture import BODY
from tests.admission.helpers import save
from tests.reconstruction_v2.test_visibility_state import source_with_clip


def state(smoothness=0.02):
    return {NameObject("/SA"): BooleanObject(False), NameObject("/SM"): FloatObject(smoothness)}


def checked_risks(document):
    data = io.BytesIO()
    document.write(data)
    reader = PdfReader(data)
    return display_risks(
        reader.pages[0], reader, glyph_bounds=(20, 247, 290, 260), allow_raster_settings=True
    )


class NativeRasterSettings(unittest.TestCase):
    def test_real_source_shading_parameters_avoid_ocr_only_under_feature_policy(self):
        for smoothness in (0.002, 0.02):
            with self.subTest(smoothness=smoothness), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                source = save(source_with_clip(b"q /Safe gs ", state=state(smoothness)), directory)
                current, legacy = root / "current", root / "legacy"
                current.mkdir()
                legacy.mkdir()
                prepared = prepare_page(source, current, 1, source_feature_policy=FEATURE_POLICY)
                old = prepare_page(source, legacy, 1)
                self.assertEqual([], prepared.observation.risks)
                self.assertEqual([], prepared.tasks)
                self.assertEqual(BODY, prepared.native_segments[0].text)
                self.assertIn("conditional_visibility", old.observation.risks)
                self.assertEqual(1, len(old.tasks))
                self.assertEqual(prepared.source_sha256, old.source_sha256)
                self.assertEqual(prepared.observation.render_sha256, old.observation.render_sha256)

    def test_only_typed_finite_smoothness_and_disabled_stroke_adjustment_are_allowed(self):
        for value in (
            FloatObject(-0.01),
            FloatObject(1.01),
            FloatObject(float("nan")),
            FloatObject(float("inf")),
            TextStringObject("0.02"),
            BooleanObject(False),
        ):
            with self.subTest(value_type=type(value).__name__):
                values = state()
                values[NameObject("/SM")] = value
                self.assertFalse(
                    inert_graphics_state(
                        {"/ExtGState": {"/Safe": values}}, "/Safe", allow_raster_settings=True
                    )
                )
        for value in (BooleanObject(True), NumberObject(0), TextStringObject("false")):
            with self.subTest(value_type=type(value).__name__):
                values = state()
                values[NameObject("/SA")] = value
                self.assertFalse(
                    inert_graphics_state(
                        {"/ExtGState": {"/Safe": values}}, "/Safe", allow_raster_settings=True
                    )
                )

    def test_raster_settings_do_not_authorize_opacity_masks_transfer_or_unknown_state(self):
        for key, value in (
            ("/ca", FloatObject(0.5)),
            ("/CA", NumberObject(0)),
            ("/SMask", NameObject("/None")),
            ("/TR", NameObject("/Identity")),
            ("/BM", NameObject("/Multiply")),
            ("/Font", NameObject("/F1")),
        ):
            with self.subTest(key=key):
                values = state()
                values[NameObject(key)] = value
                self.assertIn(
                    "conditional_visibility",
                    checked_risks(source_with_clip(b"q /Safe gs ", state=values)),
                )

    def test_raster_settings_do_not_authorize_clipped_or_invisible_text(self):
        self.assertIn(
            "conditional_visibility",
            checked_risks(source_with_clip(b"q /Safe gs 21 0 300 400 re W n ", state=state())),
        )
        self.assertIn(
            "nonstandard_text_rendering",
            checked_risks(source_with_clip(b"q /Safe gs 3 Tr ", state=state())),
        )
