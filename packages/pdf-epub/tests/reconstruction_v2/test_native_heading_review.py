"""Unranked native openings reach finite source comparison, never guessed chapter promotion."""

import hashlib
import tempfile
import unittest
from pathlib import Path

from pypdf.generic import DecodedStreamObject, NameObject

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.prepare_refinement_source import prepare_refinement_source
from ava_pdf_epub.reconstruction_v2.protocol import ReconstructionInput
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source
from tests.admission.appearance_fixture import annotated_document
from tests.admission.helpers import save


class NativeHeadingReviewTests(unittest.TestCase):
    def test_repeated_large_openings_and_unmarked_sections_require_source_rank_decisions(self):
        document = annotated_document()
        for index, page in enumerate(document.pages):
            if "/Annots" in page:
                del page[NameObject("/Annots")]
            stream = DecodedStreamObject()
            stream.set_data(
                (
                    "BT /F1 18 Tf 20 370 Td (Repeated Reader Guide) Tj "
                    f"/F1 16 Tf 0 -60 Td (Section {index + 1}) Tj "
                    "/F1 10 Tf 0 -30 Td (Ordinary authored words continue here.) Tj "
                    "0 -15 Td (Another ordinary sentence is preserved.) Tj "
                    "0 -15 Td (These authored lines establish body size.) Tj "
                    "0 -15 Td (The final ordinary line remains unchanged.) Tj ET"
                ).encode()
            )
            page[NameObject("/Contents")] = document._add_object(stream)
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = save(document, root)
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            request = ReconstructionInput(
                schema_version="ava-reconstruct-input-1",
                source_sha256=digest,
                profile_id=BILINGUAL_PROFILE,
                responses=[],
            )
            batch = prepare_refinement_source(source, root / "review", request)
            headings = {n.id: n for t in batch.tasks for n in t.nodes if n.kind == "heading"}
            self.assertEqual(4, len(headings))
            self.assertTrue(all(n.structure_candidate for n in headings.values()))
            self.assertTrue(all(n.candidate_original_kind == "heading" for n in headings.values()))
            self.assertTrue(all(not n.ranked_source for n in headings.values()))
            decisions = {ident for t in batch.tasks for ident in t.decision_ids}
            self.assertTrue(set(headings).issubset(decisions))
            self.assertTrue(all(t.prompt_version == "ava-book-refinement-6" for t in batch.tasks))
            self.assertTrue(all(n.observed_chapter is False for n in headings.values()))

            with self.assertRaisesRegex(ValueError, "coverage differs"):
                reconstruct_source(source, root / "unqualified", request)
