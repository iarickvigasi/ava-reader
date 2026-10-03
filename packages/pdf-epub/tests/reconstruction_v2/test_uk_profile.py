"""Actual native Cyrillic/columns and independently authored text/chapter oracles."""

import io
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject

from ava_pdf_epub.contracts.capabilities import required_capabilities
from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE, checked_profile
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.make_task import make_task
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.protocol import ReconstructionInput
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source

from .response_fixtures import wire_segment

FIXTURES = Path(__file__).parent / "fixtures"


class UkrainianProfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.scratch = Path(cls.temp.name)
        cls.source = FIXTURES / "uk-native.pdf"
        cls.oracle = json.loads((FIXTURES / "uk-native-oracle.json").read_text())
        cls.pages = [prepare_page(cls.source, cls.scratch, n, BILINGUAL_PROFILE) for n in (1, 2, 3)]
        cls.result = reconstruct(cls.source, cls.scratch, cls.pages, [])

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_native_ukrainian_preserves_all_text_and_column_order_without_a_provider(self):
        self.assertEqual([0, 0, 0], [len(page.tasks) for page in self.pages])
        self.assertTrue(all(page.profile_id == BILINGUAL_PROFILE for page in self.pages))
        self.assertEqual(
            self.oracle["paragraphs"],
            [block.content.text for block in self.result.book.blocks if block.kind == "paragraph"],
        )
        self.assertEqual(
            {"uk"},
            {
                block.content.language
                for block in self.result.book.blocks
                if hasattr(block, "content")
            },
        )
        self.assertIn("language", required_capabilities(self.result.book))

    def test_large_marginal_chapters_survive_furniture_and_have_separate_xhtml(self):
        self.assertEqual(
            self.oracle["chapters"], [chapter.title for chapter in self.result.book.chapters]
        )
        self.assertEqual(self.oracle["chapters"], [entry.label for entry in self.result.book.toc])
        with zipfile.ZipFile(io.BytesIO(self.result.epub)) as archive:
            chapters = [name for name in archive.namelist() if name.startswith("EPUB/text/")]
            self.assertEqual(2, len(chapters))
            for name in chapters + ["EPUB/nav/nav.xhtml"]:
                root = ET.fromstring(archive.read(name))
                self.assertEqual("uk", root.get("lang"))
                self.assertEqual("uk", root.get("{http://www.w3.org/XML/1998/namespace}lang"))
            opf = ET.fromstring(archive.read("EPUB/package.opf"))
            self.assertEqual("uk", opf.find(".//{http://purl.org/dc/elements/1.1/}language").text)
        self.assertEqual(self.result.book, portable_epub(self.result.epub)[0])

    def test_sandbox_reconstruction_input_preserves_profile_and_report(self):
        request = ReconstructionInput(
            schema_version="ava-reconstruct-input-1",
            profile_id=BILINGUAL_PROFILE,
            source_sha256=self.pages[0].source_sha256,
            responses=[],
        )
        result, report = reconstruct_source(self.source, self.scratch, request)
        self.assertEqual(self.result.book, result.book)
        self.assertEqual(BILINGUAL_PROFILE, report.profile_id)

    def test_legacy_profile_does_not_silently_expand_or_mix_pages(self):
        legacy = prepare_page(self.source, self.scratch, 1, LEGACY_PROFILE)
        self.assertTrue(legacy.tasks)
        self.assertIn("language_uncertain", legacy.observation.risks)
        with self.assertRaisesRegex(ValueError, "immutable source"):
            reconstruct(self.source, self.scratch, [legacy, *self.pages[1:]], [])
        with self.assertRaisesRegex(ValueError, "Unsupported conversion profile"):
            checked_profile("invented-profile")

    def test_conflicting_pdf_language_is_retained_but_not_promoted(self):
        writer = PdfWriter(clone_from=PdfReader(self.source))
        writer.root_object[NameObject("/Lang")] = TextStringObject("ru-UA")
        source = self.scratch / "conflicting-tag.pdf"
        writer.write(source)
        pages = [prepare_page(source, self.scratch, n, BILINGUAL_PROFILE) for n in (1, 2, 3)]
        result = reconstruct(source, self.scratch, pages, [])
        claims = {
            (claim.value, claim.status)
            for claim in result.book.metadata
            if claim.field == "language"
        }
        self.assertEqual({("uk", "accepted"), ("ru-UA", "conflict")}, claims)
        self.assertEqual(
            self.oracle["paragraphs"],
            [block.content.text for block in result.book.blocks if block.kind == "paragraph"],
        )

    def test_receipt_language_is_bound_to_the_task_profile(self):
        page = self.pages[0]
        from ava_pdf_epub.reconstruction_v2.geometry import rectangle

        region = rectangle(
            (0, 0, page.observation.width_pt, page.observation.height_pt),
            page.observation.width_pt,
            page.observation.height_pt,
        )
        task = make_task(
            page.observation, page.source_sha256, region, self.scratch, profile_id=BILINGUAL_PROFILE
        )
        response = RecognitionResponse(
            schema_version="ava-recognition-response-2",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            render_sha256=task.image.sha256,
            language="uk-UA",
            unresolved=[],
            segments=[
                wire_segment(
                    task,
                    id=line.id,
                    page=1,
                    box=line.box.model_dump(),
                    kind="paragraph",
                    text=line.text,
                    method="ocr",
                )
                for line in page.observation.lines
            ],
        )
        accept_response(task, response)
        for label in ["ru", "fr", "unknown"]:
            with self.assertRaisesRegex(ValueError, "language"):
                accept_response(task, response.model_copy(update={"language": label}))
        legacy = make_task(page.observation, page.source_sha256, region, self.scratch)
        self.assertNotEqual(task.task_id, legacy.task_id)
        with self.assertRaisesRegex(ValueError, "language"):
            accept_response(legacy, response.model_copy(update={"task_id": legacy.task_id}))

    def test_extended_book_cannot_default_missing_language_to_english(self):
        raw = self.result.book.model_dump()
        raw["metadata"] = [claim for claim in raw["metadata"] if claim["field"] != "language"]
        with self.assertRaisesRegex(ValueError, "requires source-supported language"):
            type(self.result.book).model_validate(raw)

    def test_extended_passage_language_cannot_be_silently_dropped(self):
        raw = self.result.book.model_dump()
        for block in raw["blocks"]:
            if "content" in block:
                block["content"].pop("language", None)
                break
        with self.assertRaisesRegex(ValueError, "explicit passage language"):
            type(self.result.book).model_validate(raw)
