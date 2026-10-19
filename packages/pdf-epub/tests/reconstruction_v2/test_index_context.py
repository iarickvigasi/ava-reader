"""A proof-bound index context prevents prose joins and false essential quotation checks."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_boundary import inferred_continuation
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.index_context import (
    independent_index_entry,
    record_index_context,
)
from ava_pdf_epub.reconstruction_v2.page_checkpoints import PreparedPageMap
from ava_pdf_epub.reconstruction_v2.refinement_edges import refinement_edges
from ava_pdf_epub.reconstruction_v2.source_nonquote_context import nonquote_context
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins

from .index_context_fixture import context_case


class IndexContextTests(unittest.TestCase):
    def test_lowercase_column_boundary_stays_separate_without_another_model_call(self):
        with tempfile.TemporaryDirectory() as d:
            page, owners = context_case(Path(d))
            left, right = owners[-1], owners[1]
            state = AssemblyState(source_continuation_policy=POLICY)
            state.placements = {left.id: (1, 1, 1), right.id: (1, 1, 2)}
            state.flush_starts[right.id] = True
            self.assertTrue(inferred_continuation(left, right, state))  # Reproduces old defect.
            record_index_context([page], owners, state)
            self.assertEqual(12, len(state.source_index_entries))
            self.assertFalse(inferred_continuation(left, right, state))
            self.assertEqual([], refinement_edges([left, right], state))
            self.assertEqual([left, right], stream_joins([left, right], state))
            self.assertFalse(independent_index_entry(owners[0], state))  # Intro is ordinary prose.
            state.release_observations()
            self.assertEqual({}, state.source_index_entries)

    def test_exact_entry_context_survives_style_recovery_but_not_changed_ownership(self):
        with tempfile.TemporaryDirectory() as d:
            page, owners = context_case(Path(d))
            state = AssemblyState(source_continuation_policy=POLICY)
            record_index_context([page], owners, state)
            entry = owners[1]
            italic = entry.model_copy(
                update={
                    "style": entry.style.model_copy(update={"italic": True, "block_indent_em": 1})
                }
            )
            self.assertTrue(nonquote_context(italic, owners, PreparedPageMap([page]), state))
            for changes in [
                {"text": entry.text + "x"},
                {"page": 2},
                {"continues_to_next": True},
                {"kind": "quote"},
                {"box": owners[2].box},
            ]:
                self.assertFalse(independent_index_entry(entry.model_copy(update=changes), state))

    def test_unknown_source_or_competing_owner_or_changed_text_cannot_gain_context(self):
        with tempfile.TemporaryDirectory() as d:
            page, owners = context_case(Path(d))
            for current, values in [
                (page, [owners[1].model_copy(update={"text": "wrong 12"})]),
                (page, [*owners, owners[1].model_copy(update={"id": "competitor"})]),
                (
                    page.model_copy(
                        update={
                            "observation": page.observation.model_copy(
                                update={"risks": [*page.observation.risks, "unknown"]}
                            )
                        }
                    ),
                    owners,
                ),
            ]:
                state = AssemblyState(source_continuation_policy=POLICY)
                record_index_context([current], values, state)
                self.assertFalse(
                    independent_index_entry(values[0] if len(values) == 1 else values[1], state)
                )
            state = AssemblyState()
            record_index_context([page], owners, state)
            self.assertEqual({}, state.source_index_entries)
