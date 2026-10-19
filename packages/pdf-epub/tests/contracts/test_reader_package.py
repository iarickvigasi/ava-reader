import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts import ReaderPackageV3

from .helpers import fixture


class ReaderPackageTests(unittest.TestCase):
    def test_reader_schema_hash_and_capabilities_fail_closed(self):
        ReaderPackageV3.model_validate(fixture("ava-reader-3"))
        for mutation in ["hash", "capability", "version", "text"]:
            raw = fixture("ava-reader-3")
            if mutation == "hash":
                raw["canonical_sha256"] = "0" * 64
            elif mutation == "capability":
                raw["required_capabilities"].remove("notes")
            elif mutation == "version":
                raw["version"] = 2
            else:
                raw["book"]["blocks"][1]["content"]["text"] = "silently replaced"
            with self.subTest(mutation=mutation), self.assertRaises(ValidationError):
                ReaderPackageV3.model_validate(raw)
