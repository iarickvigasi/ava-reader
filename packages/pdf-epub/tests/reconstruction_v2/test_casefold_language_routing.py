"""Source codepoints classify scripts; private case folds cannot replace source content."""

import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.language_evidence import ukrainian_evidence
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from reconstruction_v2.test_language_evidence import UK

FIXTURES = Path(__file__).parent / "fixtures"
EXPANSIONS = "Straße ﬀ ﬁ ﬂ ﬃ ﬄ İ"


class SourceCodepointLanguageRouting(unittest.TestCase):
    def test_expanding_latin_casefolds_count_source_letters_without_crashing(self) -> None:
        result = ukrainian_evidence(EXPANSIONS)
        self.assertEqual(12, result.letters)
        self.assertEqual(0, result.cyrillic_letters)
        self.assertEqual(0, result.distinctive_letters)
        self.assertIsNone(result.language)
        self.assertEqual("Straße ﬀ ﬁ ﬂ ﬃ ﬄ İ", EXPANSIONS)

    def test_expansions_do_not_invent_cyrillic_or_change_ukrainian_evidence(self) -> None:
        result = ukrainian_evidence(UK.upper() + " " + EXPANSIONS)
        original = ukrainian_evidence(UK.upper())
        self.assertEqual("uk", result.language)
        self.assertEqual(original.letters + 12, result.letters)
        self.assertEqual(original.cyrillic_letters, result.cyrillic_letters)
        self.assertEqual(original.distinctive_letters, result.distinctive_letters)
        self.assertEqual(original.hint_kinds, result.hint_kinds)

    def test_original_cyrillic_conflicts_survive_latin_expansions(self) -> None:
        result = ukrainian_evidence(UK + " Ы Э Ъ Ё " + EXPANSIONS)
        self.assertEqual(4, result.conflicting_letters)
        self.assertIsNone(result.language)

    def test_actual_native_page3_routes_without_changing_ligature_or_offsets(self) -> None:
        oracle = json.loads((FIXTURES / "native-oracle.json").read_text())
        expected = next(p["text"] for p in oracle["paragraphs"] if p["id"] == "p-unicode")
        with tempfile.TemporaryDirectory() as directory:
            page = prepare_page(FIXTURES / "native.pdf", Path(directory), 3, BILINGUAL_PROFILE)
        self.assertEqual([], page.tasks)
        self.assertEqual(BILINGUAL_PROFILE, page.profile_id)
        observed = next(segment for segment in page.native_segments if segment.text == expected)
        self.assertIn("ﬁ", observed.text)
        self.assertNotIn("fi |", observed.text)
        self.assertEqual(expected, observed.source_text or observed.text)

    def test_complete_native_book_bilingual_profile_preserves_authored_unicode(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = FIXTURES / "native.pdf"
            pages = [prepare_page(source, scratch, n, BILINGUAL_PROFILE) for n in range(1, 9)]
            self.assertTrue(all(not page.tasks for page in pages))
            book = reconstruct(source, scratch, pages, []).book
        expected = "Unicode tokens: A😀B | é | ﬁ | office."
        matches = [b for b in book.blocks if hasattr(b, "content") and b.content.text == expected]
        self.assertEqual(1, len(matches))
        content = matches[0].content
        emoji = expected.index("😀")
        self.assertEqual(emoji + 2, content.codepoint_utf16[emoji + 1])
        self.assertEqual(expected, content.text)
        self.assertTrue(
            any(
                c.field == "language" and c.status == "accepted" and c.value == "en"
                for c in book.metadata
            )
        )
