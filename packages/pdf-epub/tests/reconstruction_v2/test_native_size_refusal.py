"""Ambiguous, single-page, unstable or unowned native observations cannot establish a body base."""

import unittest

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.native_document_sizes import normalize_native_sizes

from .native_size_fixture import document, segment


class NativeSizeRefusal(unittest.TestCase):
    def unchanged(self, items):
        values, pages = document(items)
        state = AssemblyState()
        self.assertEqual(values, normalize_native_sizes(values, pages, state))
        self.assertEqual(
            ["NATIVE_DOCUMENT_SIZE_REFERENCE_UNKNOWN"], [f.code for f in state.structure_findings]
        )

    def test_no_repeated_body_or_two_competing_references_retain_local_ratios(self):
        self.unchanged([segment("a", 1), segment("b", 1, y=100)])
        self.unchanged([segment("a", 1), segment("b", 2, 14)])
        self.unchanged([segment("a", 1), segment("b", 2), segment("c", 3, 14), segment("d", 4, 14)])

    def test_pending_roles_paired_flow_and_inconsistent_lines_are_not_reference_prose(self):
        for update in [{"structure_candidate": True}, {"preserve_line_breaks": True}]:
            self.unchanged([segment("a", 1, **update), segment("b", 2)])
        first, rows = segment("a", 1)
        changed = rows[1].glyphs[0].model_copy(update={"size": 13})
        rows[1] = rows[1].model_copy(update={"glyphs": [changed]})
        self.unchanged([(first, rows), segment("b", 2)])

    def test_missing_repeated_owned_or_hidden_lines_are_not_size_authority(self):
        for invalid in ["missing", "repeated", "hidden", "outside"]:
            first, rows = segment("a", 1)
            if invalid == "missing":
                first = first.model_copy(update={"native_line_ids": ["absent", rows[1].id]})
            elif invalid == "repeated":
                first = first.model_copy(update={"native_line_ids": [rows[0].id, rows[0].id]})
            elif invalid == "hidden":
                rows[0] = rows[0].model_copy(
                    update={"glyphs": [rows[0].glyphs[0].model_copy(update={"visible": False})]}
                )
            else:
                first = first.model_copy(update={"box": first.box.model_copy(update={"x0": 50})})
            self.unchanged([(first, rows), segment("b", 2)])

    def test_visibility_risk_and_shared_line_owner_do_not_contribute(self):
        values, pages = document([segment("a", 1), segment("b", 2)])
        pages[0] = pages[0].model_copy(
            update={
                "observation": pages[0].observation.model_copy(
                    update={"risks": ["conditional_visibility"]}
                )
            }
        )
        state = AssemblyState()
        self.assertEqual(values, normalize_native_sizes(values, pages, state))
        duplicate = values[0].model_copy(update={"id": "duplicate"})
        _, pages = document([segment("a", 1), segment("b", 2)])
        self.assertEqual(
            [*values, duplicate],
            normalize_native_sizes([*values, duplicate], pages, AssemblyState()),
        )

    def test_no_trustworthy_native_sizes_records_unknown_while_pure_ocr_is_untouched(self):
        source, rows = segment("native", 1)
        source = source.model_copy(update={"native_line_ids": ["absent"]})
        self.unchanged([(source, rows)])
        values, pages = document([segment("ocr", 1, method="ocr", native_line_ids=[])])
        state = AssemblyState()
        self.assertEqual(values, normalize_native_sizes(values, pages, state))
        self.assertEqual([], state.structure_findings)

    def test_reviewed_or_unknown_bibliographic_paragraph_is_never_a_body_reference(self):
        values, pages = document([segment("a", 1), segment("b", 2)])
        for role in [None, "author", "publisher", "subtitle"]:
            state = AssemblyState(bibliographic_roles={"a": (role, values[0].text)})
            self.assertEqual(values, normalize_native_sizes(values, pages, state))
            self.assertEqual(
                "NATIVE_DOCUMENT_SIZE_REFERENCE_UNKNOWN", state.structure_findings[0].code
            )
