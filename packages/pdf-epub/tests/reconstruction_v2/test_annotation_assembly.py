"""Authored recognition proves assembly/conservation, not provider transcription quality."""

import io
import tempfile
import unittest
import zipfile
from pathlib import Path

from PIL import Image

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from tests.admission.appearance_fixture import BODY, EDITORIAL, annotated_document, passive_document
from tests.admission.helpers import save
from tests.admission.scan_fixture import scan_first_page

from .response_fixtures import wire_segment


class AnnotationAssembly(unittest.TestCase):
    def test_visible_textbox_is_required_and_survives_as_selectable_epub_text(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = save(annotated_document(), directory)
            pages = [prepare_page(source, scratch, n) for n in [1, 2]]
            task = pages[0].tasks[0]
            line = pages[0].observation.lines[0]
            body = wire_segment(task, id="body", text=BODY, box=line.box.model_dump())
            editorial = wire_segment(
                task,
                id="editorial",
                text=EDITORIAL,
                box=dict(coordinate_space="page_points_top_left", x0=30, y0=220, x1=230, y1=250),
            )
            raw = dict(
                schema_version="ava-recognition-response-2",
                task_id=task.task_id,
                source_sha256=task.source_sha256,
                render_sha256=task.image.sha256,
                language="en",
                unresolved=[],
                segments=[body],
            )
            with self.assertRaisesRegex(ValueError, "required visible annotation region"):
                accept_response(task, RecognitionResponse.model_validate(raw))
            broad = wire_segment(
                task,
                id="broad",
                text=BODY,
                box=dict(coordinate_space="page_points_top_left", x0=0, y0=0, x1=300, y1=400),
            )
            raw["segments"] = [broad]
            with self.assertRaisesRegex(ValueError, "required visible annotation region"):
                accept_response(task, RecognitionResponse.model_validate(raw))
            raw["segments"] = [body, editorial]
            response = RecognitionResponse.model_validate(raw)
            result = reconstruct(source, scratch, pages, [response])
            text = [b.content.text for b in result.book.blocks if hasattr(b, "content")]
            self.assertEqual(2, text.count(BODY))
            self.assertEqual(1, text.count(EDITORIAL))
            with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
                html = b"".join(
                    archive.read(n)
                    for n in archive.namelist()
                    if n.endswith(".xhtml") and "/text/" in n
                )
                self.assertIn(EDITORIAL.encode(), html)

    def test_ink_requires_a_source_pixel_asset_and_conserves_selectable_prose(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = save(passive_document("/Ink"), directory)
            pages = [prepare_page(source, scratch, n) for n in [1, 2]]
            task = pages[0].tasks[0]
            body = wire_segment(
                task, id="body", text=BODY, box=pages[0].observation.lines[0].box.model_dump()
            )
            raw = dict(
                schema_version="ava-recognition-response-2",
                task_id=task.task_id,
                source_sha256=task.source_sha256,
                render_sha256=task.image.sha256,
                language="en",
                unresolved=[],
                segments=[body],
            )
            with self.assertRaisesRegex(ValueError, "required visible annotation region"):
                accept_response(task, RecognitionResponse.model_validate(raw))
            box = pages[0].observation.required_regions[0].box.model_dump()
            fake = wire_segment(task, id="fake", text="Ink drawing", box=box)
            raw["segments"] = [body, fake]
            with self.assertRaisesRegex(ValueError, "required visible annotation region"):
                accept_response(task, RecognitionResponse.model_validate(raw))
            figure = wire_segment(
                task, id="ink", text="", kind="figure", alt="A blue zigzag ink stroke.", box=box
            )
            raw["segments"] = [body, figure]
            result = reconstruct(source, scratch, pages, [RecognitionResponse.model_validate(raw)])
            text = [b.content.text for b in result.book.blocks if hasattr(b, "content")]
            self.assertEqual(2, text.count(BODY))
            with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
                assets = [n for n in archive.namelist() if n.endswith(".png")]
                self.assertEqual(1, len(assets))
                with (
                    Image.open(io.BytesIO(archive.read(assets[0]))) as asset,
                    Image.open(scratch / pages[0].observation.render_path) as rendered,
                ):
                    expected = rendered.crop((180, 1200, 1381, 1441))
                    self.assertEqual(expected.size, asset.size)
                    self.assertEqual(expected.tobytes(), asset.tobytes())

    def test_native_highlight_preserves_exact_selectable_spans_without_model_calls(self):
        from ava_pdf_epub.epub_v2.portable import portable_epub

        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = save(passive_document("/Highlight"), directory)
            pages = [prepare_page(source, scratch, n) for n in [1, 2]]
            self.assertEqual([0, 0], [len(page.tasks) for page in pages])
            result = reconstruct(source, scratch, pages, [])
            bodies = [
                b for b in result.book.blocks if hasattr(b, "content") and b.content.text == BODY
            ]
            self.assertEqual(2, len(bodies))
            styles = {s.id: s for s in result.book.styles}
            marked = [
                s
                for s in bodies[0].content.spans
                if s.style_id and styles[s.style_id].background_color
            ]
            self.assertEqual(
                set(range(28)), {i for span in marked for i in range(span.start, span.end)}
            )
            self.assertEqual(
                "The book keeps this ordinary",
                "".join(BODY[i] for span in marked for i in range(span.start, span.end)),
            )
            self.assertEqual("#ffff00", styles[marked[0].style_id].background_color)
            self.assertTrue(
                all(
                    styles[span.style_id].color == "#000000"
                    for span in marked
                    if BODY[span.start : span.end].strip()
                )
            )
            self.assertFalse(
                any(
                    s.style_id and styles[s.style_id].background_color
                    for s in bodies[1].content.spans
                )
            )
            self.assertEqual(result.book, portable_epub(result.epub)[0])
            with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
                self.assertFalse(any(n.endswith(".png") for n in archive.namelist()))
                css = b"".join(archive.read(n) for n in archive.namelist() if n.endswith(".css"))
                self.assertIn(b"background-color:#ffff00", css)


@unittest.skipUnless(Path("/usr/bin/tesseract").is_file(), "Requires the packaged OCR worker")
class InstalledScannedAnnotationAssembly(unittest.TestCase):
    def test_true_scan_highlight_maps_words_and_reimports_exactly(self):
        self.verify_scan("/Highlight", "background_color")

    def test_true_scan_underline_maps_words_and_reimports_exactly(self):
        self.verify_scan("/Underline", "underline")

    def test_true_scan_strikeout_maps_words_and_reimports_exactly(self):
        self.verify_scan("/StrikeOut", "strike_through")

    def test_opaque_strikeout_cannot_recover_concealed_prose(self):
        with self.assertRaisesRegex(ValueError, "PDF_ANNOTATION_WORD_GEOMETRY_REQUIRES_REVIEW"):
            self.verify_scan("/StrikeOut", "strike_through", concealed=True)

    def verify_scan(self, subtype, field, concealed=False):
        from ava_pdf_epub.epub_v2.portable import portable_epub

        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            document = passive_document(subtype)
            if concealed:
                appearance = document.pages[0]["/Annots"][0].get_object()["/AP"]["/N"]
                appearance.set_data(b"q 1 1 1 rg 0 0 130 13 re f Q " + appearance.get_data())
            source = scan_first_page(document, scratch)
            pages = [prepare_page(source, scratch, number) for number in (1, 2)]
            self.assertFalse(pages[0].observation.lines)
            self.assertEqual(1, len(pages[0].tasks))
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
                            id="scan-body",
                            text=BODY,
                            box=dict(
                                coordinate_space="page_points_top_left", x0=0, y0=0, x1=300, y1=400
                            ),
                        )
                    ],
                )
            )
            result = reconstruct(source, scratch, pages, [response])
            bodies = [
                block
                for block in result.book.blocks
                if hasattr(block, "content") and block.content.text == BODY
            ]
            self.assertEqual(2, len(bodies))
            styles = {style.id: style for style in result.book.styles}
            positions = {
                index
                for span in bodies[0].content.spans
                if span.style_id and getattr(styles[span.style_id], field)
                for index in range(span.start, span.end)
            }
            self.assertEqual(set(range(28)), positions)
            self.assertFalse(
                any(
                    span.style_id and getattr(styles[span.style_id], field)
                    for span in bodies[1].content.spans
                )
            )
            self.assertEqual(result.book, portable_epub(result.epub)[0])
