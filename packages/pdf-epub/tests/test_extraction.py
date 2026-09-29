"""Synthetic sources only: no copyrighted book text or private paths in fixtures."""

from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
    TextStringObject,
)

from ava_pdf_epub.benchmark import import_benchmark
from ava_pdf_epub.extract import extract_native, inspect_pdf
from ava_pdf_epub.models import Block, Chapter, Evidence, Page, Span
from ava_pdf_epub.reconstruction import (
    chapters_from_plan,
    digest_text,
    inline_spans,
    join_continuations,
    resolve_notes,
)


def fixture_pdf(path: Path, count: int = 1, annotation: bool = False) -> None:
    writer = PdfWriter()
    for _ in range(count):
        page = writer.add_blank_page(width=400, height=600)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
        )
        stream = DecodedStreamObject()
        stream.set_data(
            b"BT /F1 24 Tf 40 550 Td (Fixture title) Tj "
            b"/F1 12 Tf 0 -40 Td (First ordinary sentence.) Tj ET"
        )
        page[NameObject("/Contents")] = writer._add_object(stream)
        if annotation:
            annot = DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/Annot"),
                    NameObject("/Subtype"): NameObject("/Text"),
                    NameObject("/Rect"): ArrayObject([NumberObject(x) for x in (10, 10, 20, 20)]),
                    NameObject("/Contents"): TextStringObject("private"),
                }
            )
            page[NameObject("/Annots")] = ArrayObject([writer._add_object(annot)])
    with path.open("wb") as stream:
        writer.write(stream)


def block(id_: str, text: str, page: int, **extra: object) -> Block:
    return Block(
        id=id_,
        kind="paragraph",
        text=text,
        evidence=[Evidence(page=page, method="replay")],
        **extra,
    )


class ReconstructionTests(unittest.TestCase):
    def test_exact_inline_unicode_and_rejected_injection(self) -> None:
        spans, warnings = inline_spans("A 🦊 phrase", "A <em>🦊</em> phrase")
        self.assertEqual([(s.start, s.end) for s in spans], [(2, 3)])
        self.assertEqual(warnings, [])
        spans, warnings = inline_spans("Safe", '<em onclick="x">Safe</em>')
        self.assertFalse(spans)
        self.assertTrue(warnings)
        self.assertTrue(inline_spans("A  B", "A B")[1])

    def test_partial_markup_smallcaps_and_self_closing_break(self) -> None:
        spans, warnings = inline_spans("Before. A special word. After.", "A <em>special</em> word.")
        self.assertEqual(warnings, ["inline_fragment_aligned"])
        self.assertEqual((spans[0].start, spans[0].end), (10, 17))
        spans, warnings = inline_spans("A\nB", "A<br/>B")
        self.assertEqual((spans, warnings), ([], []))
        spans, warnings = inline_spans(
            "A word", '<span style="font-variant:small-caps">A</span> word'
        )
        self.assertFalse(warnings)
        self.assertEqual(spans[0].kind, "smallcaps")
        self.assertTrue(inline_spans("A A", "<em>A</em>")[1])
        self.assertTrue(inline_spans("word", '<span style="display:none">word</span>')[1])

    def test_note_spacing_alignment_does_not_change_word_boundaries(self) -> None:
        text = "Phrase. 1 Next."
        spans, warnings = inline_spans(text, 'Phrase.<a href="#fn1"><sup>1</sup></a> Next.')
        self.assertEqual(warnings, ["inline_reference_spacing_aligned"])
        ref = next(s for s in spans if s.kind == "noteref")
        self.assertEqual(text[ref.start : ref.end], "1")
        self.assertEqual(ref.start, 8)
        self.assertEqual(inline_spans("two words", "<em>twowords</em>")[0], [])

    def test_note_labels_are_scoped_and_duplicates_not_guessed(self) -> None:
        pages = []
        for n in (1, 2):
            body = block(
                f"body{n}", "Text1", n, spans=[Span(start=4, end=5, kind="noteref", target="#fn1")]
            )
            note = Block(
                id=f"note{n}",
                kind="note",
                text="A note",
                label="1",
                evidence=[Evidence(page=n, method="replay")],
            )
            pages.append(
                Page(number=n, width=400.0, height=600.0, route="replay", blocks=[body, note])
            )
        self.assertEqual(resolve_notes(pages), [])
        self.assertEqual(pages[0].blocks[0].spans[0].target, "note1")
        self.assertEqual(pages[1].blocks[0].spans[0].target, "note2")
        pages[0].blocks[0].spans = [Span(start=4, end=5, kind="noteref", target="#fn1")]
        pages[0].blocks.append(pages[0].blocks[1].model_copy(update={"id": "noteextra"}))
        self.assertTrue(resolve_notes(pages))
        self.assertEqual(pages[0].blocks[0].spans, [])

    def test_midpage_chapter_uses_heading_not_first_block(self) -> None:
        before = block("before", "Previous chapter ending", 1)
        heading = Block(
            id="heading",
            kind="heading",
            text="Second chapter",
            evidence=[Evidence(page=1, method="replay")],
        )
        page = Page(number=1, width=400.0, height=600.0, route="replay", blocks=[before, heading])
        chapters, issues = chapters_from_plan(
            [page], [{"title": "Second chapter", "page_index": 1}]
        )
        self.assertFalse(issues)
        self.assertEqual([c.start_block_id for c in chapters], ["before", "heading"])

    def test_join_realigns_unicode_styles_and_preserves_pages(self) -> None:
        first = block("first", "First", 1, continues_to_next=True)
        second = block(
            "second",
            "🦊 next",
            2,
            continues_from_previous=True,
            spans=[Span(start=0, end=1, kind="em")],
        )
        pages = [
            Page(number=1, width=400.0, height=600.0, route="replay", blocks=[first]),
            Page(number=2, width=400.0, height=600.0, route="replay", blocks=[second]),
        ]
        join_continuations(pages, [Chapter(id="chapter", title="Book", start_block_id="first")])
        self.assertEqual(pages[0].blocks[0].text, "First 🦊 next")
        self.assertEqual(pages[0].blocks[0].spans[0].start, 6)
        self.assertEqual(pages[0].blocks[0].text_sha256, digest_text("First 🦊 next"))
        self.assertEqual(len(pages), 2)
        self.assertEqual(len(pages[0].blocks[0].evidence), 2)
        self.assertEqual([(p.page, p.offset) for p in pages[0].blocks[0].page_breaks], [(2, 6)])

    def test_join_never_crosses_empty_page_but_tracks_three_page_chain(self) -> None:
        def page(n: int, text: str) -> Page:
            return Page(
                number=n,
                width=400.0,
                height=600.0,
                route="replay",
                blocks=[
                    block(f"p{n}", text, n, continues_to_next=n < 3, continues_from_previous=n > 1)
                ]
                if text
                else [],
            )

        pages = [page(1, "One"), page(2, ""), page(3, "three")]
        issues = join_continuations(pages, [Chapter(id="ch", title="Book", start_block_id="p1")])
        self.assertTrue(issues)
        self.assertEqual(pages[0].blocks[0].text, "One")
        self.assertEqual(pages[2].blocks[0].text, "three")
        pages = [page(1, "One"), page(2, "two"), page(3, "three")]
        join_continuations(pages, [Chapter(id="ch", title="Book", start_block_id="p1")])
        self.assertEqual(pages[0].blocks[0].text, "One two three")
        self.assertEqual(
            [(p.page, p.offset) for p in pages[0].blocks[0].page_breaks], [(2, 4), (3, 8)]
        )

    def test_hyphens_and_chapter_boundaries_not_joined(self) -> None:
        first = block("first", "A com-", 1, continues_to_next=True)
        second = block("second", "pound", 2, continues_from_previous=True)
        pages = [
            Page(number=1, width=400.0, height=600.0, route="replay", blocks=[first]),
            Page(number=2, width=400.0, height=600.0, route="replay", blocks=[second]),
        ]
        issues = join_continuations(pages, [Chapter(id="ch", title="Book", start_block_id="first")])
        self.assertEqual(issues[0].code, "ambiguous_boundary_hyphen")
        self.assertEqual(pages[1].blocks[0].text, "pound")


class ExtractionTests(unittest.TestCase):
    def test_native_geometry_and_source_hash(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            pdf = root / "fixture.pdf"
            fixture_pdf(pdf)
            info = inspect_pdf(pdf)
            self.assertEqual(info["page_count"], 1)
            book = extract_native(pdf, root / "assets")
            self.assertEqual(book.source_sha256, hashlib.sha256(pdf.read_bytes()).hexdigest())
            self.assertEqual(book.pages[0].blocks[0].kind, "heading")
            self.assertIsNotNone(book.pages[0].blocks[0].evidence[0].bbox)
            self.assertTrue(book.issues)

    def test_hidden_native_text_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            pdf = root / "hidden.pdf"
            fixture_pdf(pdf)
            writer = PdfWriter(clone_from=pdf)
            stream = DecodedStreamObject()
            stream.set_data(b"BT /F1 12 Tf 3 Tr 40 500 Td (Hidden secret) Tj ET")
            writer.pages[0][NameObject("/Contents")] = writer._add_object(stream)
            writer.write(pdf)
            with self.assertRaisesRegex(ValueError, "hidden text rendering"):
                extract_native(pdf, root / "assets")

    def test_occluding_rectangle_and_rotation_require_review(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            pdf = root / "opaque.pdf"
            fixture_pdf(pdf)
            writer = PdfWriter(clone_from=pdf)
            stream = DecodedStreamObject()
            stream.set_data(b"BT /F1 12 Tf 40 500 Td (Hidden secret) Tj ET 0 g 35 495 150 20 re f")
            writer.pages[0][NameObject("/Contents")] = writer._add_object(stream)
            writer.write(pdf)
            with self.assertRaisesRegex(ValueError, "opaque rectangle"):
                extract_native(pdf, root / "assets")
            fixture_pdf(pdf)
            writer = PdfWriter(clone_from=pdf)
            writer.pages[0].rotate(90)
            writer.write(pdf)
            inspected = inspect_pdf(pdf)
            self.assertEqual(
                (inspected["pages"][0]["width"], inspected["pages"][0]["height"]), (600.0, 400.0)
            )
            with self.assertRaisesRegex(ValueError, "coordinate qualification"):
                extract_native(pdf, root / "assets")

    def test_cropbox_translates_visible_text_and_excludes_outside_text(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            pdf = root / "crop.pdf"
            fixture_pdf(pdf)
            writer = PdfWriter(clone_from=pdf)
            page = writer.pages[0]
            page.cropbox.lower_left = (20, 40)
            page.cropbox.upper_right = (380, 580)
            contents = page.get_contents()
            assert contents is not None
            stream = DecodedStreamObject()
            stream.set_data(contents.get_data() + b" BT /F1 10 Tf 25 590 Td (OUTSIDE SECRET) Tj ET")
            page[NameObject("/Contents")] = writer._add_object(stream)
            writer.write(pdf)
            book = extract_native(pdf, root / "assets")
            self.assertEqual((book.pages[0].width, book.pages[0].height), (360.0, 540.0))
            text = "\n".join(b.text for b in book.pages[0].blocks)
            self.assertIn("Fixture title", text)
            self.assertNotIn("OUTSIDE", text)
            self.assertTrue(
                any(i.code == "outside_crop_text_excluded" for i in book.pages[0].issues)
            )
            bbox = book.pages[0].blocks[0].evidence[0].bbox
            assert bbox is not None
            self.assertEqual(bbox[0], 20.0)
            self.assertTrue(0 <= bbox[1] < bbox[3] <= 540.0)

    def test_cropbox_partially_clipped_glyph_requires_review(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            pdf = root / "clipped.pdf"
            fixture_pdf(pdf)
            writer = PdfWriter(clone_from=pdf)
            page = writer.pages[0]
            page.cropbox.lower_left = (20, 40)
            page.cropbox.upper_right = (380, 580)
            contents = page.get_contents()
            assert contents is not None
            stream = DecodedStreamObject()
            stream.set_data(contents.get_data() + b" BT /F1 12 Tf 18 450 Td (W) Tj ET")
            page[NameObject("/Contents")] = writer._add_object(stream)
            writer.write(pdf)
            with self.assertRaisesRegex(ValueError, "Partially clipped native glyph"):
                extract_native(pdf, root / "assets")

    @unittest.skipUnless(shutil.which("pdftoppm"), "Poppler required")
    def test_native_figure_is_cropped_and_source_linked(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            pdf = root / "image.pdf"
            fixture_pdf(pdf)
            writer = PdfWriter(clone_from=pdf)
            image = DecodedStreamObject()
            image.set_data(bytes([10, 80, 190] * 4))
            image.update(
                {
                    NameObject("/Type"): NameObject("/XObject"),
                    NameObject("/Subtype"): NameObject("/Image"),
                    NameObject("/Width"): NumberObject(2),
                    NameObject("/Height"): NumberObject(2),
                    NameObject("/ColorSpace"): NameObject("/DeviceRGB"),
                    NameObject("/BitsPerComponent"): NumberObject(8),
                }
            )
            writer.pages[0]["/Resources"][NameObject("/XObject")] = DictionaryObject(
                {NameObject("/Im0"): writer._add_object(image)}
            )
            contents = writer.pages[0].get_contents()
            assert contents is not None
            stream = DecodedStreamObject()
            stream.set_data(contents.get_data() + b"\nq 100 0 0 60 40 250 cm /Im0 Do Q")
            writer.pages[0][NameObject("/Contents")] = writer._add_object(stream)
            writer.pages[0].cropbox.lower_left = (20, 40)
            writer.pages[0].cropbox.upper_right = (380, 580)
            writer.write(pdf)
            book = extract_native(pdf, root / "assets")
            self.assertEqual(len(book.assets), 1)
            self.assertEqual(book.assets[0].evidence[0].coordinate_space, "normalized_top_left")
            self.assertEqual(book.pages[0].blocks[-1].asset_id, book.assets[0].id)
            self.assertTrue((root / "assets" / book.assets[0].path).is_file())
            bbox = book.assets[0].evidence[0].bbox
            assert bbox is not None
            self.assertAlmostEqual(bbox[0], 20.0 / 360.0)
            self.assertAlmostEqual(bbox[1], 270.0 / 540.0)

    def test_annotations_rejected_without_leaking_contents(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            pdf = Path(folder) / "annotated.pdf"
            fixture_pdf(pdf, annotation=True)
            with self.assertRaisesRegex(ValueError, "annotations require review") as error:
                inspect_pdf(pdf)
            self.assertNotIn("private", str(error.exception))

    @unittest.skipUnless(shutil.which("pdftoppm"), "Poppler required for source cover fixture")
    def test_replay_hashes_and_chapter_binding(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            pdf, run = root / "fixture.pdf", root / "run"
            fixture_pdf(pdf)
            (run / "pages").mkdir(parents=True)
            source_hash = hashlib.sha256(pdf.read_bytes()).hexdigest()
            page = {
                "page_index": 1,
                "printed_page": "1",
                "warnings": [],
                "blocks": [
                    {"id": "p0001-b0001", "type": "paragraph", "text": "Previous text"},
                    {"id": "p0001-b0002", "type": "heading", "level": 1, "text": "Fixture title"},
                    {"id": "p0001-b0003", "type": "page_number", "text": "1"},
                ],
            }
            page_path = run / "pages/0001.json"
            page_path.write_text(json.dumps(page))
            config_path = run / "config.json"
            config_path.write_text(json.dumps({"source_sha256": source_hash}))
            plan = {
                "metadata": {"title": "Fixture"},
                "chapters": [{"title": "Fixture title", "page_index": 1}],
                "finalization": {
                    "source_sha256": source_hash,
                    "source_page_count": 1,
                    "status": "complete",
                    "run_config_sha256": hashlib.sha256(config_path.read_bytes()).hexdigest(),
                    "candidate_page_sha256": {
                        "pages/0001.json": hashlib.sha256(page_path.read_bytes()).hexdigest()
                    },
                },
            }
            (run / "book-plan-finalized.json").write_text(json.dumps(plan))
            book = import_benchmark(pdf, run, root / "assets")
            self.assertEqual(book.chapters[-1].start_block_id, "p0001-b0002")
            self.assertEqual(len(book.pages[0].blocks), 2)
            self.assertIsNotNone(book.cover_asset_id)
            self.assertTrue(
                any(i.code == "source_furniture_excluded" for i in book.pages[0].issues)
            )
            page_path.write_text(json.dumps(page) + " ")
            with self.assertRaisesRegex(ValueError, "changed since finalization"):
                import_benchmark(pdf, run, root / "assets")


if __name__ == "__main__":
    unittest.main()
