import tempfile
import unittest

from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, TextStringObject

from ava_pdf_epub.admission import inspect_admission
from ava_pdf_epub.admission_actions import AdmissionError

from .helpers import action, link, save, writer


class AdmissionActionsTests(unittest.TestCase):
    def inspect(self, document):
        with tempfile.TemporaryDirectory() as directory:
            return inspect_admission(save(document, directory))

    def test_ordinary_links_and_benign_initial_navigation(self):
        for url in [
            "https://example.invalid/a",
            "http://example.invalid",
            "mailto:a@example.invalid",
        ]:
            self.assertEqual(self.inspect(writer(link(action(uri=url))))["page_count"], 1)
        for initial in [
            ArrayObject([NumberObject(0), NameObject("/Fit")]),
            TextStringObject("chapter-1"),
            DictionaryObject(
                {
                    NameObject("/S"): NameObject("/GoTo"),
                    NameObject("/D"): TextStringObject("chapter-1"),
                }
            ),
        ]:
            document = writer()
            document._root_object[NameObject("/OpenAction")] = initial
            self.assertEqual(self.inspect(document)["page_count"], 1)

    def test_active_link_variants_are_rejected(self):
        chained = action()
        chained[NameObject("/Next")] = action("/JavaScript")
        additional = link(action())
        additional[NameObject("/AA")] = DictionaryObject({NameObject("/E"): action("/JavaScript")})
        for annotation in [
            link(chained),
            additional,
            link(action(uri="javascript:void(0)")),
            link(action(uri="file:///etc/passwd")),
            link(action("/Launch")),
        ]:
            with (
                self.subTest(annotation=annotation),
                self.assertRaisesRegex(AdmissionError, "PDF_ACTIVE_CONTENT_UNSUPPORTED"),
            ):
                self.inspect(writer(annotation))

    def test_catalog_javascript_and_executable_open_action_rejected(self):
        document = writer()
        document.add_js("void(0)")
        with self.assertRaisesRegex(AdmissionError, "PDF_ACTIVE_CONTENT_UNSUPPORTED"):
            self.inspect(document)
        document = writer()
        document._root_object[NameObject("/OpenAction")] = action("/JavaScript")
        with self.assertRaisesRegex(AdmissionError, "PDF_ACTIVE_CONTENT_UNSUPPORTED"):
            self.inspect(document)

    def test_personal_annotations_are_unsupported_not_corrupt(self):
        annotation = link()
        annotation[NameObject("/Subtype")] = NameObject("/Ink")
        with self.assertRaisesRegex(AdmissionError, "PDF_ANNOTATIONS_UNSUPPORTED"):
            self.inspect(writer(annotation))

    def test_embedded_files_and_forms_are_explicitly_unsupported(self):
        document = writer()
        document.add_attachment("inert.txt", b"inert")
        with self.assertRaisesRegex(AdmissionError, "PDF_EMBEDDED_CONTENT_UNSUPPORTED"):
            self.inspect(document)
        document = writer()
        document._root_object[NameObject("/AcroForm")] = DictionaryObject(
            {NameObject("/XFA"): TextStringObject("inert")}
        )
        with self.assertRaisesRegex(AdmissionError, "PDF_FORMS_UNSUPPORTED"):
            self.inspect(document)
