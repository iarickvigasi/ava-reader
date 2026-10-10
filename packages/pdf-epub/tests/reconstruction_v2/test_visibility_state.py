"""Benign page clips stay native; hidden/clipped/unknown state still requires review."""

import io
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject, NumberObject

from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.visibility import display_risks
from tests.admission.appearance_fixture import BODY, annotated_document
from tests.admission.helpers import save


def source_with_clip(prefix, *, state=None, suffix=b"Q"):
    document = annotated_document()
    del document.pages[0][NameObject("/Annots")]
    page = document.pages[0]
    if state is not None:
        page["/Resources"][NameObject("/ExtGState")] = DictionaryObject(
            {NameObject("/Safe"): DictionaryObject(state)}
        )
    content = DecodedStreamObject()
    content.set_data(prefix + page.get_contents().get_data() + suffix)
    page[NameObject("/Contents")] = document._add_object(content)
    return document


def risks(document, bounds=(20, 247, 290, 260), *, transformed=False):
    data = io.BytesIO()
    document.write(data)
    reader = PdfReader(data)
    return display_risks(
        reader.pages[0], reader, glyph_bounds=bounds, allow_transformed_rectangles=transformed
    )


class NativeVisibilityState(unittest.TestCase):
    def test_source_enclosing_clip_and_opaque_normal_state_need_no_model(self):
        state = {
            NameObject("/BM"): NameObject("/Normal"),
            NameObject("/ca"): NumberObject(1),
            NameObject("/CA"): NumberObject(1),
        }
        document = source_with_clip(b"q 0.000008872 0 300 400 re W* n /Safe gs ", state=state)
        with tempfile.TemporaryDirectory() as directory:
            prepared = prepare_page(save(document, directory), Path(directory), 1)
            self.assertEqual([], prepared.observation.risks)
            self.assertEqual([], prepared.tasks)
            self.assertEqual(BODY, prepared.native_segments[0].text)

    def test_offset_crop_retains_source_visibility_review(self):
        document = source_with_clip(b"q 0 0 300 400 re W n ")
        document.pages[0].cropbox.lower_left = (10, 0)
        with tempfile.TemporaryDirectory() as directory:
            prepared = prepare_page(save(document, directory), Path(directory), 1)
            self.assertIn("conditional_visibility", prepared.observation.risks)
            self.assertEqual(1, len(prepared.tasks))

    def test_clip_cutting_even_one_source_edge_is_not_qualified(self):
        for rect in (b"21 0 300 400", b"0 0 289 400", b"0 248 300 400", b"0 0 300 259"):
            with self.subTest(rect=rect):
                self.assertIn(
                    "conditional_visibility", risks(source_with_clip(b"q " + rect + b" re W n "))
                )

    def test_compound_paths_and_transformed_rectangles_remain_review(self):
        for prefix in (
            b"q 0 0 300 400 re 10 10 2 2 re W* n ",
            b"q 0 0 300 400 re 1 1 m 2 2 l W n ",
            b"q 0.5 0 0 0.5 0 0 cm 0 0 600 800 re W n ",
        ):
            with self.subTest(prefix=prefix):
                self.assertIn("conditional_visibility", risks(source_with_clip(prefix)))

    def test_axis_aligned_source_region_proof_is_opt_in_and_has_no_edge_tolerance(self):
        for prefix in (
            b"q 0.5 0 0 0.5 0 0 cm 0 0 600 800 re W n ",
            b"q 1 0 0 -1 0 400 cm 0 0 300 400 re W n ",
            b"q 1 0 0 1 10 20 cm -10 -20 300 400 re W n ",
        ):
            with self.subTest(prefix=prefix):
                source = source_with_clip(prefix)
                self.assertEqual([], risks(source, transformed=True))
                self.assertIn("conditional_visibility", risks(source))
        source = source_with_clip(b"q 0.5 0 0 0.5 0 0 cm 42 0 600 800 re W n ")
        self.assertIn("conditional_visibility", risks(source, transformed=True))

    def test_skew_rotation_singular_and_compound_paths_are_not_region_proof(self):
        for prefix in (
            b"q 1 0.1 0 1 0 0 cm 0 0 600 800 re W n ",
            b"q 0 1 -1 0 400 0 cm 0 0 600 800 re W n ",
            b"q 0 0 0 1 0 0 cm 0 0 600 800 re W n ",
            b"q 0.5 0 0 0.5 0 0 cm 0 0 600 800 re 1 1 2 2 re W* n ",
        ):
            with self.subTest(prefix=prefix):
                self.assertIn(
                    "conditional_visibility", risks(source_with_clip(prefix), transformed=True)
                )

    def test_nested_matrix_restore_and_clip_intersection_are_checked(self):
        source = source_with_clip(b"q 1 0 0 1 10 20 cm q 2 0 0 2 0 0 cm Q -10 -20 300 400 re W n ")
        self.assertEqual([], risks(source, transformed=True))
        source = source_with_clip(b"q 1 0 0 1 10 20 cm -10 -20 300 400 re W n 20 220 10 50 re W n ")
        self.assertIn("conditional_visibility", risks(source, transformed=True))

    def test_unknown_opacity_softmask_transfer_and_blend_are_not_noops(self):
        for state in (
            {NameObject("/ca"): NumberObject(0)},
            {NameObject("/SMask"): NameObject("/None")},
            {NameObject("/TR"): NameObject("/Identity")},
            {NameObject("/BM"): NameObject("/Multiply")},
            {NameObject("/Font"): NameObject("/F1")},
        ):
            with self.subTest(state=state):
                self.assertIn(
                    "conditional_visibility", risks(source_with_clip(b"q /Safe gs ", state=state))
                )
        self.assertIn("conditional_visibility", risks(source_with_clip(b"q /Missing gs ")))

    def test_path_ends_reset_previous_safe_rectangle(self):
        self.assertIn("conditional_visibility", risks(source_with_clip(b"q 0 0 300 400 re n W n ")))
        self.assertIn(
            "conditional_visibility",
            risks(source_with_clip(b"q 0 0 300 400 re W n 30 250 10 10 re W n ")),
        )

    def test_no_source_envelope_cannot_authorize_a_clip(self):
        self.assertIn(
            "conditional_visibility", risks(source_with_clip(b"q 0 0 300 400 re W n "), None)
        )
        self.assertIn("complex_graphics_state", risks(source_with_clip(b"Q ", suffix=b"")))
