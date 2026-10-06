"""Authored native source geometry, not fixture answers, drives repaired indentation."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.recover_native_indents import recover_native_indents


class NativeIndentCorpusRecoveryTests(unittest.TestCase):
    def test_genuine_five_first_line_offsets_and_literal_inset(self):
        source = Path(__file__).parent / "fixtures/native.pdf"
        comparisons = []

        def observed_recovery(segments, prepared, state):
            before = [s.model_dump(exclude={"style"}) for s in segments]
            style_before = [
                s.style.model_dump(exclude={"indent_em", "block_indent_em"}) if s.style else None
                for s in segments
            ]
            result = recover_native_indents(segments, prepared, state)
            self.assertEqual(before, [s.model_dump(exclude={"style"}) for s in result])
            self.assertEqual(
                style_before,
                [
                    s.style.model_dump(exclude={"indent_em", "block_indent_em"})
                    if s.style
                    else None
                    for s in result
                ],
            )
            comparisons.append(True)
            return result

        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = [prepare_page(source, scratch, i) for i in range(1, 9)]
            with patch(
                "ava_pdf_epub.reconstruction_v2.source_segments.recover_native_indents",
                side_effect=observed_recovery,
            ):
                book = reconstruct(source, scratch, pages, []).book
            with patch(
                "ava_pdf_epub.reconstruction_v2.source_segments.recover_native_indents",
                side_effect=lambda segments, _prepared, _state: segments,
            ):
                original = reconstruct(source, scratch, pages, []).book
        self.assertEqual([True], comparisons)
        before = original.model_dump(exclude={"blocks", "styles"})
        self.assertEqual(before, book.model_dump(exclude={"blocks", "styles"}))
        self.assertEqual(
            [b.model_dump(exclude={"style_id"}) for b in original.blocks],
            [b.model_dump(exclude={"style_id"}) for b in book.blocks],
        )
        styles = {style.id: style for style in book.styles}
        blocks = {block.id: block for block in book.blocks}
        for ident in ["p1-line7", "p1-line9", "p3-line3", "p6-line6", "p8-line4"]:
            block = blocks[ident]
            self.assertAlmostEqual(16 / 11, styles[block.style_id].indent_em)
        register = blocks["p6-line2"]
        self.assertAlmostEqual(16 / 10, styles[register.style_id].block_indent_em)
        self.assertEqual(
            "North quay, lanterns\n    first watch, 3\n    return journey, 7", register.content.text
        )
