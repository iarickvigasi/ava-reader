"""Measured subentries/hangs retain exact source content and change comparison identities."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.index_context import record_index_context
from ava_pdf_epub.reconstruction_v2.index_indents import recover_index_indents
from ava_pdf_epub.reconstruction_v2.refinement_digest import observation_digest

from .index_context_fixture import context_case
from .index_guard_fixture import wrapped_entry


class IndexIndentTests(unittest.TestCase):
    def test_subentries_use_block_insets_and_keep_all_other_source_fields(self):
        with tempfile.TemporaryDirectory() as d:
            page, owners = context_case(Path(d))
            owners = [
                o.model_copy(update={"style": o.style.model_copy(update={"indent_em": 1})})
                if o.text.startswith(("alpha1", "alpha3", "alpha5"))
                else o
                for o in owners
            ]
            before = [owner.model_dump() for owner in owners]
            state = AssemblyState(source_continuation_policy=POLICY)
            record_index_context([page], owners, state)
            result = recover_index_indents([page], owners, state)
            for old, new in zip(owners, result, strict=True):
                self.assertEqual(
                    old.model_dump(exclude={"style"}), new.model_dump(exclude={"style"})
                )
                self.assertEqual(
                    old.style.model_dump(exclude={"indent_em", "block_indent_em"}),
                    new.style.model_dump(exclude={"indent_em", "block_indent_em"}),
                )
                if new.text.startswith(("alpha1", "alpha3", "alpha5")):
                    self.assertEqual(0, new.style.indent_em)
                    self.assertAlmostEqual(0.8, new.style.block_indent_em)
            self.assertEqual(before, [owner.model_dump() for owner in owners])
            self.assertNotEqual(observation_digest(owners), observation_digest(result))
            self.assertEqual(
                6, sum(r.block_indent_em is not None for r in state.source_index_entries.values())
            )

    def test_one_complete_numeric_continuation_establishes_a_measured_hanging_indent(self):
        with tempfile.TemporaryDirectory() as d:
            page, owners = context_case(Path(d))
            page, owners, entry = wrapped_entry(page, owners, "41, 42")
            state = AssemblyState(source_continuation_policy=POLICY)
            record_index_context([page], owners, state)
            result = recover_index_indents([page], owners, state)
            new = next(owner for owner in result if owner.id == entry.id)
            self.assertEqual(entry.text, new.text)
            self.assertEqual(entry.spans, new.spans)
            self.assertAlmostEqual(-1.6, new.style.indent_em)
            self.assertAlmostEqual(1.6, new.style.block_indent_em)
            self.assertEqual(0, new.style.indent_em + new.style.block_indent_em)

    def test_missing_source_root_owners_cannot_move_the_column_origin_to_subentries(self):
        with tempfile.TemporaryDirectory() as d:
            page, owners = context_case(Path(d))
            selected = [o for o in owners if o.text.startswith(("alpha1", "alpha3", "alpha5"))]
            state = AssemblyState(source_continuation_policy=POLICY)
            record_index_context([page], selected, state)
            self.assertEqual(selected, recover_index_indents([page], selected, state))
            self.assertFalse(
                any(r.block_indent_em is not None for r in state.source_index_entries.values())
            )

    def test_uncertain_source_and_absent_policy_never_infer_layout(self):
        with tempfile.TemporaryDirectory() as d:
            page, owners = context_case(Path(d))
            state = AssemblyState(source_continuation_policy=POLICY)
            record_index_context([page], owners, state)
            changed = page.model_copy(
                update={"observation": page.observation.model_copy(update={"risks": ["unknown"]})}
            )
            self.assertEqual(owners, recover_index_indents([changed], owners, state))
            self.assertEqual(owners, recover_index_indents([page], owners, AssemblyState()))
