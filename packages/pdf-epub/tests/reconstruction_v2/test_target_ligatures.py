"""Finite typographic expansions map whole source glyphs to atomic accepted scalar ranges."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.numbered_heading_map import numbered_heading_map

from .compound_heading_fixture import fixture


class TargetLigatureTests(unittest.TestCase):
    def test_seven_expansions_keep_original_object_line_and_ordinal(self):
        pairs = [
            ("ﬀ", "ff"),
            ("ﬁ", "fi"),
            ("ﬂ", "fl"),
            ("ﬃ", "ffi"),
            ("ﬄ", "ffl"),
            ("ﬅ", "ſt"),
            ("ﬆ", "st"),
        ]
        with tempfile.TemporaryDirectory() as directory:
            for printed, accepted in pairs:
                with self.subTest(printed=printed):
                    f = fixture(
                        Path(directory), printed=printed + " title", accepted=accepted + " title"
                    )
                    proof = numbered_heading_map(
                        f.reader, f.target, f.page, f.owners[0], f.owners, POLICY
                    )
                    self.assertIsNotNone(proof)
                    value = next(g for g in proof.glyphs if g.line_id == "title" and g.ordinal == 0)
                    self.assertIs(value.glyph, f.page.lines[1].glyphs[0])
                    self.assertEqual((3, 3 + len(accepted)), (value.start, value.end))
                    self.assertEqual(accepted, proof.text[value.start : value.end])
                    self.assertEqual(
                        sum(bool(g.text.strip()) for ln in f.page.lines[:4] for g in ln.glyphs),
                        len(proof.glyphs),
                    )
                    self.assertEqual(("chapter", 0), f.resolve())

    def test_whitespace_partial_case_punctuation_intrinsic_letters_never_normalize(self):
        pairs = [
            ("ﬁ", "f i"),
            ("ﬁ", "f\ni"),
            ("ﬁ", "f"),
            ("ﬁ", "Fi"),
            ("ﬂ", "fl!"),
            ("ﬅ", "st"),
            ("²", "2"),
            ("Ａ", "A"),
            ("é", "e"),
            ("Ⅰ", "I"),
            ("x", "X"),
        ]
        with tempfile.TemporaryDirectory() as directory:
            for printed, accepted in pairs:
                with self.subTest(printed=printed, accepted=accepted):
                    f = fixture(
                        Path(directory), printed=printed + " title", accepted=accepted + " title"
                    )
                    with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                        f.resolve()

    def test_missing_extra_reordered_or_lookalike_owner_characters_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            owner = f.owners[0]
            for text in (
                owner.text + " extra",
                owner.text.replace("flea", ""),
                owner.text.replace("fires", "fіres"),
                owner.text.replace("–", "—"),
                owner.text.replace("5", "6"),
                owner.text.replace("flights", "flight"),
            ):
                with self.subTest(text=text), self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                    f.resolve(owners=[owner.model_copy(update={"text": text}), *f.owners[1:]])
