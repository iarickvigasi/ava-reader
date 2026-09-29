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


if __name__ == "__main__":
    unittest.main()
