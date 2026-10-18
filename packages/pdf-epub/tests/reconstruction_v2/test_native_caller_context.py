"""Native text stays authoritative; local OCR corroborates only bounded caller geometry."""

import hashlib
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

from PIL import Image, ImageDraw
from pypdf import PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, TextStringObject

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.reconstruction_v2.annotation_word_ocr import recognize_native_line_words
from ava_pdf_epub.reconstruction_v2.annotation_words import (
    HEADER,
    AnnotationRasterFrame,
    AnnotationWord,
    parse_words,
)
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.native_caller_context import native_caller_ranges
from ava_pdf_epub.reconstruction_v2.native_line_offsets import NativeLineOffset
from ava_pdf_epub.reconstruction_v2.observations import Graphic, PageObservation, RequiredRegion
from ava_pdf_epub.reconstruction_v2.pdf_links import apply_pdf_links
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.segments import Segment


def rectangle(x0=10, y0=20, x1=70, y1=34):
    return Box(coordinate_space="page_points_top_left", x0=x0, y0=y0, x1=x1, y1=y1)


class NativeCallerContextTests(unittest.TestCase):
    def fixture(self, text="Open guide", *, suffix="", prefix="Before. "):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        (root / "renders").mkdir()
        image = Image.new("RGB", (200, 200), "white")
        draw = ImageDraw.Draw(image)
        for index, char in enumerate(text):
            if char.strip():
                draw.rectangle((21 + index * 12, 45, 29 + index * 12, 59), fill="black")
        image.save(root / "renders/page-0001.png")
        glyphs = [
            dict(
                text=c,
                box=rectangle(10 + i * 6, 20, 16 + i * 6, 34).model_dump(),
                font="authored",
                size=14,
                visible=True,
            )
            for i, c in enumerate(text)
        ]
        page = PageObservation.model_validate(
            dict(
                number=1,
                width_pt=100,
                height_pt=100,
                rotation=0,
                render_path="renders/page-0001.png",
                render_sha256=hashlib.sha256(
                    (root / "renders/page-0001.png").read_bytes()
                ).hexdigest(),
                render_width=200,
                render_height=200,
                graphics=[],
                risks=[],
                lines=[
                    dict(
                        id="line",
                        text=text,
                        box=rectangle(10, 20, 10 + len(text) * 6, 34).model_dump(),
                        style={"id": "native", "bold": True},
                        glyphs=glyphs,
                    )
                ],
            )
        )
        owner = Segment.model_validate(
            dict(
                id="owner",
                page=1,
                method="native",
                kind="paragraph",
                text=prefix + text + suffix,
                box=rectangle(0, 10, 95, 60).model_dump(),
                style={"id": "native", "bold": True},
                native_line_ids=["line"],
            )
        )
        caller = rectangle(10, 22, 10 + len(text) * 6, 32)
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.add_annotation(
            0,
            DictionaryObject(
                {
                    NameObject("/Subtype"): NameObject("/Link"),
                    NameObject("/Rect"): ArrayObject(
                        [
                            NumberObject(v)
                            for v in (caller.x0, 100 - caller.y1, caller.x1, 100 - caller.y0)
                        ]
                    ),
                    NameObject("/A"): DictionaryObject(
                        {
                            NameObject("/S"): NameObject("/URI"),
                            NameObject("/URI"): TextStringObject("https://example.org"),
                        }
                    ),
                }
            ),
        )
        source = root / "source.pdf"
        writer.write(source)
        checkpoint = PreparedPage(
            schema_version="ava-prepared-page-1",
            source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
            source_byte_length=source.stat().st_size,
            source_page_count=1,
            observation=page,
            tables=[],
            native_segments=[owner],
            tasks=[],
        )
        return root, source, checkpoint, owner, caller

    def words(self, image, language):
        self.assertEqual("eng", language)
        with Image.open(image) as crop:
            self.assertEqual((122, 30), crop.size)
            self.assertAlmostEqual(144, crop.info["dpi"][0], delta=0.02)
            self.assertEqual((0, 0, 0), crop.convert("RGB").getpixel((2, 6)))
        rows = [
            HEADER,
            (5, 1, 1, 1, 1, 1, 2, 6, 45, 14, 96, "Open"),
            (5, 1, 1, 1, 1, 2, 62, 6, 57, 14, 96, "guide"),
        ]
        return ("\n".join("\t".join(map(str, r)) for r in rows) + "\n").encode()

    def test_native_font_gutter_reaches_stock_link_application_without_rewriting_owner(self):
        root, source, checkpoint, owner, _ = self.fixture()
        before = owner.model_dump()
        with patch(
            "ava_pdf_epub.reconstruction_v2.annotation_word_ocr._run_ocr", side_effect=self.words
        ) as run:
            result = apply_pdf_links(source, [checkpoint], [owner], AssemblyState(), root)
        self.assertEqual(1, run.call_count)
        self.assertEqual(before, owner.model_dump())
        self.assertEqual(owner.text, result[0].text)
        self.assertEqual(owner.style, result[0].style)
        self.assertEqual("native", result[0].method)
        self.assertEqual([(8, 18)], [(s.start, s.end) for s in result[0].spans])
        self.assertEqual("https://example.org", result[0].spans[0].url)

    def word_values(self):
        return [
            AnnotationWord((1, 1, 1), 1, "Open", 96, rectangle(10.5, 22.5, 33, 29.5)),
            AnnotationWord((1, 1, 1), 2, "guide", 96, rectangle(40.5, 22.5, 69, 29.5)),
        ]

    def test_exact_joined_line_map_and_duplicate_link_cache_preserve_offsets(self):
        root, _, checkpoint, owner, caller = self.fixture()
        page = checkpoint.observation
        mapping = NativeLineOffset(
            line_id="line",
            segment_id="owner",
            start=8,
            end=18,
            text_sha256=hashlib.sha256(page.lines[0].text.encode()).hexdigest(),
        )
        cache = {}
        with patch(
            "ava_pdf_epub.reconstruction_v2.native_caller_context.recognize_native_line_words",
            return_value=self.word_values(),
        ) as run:
            for _ in range(2):
                self.assertEqual(
                    [("owner", 8, 18)],
                    native_caller_ranges(
                        page, [owner], caller, root, checkpoint.profile_id, {"line": mapping}, cache
                    ),
                )
            run.assert_called_once()
            wrong = mapping.model_copy(update={"start": 0, "end": 10})
            with self.assertRaises(ValueError):
                native_caller_ranges(
                    page, [owner], caller, root, checkpoint.profile_id, {"line": wrong}, {}
                )
            self.assertEqual(1, run.call_count)

    def test_missing_extra_lookalike_malformed_lowconf_and_partial_words_refuse(self):
        root, _, checkpoint, owner, caller = self.fixture()
        good = self.word_values()
        cases = [
            good[:1],
            good + [replace(good[-1], text="extra", ordinal=3)],
            [good[0], replace(good[1], text="guіde")],
            [replace(good[0], confidence=84.99), good[1]],
            [replace(good[0], visible=False), good[1]],
            [good[0], replace(good[1], line=(1, 1, 2))],
            [good[0], replace(good[1], mappable=False)],
            [good[0], replace(good[1], box=rectangle(40.5, 28, 69, 37))],
        ]
        for words in cases:
            with (
                self.subTest(count=len(words)),
                patch(
                    "ava_pdf_epub.reconstruction_v2.native_caller_context.recognize_native_line_words",
                    return_value=words,
                ),
                self.assertRaises(ValueError),
            ):
                native_caller_ranges(
                    checkpoint.observation, [owner], caller, root, checkpoint.profile_id, None, {}
                )
        payload = self.words_payload()
        for bad in [payload + b"broken row\n"]:
            with self.assertRaises(ValueError):
                parse_words(bad, AnnotationRasterFrame(checkpoint.observation, 19, 39, 122, 30))

    def words_payload(self):
        rows = [
            HEADER,
            (5, 1, 1, 1, 1, 1, 2, 6, 45, 14, 96, "Open"),
            (5, 1, 1, 1, 1, 2, 62, 6, 57, 14, 96, "guide"),
        ]
        return ("\n".join("\t".join(map(str, r)) for r in rows) + "\n").encode()

    def test_punctuation_and_partly_intersecting_adjacent_glyph_cannot_be_added_or_dropped(self):
        for mode in ("punctuation", "adjacent"):
            root, _, checkpoint, owner, _ = self.fixture(text="Open.", prefix="")
            page = checkpoint.observation
            caller = rectangle(10, 22, 34 if mode == "punctuation" else 35.5, 32)
            word = AnnotationWord((1, 1, 1), 1, "Open.", 96, rectangle(10.5, 22.5, 33.5, 29.5))
            with (
                patch(
                    "ava_pdf_epub.reconstruction_v2.native_caller_context.recognize_native_line_words",
                    return_value=[word],
                ),
                self.assertRaises(ValueError),
            ):
                native_caller_ranges(page, [owner], caller, root, checkpoint.profile_id, None, {})
            if mode == "adjacent":
                # Whole OCR word excludes the added partial adjacent character;
                # exact context or symmetric character accounting must refuse it.
                with (
                    patch(
                        "ava_pdf_epub.reconstruction_v2.native_caller_context.recognize_native_line_words",
                        return_value=[replace(word, text="Open")],
                    ),
                    self.assertRaises(ValueError),
                ):
                    native_caller_ranges(
                        page, [owner], caller, root, checkpoint.profile_id, None, {}
                    )

    def test_source_risk_hidden_duplicate_foreign_mixed_or_furniture_owner_stops_before_ocr(self):
        root, _, checkpoint, owner, caller = self.fixture()
        page = checkpoint.observation
        hidden = page.lines[0].model_copy(
            update={
                "glyphs": [
                    page.lines[0].glyphs[0].model_copy(update={"visible": False}),
                    *page.lines[0].glyphs[1:],
                ]
            }
        )
        cases = [
            (page.model_copy(update={"risks": ["language_uncertain"]}), [owner]),
            (page.model_copy(update={"lines": [hidden]}), [owner]),
            (page, [owner, owner.model_copy(update={"id": "other"})]),
            (page, [owner.model_copy(update={"page": 2})]),
            (page, [owner.model_copy(update={"kind": "furniture"})]),
            (
                page,
                [
                    owner,
                    owner.model_copy(
                        update={"id": "visual", "method": "ocr", "native_line_ids": []}
                    ),
                ],
            ),
        ]
        for observed, owners in cases:
            with (
                self.subTest(risks=observed.risks),
                patch(
                    "ava_pdf_epub.reconstruction_v2.native_caller_context.recognize_native_line_words"
                ) as run,
                self.assertRaises(ValueError),
            ):
                native_caller_ranges(
                    observed, owners, caller, root, checkpoint.profile_id, None, {}
                )
            run.assert_not_called()

    def test_crop_neighbour_frame_graphics_inline_regions_hash_and_dimensions_refuse_before_ocr(
        self,
    ):
        root, _, checkpoint, _, caller = self.fixture()
        page = checkpoint.observation
        line = page.lines[0]
        nearby = line.model_copy(update={"id": "neighbour"})
        cases = [
            page.model_copy(update={"lines": [line, nearby]}),
            page.model_copy(update={"rotation": 90}),
            page.model_copy(update={"render_sha256": "f" * 64}),
            page.model_copy(update={"render_width": 201}),
            page.model_copy(update={"graphics": [Graphic(kind="vector", box=line.box)]}),
            page.model_copy(
                update={"required_regions": [RequiredRegion(kind="appearance", box=line.box)]}
            ),
        ]
        for observed in cases:
            with (
                self.subTest(rotation=observed.rotation),
                patch("ava_pdf_epub.reconstruction_v2.annotation_word_ocr._run_ocr") as run,
                self.assertRaises(ValueError),
            ):
                recognize_native_line_words(observed, line, caller, root, checkpoint.profile_id)
            run.assert_not_called()
        with self.assertRaises(ValueError):
            AnnotationRasterFrame(page, 199, 0, 2, 20)

    def test_crop_parser_maps_integer_origins_without_fake_page_or_old_frame_change(self):
        root, _, checkpoint, _, _ = self.fixture()
        page = checkpoint.observation
        crop = parse_words(self.words_payload(), AnnotationRasterFrame(page, 19, 39, 122, 30))
        self.assertEqual(
            (10.5, 22.5, 33.0, 29.5),
            (crop[0].box.x0, crop[0].box.y0, crop[0].box.x1, crop[0].box.y1),
        )
        ordinary = parse_words(self.words_payload(), page)
        self.assertEqual(
            (1.0, 3.0, 23.5, 10.0),
            (ordinary[0].box.x0, ordinary[0].box.y0, ordinary[0].box.x1, ordinary[0].box.y1),
        )

    def test_primary_native_success_still_skips_local_ocr(self):
        root, source, checkpoint, owner, _ = self.fixture()
        line = checkpoint.observation.lines[0]
        page = checkpoint.observation.model_copy(
            update={
                "lines": [
                    line.model_copy(
                        update={
                            "glyphs": [
                                g.model_copy(update={"box": rectangle(g.box.x0, 22, g.box.x1, 32)})
                                for g in line.glyphs
                            ]
                        }
                    )
                ]
            }
        )
        with patch("ava_pdf_epub.reconstruction_v2.annotation_word_ocr._run_ocr") as run:
            result = apply_pdf_links(
                source,
                [checkpoint.model_copy(update={"observation": page})],
                [owner],
                AssemblyState(),
                root,
            )
        run.assert_not_called()
        self.assertEqual([(8, 18)], [(s.start, s.end) for s in result[0].spans])

    def test_native_caller_corroboration_does_not_bypass_missing_destination_text(self):
        root, source, checkpoint, owner, caller = self.fixture()
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.add_blank_page(width=100, height=100)
        writer.add_annotation(
            0,
            DictionaryObject(
                {
                    NameObject("/Subtype"): NameObject("/Link"),
                    NameObject("/Rect"): ArrayObject(
                        [
                            NumberObject(v)
                            for v in (caller.x0, 100 - caller.y1, caller.x1, 100 - caller.y0)
                        ]
                    ),
                    NameObject("/Dest"): ArrayObject(
                        [
                            writer.pages[1].indirect_reference,
                            NameObject("/XYZ"),
                            NumberObject(0),
                            NumberObject(100),
                            NumberObject(0),
                        ]
                    ),
                }
            ),
        )
        writer.write(source)
        checkpoint = checkpoint.model_copy(
            update={
                "source_page_count": 2,
                "source_byte_length": source.stat().st_size,
                "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            }
        )
        blank = checkpoint.model_copy(
            update={
                "observation": checkpoint.observation.model_copy(update={"number": 2, "lines": []}),
                "native_segments": [],
            }
        )
        with patch(
            "ava_pdf_epub.reconstruction_v2.annotation_word_ocr._run_ocr", side_effect=self.words
        ) as run:
            with self.assertRaisesRegex(ValueError, "PDF_LINK_TARGET_REQUIRES_REVIEW"):
                apply_pdf_links(source, [checkpoint, blank], [owner], AssemblyState(), root)
        self.assertEqual(1, run.call_count)

    def test_unrelated_native_refusal_does_not_start_new_ocr(self):
        root, source, checkpoint, owner, _ = self.fixture()
        with (
            patch(
                "ava_pdf_epub.reconstruction_v2.pdf_link_application.glyph_ranges",
                side_effect=ValueError("OTHER_REFUSAL"),
            ),
            patch("ava_pdf_epub.reconstruction_v2.annotation_word_ocr._run_ocr") as run,
        ):
            with self.assertRaisesRegex(ValueError, "OTHER_REFUSAL"):
                apply_pdf_links(source, [checkpoint], [owner], AssemblyState(), root)
        run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
