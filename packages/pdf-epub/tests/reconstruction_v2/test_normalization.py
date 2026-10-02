"""Source positions remain resolvable outside the exact newline normalization boundary."""

import unittest

from ava_pdf_epub.contracts.normalization import NormalizationMap
from ava_pdf_epub.reconstruction_v2.normalization_map import line_wrap_map


class NormalizationTests(unittest.TestCase):
    def test_identity_offsets_survive_page_line_join_with_unicode(self) -> None:
        source = "A😀B é\nsecond line"
        text = "A😀B é second line"
        mapping = NormalizationMap.model_validate(line_wrap_map(source, text))
        mapping.validate_canonical(text)
        for offset in range(len(source) + 1):
            self.assertEqual(offset, mapping.source_boundary(offset))

    def test_only_changed_crlf_boundary_is_ambiguous(self) -> None:
        source = "kept \r\n  text"
        mapping = NormalizationMap.model_validate(line_wrap_map(source, "kept text"))
        mapping.validate_canonical("kept text")
        self.assertEqual(2, mapping.source_boundary(2))
        self.assertEqual(7, mapping.source_boundary(11))
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            mapping.source_boundary(6)

    def test_native_trailing_spaces_stay_identity_with_unicode_offsets(self) -> None:
        source = "Ґанок 😀 \n  пам’ять"
        text = "Ґанок 😀    пам’ять"
        mapping = NormalizationMap.model_validate(line_wrap_map(source, text))
        mapping.validate_canonical(text)
        for offset in range(len(source) + 1):
            self.assertEqual(offset, mapping.source_boundary(offset))
        self.assertEqual(
            ["\n"],
            [
                source[s.source_start : s.source_end]
                for s in mapping.segments
                if s.kind == "line_wrap"
            ],
        )

    def test_neither_whitespace_mode_permits_changed_letters_or_punctuation(self) -> None:
        for text in ("kept changed", "kept  changed", "kept text!", "kepttext"):
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, "Unaccounted"):
                line_wrap_map("kept \ntext", text)

    def test_real_pdf_with_trailing_line_spaces_exports_and_round_trips(self) -> None:
        import hashlib
        import tempfile
        from pathlib import Path
        from unittest.mock import patch

        from ava_pdf_epub.epub_v2.portable import portable_epub
        from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
        from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
        from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
        from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

        from .test_native_literal import BODY, responses, source_pdf

        printed = [line + " " for line in BODY]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.pdf"
            with patch("reconstruction_v2.test_native_literal.BODY", printed):
                source_pdf(source, "quote")
            pages = prepare_source(source, root, hashlib.sha256(source.read_bytes()).hexdigest())
            _, segments, state = source_segments(source, root, pages, [])
            tasks = prepare_refinement(source, root, pages, segments, state)
            result = reconstruct(source, root, pages, [], responses(tasks, "quote"))
            expected = " ".join(printed)
            block = next(
                b
                for b in result.book.blocks
                if hasattr(b, "content") and b.content.text == expected
            )
            self.assertEqual("\n".join(printed), block.content.normalization.source_text)
            block.content.normalization.validate_canonical(expected)
            imported, _ = portable_epub(result.epub)
            self.assertEqual(result.book, imported)


if __name__ == "__main__":
    unittest.main()
