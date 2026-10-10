"""Real grayscale appearance, exact Unicode, and exported-color source oracles."""

import tempfile
import unittest
from pathlib import Path

from pypdf.generic import ArrayObject, FloatObject, NameObject

from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from tests.admission.appearance_fixture import BODY, passive_document
from tests.admission.helpers import save
from tests.admission.scan_fixture import scan_first_page

from .response_fixtures import wire_segment


def grayscale_document(subtype):
    document = passive_document(subtype)
    annotation = document.pages[0]["/Annots"][0].get_object()
    gray = 0.8 if subtype == "/Highlight" else 0
    annotation[NameObject("/C")] = ArrayObject([FloatObject(gray)])
    appearance = annotation["/AP"]["/N"].get_object()
    if subtype == "/Highlight":
        appearance.set_data(b"q /GS gs 0.8 g 0 0 130 13 re f Q")
    else:
        y = 1 if subtype == "/Underline" else 6
        appearance.set_data(f"q 0 G 1 w 0 {y} m 130 {y} l S Q".encode())
    return document


def verify_result(test, result, subtype):
    bodies = [b for b in result.book.blocks if hasattr(b, "content") and b.content.text == BODY]
    test.assertEqual(2, len(bodies))
    styles = {s.id: s for s in result.book.styles}
    field = {
        "/Highlight": "background_color",
        "/Underline": "underline",
        "/StrikeOut": "strike_through",
    }[subtype]
    selected = [
        s for s in bodies[0].content.spans if s.style_id and getattr(styles[s.style_id], field)
    ]
    test.assertEqual(set(range(28)), {i for s in selected for i in range(s.start, s.end)})
    color_field = "background_color" if subtype == "/Highlight" else "decoration_color"
    expected = "#cccccc" if subtype == "/Highlight" else "#000000"
    test.assertTrue(all(getattr(styles[s.style_id], color_field) == expected for s in selected))
    test.assertFalse(
        any(s.style_id and getattr(styles[s.style_id], field) for s in bodies[1].content.spans)
    )
    test.assertEqual(result.book, portable_epub(result.epub)[0])


class GrayscaleNativeAnnotations(unittest.TestCase):
    def test_gray_highlight_underline_strikeout_need_no_provider(self):
        for subtype in ("/Highlight", "/Underline", "/StrikeOut"):
            with self.subTest(subtype=subtype), tempfile.TemporaryDirectory() as directory:
                scratch = Path(directory)
                source = save(grayscale_document(subtype), directory)
                pages = [prepare_page(source, scratch, n) for n in (1, 2)]
                self.assertEqual([0, 0], [len(p.tasks) for p in pages])
                verify_result(self, reconstruct(source, scratch, pages, []), subtype)

    def test_declared_gray_cannot_override_blue_source_stroke(self):
        document = passive_document("/Underline")
        annotation = document.pages[0]["/Annots"][0].get_object()
        annotation[NameObject("/C")] = ArrayObject([FloatObject(0)])
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "PDF_ANNOTATION_STYLE_REQUIRES_REVIEW"):
                prepare_page(save(document, directory), Path(directory), 1)


@unittest.skipUnless(Path("/usr/bin/tesseract").is_file(), "Requires packaged OCR worker")
class GrayscaleScanAnnotations(unittest.TestCase):
    def test_actual_scan_gray_highlight_underline_strikeout(self):
        for subtype in ("/Highlight", "/Underline", "/StrikeOut"):
            with self.subTest(subtype=subtype), tempfile.TemporaryDirectory() as directory:
                scratch = Path(directory)
                source = scan_first_page(grayscale_document(subtype), scratch)
                pages = [prepare_page(source, scratch, n) for n in (1, 2)]
                self.assertFalse(pages[0].observation.lines)
                task = pages[0].tasks[0]
                response = RecognitionResponse.model_validate(
                    dict(
                        schema_version="ava-recognition-response-2",
                        task_id=task.task_id,
                        source_sha256=task.source_sha256,
                        render_sha256=task.image.sha256,
                        language="en",
                        unresolved=[],
                        segments=[
                            wire_segment(
                                task,
                                id="body",
                                text=BODY,
                                box=dict(
                                    coordinate_space="page_points_top_left",
                                    x0=0,
                                    y0=0,
                                    x1=300,
                                    y1=400,
                                ),
                            )
                        ],
                    )
                )
                verify_result(self, reconstruct(source, scratch, pages, [response]), subtype)
