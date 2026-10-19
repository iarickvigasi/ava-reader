"""The genuine independent native corpus must export its visibly printed author."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from ava_pdf_epub.epub_v2.metadata import metadata_element
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct

FIXTURES = Path(__file__).parent / "fixtures"


class NativeOpeningAuthorTests(unittest.TestCase):
    def test_real_native_credit_survives_a_separate_visible_title_edition_label(self):
        original = FIXTURES / "native.pdf"
        label = "The Lantern Atlas — Streaming verification edition"
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = scratch / "labelled-native.pdf"
            pdf = PdfWriter(clone_from=original)
            page = pdf.pages[0]
            font = DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/Font"),
                    NameObject("/Subtype"): NameObject("/Type1"),
                    NameObject("/BaseFont"): NameObject("/Helvetica"),
                    NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
                }
            )
            page["/Resources"]["/Font"][NameObject("/FVerification")] = pdf._add_object(font)
            stream = DecodedStreamObject()
            stream.set_data(
                page.get_contents().get_data()
                + b"\nq BT /FVerification 8.5 Tf 150 570 Td <"
                + label.encode("cp1252").hex().encode("ascii")
                + b"> Tj ET Q\n"
            )
            page.replace_contents(stream)
            pdf.write(source)
            pages = prepare_source(source, scratch, hashlib.sha256(source.read_bytes()).hexdigest())
            self.assertTrue(all(not page.tasks for page in pages))
            book = reconstruct(source, scratch, pages, []).book
        credit = next(
            block
            for block in book.blocks
            if hasattr(block, "content")
            and block.content.text == "AVA Fixture Studio / Synthetic test edition 1 / 2026-09-28"
        )
        self.assertTrue(any(hasattr(b, "content") and b.content.text == label for b in book.blocks))
        claims = [m for m in book.metadata if m.field in {"contributor", "edition", "date"}]
        self.assertEqual(
            [
                ("contributor", "AVA Fixture Studio", "accepted"),
                ("edition", "Synthetic test edition 1", "accepted"),
                ("date", "2026-09-28", "accepted"),
            ],
            [(m.field, m.value, m.status) for m in claims],
        )
        self.assertTrue(all(m.evidence == credit.evidence for m in claims))
        self.assertEqual(
            ["AVA Fixture Studio"],
            [node.text for node in metadata_element(book) if node.tag == "dc:creator"],
        )

    def test_genuine_author_keeps_printed_credit_evidence_and_epub_creator(self):
        source = FIXTURES / "native.pdf"
        oracle = json.loads((FIXTURES / "native-oracle.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = [prepare_page(source, scratch, i) for i in range(1, 9)]
            self.assertTrue(all(not page.tasks for page in pages))
            book = reconstruct(source, scratch, pages, []).book
        authors = [
            m for m in book.metadata if m.field == "contributor" and m.contributor_role == "author"
        ]
        self.assertEqual(
            [(oracle["metadata"]["author"], "accepted")],
            [(m.value, m.status) for m in authors],
        )
        credit = next(
            block
            for block in book.blocks
            if hasattr(block, "content")
            and block.content.text == "AVA Fixture Studio / Synthetic test edition 1 / 2026-09-28"
        )
        self.assertEqual(credit.evidence, authors[0].evidence)
        suffixes = {
            m.field: m
            for m in book.metadata
            if m.field in {"edition", "date"} and m.status == "accepted"
        }
        self.assertEqual("Synthetic test edition 1", suffixes["edition"].value)
        self.assertEqual("2026-09-28", suffixes["date"].value)
        for claim in suffixes.values():
            self.assertEqual("source_edition", claim.scope)
            self.assertEqual(credit.evidence, claim.evidence)
        self.assertEqual(
            [oracle["metadata"]["author"]],
            [node.text for node in metadata_element(book) if node.tag == "dc:creator"],
        )
        self.assertEqual(
            ["2026-09-28"],
            [node.text for node in metadata_element(book) if node.tag == "dc:date"],
        )
