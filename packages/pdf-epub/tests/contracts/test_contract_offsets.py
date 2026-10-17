import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.inline_text import TextValue
from ava_pdf_epub.contracts.offsets import codepoint_to_utf16, utf16_to_codepoint
from ava_pdf_epub.contracts.selection_mapping import source_range_to_utf16


def content(source, canonical, segments):
    return TextValue.model_validate(
        {
            "text": canonical,
            "sha256": text_digest(canonical),
            "codepoint_utf16": codepoint_to_utf16(canonical),
            "normalization": {
                "source_text": source,
                "source_sha256": text_digest(source),
                "segments": segments,
            },
        }
    )


def segment(a, b, c, d, kind):
    return dict(source_start=a, source_end=b, canonical_start=c, canonical_end=d, kind=kind)


class OffsetContractTests(unittest.TestCase):
    def test_emoji_maps_exact_utf16_range(self):
        text = TextValue(text="A😀B", sha256=text_digest("A😀B"), codepoint_utf16=[0, 1, 3, 4])
        self.assertEqual(source_range_to_utf16(text, 1, 2), (1, 2, 1, 3))
        self.assertEqual("A😀B".encode("utf-16-le")[2:6].decode("utf-16-le"), "😀")
        with self.assertRaises(ValueError):
            utf16_to_codepoint("A😀B", 2)
        with self.assertRaises(ValueError):
            utf16_to_codepoint("A😀B", True)
        with self.assertRaises(ValueError):
            codepoint_to_utf16("\ud800")

    def test_combining_sequence_exact_selection_and_ambiguous_boundary(self):
        text = content(
            "cafe\u0301", "café", [segment(0, 3, 0, 3, "identity"), segment(3, 5, 3, 4, "nfc")]
        )
        self.assertEqual(source_range_to_utf16(text, 3, 5), (3, 4, 3, 4))
        self.assertEqual(text.text[3:4], "é")
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            source_range_to_utf16(text, 3, 4)

    def test_ligature_expansion_and_prose_line_wrap_preserve_provenance(self):
        text = content(
            "oﬃce\nnext",
            "office next",
            [
                segment(0, 1, 0, 1, "identity"),
                segment(1, 2, 1, 4, "ligature"),
                segment(2, 4, 4, 6, "identity"),
                segment(4, 5, 6, 7, "line_wrap"),
                segment(5, 9, 7, 11, "identity"),
            ],
        )
        self.assertEqual(source_range_to_utf16(text, 1, 2), (1, 4, 1, 4))
        self.assertEqual(text.text[1:4], "ffi")
        self.assertEqual(source_range_to_utf16(text, 4, 5), (6, 7, 6, 7))

    def test_false_transform_hash_gap_and_negative_range_rejected(self):
        with self.assertRaises(ValidationError):
            content("original", "invented", [segment(0, 8, 0, 8, "identity")])
        with self.assertRaises(ValidationError):
            content(
                "abc", "abc", [segment(0, 1, 0, 1, "identity"), segment(2, 3, 2, 3, "identity")]
            )
        text = TextValue(
            text=" a  b\n", sha256=text_digest(" a  b\n"), codepoint_utf16=list(range(7))
        )
        self.assertEqual(text.text, " a  b\n")
        with self.assertRaises(ValueError):
            source_range_to_utf16(text, -1, 2)
        with self.assertRaises(ValueError):
            source_range_to_utf16(text, 2, 1)
