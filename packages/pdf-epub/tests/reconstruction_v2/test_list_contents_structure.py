"""OCR TOC list rows retain exact text while independent source claims form chapters."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.plain_contents_claims import plain_contents_claims
from ava_pdf_epub.reconstruction_v2.structure_claims import StructureClaim

from .list_contents_fixture import assemble, rows
from .metadata_helpers import heading, metadata_state


class ListContentsStructureTests(unittest.TestCase):
    def test_source_structure_creates_distinct_chapters_and_coalesces_original_links(self):
        with tempfile.TemporaryDirectory() as directory:
            original, actual, state, chapters, toc = assemble(Path(directory))
        self.assertEqual(original[1:3], actual[1:3])
        self.assertEqual(["Contents", "Harbour", "Orchard"], [c["title"] for c in chapters])
        self.assertEqual(3, len({c["resource_paths"][0] for c in chapters}))
        self.assertEqual(["Contents", "Harbour", "Orchard"], [t["label"] for t in toc])
        for row, target, chapter in [
            (original[1], original[3], "chapter-2"),
            (original[2], original[5], "chapter-3"),
        ]:
            block = next(b for b in state.blocks if b["id"] == row.id)
            self.assertEqual("list_item", block["kind"])
            self.assertEqual(row.text, block["content"]["text"])
            links = [s for s in block["content"]["spans"] if s.get("link")]
            self.assertEqual(1, len(links))
            self.assertEqual((0, len(row.text)), (links[0]["start"], links[0]["end"]))
            self.assertEqual(
                (target.id, chapter, 0),
                (
                    links[0]["link"]["block_id"],
                    links[0]["link"]["chapter_id"],
                    links[0]["link"]["offset"],
                ),
            )
        self.assertTrue(
            any(f.code == "SOURCE_INTERNAL_LINK_CLAIMS_COALESCED" for f in state.structure_findings)
        )

    def test_conflicting_original_link_does_not_gain_authority_from_a_list_row(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "Conflicting overlapping"):
                assemble(Path(directory), conflicting=True)

    def test_list_rows_require_the_same_exact_outline_and_folio_authority(self):
        state = rows()
        segments = list(state.segments.values())[:2]
        good = StructureClaim("Harbour", None, pdf_page=2)
        for outline, folios in [
            ([], {"1": 2}),
            ([good, good], {"1": 2}),
            ([good], {}),
            ([good], {"1": 3}),
            ([StructureClaim("Harbour abridged", None, pdf_page=2)], {"1": 2}),
        ]:
            with self.subTest(outline=outline, folios=folios):
                with self.assertRaisesRegex(ValueError, "unique exact"):
                    plain_contents_claims(segments, outline, folios)
        with self.assertRaisesRegex(ValueError, "Repeated"):
            plain_contents_claims(segments + [segments[1]], [good], {"1": 2})

    def test_roman_multiline_rows_keep_list_fields_offsets_and_source_text(self):
        state = metadata_state(
            [
                heading("Contents"),
                dict(
                    kind="list_item",
                    text="Preface\nvii",
                    method="ocr",
                    list_ordered=False,
                    list_depth=1,
                ),
                dict(
                    kind="list_item",
                    text="1 A😀B café\nand light 1",
                    method="ocr",
                    list_ordered=True,
                    list_start=1,
                    list_depth=1,
                ),
            ]
        )
        segments = list(state.segments.values())
        before = [s.model_dump() for s in segments]
        outline = [
            StructureClaim("Preface", None, pdf_page=8),
            StructureClaim("1 A😀B café and light", None, pdf_page=10),
        ]
        claims = plain_contents_claims(segments, outline, {"vii": 8, "1": 10})
        self.assertEqual(["Preface", "1 A😀B café\nand light"], [c.title for c in claims])
        self.assertEqual([s.model_dump() for s in segments], before)
        for claim in claims:
            owner = state.segments[claim.source_id]
            self.assertEqual(
                claim.title,
                owner.text[claim.source_offset : claim.source_offset + len(claim.title)],
            )

    def test_list_role_does_not_admit_body_native_dotted_or_unrelated_text(self):
        state = rows()
        segments = list(state.segments.values())
        variants = [
            segments[1].model_copy(update=update)
            for update in [
                dict(page=2),
                dict(page=6),
                dict(method="native"),
                dict(text="Harbour .... 1"),
                dict(text="No trailing folio"),
            ]
        ]
        outline = [StructureClaim("Harbour", None, pdf_page=2)]
        for variant in variants:
            with self.subTest(variant=variant):
                self.assertEqual(
                    [], plain_contents_claims([segments[0], variant], outline, {"1": 2})
                )
