"""Real native three-table source corrects associations without changing any other graph data."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

FIXTURES = Path(__file__).parent / "fixtures"


class NativeTableCaptionSource(unittest.TestCase):
    def convert(self, profile):
        source = FIXTURES / "table-captions-native.pdf"
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = prepare_source(
                source, scratch, hashlib.sha256(source.read_bytes()).hexdigest(), profile
            )
            self.assertTrue(all(not p.tasks for p in pages))
            _, segments, state = source_segments(source, scratch, pages, [])
            self.assertEqual([], prepare_refinement(source, scratch, pages, segments, state))
            return reconstruct(source, scratch, pages, [], [])

    def test_all_three_tables_have_their_original_caption_values_headers_and_exact_roundtrip(self):
        oracle = json.loads((FIXTURES / "table-captions-native-oracle.json").read_text())
        baseline = json.loads((FIXTURES / "table-captions-baseline.json").read_text())
        result = self.convert(BILINGUAL_PROFILE)
        book = result.book
        self.assertEqual(baseline["sourceSha256"], book.source.sha256)
        nodes = {b.id: b for b in book.blocks}
        tables = [b for b in book.blocks if b.kind == "table"]
        self.assertEqual(3, len(tables))
        self.assertEqual(3, len({b.caption_id for b in tables}))
        for table, expected in zip(tables, oracle["tables"], strict=True):
            self.assertEqual(expected["caption"], nodes[table.caption_id].content.text)
            self.assertEqual(
                [v for row in expected["matrix"] for v in row],
                [c.content.text for c in table.cells],
            )
            for cell in table.cells:
                row, col = (
                    cell.row in expected["header_rows"],
                    cell.column in expected["header_columns"],
                )
                self.assertEqual(
                    "both" if row and col else "column" if row else "row" if col else None,
                    cell.header_axis,
                )
        restored, assets = portable_epub(result.epub)
        self.assertEqual(book, restored)
        self.assertEqual(result.assets, assets)
        value = book.model_dump(mode="json")
        for block in value["blocks"]:
            if block["kind"] == "table":
                block["caption_id"] = None
        raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        self.assertEqual(2, len(value["pages"]))
        self.assertEqual(
            baseline["sourcePrintedPageLabels"], [page["label"] for page in value["pages"]]
        )
        self.assertEqual(baseline["footerOnlyNonCaptionDigest"], hashlib.sha256(raw).hexdigest())
        # These two source-proven folios are the only approved composition difference.
        # Retain the original caption-only conservation guard for every other field.
        value["pages"][0]["label"] = None
        value["pages"][1]["label"] = None
        raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        self.assertEqual(baseline["currentNonCaptionDigest"], hashlib.sha256(raw).hexdigest())

    def test_legacy_profile_keeps_exact_pre_repair_canonical_and_epub_bytes(self):
        baseline = json.loads((FIXTURES / "table-captions-baseline.json").read_text())
        result = self.convert(LEGACY_PROFILE)
        self.assertEqual(baseline["legacyCanonicalDigest"], document_digest(result.book))
        self.assertEqual(baseline["legacyEpubSha256"], hashlib.sha256(result.epub).hexdigest())
