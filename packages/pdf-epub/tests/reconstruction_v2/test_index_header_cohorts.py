"""Only repeated small source headers change role; raw observations stay fixed."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.corroborate_index_headers import corroborate_index_headers
from ava_pdf_epub.reconstruction_v2.linked_furniture import preserve_linked_furniture

from .index_header_fixture import header_case


class IndexHeaderCohorts(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)

    def test_real_source_cohorts_keep_title_text_styles_and_observations(self):
        source, pages, owners = header_case(self.root)
        original = {n: [s.model_dump_json() for s in values] for n, values in owners.items()}
        observed = [p.model_dump_json() for p in pages]
        state = AssemblyState(source_continuation_policy=POLICY)
        result = corroborate_index_headers(source, pages, owners, state)
        changed = []
        for n, values in result.items():
            for before, after in zip(owners[n], values, strict=True):
                if before != after:
                    changed.append(n)
                    self.assertEqual(
                        before.model_dump(exclude={"kind", "heading_level"}),
                        after.model_dump(exclude={"kind", "heading_level"}),
                    )
                    self.assertEqual(("furniture", None), (after.kind, after.heading_level))
        self.assertEqual([4, 5, 6, 7, 8], changed)
        self.assertTrue(next(s for s in result[1] if s.kind == "heading").chapter_start)
        self.assertEqual(original, {n: [s.model_dump_json() for s in v] for n, v in owners.items()})
        self.assertEqual(observed, [p.model_dump_json() for p in pages])
        self.assertEqual(5, len(state.structure_findings))
        self.assertEqual(owners, corroborate_index_headers(source, pages, owners, AssemblyState()))

    def test_large_source_titles_inside_margin_are_not_running_headers(self):
        source, pages, owners = header_case(self.root, header_size=16)
        state = AssemblyState(source_continuation_policy=POLICY)
        self.assertEqual(owners, corroborate_index_headers(source, pages, owners, state))
        self.assertEqual([], state.structure_findings)

    def test_original_annotation_is_preserved_as_credit_after_role_correction(self):
        source, pages, owners = header_case(self.root, link=True)
        state = AssemblyState(source_continuation_policy=POLICY)
        fixed = corroborate_index_headers(source, pages, owners, state)
        result = preserve_linked_furniture(source, pages, fixed, state)
        original = next(s for s in owners[4] if s.kind == "heading")
        actual = next(s for s in result[4] if s.id == original.id)
        self.assertEqual("credit", actual.kind)
        self.assertIn(actual.id, state.source_linked_furniture_ids)
        self.assertEqual(
            (original.text, original.style, original.spans),
            (actual.text, actual.style, actual.spans),
        )
