"""Tesseract TSV text fields have literal quotes, never CSV quoting syntax."""

import unittest

from ava_pdf_epub.reconstruction_v2.annotation_words import exact_word_offsets, parse_words

from .test_annotation_words import page, row, tsv


class AnnotationTsvLiteralTests(unittest.TestCase):
    def test_literal_quotes_preserve_rows_text_ordinals_and_exact_offsets(self):
        tokens = ['"', "Source", '"', 'quoted"word', '"open', 'close"', "«книга»"]
        words = parse_words(tsv(*(row(text, i + 1) for i, text in enumerate(tokens))), page())
        self.assertEqual(tokens, [word.text for word in words])
        self.assertEqual(list(range(1, 8)), [word.ordinal for word in words])
        text = "\n  ".join(tokens)
        self.assertEqual(
            tokens, [text[start:end] for start, end in exact_word_offsets(text, words)]
        )
        self.assertTrue(all(word.mappable for word in words))

    def test_unclosed_quote_does_not_swallow_following_lines(self):
        words = parse_words(tsv(row('"'), row("next", 2), row("line", 1, line_num=2)), page())
        self.assertEqual(['"', "next", "line"], [word.text for word in words])
        self.assertEqual([(1, 1, 1), (1, 1, 1), (1, 1, 2)], [word.line for word in words])
