"""The independent two-column source oracle needs no model for its complete opening credit."""

import hashlib
import io
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.book_language import language_metadata
from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

from .metadata_helpers import body, metadata_state, title
from .opening_credit_test_fixture import credit


class NativeLanguageCreditExportTests(unittest.TestCase):
    def test_printed_language_marker_cannot_override_source_qualified_primary_language(self):
        source = Path(__file__).parent / "fixtures" / "two-column.pdf"
        with tempfile.TemporaryDirectory() as directory:
            prepared = prepare_source(
                source,
                Path(directory),
                hashlib.sha256(source.read_bytes()).hexdigest(),
                BILINGUAL_PROFILE,
            )
            state = metadata_state([title(), credit("A. Example / Ukrainian / 2024-02-29"), body()])
            from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata

            claims = printed_metadata(state, "A. Example")
            claims.extend(language_metadata(source, state, prepared, []))
            languages = [(c["value"], c["status"]) for c in claims if c["field"] == "language"]
            self.assertEqual([("uk", "candidate"), ("en", "accepted")], languages)

    def test_actual_source_keeps_body_and_creator_date_without_paid_comparison(self):
        source = Path(__file__).parent / "fixtures" / "two-column.pdf"
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            prepared = prepare_source(
                source, scratch, hashlib.sha256(source.read_bytes()).hexdigest(), BILINGUAL_PROFILE
            )
            self.assertTrue(all(not page.tasks for page in prepared))
            _, segments, state = source_segments(source, scratch, prepared, [])
            credit = next(s for s in segments if s.id == "p1-line1")
            self.assertEqual("AVA Fixture Studio / English / 2026-09-28", credit.text)
            self.assertEqual([], prepare_refinement(source, scratch, prepared, segments, state))
            result = reconstruct(source, scratch, prepared, [], [])
            book = result.book
            self.assertEqual(
                credit.text, next(b.content.text for b in book.blocks if b.id == credit.id)
            )
            authors = [
                m for m in book.metadata if m.field == "contributor" and m.status == "accepted"
            ]
            dates = [m for m in book.metadata if m.field == "date" and m.status == "accepted"]
            self.assertEqual(["AVA Fixture Studio"], [m.value for m in authors])
            self.assertEqual(["2026-09-28"], [m.value for m in dates])
            self.assertEqual("source_edition", dates[0].scope)
            self.assertEqual(1, dates[0].evidence[0].page)
            self.assertEqual([], result.refinement_evidence)
            self.assertEqual(
                ["en"],
                [
                    m.value
                    for m in book.metadata
                    if m.field == "language" and m.status == "accepted"
                ],
            )
            with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
                name = next(n for n in archive.namelist() if n.endswith(".opf"))
                root = ET.fromstring(archive.read(name))
                dc = "{http://purl.org/dc/elements/1.1/}"
                self.assertEqual(
                    ["AVA Fixture Studio"], [n.text for n in root.findall(".//" + dc + "creator")]
                )
                date = root.findall(".//" + dc + "date")
                self.assertEqual(["2026-09-28"], [n.text for n in date])
                self.assertNotIn("event", date[0].attrib)
                scope = [
                    n.text
                    for n in root.iter()
                    if n.attrib.get("refines") == "#" + date[0].attrib["id"]
                    and n.attrib.get("property") == "ava:scope"
                ]
                self.assertEqual(["source_edition"], scope)
