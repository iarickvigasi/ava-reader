"""Reliable text stays native; unsupported books never gain an invented language."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.raster_regions import raster_regions
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct

FIXTURE = Path(__file__).parent / "fixtures" / "uk-native.pdf"
FRENCH = (
    "Les lecteurs souhaitent comprendre chaque phrase du roman. "
    "Ils cherchent plusieurs exemples simples pendant leur lecture. "
    "Une histoire raconte comment chacun retrouve progressivement sa confiance. "
    "Les personnages parlent ensemble puis observent calmement leur village. "
    "Chaque lecteur construit une interpretation personnelle pendant cette aventure. "
    "Ces pages restent identiques lorsque leur langue demeure inconnue."
)


def authored_pdf(path: Path, text: str) -> None:
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
    )
    lines = ["1. Une histoire", *text.split(". ")]
    content = ["BT /F1 18 Tf 72 720 Td (" + lines[0] + ") Tj /F1 10 Tf"]
    content.extend("0 -18 Td (" + line + ") Tj" for line in lines[1:])
    stream = DecodedStreamObject()
    stream.set_data(("\n".join(content) + "\nET").encode("ascii"))
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)


class LanguageOnlyRouting(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp = tempfile.TemporaryDirectory()
        cls.scratch = Path(cls.temp.name)
        cls.page = prepare_page(FIXTURE, cls.scratch, 1, BILINGUAL_PROFILE)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temp.cleanup()

    def test_language_only_uncertainty_does_not_request_new_transcription(self) -> None:
        observation = self.page.observation.model_copy(update={"risks": ["language_uncertain"]})
        self.assertEqual([], raster_regions(observation, self.scratch, BILINGUAL_PROFILE))
        self.assertEqual(1, len(raster_regions(observation, self.scratch, LEGACY_PROFILE)))
        self.assertEqual(self.page.observation.lines, observation.lines)

    def test_other_risks_and_missing_text_still_need_recognition(self) -> None:
        for risk in ["hidden_text", "visible_annotation", "unknown_source_risk"]:
            observation = self.page.observation.model_copy(
                update={"risks": ["language_uncertain", risk]}
            )
            self.assertEqual(1, len(raster_regions(observation, self.scratch, BILINGUAL_PROFILE)))
        empty = self.page.observation.model_copy(update={"risks": [], "lines": []})
        self.assertEqual(1, len(raster_regions(empty, self.scratch, BILINGUAL_PROFILE)))

    def test_native_unsupported_book_is_refused_without_paid_ocr_or_english_default(self) -> None:
        source = self.scratch / "authored-french.pdf"
        authored_pdf(source, FRENCH)
        page = prepare_page(source, self.scratch, 1, BILINGUAL_PROFILE)
        self.assertIn("language_uncertain", page.observation.risks)
        self.assertEqual([], page.tasks)
        with self.assertRaisesRegex(ValueError, "Source-supported book language requires review"):
            reconstruct(source, self.scratch, [page], [])

    def test_foreign_passage_keeps_text_and_unknown_language(self) -> None:
        quote = "Les personnages parlent ensemble puis observent calmement leur village."
        foreign = self.scratch / "authored-foreign-passage.pdf"
        authored_pdf(foreign, quote)
        writer = PdfWriter(clone_from=PdfReader(FIXTURE))
        writer.add_page(PdfReader(foreign).pages[0])
        source = self.scratch / "authored-uk-with-foreign-passage.pdf"
        writer.write(source)
        pages = [prepare_page(source, self.scratch, n, BILINGUAL_PROFILE) for n in range(1, 5)]
        self.assertTrue(all(not page.tasks for page in pages))
        result = reconstruct(source, self.scratch, pages, [])
        block = next(
            b for b in result.book.blocks
            if hasattr(b, "content") and b.content.text.strip() == quote
        )
        self.assertEqual("und", block.content.language)
        self.assertEqual(quote, block.content.text.strip())
        self.assertTrue(any(
            c.field == "language" and c.status == "accepted" and c.value == "uk"
            for c in result.book.metadata
        ))
