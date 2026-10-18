"""Malformed OCR evidence is refused, never reinterpreted as a source proof."""

import unittest

from ava_pdf_epub.reconstruction_v2.cell_ocr_words import cell_ocr_words

from .cell_ocr_fixture import target, tsv


class CellOcrWordTests(unittest.TestCase):
    def test_literal_quotes_survive_tsv_without_csv_unquoting(self):
        words = cell_ocr_words(tsv([target(text='"Target"')]), 1000, 1000)
        self.assertEqual('"Target"', words[0].text)

    def test_malformed_confidence_order_frame_control_and_bounds_refuse(self):
        good = tsv([target()])
        cases = [
            b"",
            b"invalid\n",
            good + good,
            good.replace(b"97", b"nan"),
            good.replace(b"97", b"-1"),
            good.replace(b"97", b"101"),
            good.replace(b"Target", b"Tar\x00get"),
            good.replace(b"Target", b"\xff"),
            good.replace(b"20\t20\t60", b"-1\t20\t60"),
            good.replace(b"20\t20\t60", b"999\t20\t60"),
            b"x" * 262145,
        ]
        for payload in cases:
            with self.subTest(payload=payload[:20]), self.assertRaises(ValueError):
                cell_ocr_words(payload, 1000, 1000)
        with self.assertRaises(ValueError):
            cell_ocr_words(tsv([target(), target()]), 1000, 1000)
