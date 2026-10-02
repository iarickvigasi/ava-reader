"""Independent geometry/text oracles for native source markup, not fabricated OCR output."""

import tempfile
import unittest
from pathlib import Path

from admission.appearance_fixture import BODY, multiline_highlight, passive_document
from admission.helpers import save
from pypdf.generic import ArrayObject, NameObject, NumberObject

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.annotation_spans import (
    apply_annotation_spans,
    merge_annotation_spans,
)
from ava_pdf_epub.reconstruction_v2.native_page import native_page
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan


class NativeAnnotationSpans(unittest.TestCase):
    def test_genuine_decorations_retain_exact_text_and_blue_stroke(self):
        for subtype, field in [("/Underline", "underline"), ("/StrikeOut", "strike_through")]:
            with self.subTest(subtype=subtype), tempfile.TemporaryDirectory() as directory:
                scratch = Path(directory)
                source = save(passive_document(subtype), directory)
                prepared = prepare_page(source, scratch, 1)
                self.assertEqual(0, len(prepared.tasks))
                segments = apply_annotation_spans(
                    prepared.observation, native_page(prepared.observation, [], set(), []), scratch
                )
                self.assertEqual(BODY, segments[0].text)
                marked = [
                    span for span in segments[0].spans if span.style and getattr(span.style, field)
                ]
                self.assertEqual(
                    set(range(28)), {i for span in marked for i in range(span.start, span.end)}
                )
                self.assertTrue(all(span.style.decoration_color == "#0000ff" for span in marked))

    def test_multiple_quads_do_not_style_the_line_between_them(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = save(multiline_highlight(), directory)
            prepared = prepare_page(source, scratch, 1)
            self.assertEqual(2, len(prepared.observation.required_regions))
            self.assertEqual(0, len(prepared.tasks))
            segments = apply_annotation_spans(
                prepared.observation, native_page(prepared.observation, [], set(), []), scratch
            )
            joined = "\n".join(segment.text for segment in segments)
            self.assertIn("Unmarked line between the quads.", joined)
            marked_text = []
            for segment in segments:
                positions = {
                    i
                    for span in segment.spans
                    if span.style and span.style.background_color
                    for i in range(span.start, span.end)
                }
                middle_start = segment.text.find("Unmarked line between the quads.")
                if middle_start >= 0:
                    self.assertFalse(positions.intersection(range(middle_start, middle_start + 32)))
                marked_text.append("".join(segment.text[i] for i in sorted(positions)))
            self.assertEqual("The book keeps this ordinary" * 2, "".join(marked_text))

    def test_boundary_through_a_nonspace_glyph_is_not_guessed(self):
        document = passive_document("/Highlight")
        annotation = document.pages[0]["/Annots"][0].get_object()
        annotation[NameObject("/Rect")] = ArrayObject(
            [NumberObject(n) for n in [20, 247, 160, 260]]
        )
        annotation[NameObject("/QuadPoints")] = ArrayObject(
            [NumberObject(n) for n in [20, 260, 160, 260, 20, 247, 160, 247]]
        )
        appearance = annotation["/AP"]["/N"].get_object()
        appearance[NameObject("/BBox")] = ArrayObject([NumberObject(n) for n in [0, 0, 140, 13]])
        appearance.set_data(b"q /GS gs 1 1 0 rg 0 0 140 13 re f Q")
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            prepared = prepare_page(save(document, directory), scratch, 1)
            self.assertEqual(1, len(prepared.tasks))
            with self.assertRaisesRegex(ValueError, "PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW"):
                apply_annotation_spans(
                    prepared.observation, native_page(prepared.observation, [], set(), []), scratch
                )

    def test_overlapping_decoration_preserves_link_and_existing_emphasis(self):
        original = ObservedSpan(
            start=0, end=8, style=Style(id="original", bold=True), url="https://example.com"
        )
        mark = ObservedSpan(start=2, end=5, style=Style(id="mark", background_color="#ffff00"))
        result = merge_annotation_spans([original], mark)
        self.assertEqual([(0, 2), (2, 5), (5, 8)], [(s.start, s.end) for s in result])
        self.assertTrue(all(s.style.bold and s.url == original.url for s in result))
        self.assertEqual([None, "#ffff00", None], [s.style.background_color for s in result])
        underline = ObservedSpan(
            start=3, end=7, style=Style(id="line", underline=True, decoration_color="#0000ff")
        )
        result = merge_annotation_spans(result, underline)
        covered = [s for s in result if s.start >= 3 and s.end <= 5]
        self.assertEqual(1, len(covered))
        self.assertTrue(covered[0].style.underline)
        self.assertEqual("#ffff00", covered[0].style.background_color)

    def test_conflicting_note_destinations_are_not_silently_replaced(self):
        spans = [
            ObservedSpan(start=0, end=4, note_label="1"),
            ObservedSpan(start=2, end=6, note_label="2"),
        ]
        mark = ObservedSpan(start=0, end=6, style=Style(id="mark", underline=True))
        with self.assertRaisesRegex(ValueError, "PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW"):
            merge_annotation_spans(spans, mark)

    def test_conflicting_overlapping_colors_require_review(self):
        for key in ("background_color", "decoration_color"):
            with self.subTest(key=key):
                original = ObservedSpan(
                    start=0, end=8, style=Style.model_validate({"id": "first", key: "#ffff00"})
                )
                mark = ObservedSpan(
                    start=2, end=5, style=Style.model_validate({"id": "second", key: "#0000ff"})
                )
                with self.assertRaisesRegex(
                    ValueError, "PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW"
                ):
                    merge_annotation_spans([original], mark)
