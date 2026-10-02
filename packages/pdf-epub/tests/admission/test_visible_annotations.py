"""Visible appearance routing and personal-note exclusion use genuine PDF rendering."""

import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from pypdf import PdfReader
from pypdf.generic import NameObject, TextStringObject

from ava_pdf_epub.admission import inspect_admission
from ava_pdf_epub.admission_actions import AdmissionError
from ava_pdf_epub.annotation_view import annotation_view
from ava_pdf_epub.extract import extract_native, inspect_pdf
from ava_pdf_epub.reconstruction_v2.annotation_findings import annotation_findings
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page

from .appearance_fixture import annotated_document, passive_document
from .helpers import save


class VisibleAnnotations(unittest.TestCase):
    def test_only_visible_annotation_page_routes_and_preserves_source_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = save(annotated_document(), directory)
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            self.assertEqual(2, inspect_admission(source)["page_count"])
            first = prepare_page(source, scratch, 1)
            second = prepare_page(source, scratch, 2)
            self.assertEqual(1, len(first.tasks))
            self.assertEqual(0, len(second.tasks))
            self.assertIn("visible_annotation", first.observation.risks)
            # Text-box rectangle maps to x=180..1380, y=1320..1500 at this render scale.
            with Image.open(scratch / first.observation.render_path) as image:
                region = image.convert("L").crop((180, 1320, 1380, 1500))
                self.assertGreater(sum(v < 150 for v in region.tobytes()), 100)

            self.assertEqual(digest, first.tasks[0].source_sha256)
            self.assertEqual(digest, hashlib.sha256(source.read_bytes()).hexdigest())
            self.assertEqual("visible", inspect_pdf(source)["annotations"][0]["disposition"])
            with self.assertRaisesRegex(ValueError, "REQUIRE_V2_RECONSTRUCTION"):
                extract_native(source, scratch / "assets")

    def test_personal_note_is_excluded_and_accounted_without_leaking_text(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            document = annotated_document("/Text")
            annotation = document.pages[0]["/Annots"][0].get_object()
            annotation[NameObject("/Contents")] = TextStringObject("Private personal note")
            source = save(document, directory)
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            view = annotation_view(source, scratch)
            self.assertFalse(PdfReader(view).pages[0]["/Annots"])
            self.assertTrue(PdfReader(source).pages[0]["/Annots"])
            findings = annotation_findings(source)
            self.assertEqual("information", findings[0].severity)
            self.assertNotIn("Private", findings[0].message)
            self.assertEqual(1, findings[0].page)
            self.assertEqual(0, len(prepare_page(source, scratch, 1).tasks))
            self.assertEqual(digest, hashlib.sha256(source.read_bytes()).hexdigest())

    def test_visible_passive_types_are_admitted_with_appearance(self):
        for subtype in ["/FreeText", "/Ink", "/Highlight", "/Underline", "/Stamp"]:
            with self.subTest(subtype=subtype), tempfile.TemporaryDirectory() as directory:
                source = save(annotated_document(subtype), directory)
                self.assertEqual(2, inspect_admission(source)["page_count"])

    def test_redaction_and_missing_essential_appearance_have_specific_refusals(self):
        for subtype, code in [
            ("/Redact", "PDF_REDACTION_UNSUPPORTED"),
            ("/FreeText", "PDF_ANNOTATION_APPEARANCE_REQUIRED"),
        ]:
            document = annotated_document(subtype)
            annotation = document.pages[0]["/Annots"][0].get_object()
            del annotation[NameObject("/AP")]
            annotation[NameObject("/Contents")] = TextStringObject("Essential text")
            with (
                tempfile.TemporaryDirectory() as directory,
                self.assertRaisesRegex(AdmissionError, code),
            ):
                inspect_admission(save(document, directory))

    def test_renderer_refusal_cannot_become_an_omitted_textbox(self):
        document = annotated_document()
        annotation = document.pages[0]["/Annots"][0].get_object()
        # A normal stream alone is insufficient: this source lacks FreeText's default appearance.
        del annotation[NameObject("/DA")]
        del annotation[NameObject("/Contents")]
        with tempfile.TemporaryDirectory() as directory:
            source = save(document, directory)
            with self.assertRaisesRegex(ValueError, "PDF_ANNOTATION_RENDER_FAILED"):
                prepare_page(source, Path(directory), 1)

    def test_required_visible_appearance_cannot_be_skipped_as_blank(self):
        with tempfile.TemporaryDirectory() as directory:
            source = save(annotated_document(), directory)
            with (
                patch("ava_pdf_epub.reconstruction_v2.prepare_page.blank_page", return_value=True),
                self.assertRaisesRegex(ValueError, "PDF_ANNOTATION_RENDER_FAILED"),
            ):
                prepare_page(source, Path(directory), 1)

    def test_unlisted_popup_is_removed_from_rendering_view_only(self):
        document = annotated_document()
        annotation = document.pages[0]["/Annots"][0].get_object()
        note = annotated_document("/Popup").pages[0]["/Annots"][0].get_object()
        note[NameObject("/Contents")] = TextStringObject("Private unlisted popup")
        annotation[NameObject("/Popup")] = document._add_object(note)
        with tempfile.TemporaryDirectory() as directory:
            source = save(document, directory)
            view = annotation_view(source, Path(directory))
            self.assertNotEqual(source, view)
            self.assertIn("/Popup", PdfReader(source).pages[0]["/Annots"][0].get_object())
            self.assertNotIn("/Popup", PdfReader(view).pages[0]["/Annots"][0].get_object())
            self.assertNotIn(b"Private unlisted popup", view.read_bytes())
            findings = annotation_findings(source)
            self.assertEqual(1, len(findings))
            self.assertIn("1 personal", findings[0].message)
            self.assertNotIn("Private", findings[0].message)

    def test_genuine_highlight_and_ink_have_visible_pixels_and_selectable_native_prose(self):
        from .appearance_fixture import BODY

        for subtype in ["/Highlight", "/Ink"]:
            with self.subTest(subtype=subtype), tempfile.TemporaryDirectory() as directory:
                scratch = Path(directory)
                source = save(passive_document(subtype), directory)
                self.assertEqual(2, inspect_admission(source)["page_count"])
                prepared = prepare_page(source, scratch, 1)
                self.assertEqual(0 if subtype == "/Highlight" else 1, len(prepared.tasks))
                self.assertEqual(BODY, prepared.observation.lines[0].text)
                self.assertEqual(0, len(prepare_page(source, scratch, 2).tasks))
                with Image.open(scratch / prepared.observation.render_path) as image:
                    pixels = image.convert("RGB").getdata()
                    if subtype == "/Highlight":
                        visible = sum(r > 180 and g > 180 and b < 80 for r, g, b in pixels)
                    else:
                        visible = sum(b > 180 and r < 80 and g < 80 for r, g, b in pixels)
                    self.assertGreater(visible, 500)
