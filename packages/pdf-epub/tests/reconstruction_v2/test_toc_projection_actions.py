"""Real original actions/labels/outlines, full peer checks and private proof integrity."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pypdf.generic import NameObject, NumberObject, TextStringObject

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.project_toc_pages import project_toc_pages
from ava_pdf_epub.reconstruction_v2.toc_page_projection import toc_page_projection

from .toc_projection_fixture import projection_case


class TocProjectionActionTests(unittest.TestCase):
    def test_real_annotation_mutations_cannot_become_source_rows(self):
        for case in ["partial", "foreign", "missing", "duplicate", "target", "label", "outline"]:
            with self.subTest(case=case), tempfile.TemporaryDirectory() as d:
                f = projection_case(Path(d))
                self.addCleanup(f.reader.close)
                annotations = f.reader.pages[0]["/Annots"]
                action = annotations[0].get_object()
                if case == "partial":
                    action["/Rect"][0] = NumberObject(6)
                elif case == "foreign":
                    action["/Rect"][3] = NumberObject(100)
                elif case == "missing":
                    del annotations[0]
                elif case == "duplicate":
                    annotations.append(annotations[0])
                elif case == "target":
                    action["/A"]["/D"][0] = f.reader.pages[4].indirect_reference
                elif case == "label":
                    f.reader.trailer["/Root"]["/PageLabels"]["/Nums"][5][NameObject("/St")] = (
                        NumberObject(2)
                    )
                else:
                    # Same source page and original rows, but no uniquely agreeing outline.
                    f.reader.trailer["/Root"]["/Outlines"]["/First"][NameObject("/Title")] = (
                        TextStringObject("Different")
                    )
                self.assertIsNone(toc_page_projection(f.reader, f.page, f.owners, POLICY))

    def test_complete_projected_peer_list_is_passed_to_ordinary_literal_guard(self):
        with tempfile.TemporaryDirectory() as d:
            f = projection_case(Path(d))
            self.addCleanup(f.reader.close)
            from ava_pdf_epub.reconstruction_v2.ocr_literal_glyph_map import literal_fragment_map

            seen = []

            def observe(page, owner, peers, fragments):
                seen.append((owner.id, [p.id for p in peers]))
                return literal_fragment_map(page, owner, peers, fragments)

            with patch(
                "ava_pdf_epub.reconstruction_v2.toc_page_projection.literal_fragment_map",
                side_effect=observe,
            ):
                self.assertIsNotNone(toc_page_projection(f.reader, f.page, f.owners, POLICY))
            self.assertEqual(4, len(seen))
            self.assertTrue(all(peers == [o.id for o in f.owners] for _, peers in seen))

    def test_damaged_existing_provenance_is_not_replaced_or_accepted(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            f = projection_case(root)
            self.addCleanup(f.reader.close)

            def run():
                state = AssemblyState(source_continuation_policy=POLICY)
                result = project_toc_pages(f.source, root, [f.checkpoint], {1: f.owners}, state)
                return result, state

            run()
            target = next((root / "toc-projections").glob("*.json"))
            target.write_bytes(b"corrupt")
            with self.assertRaisesRegex(ValueError, "collision"):
                run()
            self.assertEqual(b"corrupt", target.read_bytes())
