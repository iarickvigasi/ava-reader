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
        annotation[NameObject("/Subtype")] = NameObject("/RichMedia")
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

    def test_unlisted_related_annotations_cannot_hide_actions(self):
        for key in ("/Popup", "/Parent", "/IRT"):
            outer = link()
            child = link(action("/JavaScript"))
            child[NameObject("/Subtype")] = NameObject("/Text")
            outer[NameObject(key)] = child
            with (
                self.subTest(key=key),
                self.assertRaisesRegex(AdmissionError, "PDF_ACTIVE_CONTENT_UNSUPPORTED"),
            ):
                self.inspect(writer(outer))

    def test_popup_parent_cycle_is_bounded_and_allowed_when_passive(self):
        document = writer()
        note = link()
        note[NameObject("/Subtype")] = NameObject("/Text")
        popup = link()
        popup[NameObject("/Subtype")] = NameObject("/Popup")
        note_ref = document._add_object(note)
        popup_ref = document._add_object(popup)
        note[NameObject("/Popup")] = popup_ref
        popup[NameObject("/Parent")] = note_ref
        document.pages[0][NameObject("/Annots")] = ArrayObject([note_ref])
        self.assertEqual(1, self.inspect(document)["page_count"])

    def test_malformed_annotation_array_has_specific_error(self):
        document = writer()
        document.pages[0][NameObject("/Annots")] = DictionaryObject()
        with self.assertRaisesRegex(AdmissionError, "PDF_ANNOTATION_INVALID"):
            self.inspect(document)

    def test_second_page_second_annotation_has_content_free_location(self):
        document = writer()
        page = document.add_blank_page(width=300, height=400)
        bad = link()
        bad[NameObject("/Subtype")] = NameObject("/FreeText")
        bad[NameObject("/Contents")] = TextStringObject("PRIVATE NOTE")
        bad[NameObject("/Rect")] = ArrayObject(
            [TextStringObject("PRIVATE VALUE"), NumberObject(0), NumberObject(10), NumberObject(10)]
        )
        page[NameObject("/Annots")] = ArrayObject(
            [document._add_object(link()), document._add_object(bad)]
        )
        with self.assertRaises(AdmissionError) as caught:
            self.inspect(document)
        self.assertEqual(str(caught.exception), "PDF_ANNOTATION_INVALID")
        self.assertEqual(
            caught.exception.finding,
            {"page_number": 2, "annotation_number": 2, "relationship_path": []},
        )
        self.assertNotIn("PRIVATE", str(caught.exception.finding))

    def test_nested_action_has_relationship_location(self):
        outer = link()
        child = link(action("/JavaScript"))
        child[NameObject("/Subtype")] = NameObject("/Text")
        outer[NameObject("/Popup")] = child
        with self.assertRaises(AdmissionError) as caught:
            self.inspect(writer(outer))
        self.assertEqual(str(caught.exception), "PDF_ACTIVE_CONTENT_UNSUPPORTED")
        self.assertEqual(
            caught.exception.finding,
            {"page_number": 1, "annotation_number": 1, "relationship_path": ["/Popup"]},
        )

    def test_cli_emits_refusal_location(self):
        import json
        import subprocess
        import sys

        bad = link()
        bad[NameObject("/Subtype")] = NameObject("/Redact")
        with tempfile.TemporaryDirectory() as directory:
            path = save(writer(bad), directory)
            result = subprocess.run(
                [sys.executable, "-m", "ava_pdf_epub.admission", str(path)],
                capture_output=True,
                text=True,
                check=True,
            )
        self.assertEqual(
            json.loads(result.stdout),
            {
                "accepted": False,
                "code": "PDF_REDACTION_UNSUPPORTED",
                "finding": {"page_number": 1, "annotation_number": 1, "relationship_path": []},
            },
        )

    def test_isolated_runtime_preserves_the_same_refusal(self):
        import contextlib
        import io
        import json
        from unittest.mock import patch

        from ava_pdf_epub.runtime.inspect import main

        error = AdmissionError(
            "PDF_REDACTION_UNSUPPORTED",
            finding={"page_number": 2, "annotation_number": 1, "relationship_path": []},
        )
        stdout = io.StringIO()
        with (
            patch("ava_pdf_epub.runtime.inspect.preflight", side_effect=error),
            contextlib.redirect_stdout(stdout),
        ):
            main()
        self.assertEqual(json.loads(stdout.getvalue()), error.refusal())
