"""Independent print-face oracle keeps roman connectors and punctuation inside mixed prose."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from ava_pdf_epub.contracts.inline_text import TextValue
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.canonical_text import canonical_text
from ava_pdf_epub.reconstruction_v2.font_region_safety import font_region_safe
from ava_pdf_epub.reconstruction_v2.ocr_font_faces import corroborate_ocr_font_faces
from ava_pdf_epub.reconstruction_v2.ocr_font_runs import qualified_font_runs
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan

from .test_pdf_links import box
from .test_refinement_grouping import segment

TEXT = "Fear and worry: bold."


def printed_source(path, clip=b"0 0 600 710", extra=b""):
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    fonts = DictionaryObject(
        {
            NameObject(name): DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/Font"),
                    NameObject("/Subtype"): NameObject("/Type1"),
                    NameObject("/BaseFont"): NameObject(face),
                }
            )
            for name, face in [
                ("/R", "/Helvetica"),
                ("/I", "/Helvetica-Oblique"),
                ("/B", "/Helvetica-Bold"),
            ]
        }
    )
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): fonts})
    stream = DecodedStreamObject()
    # A source clip cuts only the unrelated top line. Target prose is wholly enclosed.
    stream.set_data(
        b"q " + clip + b" re W n " + extra + b"BT /R 12 Tf 40 704 Td "
        b"(Partly clipped heading) Tj ET BT /I 12 Tf 40 400 Td (Fear) Tj "
        b"/R 12 Tf ( and ) Tj /I 12 Tf (worry) Tj /R 12 Tf (: ) Tj "
        b"/B 12 Tf (bold) Tj /R 12 Tf (.) Tj ET Q"
    )
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)


def face_at(item, index):
    face = item.style.model_dump(include={"family", "bold", "italic"})
    for span in item.spans:
        if span.style and span.start <= index < span.end:
            face.update(
                span.style.model_dump(exclude_none=True, include={"family", "bold", "italic"})
            )
    return face


class MixedFontRuns(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.source = self.root / "source.pdf"
        printed_source(self.source)
        self.prepared = prepare_page(self.source, self.root, 1)
        self.line = next(line for line in self.prepared.observation.lines if line.text == TEXT)
        self.item = segment("mixed", TEXT).model_copy(
            update={
                "box": self.line.box,
                "style": Style(id="base", italic=True, line_height=1.4),
                "spans": [
                    ObservedSpan(
                        start=0,
                        end=len(TEXT),
                        style=Style(id="wrong", italic=True, underline=True, color="#123456"),
                        url="https://example.org",
                    )
                ],
            }
        )

    def qualify(self, item=None, prepared=None):
        state = AssemblyState()
        result = corroborate_ocr_font_faces(
            self.source, [prepared or self.prepared], [item or self.item], state
        )
        return result[0], state

    def test_source_partial_enclosure_does_not_promote_page_transcription(self):
        self.assertIn("conditional_visibility", self.prepared.observation.risks)
        self.assertEqual(1, len(self.prepared.tasks))
        got, state = self.qualify()
        self.assertEqual("ocr", got.method)
        self.assertEqual([], got.native_line_ids)
        self.assertEqual(self.item.text, got.text)
        self.assertEqual(self.item.box, got.box)
        self.assertEqual("OCR_DECLARED_FONT_RUNS_CORROBORATED", state.structure_findings[0].code)
        for word in ("Fear", "worry"):
            self.assertTrue(
                all(
                    face_at(got, i)["italic"]
                    for i in range(TEXT.index(word), TEXT.index(word) + len(word))
                )
            )
        for word in (" and ", ":", "."):
            self.assertTrue(
                all(
                    not face_at(got, i)["italic"] and not face_at(got, i)["bold"]
                    for i in range(TEXT.index(word), TEXT.index(word) + len(word))
                )
            )
        self.assertTrue(face_at(got, TEXT.index("bold"))["bold"])

    def test_link_ranges_nonfont_properties_and_canonical_text_are_conserved(self):
        got, _ = self.qualify()
        self.assertEqual(self.item.spans[0].url, got.spans[0].url)
        self.assertEqual((0, len(TEXT)), (got.spans[0].start, got.spans[0].end))
        self.assertTrue(got.spans[0].style.underline)
        self.assertEqual("#123456", got.spans[0].style.color)
        self.assertEqual(1.4, got.style.line_height)
        self.assertTrue(self.item.spans[0].style.italic)
        canonical = TextValue.model_validate(
            canonical_text(got.text, got.spans, None, "text", AssemblyState())
        )
        self.assertEqual(TEXT, canonical.text)
        self.assertEqual(1, sum(s.link is not None for s in canonical.spans))

    def test_generated_epub_round_trip_keeps_plain_resets_and_link_range(self):
        from ava_pdf_epub.contracts.book import CanonicalBookV2
        from ava_pdf_epub.epub_v2.export import export_epub
        from ava_pdf_epub.epub_v2.portable import portable_epub
        from ava_pdf_epub.reconstruction_v2.assemble_addresses import assemble_addresses
        from tests.epub_v2.helpers import fixture

        got, _ = self.qualify()
        book, assets, _ = fixture()
        state = AssemblyState()
        value = TextValue.model_validate(
            canonical_text(got.text, got.spans, None, "font-test", state)
        )
        block = next(b for b in book.blocks if b.id == "style-demo")
        block = block.model_copy(update={"content": value, "style_id": state.style_id(got.style)})
        blocks = [block if b.id == block.id else b for b in book.blocks]
        state.blocks = [b.model_dump() for b in blocks]
        addresses = assemble_addresses(state, [c.model_dump() for c in book.chapters])
        candidate = book.model_copy(
            update={
                "blocks": blocks,
                "styles": [*book.styles, *(Style.model_validate(v) for v in state.styles.values())],
                "addresses": [type(book.addresses[0]).model_validate(a) for a in addresses],
            }
        )
        candidate = CanonicalBookV2.model_validate(candidate.model_dump())
        imported, _ = portable_epub(export_epub(candidate, assets))
        self.assertEqual(candidate, imported)
        self.assertEqual(TEXT, next(b for b in imported.blocks if b.id == block.id).content.text)
        self.assertEqual(1, sum(s.link is not None for s in block.content.spans))

    def test_clip_crossing_target_and_unknown_opacity_are_not_qualified(self):
        for clip, extra in [
            (b"41 0 559 710", b""),
            (b"0 0 600 402", b""),
            (b"0 0 600 710", b"/Unknown gs "),
        ]:
            with self.subTest(clip=clip, extra=extra):
                printed_source(self.source, clip, extra)
                got, state = self.qualify()
                self.assertEqual(self.item, got)
                self.assertEqual([], state.structure_findings)

    def test_offset_crop_and_rotated_mapping_cannot_supply_font_authority(self):
        from pypdf import PdfReader

        reader = PdfReader(self.source)
        for update in ("crop", "rotation"):
            page = reader.pages[0]
            if update == "crop":
                page.cropbox.lower_left = (1, 0)
            else:
                page.cropbox.lower_left = (0, 0)
                page.rotate(90)
            self.assertFalse(font_region_safe(page, reader, self.prepared.observation, [self.line]))

    def test_different_transcription_and_unknown_face_keep_unqualified_model(self):
        item = self.item.model_copy(update={"text": TEXT.replace("Fear", "Dear")})
        got, state = self.qualify(item=item)
        self.assertEqual(item, got)
        self.assertEqual([], state.structure_findings)
        line = self.line.model_copy(
            update={
                "glyphs": [
                    g.model_copy(update={"font": "Unknown"}) if g.text == "F" else g
                    for g in self.line.glyphs
                ]
            }
        )
        self.assertIsNone(qualified_font_runs(self.item, line.glyphs))

    def test_exact_unicode_positions_and_layout_whitespace_do_not_change_text(self):
        from ava_pdf_epub.reconstruction_v2.observations import Glyph

        text = "Ї😀 і е\u0301:"
        glyphs = [
            Glyph(
                text=c,
                box=box(i * 2, 20, i * 2 + 1, 30),
                size=10,
                font="MinionPro-It" if i in (0, 1, 5, 6) else "MinionPro-Regular",
                visible=True,
            )
            for i, c in enumerate(text)
        ]
        item = segment("unicode", text).model_copy(update={"spans": []})
        got = qualified_font_runs(item, glyphs)
        self.assertIsNotNone(got)
        self.assertEqual(text, got.text)
        self.assertFalse(face_at(got, 3)["italic"])
        self.assertFalse(face_at(got, 7)["italic"])
        self.assertTrue(face_at(got, 6)["italic"])
        item = item.model_copy(update={"text": text.replace(" ", "\n")})
        self.assertEqual(item.text, qualified_font_runs(item, glyphs).text)
