import copy
import json
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.capabilities import required_capabilities
from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.reader import ReaderPackageV3

from .helpers import fixture


class SourcePageAddressTests(unittest.TestCase):
    def marked(self):
        return json.loads(
            (Path(__file__).parent / "fixtures/ava-reader-3-source-pages.json").read_bytes()
        )

    def test_separate_reader_fixture_is_semantically_valid_complete_and_digest_bound(self):
        raw = self.marked()
        reader = ReaderPackageV3.model_validate(raw)
        self.assertEqual(
            {1, 2}, {a.source_page for a in reader.book.addresses if a.source_page is not None}
        )
        self.assertIn("source-page-starts", reader.required_capabilities)
        self.assertEqual(raw["canonical_sha256"], document_digest(reader.book))
        old = ReaderPackageV3.model_validate(fixture("ava-reader-3"))
        self.assertNotIn("source-page-starts", old.required_capabilities)
        self.assertFalse(any("source_page" in a for a in old.book.model_dump()["addresses"]))

    def test_missing_capability_or_wrong_digest_cannot_claim_the_new_reader_package(self):
        for mode in ["capability", "digest"]:
            raw = self.marked()
            if mode == "capability":
                raw["required_capabilities"].remove("source-page-starts")
            else:
                raw["canonical_sha256"] = fixture("ava-reader-3")["canonical_sha256"]
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                ReaderPackageV3.model_validate(raw)

    def test_complete_map_semantics_refuse_partial_blank_collision_owner_and_ranges(self):
        mutations = [
            lambda r: r["addresses"].pop(),
            lambda r: r["addresses"][-1].update(source_page=1),
            lambda r: r["addresses"][-1].update(source_page=3),
            lambda r: r["addresses"][-1].update(fragment="body-two"),
            lambda r: r["addresses"][-1]["target"].update(block_id="body-two"),
            lambda r: r["addresses"][-1]["target"].update(chapter_id="chapter-one"),
            lambda r: r["addresses"][-1]["target"].update(offset=1),
            lambda r: r["addresses"][-1].update(resource_path="text/chapter-one.xhtml"),
            lambda r: r["pages"][1]["regions"][0].update(role="furniture"),
        ]
        for mutation in mutations:
            raw = self.marked()["book"]
            mutation(raw)
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                CanonicalBookV2.model_validate(raw)

    def test_unmarked_reserved_looking_identity_remains_an_ordinary_legacy_address(self):
        raw = fixture()

        def renamed(value):
            if isinstance(value, dict):
                return {k: renamed(v) for k, v in value.items()}
            if isinstance(value, list):
                return [renamed(v) for v in value]
            return "ava-source-page-1" if value == "chapter-one" else value

        book = CanonicalBookV2.model_validate(renamed(copy.deepcopy(raw)))
        self.assertNotIn("source-page-starts", required_capabilities(book))
        self.assertEqual("ava-source-page-1", book.addresses[0].fragment)
        self.assertIsNone(book.addresses[0].source_page)

    def test_marked_map_refuses_a_real_ordinary_identity_collision_without_breaking_legacy_ids(
        self,
    ):
        raw = self.marked()["book"]

        def replace(value):
            if isinstance(value, dict):
                return {k: replace(v) for k, v in value.items()}
            if isinstance(value, list):
                return [replace(v) for v in value]
            return "ava-source-page-1" if value == "chapter-one" else value

        raw = replace(raw)
        legacy = copy.deepcopy(raw)
        legacy["addresses"] = [a for a in legacy["addresses"] if a.get("source_page") is None]
        CanonicalBookV2.model_validate(legacy)
        with self.assertRaisesRegex(ValueError, "reserved identity"):
            CanonicalBookV2.model_validate(raw)
