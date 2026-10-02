import hashlib
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, TextStringObject

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.pdf_navigation import NavigationTarget, navigation_uri, pdf_navigation
from ava_pdf_epub.reconstruction_v2.annotation_words import AnnotationWord
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.observations import PageObservation
from ava_pdf_epub.reconstruction_v2.pdf_links import (
    apply_pdf_links,
    glyph_ranges,
    page_target,
    scanned_ranges,
)
from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

from .test_native_literal import responses, source_pdf
from .test_refinement_grouping import segment


def box(x0=0, y0=20, x1=20, y1=30):
    return Box(coordinate_space="page_points_top_left", x0=x0, y0=y0, x1=x1, y1=y1)


def observation():
    return PageObservation.model_validate(
        dict(
            number=1,
            width_pt=100,
            height_pt=100,
            rotation=0,
            render_path="page.png",
            render_sha256="a" * 64,
            render_width=100,
            render_height=100,
            graphics=[],
            risks=[],
            lines=[
                dict(
                    id="line",
                    text="Go",
                    box=box().model_dump(),
                    style={"id": "base"},
                    glyphs=[
                        dict(
                            text=c,
                            box=box(x0=i * 10, x1=(i + 1) * 10).model_dump(),
                            font="test",
                            size=10,
                            visible=True,
                        )
                        for i, c in enumerate("Go")
                    ],
                )
            ],
        )
    )


class PdfLinkTests(unittest.TestCase):
    def test_visual_ink_box_can_differ_from_font_envelope_within_source_margin(self):
        page = observation()
        ink = segment("ink", "Go").model_copy(update={"box": box(1, 22, 19, 28)})
        self.assertEqual([("ink", 0, 2)], glyph_ranges(page, [ink], box(), corroborate_ocr=True))
        displaced = ink.model_copy(update={"box": box(1, 26, 19, 29)})
        with self.assertRaises(ValueError):
            glyph_ranges(page, [displaced], box(), corroborate_ocr=True)

    def test_visual_transcription_can_corroborate_visible_native_geometry(self):
        page = observation().model_copy(
            update={"risks": ["conditional_visibility", "nonstandard_text_rendering"]}
        )
        item = segment("visual", "prefix Go suffix").model_copy(update={"box": box()})
        self.assertEqual(
            [("visual", 7, 9)], glyph_ranges(page, [item], box(), corroborate_ocr=True)
        )
        padded = page.model_copy(
            update={"lines": [page.lines[0].model_copy(update={"text": " Go  "})]}
        )
        self.assertEqual(
            [("visual", 7, 9)], glyph_ranges(padded, [item], box(), corroborate_ocr=True)
        )
        self.assertEqual([], item.native_line_ids)
        self.assertEqual("ocr", item.method)
        for changed, owners in (
            (page, [item.model_copy(update={"text": "prefix Gone suffix"})]),
            (page, [item.model_copy(update={"text": "Go Go"})]),
            (page, [item, item.model_copy(update={"id": "duplicate"})]),
            (page, [item.model_copy(update={"box": box(30, 20, 50, 30)})]),
            (page.model_copy(update={"risks": ["unreliable_glyph_mapping"]}), [item]),
        ):
            with self.subTest(owners=owners), self.assertRaises(ValueError):
                glyph_ranges(changed, owners, box(), corroborate_ocr=True)

    def test_scanned_page_uses_one_geometry_call_for_duplicate_links(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.pdf"
            writer = PdfWriter()
            writer.add_blank_page(width=100, height=100)
            for _ in range(2):
                annotation = DictionaryObject(
                    {
                        NameObject("/Subtype"): NameObject("/Link"),
                        NameObject("/Rect"): ArrayObject(
                            [NumberObject(v) for v in (10, 70, 90, 80)]
                        ),
                        NameObject("/A"): DictionaryObject(
                            {
                                NameObject("/S"): NameObject("/URI"),
                                NameObject("/URI"): TextStringObject("https://example.org"),
                            }
                        ),
                    }
                )
                writer.add_annotation(0, annotation)
            writer.write(path)
            checkpoint = PreparedPage(
                schema_version="ava-prepared-page-1",
                source_sha256="a" * 64,
                source_byte_length=path.stat().st_size,
                source_page_count=1,
                observation=observation().model_copy(update={"lines": []}),
                tables=[],
                native_segments=[],
                tasks=[],
            )
            words = [AnnotationWord((1, 1, 1), 1, "Visit", 95, box(10, 20, 90, 30))]
            original = segment("scan", "Visit")
            with patch(
                "ava_pdf_epub.reconstruction_v2.pdf_links.recognize_annotation_words",
                return_value=words,
            ) as recognize:
                result = apply_pdf_links(
                    path, [checkpoint], [original], AssemblyState(), path.parent
                )
            self.assertEqual(1, recognize.call_count)
            self.assertEqual("Visit", result[0].text)
            self.assertEqual([], original.spans)
            self.assertEqual(1, len(result[0].spans))
            self.assertEqual("https://example.org", result[0].spans[0].url)
            styled = original.model_copy(
                update={
                    "spans": [
                        ObservedSpan(
                            start=0,
                            end=5,
                            url="https://example.org",
                            style=Style(id="source-underline", underline=True),
                        )
                    ]
                }
            )
            with patch(
                "ava_pdf_epub.reconstruction_v2.pdf_links.recognize_annotation_words",
                return_value=words,
            ):
                retained = apply_pdf_links(
                    path, [checkpoint], [styled], AssemblyState(), path.parent
                )
                self.assertEqual(styled.spans, retained[0].spans)
                for bad in [
                    styled.spans[0].model_copy(update={"url": "https://other.example"}),
                    styled.spans[0].model_copy(update={"end": 4}),
                ]:
                    with self.assertRaises(ValueError):
                        apply_pdf_links(
                            path,
                            [checkpoint],
                            [styled.model_copy(update={"spans": [bad]})],
                            AssemblyState(),
                            path.parent,
                        )

    def test_scanned_link_offsets_preserve_exact_transcription(self):
        words = [
            AnnotationWord((1, 1, 1), 1, "Visit", 95, box(10, 20, 40, 30)),
            AnnotationWord((1, 1, 1), 2, "our", 95, box(45, 20, 60, 30)),
            AnnotationWord((1, 1, 1), 3, "site", 95, box(65, 20, 90, 30)),
        ]
        item = segment("scan", "Prefix. Visit  our site Suffix.")
        self.assertEqual([("scan", 8, 23)], scanned_ranges([item], box(10, 20, 90, 30), words))
        self.assertEqual([("scan", 19, 23)], scanned_ranges([item], box(65, 20, 90, 30), words))
        self.assertEqual("Prefix. Visit  our site Suffix.", item.text)
        for candidates, rectangle, observed in (
            ([item, item.model_copy(update={"id": "duplicate"})], box(10, 20, 90, 30), words),
            ([item], box(70, 20, 90, 30), words),
            ([item], box(10, 20, 90, 30), [replace(w, confidence=40) for w in words]),
            ([item], box(10, 20, 90, 30), [replace(w, visible=False) for w in words]),
            ([item.model_copy(update={"text": "Visit our website"})], box(10, 20, 90, 30), words),
            ([item.model_copy(update={"box": box(10, 20, 60, 30)})], box(10, 20, 90, 30), words),
            ([item], box(120, 20, 150, 30), words),
        ):
            with self.subTest(rectangle=rectangle), self.assertRaises(ValueError):
                scanned_ranges(candidates, rectangle, observed)

    def test_uri_resolution_is_bounded_and_scheme_derivation_is_explicit(self):
        for raw, expected, derived in (
            ("https://example.org/a", "https://example.org/a", False),
            ("mailto:reader@example.org", "mailto:reader@example.org", False),
            ("www.example.org/a#b", "https://www.example.org/a#b", True),
        ):
            result = navigation_uri(raw)
            self.assertEqual((expected, derived), (result.url, result.derived_scheme))
        self.assertEqual(
            "https://example.org/b", navigation_uri("../b", "https://example.org/a/").url
        )
        for raw in (
            "javascript:alert(1)",
            "file:///etc/passwd",
            "//example.org",
            "www.-bad.org",
            "www.example.org@evil.org",
            "www.example.org\\x",
            "www.example.org\x00",
            "other-relative",
        ):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                navigation_uri(raw)

    def test_literal_script_is_data_and_named_goto_resolves_source_page(self):
        with tempfile.TemporaryDirectory() as directory:
            writer = PdfWriter()
            for _ in range(3):
                writer.add_blank_page(width=100, height=100)
            writer.add_named_destination("target", 2)
            path = Path(directory) / "source.pdf"
            writer.write(path)
            reader = PdfReader(path, strict=True)

            def link(kind, key, value):
                return DictionaryObject(
                    {
                        NameObject("/Subtype"): NameObject("/Link"),
                        NameObject("/A"): DictionaryObject(
                            {
                                NameObject("/S"): NameObject(kind),
                                NameObject(key): TextStringObject(value),
                            }
                        ),
                    }
                )

            self.assertEqual(
                3,
                pdf_navigation(
                    reader, link("/JavaScript", "/JS", "this.zoom=100;this.pageNum=2")
                ).page,
            )
            self.assertEqual(3, pdf_navigation(reader, link("/GoTo", "/D", "target")).page)
            direct = DictionaryObject(
                {
                    NameObject("/Subtype"): NameObject("/Link"),
                    NameObject("/Dest"): TextStringObject("target"),
                }
            )
            self.assertEqual(3, pdf_navigation(reader, direct).page)
            direct[NameObject("/Dest")] = ArrayObject(
                [reader.pages[2].indirect_reference, NameObject("/Fit")]
            )
            self.assertEqual(3, pdf_navigation(reader, direct).page)

            for wrong in (
                link("/JavaScript", "/JS", "this.zoom=100;this.pageNum=3"),
                link("/JavaScript", "/JS", "app.alert(1)"),
                link("/Launch", "/F", "local.exe"),
            ):
                with self.assertRaises(ValueError):
                    pdf_navigation(reader, wrong)

    def test_link_rectangle_maps_exact_native_glyph_range(self):
        owner = segment("owner", "prefix Go suffix").model_copy(
            update={"method": "native", "native_line_ids": ["line"]}
        )
        self.assertEqual([("owner", 7, 9)], glyph_ranges(observation(), [owner], box()))
        for selected, owners in ((box(x0=5), [owner]), (box(x0=30, x1=40), [owner]), (box(), [])):
            with self.assertRaises(ValueError):
                glyph_ranges(observation(), owners, selected)
        duplicated = owner.model_copy(update={"text": "Go Go"})
        with self.assertRaises(ValueError):
            glyph_ranges(observation(), [duplicated], box())

    def test_destination_point_maps_exact_line_offset_and_rejects_missing_page(self):
        with tempfile.TemporaryDirectory() as directory:
            writer = PdfWriter()
            writer.add_blank_page(width=100, height=100)
            path = Path(directory) / "source.pdf"
            writer.write(path)
            reader = PdfReader(path)
            owner = segment("owner", "prefix Go suffix").model_copy(
                update={"method": "native", "native_line_ids": ["line"]}
            )
            self.assertEqual(
                ("owner", 7),
                page_target(NavigationTarget(page=1, top=80), [owner], reader, observation()),
            )
            self.assertEqual(
                ("owner", 0), page_target(NavigationTarget(page=1), [owner], reader, observation())
            )
            with self.assertRaises(ValueError):
                page_target(NavigationTarget(page=2), [owner], reader, observation())

    def test_horizontal_destination_selects_right_column_and_rejects_outside_point(self):
        with tempfile.TemporaryDirectory() as directory:
            writer = PdfWriter()
            writer.add_blank_page(width=100, height=100)
            path = Path(directory) / "source.pdf"
            writer.write(path)
            reader = PdfReader(path)
            page = observation()
            right_line = page.lines[0].model_copy(
                update={"id": "right", "box": box(60, 20, 80, 30)}
            )
            page = page.model_copy(update={"lines": [*page.lines, right_line]})
            left = segment("left", "Go").model_copy(update={"native_line_ids": ["line"]})
            right = segment("right", "prefix Go").model_copy(update={"native_line_ids": ["right"]})
            self.assertEqual(
                ("right", 7),
                page_target(NavigationTarget(page=1, top=80, left=60), [left, right], reader, page),
            )
            with self.assertRaises(ValueError):
                page_target(NavigationTarget(page=1, top=80, left=101), [left, right], reader, page)

    def test_real_pdf_links_survive_reconstruction_and_epub_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.pdf"
            source_pdf(path, "paragraph")
            writer = PdfWriter()
            writer.clone_document_from_reader(PdfReader(path))
            annotations = []
            for rect, kind, key, value in (
                ([48, 735, 95, 755], "/URI", "/URI", "www.example.org"),
                ([84, 685, 350, 705], "/JavaScript", "/JS", "this.zoom=100;this.pageNum=0"),
            ):
                action = DictionaryObject(
                    {NameObject("/S"): NameObject(kind), NameObject(key): TextStringObject(value)}
                )
                annotations.append(
                    writer._add_object(
                        DictionaryObject(
                            {
                                NameObject("/Subtype"): NameObject("/Link"),
                                NameObject("/Rect"): ArrayObject([NumberObject(x) for x in rect]),
                                NameObject("/A"): action,
                            }
                        )
                    )
                )
            writer.pages[0][NameObject("/Annots")] = ArrayObject(annotations)
            writer.write(path)
            pages = prepare_source(path, path.parent, hashlib.sha256(path.read_bytes()).hexdigest())
            _, segments, state = source_segments(path, path.parent, pages, [])
            tasks = prepare_refinement(path, path.parent, pages, segments, state)
            result = reconstruct(path, path.parent, pages, [], responses(tasks, "paragraph"))
            links = [
                span.link
                for block in result.book.blocks
                if hasattr(block, "content")
                for span in block.content.spans
                if span.link
            ]
            self.assertTrue(
                any(
                    target.kind == "external" and target.url == "https://www.example.org"
                    for target in links
                )
            )
            self.assertTrue(any(target.kind == "internal" for target in links))
            restored, _ = portable_epub(result.epub)
            self.assertEqual(result.book, restored)
            self.assertTrue(
                any(f.code == "PDF_LINK_SCHEME_DERIVED" for f in result.structure_findings)
            )
