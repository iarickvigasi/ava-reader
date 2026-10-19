"""Recovery receipts retain original identities and cannot change historical assembly."""

import unittest

from ava_pdf_epub.contracts.common import document_digest, text_digest
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.recover_source_quotes import recover_source_quotes
from ava_pdf_epub.reconstruction_v2.source_quote_receipt import SourceQuoteReceipt

from .source_quote_fixture import quoted


class RecoverSourceQuotesTests(unittest.TestCase):
    def test_source_and_changed_text_hashes_bind_each_finite_glyph_receipt(self):
        page, owner = quoted("’" * 17, "'" * 17)
        prepared = PreparedPage(
            schema_version="ava-prepared-page-1",
            source_sha256="a" * 64,
            source_byte_length=1,
            source_page_count=1,
            observation=page,
            tables=[],
            native_segments=[],
            tasks=[],
        )
        state = AssemblyState(source_continuation_policy=POLICY)
        result = recover_source_quotes([prepared], [owner], state)
        self.assertEqual("’" * 17, result[0].text)
        self.assertIsNone(result[0].source_text)
        receipts = [
            SourceQuoteReceipt.model_validate_json(f.message) for f in state.structure_findings
        ]
        self.assertEqual([8, 8, 1], [len(r.substitutions) for r in receipts])
        self.assertEqual(list(range(17)), [s.offset for r in receipts for s in r.substitutions])
        for finding, receipt in zip(state.structure_findings, receipts, strict=True):
            self.assertEqual("information", finding.severity)
            self.assertEqual(owner.id, receipt.owner_id)
            self.assertEqual(text_digest(owner.text), receipt.original_sha256)
            self.assertEqual(text_digest(result[0].text), receipt.recovered_sha256)
            self.assertEqual(document_digest(page), receipt.observation_sha256)
        self.assertEqual(result[0], state.segments[owner.id])
        historical = AssemblyState()
        self.assertEqual([owner], recover_source_quotes([prepared], [owner], historical))
        self.assertEqual([], historical.structure_findings)
