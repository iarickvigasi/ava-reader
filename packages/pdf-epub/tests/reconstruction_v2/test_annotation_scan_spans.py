"""Independent scanned geometry, text and source color oracles."""

import unittest
from dataclasses import replace

from PIL import Image

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.annotation_scan_spans import scanned_marks
from ava_pdf_epub.reconstruction_v2.annotation_word_ocr import annotation_word_view
from ava_pdf_epub.reconstruction_v2.annotation_word_visibility import source_visible_words
from ava_pdf_epub.reconstruction_v2.annotation_words import ERROR, AnnotationWord
from ava_pdf_epub.reconstruction_v2.observations import PageObservation, RequiredRegion
from ava_pdf_epub.reconstruction_v2.segments import Segment


def box(left=0, top=0, right=100, bottom=40):
    return Box(coordinate_space="page_points_top_left", x0=left, y0=top, x1=right, y1=bottom)


def observation(region):
    return PageObservation(
        number=1,
        width_pt=100,
        height_pt=40,
        rotation=0,
        render_path="render.png",
        render_sha256="a" * 64,
        render_width=100,
        render_height=40,
        lines=[],
        graphics=[],
        risks=[],
        required_regions=[region],
    )


def source():
    region = RequiredRegion(
        kind="inline_style",
        box=box(0, 0, 50, 20),
        style=Style(id="mark", background_color="#ffff00"),
    )
    words = [
        AnnotationWord((1, 1, 1), 1, "Source", 96, box(2, 3, 20, 17)),
        AnnotationWord((1, 1, 1), 2, "book", 96, box(25, 3, 45, 17)),
        AnnotationWord((1, 1, 1), 3, "stays.", 96, box(55, 3, 90, 17)),
    ]
    image = Image.new("RGB", (100, 40), "white")
    image.paste("#ffff00", (0, 0, 50, 20))
    image.paste("#000000", (4, 5, 15, 15))
    image.paste("#0000aa", (27, 5, 38, 15))
    segment = Segment(
        id="scan", page=1, box=box(), kind="paragraph", text="Source   book stays.", method="ocr"
    )
    return region, words, image, segment


class ScannedAnnotationSpansTests(unittest.TestCase):
    def test_exact_words_and_internal_spaces_preserve_original_ink(self):
        region, words, image, segment = source()
        marks = scanned_marks(observation(region), [segment], region, words, image)
        self.assertEqual(
            set(range(13)), {i for _, span in marks for i in range(span.start, span.end)}
        )
        self.assertEqual(["#000000", "#0000aa", None], [span.style.color for _, span in marks])
        self.assertTrue(all(span.style.background_color == "#ffff00" for _, span in marks))
        self.assertEqual("Source   book stays.", segment.text)

    def test_partial_low_confidence_and_text_mismatch_require_review(self):
        region, words, image, segment = source()
        for changed_region, changed_words, changed_segment in [
            (region.model_copy(update={"box": box(0, 0, 35, 20)}), words, segment),
            (
                region,
                [AnnotationWord(words[0].line, 1, "Source", 84, words[0].box), *words[1:]],
                segment,
            ),
            (region, words, segment.model_copy(update={"text": "Source book changed."})),
        ]:
            with self.subTest(text=changed_segment.text), self.assertRaisesRegex(ValueError, ERROR):
                scanned_marks(
                    observation(changed_region),
                    [changed_segment],
                    changed_region,
                    changed_words,
                    image,
                )

    def test_multiple_candidate_segments_do_not_guess(self):
        region, words, image, segment = source()
        with self.assertRaisesRegex(ValueError, ERROR):
            scanned_marks(
                observation(region),
                [segment, segment.model_copy(update={"id": "duplicate"})],
                region,
                words,
                image,
            )

    def test_ocr_view_removes_only_fill_inside_declared_region(self):
        region, words, image, segment = source()
        image.putpixel((80, 30), (255, 255, 0))
        image.putpixel((10, 10), (230, 230, 230))
        before = image.tobytes()
        view = annotation_word_view(image, observation(region))
        self.assertEqual((255, 255, 255), view.getpixel((1, 1)))
        self.assertEqual((0, 0, 0), view.getpixel((5, 5)))
        self.assertEqual((0, 0, 170), view.getpixel((30, 5)))
        self.assertEqual((230, 230, 230), view.getpixel((10, 10)))
        self.assertEqual((255, 255, 0), view.getpixel((80, 30)))
        self.assertEqual(before, image.tobytes())

    def test_bitmap_decoration_pixels_are_not_erased_or_reconstructed(self):
        for field, stroke_y in [("underline", 17), ("strike_through", 9)]:
            with self.subTest(field=field):
                region = RequiredRegion(
                    kind="inline_style",
                    box=box(0, 0, 50, 20),
                    style=Style.model_validate(
                        {"id": "stroke", field: True, "decoration_color": "#0000ff"}
                    ),
                )
                image = Image.new("RGB", (100, 40), "white")
                image.paste("#0000ff", (0, stroke_y, 50, stroke_y + 1))
                image.putpixel((10, 3), (0, 0, 255))
                before = image.tobytes()
                view = annotation_word_view(image, observation(region))
                self.assertEqual(before, view.tobytes())
                self.assertEqual(before, image.tobytes())


class OriginalWordVisibilityTests(unittest.TestCase):
    def test_original_ink_and_thin_crossing_stroke_remain_visible(self):
        region, words, _, _ = source()
        clean = Image.new("RGB", (100, 40), "white")
        clean.paste("black", (4, 5, 15, 15))
        clean.paste("#0000aa", (27, 5, 38, 15))
        clean.paste("black", (60, 5, 80, 15))
        original = clean.copy()
        original.paste("blue", (0, 9, 100, 10))
        observed = source_visible_words(observation(region), words, original, clean)
        self.assertTrue(all(word.visible for word in observed))
        self.assertTrue(all(word.visible for word in words))

    def test_opaque_plate_cannot_authorize_underlying_words(self):
        region, words, _, segment = source()
        clean = Image.new("RGB", (100, 40), "white")
        clean.paste("black", (4, 5, 15, 15))
        clean.paste("black", (27, 5, 38, 15))
        original = clean.copy()
        original.paste("white", (0, 0, 50, 20))
        original.paste("blue", (0, 9, 50, 10))
        observed = source_visible_words(observation(region), words, original, clean)
        self.assertFalse(observed[0].visible)
        self.assertFalse(observed[1].visible)
        with self.assertRaisesRegex(ValueError, ERROR):
            scanned_marks(observation(region), [segment], region, observed, original)

    def test_missing_ink_does_not_count_as_visible(self):
        region, words, _, _ = source()
        blank = Image.new("RGB", (100, 40), "white")
        observed = source_visible_words(observation(region), words, blank, blank)
        self.assertFalse(any(word.visible for word in observed))

    def test_explicitly_unverified_word_cannot_be_styled(self):
        region, words, image, segment = source()
        words[0] = replace(words[0], visible=False)
        with self.assertRaisesRegex(ValueError, ERROR):
            scanned_marks(observation(region), [segment], region, words, image)

    def test_incompatible_rasters_require_review(self):
        region, words, _, _ = source()
        original = Image.new("RGB", (100, 40), "white")
        for clean in [Image.new("RGB", (99, 40), "white"), original.convert("L")]:
            with self.subTest(mode=clean.mode, size=clean.size):
                with self.assertRaisesRegex(ValueError, ERROR):
                    source_visible_words(observation(region), words, original, clean)
