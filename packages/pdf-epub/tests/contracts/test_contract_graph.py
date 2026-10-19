import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts import CanonicalBookV2, validate_contract
from ava_pdf_epub.contracts.common import document_digest

from .helpers import block, fixture


class CanonicalContractTests(unittest.TestCase):
    def reject(self, change):
        book = fixture()
        change(book)
        with self.assertRaises((ValidationError, ValueError)):
            CanonicalBookV2.model_validate(book)

    def test_exact_content_round_trip(self):
        book = CanonicalBookV2.model_validate(fixture())
        wire = book.model_dump_json()
        again = CanonicalBookV2.model_validate_json(wire)
        self.assertEqual(book, again)
        self.assertEqual(document_digest(book), document_digest(again))
        self.assertEqual(len(book.blocks), 14)
        self.assertEqual(len(book.addresses), 25)
        self.assertIs(book.styles[0].bold, False)
        self.assertEqual(book.styles[0].indent_em, 0)
        self.assertIsNone(book.styles[0].relative_size)
        self.assertEqual(
            book.blocks[1].content.text, "A😀B café office Line two [1] and again [1]."
        )

    def test_unknown_or_missing_version_and_extra_html_fail(self):
        for version in [None, "ava-book-1", "ava-book-999"]:
            self.reject(lambda b, version=version: b.update(schema_version=version))
        self.reject(lambda b: b.pop("schema_version"))
        self.reject(lambda b: block(b, "body-one").update(html="<b>invented</b>"))
        with self.assertRaises(ValueError):
            validate_contract("ava-book-2", fixture("ava-pdf-job-1"))

    def test_hash_offsets_identity_and_address_invariants(self):
        self.reject(lambda b: block(b, "body-one")["content"].update(sha256="0" * 64))
        self.reject(lambda b: block(b, "body-one")["content"]["codepoint_utf16"].__setitem__(2, 2))
        self.reject(lambda b: b["blocks"].append(b["blocks"][0]))
        self.reject(lambda b: b["spine"].reverse())
        self.reject(lambda b: b["addresses"].pop())
        self.reject(lambda b: b["addresses"].append(b["addresses"][0]))
        self.reject(lambda b: b["addresses"][3]["target"].update(chapter_id="chapter-two"))
        self.reject(
            lambda b: block(b, "body-two")["content"]["spans"][1]["link"].update(offset=999)
        )

    def test_note_labels_are_not_identity_and_returns_are_exact(self):
        book = fixture()
        self.assertEqual(block(book, "note-one")["label"], block(book, "note-two")["label"])
        self.reject(lambda b: block(b, "note-one")["callout_ids"].pop())
        self.reject(lambda b: block(b, "note-two").update(callout_ids=["call-1a"]))
        self.reject(
            lambda b: block(b, "body-one")["content"]["spans"][0]["link"].update(
                block_id="body-one"
            )
        )

    def test_table_list_and_style_relationships(self):
        self.reject(lambda b: block(b, "table-one")["cells"].pop())
        self.reject(lambda b: block(b, "table-one")["cells"][3].update(header_ids=["cell-00"]))
        self.reject(lambda b: b["lists"][1].update(depth=3))
        self.reject(lambda b: b["lists"][0].update(start=None))
        self.reject(lambda b: block(b, "body-one").update(style_id="missing-style"))
        self.reject(lambda b: block(b, "table-one").update(row_count=21))

    def test_assets_paths_and_metadata_provenance(self):
        self.reject(lambda b: b["resources"][0].update(path="../outside.png"))
        self.reject(lambda b: b["resources"][0].update(path="images/%2e%2e/out.png"))
        self.reject(lambda b: block(b, "figure-one").update(resource_id="missing-image"))
        self.reject(lambda b: block(b, "figure-one").update(caption_id="body-one"))
        self.reject(lambda b: b["metadata"][0].update(identifier_scheme="isbn"))
        self.reject(lambda b: b["metadata"][0].update(value="SYNTHETIC-PRINT-123"))
        self.reject(lambda b: b["metadata"][2].update(evidence=[]))

    def test_literal_text_whitespace_and_explicit_resets_survive(self):
        book = CanonicalBookV2.model_validate(fixture())
        values = {b.id: b for b in book.blocks}
        self.assertEqual(values["verse-one"].content.text, "  Wind at the gate\n    rests.")
        self.assertEqual(values["code-one"].content.text, "if ready:\n    open_book()")
        self.reject(lambda b: b["styles"][0].update(bold=0))
        self.reject(lambda b: b["pages"][0]["regions"][0].update(column=True))
