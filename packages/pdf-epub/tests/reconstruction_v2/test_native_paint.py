"""Authored paint operations qualify native text; hidden or ambiguous paint stays reviewed."""

import hashlib
import io
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from pypdf.generic import (
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
)

from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from tests.admission.appearance_fixture import annotated_document
from tests.admission.helpers import save


def painted_document(body, *, image_clip=False):
    document = annotated_document()
    for page in document.pages:
        if "/Annots" in page:
            del page[NameObject("/Annots")]
        stream = DecodedStreamObject()
        prefix = b""
        if image_clip:
            image = DecodedStreamObject()
            image.set_data(b"\x00\x80\xff")
            image.update(
                {
                    NameObject("/Type"): NameObject("/XObject"),
                    NameObject("/Subtype"): NameObject("/Image"),
                    NameObject("/Width"): NumberObject(1),
                    NameObject("/Height"): NumberObject(1),
                    NameObject("/ColorSpace"): NameObject("/DeviceRGB"),
                    NameObject("/BitsPerComponent"): NumberObject(8),
                }
            )
            page["/Resources"][NameObject("/XObject")] = DictionaryObject(
                {NameObject("/Logo"): document._add_object(image)}
            )
            prefix = b"q 250 20 20 10 re W* n 20 0 0 10 250 20 cm /Logo Do Q "
        stream.set_data(prefix + body)
        page[NameObject("/Contents")] = document._add_object(stream)
    return document


class NativePaintTests(unittest.TestCase):
    def prepare(self, body, **kwargs):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        return prepare_page(
            save(painted_document(body, **kwargs), root),
            root,
            1,
            source_feature_policy=FEATURE_POLICY,
        )

    def test_image_only_local_clip_restored_before_text_does_not_hide_native_glyphs(self):
        result = self.prepare(
            b"BT /F1 10 Tf 20 250 Td (Ordinary native words remain.) Tj ET", image_clip=True
        )
        self.assertEqual([], result.observation.risks)
        self.assertEqual([], result.tasks)
        self.assertEqual("Ordinary native words remain.", result.native_segments[0].text)

    def test_qualified_fill_stroke_binds_bold_to_exact_glyphs_and_leaves_other_runs_regular(self):
        result = self.prepare(
            b"BT /F1 10 Tf 20 250 Td (Plain ) Tj "
            b"0.28 w 2 Tr (emphasis) Tj 0 Tr ( stays plain.) Tj ET"
        )
        self.assertEqual([], result.observation.risks)
        self.assertEqual([], result.tasks)
        line = result.observation.lines[0]
        self.assertEqual("Plain emphasis stays plain.", line.text)
        span = next(s for s in result.native_segments[0].spans if s.style.bold)
        self.assertEqual("emphasis", result.native_segments[0].text[span.start : span.end])
        self.assertFalse(result.native_segments[0].style.bold)

    def test_zero_or_heavy_width_distinct_colors_and_nonuniform_transform_stay_reviewed(self):
        for paint in [
            b"0 w 2 Tr",
            b"2 w 2 Tr",
            b"1 0 0 RG 0 g 0.28 w 2 Tr",
            b"2 0 0 1 0 0 Tm 0.28 w 2 Tr",
            b"0.1 0 0 0.1 20 250 Tm 0.28 w 2 Tr",
        ]:
            with self.subTest(paint=paint):
                result = self.prepare(
                    b"BT /F1 10 Tf 20 250 Td " + paint + b" (Source words.) Tj ET"
                )
                self.assertIn("nonstandard_text_rendering", result.observation.risks)
                self.assertEqual(1, len(result.tasks))

    def test_hidden_stroke_only_clip_modes_and_text_under_local_clip_stay_reviewed(self):
        for mode in (1, 3, 4, 5, 6, 7):
            with self.subTest(mode=mode):
                result = self.prepare(
                    f"BT /F1 10 Tf 20 250 Td {mode} Tr (Source words.) Tj ET".encode()
                )
                self.assertIn("nonstandard_text_rendering", result.observation.risks)
        result = self.prepare(
            b"q 20 250 5 10 re W n BT /F1 10 Tf 20 250 Td (Source words.) Tj ET Q"
        )
        self.assertIn("conditional_visibility", result.observation.risks)
        self.assertEqual(1, len(result.tasks))

    def test_qualified_colored_emphasis_survives_source_canonical_visible_epub_and_reimport(self):
        body = (
            b"BT /F1 10 Tf 20 250 Td (Plain ) Tj "
            b"1 0.5 0 RG 1 0.5 0 rg 0.28 w 2 Tr (emphasis) Tj "
            b"0 Tr 0 g ( stays plain.) Tj ET"
        )
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = save(painted_document(body), root)
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            pages = prepare_source(
                source, root / "scratch", digest, source_feature_policy=FEATURE_POLICY
            )
            self.assertFalse(any(p.tasks for p in pages))
            result = reconstruct(source, root / "scratch", pages, [])
            self.assertEqual(digest, hashlib.sha256(source.read_bytes()).hexdigest())
            block = next(
                b
                for b in result.book.blocks
                if hasattr(b, "content") and b.content.text == "Plain emphasis stays plain."
            )
            styles = {s.id: s for s in result.book.styles}
            highlighted = [s for s in block.content.spans if s.style_id and styles[s.style_id].bold]
            self.assertEqual(
                "emphasis", "".join(block.content.text[s.start : s.end] for s in highlighted)
            )
            self.assertTrue(all(styles[s.style_id].color == "#ff8000" for s in highlighted))
            imported, assets = portable_epub(result.epub)
            self.assertEqual(result.book, imported)
            self.assertEqual(result.assets, assets)
            with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
                document = ET.fromstring(
                    archive.read(next(n for n in archive.namelist() if n.startswith("EPUB/text/")))
                )
                self.assertIn("emphasis", "".join(document.itertext()))
                css = archive.read("EPUB/styles/book.css").decode()
                self.assertIn("color:#ff8000", css.replace(" ", ""))

    def test_regular_fill_color_is_exact_inline_source_ink_and_neutral_body_stays_themeable(self):
        result = self.prepare(
            b"BT /F1 10 Tf 20 250 Td 0 0 1 rg (12.) Tj 0 g ( Ordinary words remain regular.) Tj ET"
        )
        self.assertEqual([], result.observation.risks)
        self.assertEqual([], result.tasks)
        line = result.observation.lines[0]
        self.assertEqual("12. Ordinary words remain regular.", line.text)
        marker = [g for g in line.glyphs if g.paint_color == "#0000ff"]
        self.assertEqual("12.", "".join(g.text for g in marker))
        self.assertFalse(any(g.paint_bold for g in line.glyphs))
        segment = result.native_segments[0]
        colored = [s for s in segment.spans if s.style.color == "#0000ff"]
        self.assertEqual("12.", "".join(segment.text[s.start : s.end] for s in colored))
        self.assertIsNone(segment.style.color)

    def test_absent_policy_keeps_old_review_and_absent_glyph_extensions_keep_serialization(self):
        from ava_pdf_epub.reconstruction_v2.observations import Glyph

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            body = b"BT /F1 10 Tf 20 250 Td 0.28 w 2 Tr (Authored emphasis.) Tj ET"
            legacy = prepare_page(save(painted_document(body), root), root, 1)
            self.assertIn("nonstandard_text_rendering", legacy.observation.risks)
            self.assertEqual(1, len(legacy.tasks))
            for line in legacy.observation.lines:
                for glyph in line.glyphs:
                    raw = glyph.model_dump(mode="json")
                    self.assertNotIn("paint_bold", raw)
                    self.assertNotIn("paint_color", raw)
                    self.assertEqual(glyph, Glyph.model_validate(raw))
