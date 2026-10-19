import tempfile
import unittest

from pypdf.generic import NameObject, TextStringObject

from ava_pdf_epub.admission import inspect_admission
from ava_pdf_epub.admission_actions import AdmissionError
from ava_pdf_epub.static_navigation import static_page_jump

from .helpers import action, link, save, writer


class StaticNavigationTests(unittest.TestCase):
    def test_literal_jump_target_is_checked_without_evaluation(self):
        for script, index in (
            ("this.zoom=100;this.pageNum=146", 146),
            ("this.zoom=100;this.pageNum=0;", 0),
            ("\nthis . zoom = 100; this . pageNum = 231;\n", 231),
        ):
            self.assertEqual(index, static_page_jump(script, 232))

    def test_executable_ambiguous_and_out_of_book_variants_are_refused(self):
        for script in (
            "this.zoom=100;this.pageNum=232",
            "this.zoom=100;this.pageNum=-1",
            "this.zoom=100;this.pageNum=1+1",
            "this.zoom=100;this.pageNum=0;app.alert(1)",
            "this.zoom=100;this.pageNum=1/* comment */",
            "this.zoom=100;this.pageNum=١",
            "this.zoom=100;this.pageNum=this.pageNum+1",
            "this.zoom=50;this.pageNum=1",
            "this.zoom=100;this.pageNum=1.0",
            "this.zoom=100;this.pageNum=1000",
            "this.zoom=100;this.pageNum=1\x00",
            "this.zoom=100;this.pageNum=1\u2028",
            b"this.zoom=100;this.pageNum=1",
            None,
            " " * 257,
        ):
            with (
                self.subTest(script=script),
                self.assertRaisesRegex(ValueError, "PDF_NAVIGATION_ACTION_UNSUPPORTED"),
            ):
                static_page_jump(script, 232)

    def test_only_literal_link_navigation_is_admitted_other_scripts_stay_refused(self):
        jump = action("/JavaScript")
        jump[NameObject("/JS")] = TextStringObject("this.zoom=100;this.pageNum=0")
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(
                1, inspect_admission(save(writer(link(jump)), directory))["page_count"]
            )
            for script in (
                "this.zoom=100;this.pageNum=1",
                "this.zoom=100;this.pageNum=0;app.alert(1)",
            ):
                jump[NameObject("/JS")] = TextStringObject(script)
                with self.assertRaisesRegex(AdmissionError, "PDF_ACTIVE_CONTENT_UNSUPPORTED"):
                    inspect_admission(save(writer(link(jump)), directory))

    def test_unknown_or_invalid_source_page_count_is_refused(self):
        for count in (None, True, 0, -1, 501, 232.0):
            with (
                self.subTest(count=count),
                self.assertRaisesRegex(ValueError, "PDF_NAVIGATION_PAGE_COUNT_INVALID"),
            ):
                static_page_jump("this.zoom=100;this.pageNum=1", count)
