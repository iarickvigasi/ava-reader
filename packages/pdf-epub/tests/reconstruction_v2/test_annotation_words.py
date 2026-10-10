"""Independent malformed geometry and unchanged-text alignment contracts."""

import unittest

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.reconstruction_v2.annotation_words import (
    ERROR,
    HEADER,
    MAX_BYTES,
    AnnotationWord,
    exact_word_offsets,
    parse_words,
)
from ava_pdf_epub.reconstruction_v2.observations import PageObservation


def page():
    return PageObservation(
        number=1,
        width_pt=300,
        height_pt=400,
        rotation=0,
        render_path="render.png",
        render_sha256="a" * 64,
        render_width=600,
        render_height=800,
        lines=[],
        graphics=[],
        risks=[],
    )


def tsv(*rows):
    return ("\t".join(HEADER) + "\n" + "\n".join("\t".join(map(str, row)) for row in rows)).encode()


def row(text="Source", ordinal=1, **changes):
    fields = dict(zip(HEADER, [5, 1, 1, 1, 1, ordinal, 20, 40, 100, 30, 96.5, text], strict=True))
    fields.update(changes)
    return [fields[field] for field in HEADER]


class AnnotationWordsTests(unittest.TestCase):
    def test_pixel_geometry_scales_to_upright_page_points(self):
        word = parse_words(tsv(row("Українська")), page())[0]
        self.assertEqual("Українська", word.text)
        self.assertEqual((10, 20, 60, 35), (word.box.x0, word.box.y0, word.box.x1, word.box.y1))
        self.assertEqual(96.5, word.confidence)

    def test_malformed_and_outside_geometry_are_sanitized(self):
        for changes in [
            dict(left=-1),
            dict(width=0),
            dict(left=550),
            dict(conf="nan"),
            dict(conf="inf"),
            dict(conf=-1),
            dict(page_num=2),
            dict(word_num=0),
            dict(text="two words"),
            dict(text="private\x00text"),
        ]:
            with (
                self.subTest(changes=changes),
                self.assertRaisesRegex(ValueError, "^" + ERROR + "$"),
            ):
                parse_words(tsv(row(**changes)), page())

    def test_duplicate_and_reversed_word_positions_are_not_reordered(self):
        for rows in [(row(), row()), (row(ordinal=2), row(ordinal=1))]:
            with self.subTest(rows=rows), self.assertRaisesRegex(ValueError, ERROR):
                parse_words(tsv(*rows), page())

    def test_whitespace_only_border_row_is_not_a_source_word(self):
        words = parse_words(tsv(row(" "), row("Source", 2)), page())
        self.assertEqual(["Source"], [word.text for word in words])

    def test_invalid_encoding_header_and_size_are_refused(self):
        for payload in [b"invalid", b"\xff", b"x" * (MAX_BYTES + 1), tsv(row()) + b"\nbad\n"]:
            with self.subTest(length=len(payload)), self.assertRaisesRegex(ValueError, ERROR):
                parse_words(payload, page())

    def test_offsets_preserve_unicode_and_whitespace_without_rewriting(self):
        words = parse_words(tsv(row("Українська"), row("книга", 2)), page())
        text = "Before. Українська\n  книга After."
        offsets = exact_word_offsets(text, words)
        self.assertEqual(["Українська", "книга"], [text[start:end] for start, end in offsets])
        self.assertEqual([(8, 18), (21, 26)], offsets)

    def test_repeated_lines_punctuation_and_lookalikes_require_review(self):
        words = parse_words(tsv(row("Source"), row("book", 2)), page())
        for text in ["Source book Source book", "Source book.", "Sourсe book", "Source extra book"]:
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, ERROR):
                exact_word_offsets(text, words)

    def test_mixed_observed_lines_cannot_claim_one_text_match(self):
        box = Box(coordinate_space="page_points_top_left", x0=1, y0=1, x1=2, y1=2)
        words = [
            AnnotationWord((1, 1, 1), 1, "Source", 95, box),
            AnnotationWord((1, 1, 2), 1, "book", 95, box),
        ]
        with self.assertRaisesRegex(ValueError, ERROR):
            exact_word_offsets("Source book", words)
