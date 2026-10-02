"""Regression: empty Contents never proves that an appearance is empty."""

import tempfile
import unittest

from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    IndirectObject,
    NameObject,
    NumberObject,
    TextStringObject,
)

from ava_pdf_epub.admission import inspect_admission
from ava_pdf_epub.admission_actions import AdmissionError
from ava_pdf_epub.extract import inspect_pdf

from .helpers import action, link, save, writer


def textbox():
    annotation = link()
    annotation[NameObject("/Subtype")] = NameObject("/FreeText")
    annotation[NameObject("/Contents")] = TextStringObject("")
    return annotation


class EmptyFreeText(unittest.TestCase):
    def check_both(self, document):
        with tempfile.TemporaryDirectory() as directory:
            source = save(document, directory)
            self.assertEqual(inspect_admission(source)["page_count"], 1)
            self.assertEqual(inspect_pdf(source)["page_count"], 1)

    def test_empty_without_appearance_is_accepted_by_both_paths(self):
        self.check_both(writer(textbox()))

    def test_empty_with_dangling_appearance_matches_reported_source(self):
        annotation = textbox()
        document = writer(annotation)
        annotation[NameObject("/AP")] = DictionaryObject(
            {NameObject("/N"): IndirectObject(0, 0, document)}
        )
        self.check_both(document)

    def test_empty_whitespace_appearance_is_accepted(self):
        annotation = textbox()
        stream = DecodedStreamObject()
        stream.set_data(b" \n\t")
        annotation[NameObject("/AP")] = DictionaryObject({NameObject("/N"): stream})
        self.check_both(writer(annotation))

    def test_visible_content_and_alternate_appearances_are_not_silently_dropped(self):
        for key, value in [
            ("/Contents", TextStringObject("Private note")),
            ("/RC", TextStringObject("<p>Visible</p>")),
            ("/CL", ArrayObject([NumberObject(1)])),
        ]:
            annotation = textbox()
            annotation[NameObject(key)] = value
            with self.subTest(key=key), self.assertRaises(AdmissionError):
                self.check_both(writer(annotation))
        for key in ["/N", "/R", "/D"]:
            annotation = textbox()
            stream = DecodedStreamObject()
            stream.set_data(b"BT (Visible content) Tj ET")
            annotation[NameObject("/AP")] = DictionaryObject({NameObject(key): stream})
            with self.subTest(key=key), self.assertRaises(AdmissionError):
                self.check_both(writer(annotation))

    def test_empty_box_does_not_bypass_action_safety(self):
        for key in ["/A", "/AA"]:
            annotation = textbox()
            annotation[NameObject(key)] = action("/JavaScript")
            with (
                self.subTest(key=key),
                self.assertRaisesRegex(AdmissionError, "PDF_ACTIVE_CONTENT_UNSUPPORTED"),
            ):
                self.check_both(writer(annotation))

    def test_malformed_annotation_has_explicit_error(self):
        document = writer(TextStringObject("not an annotation dictionary"))
        with self.assertRaisesRegex(AdmissionError, "PDF_ANNOTATION_INVALID"):
            self.check_both(document)

    def test_unknown_broken_appearance_is_not_assumed_empty(self):
        from pypdf import PdfReader

        from ava_pdf_epub.annotation_empty import empty_freetext

        for strict in [False, True]:
            annotation = textbox()
            document = writer(annotation)
            annotation[NameObject("/AP")] = DictionaryObject(
                {NameObject("/N"): IndirectObject(999, 0, document)}
            )
            with tempfile.TemporaryDirectory() as directory:
                reader = PdfReader(save(document, directory), strict=strict)
                loaded = reader.pages[0]["/Annots"][0].get_object()
                with self.subTest(strict=strict):
                    self.assertFalse(empty_freetext(loaded))
