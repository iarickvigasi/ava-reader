"""Final assembly refuses lost/conflicting source measurements instead of rewriting them."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.assert_index_indents import assert_index_indents
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.index_context import record_index_context
from ava_pdf_epub.reconstruction_v2.index_indents import recover_index_indents

from .index_context_fixture import context_case


class IndexIndentGuardTests(unittest.TestCase):
    def test_equal_point_sizes_from_different_start_fonts_do_not_calibrate_an_inset(self):
        with tempfile.TemporaryDirectory() as d:
            page, owners = context_case(Path(d))
            rows = [
                row.model_copy(
                    update={
                        "glyphs": [
                            g.model_copy(
                                update={
                                    "font": "EntryFont"
                                    if row.id in {"left1", "left3", "left5"}
                                    else "RootFont"
                                }
                            )
                            for g in row.glyphs
                        ]
                    }
                )
                for row in page.observation.lines
            ]
            page = page.model_copy(
                update={"observation": page.observation.model_copy(update={"lines": rows})}
            )
            state = AssemblyState(source_continuation_policy=POLICY)
            record_index_context([page], owners, state)
            result = recover_index_indents([page], owners, state)
            for old, new in zip(owners, result, strict=True):
                if old.text.startswith(("alpha1", "alpha3", "alpha5")):
                    self.assertEqual(old, new)
                    self.assertIsNone(state.source_index_entries[old.id].block_indent_em)

    def test_final_font_updates_survive_but_changed_fields_owner_or_text_refuse(self):
        with tempfile.TemporaryDirectory() as d:
            page, owners = context_case(Path(d))
            state = AssemblyState(source_continuation_policy=POLICY)
            record_index_context([page], owners, state)
            result = recover_index_indents([page], owners, state)
            assert_index_indents(result, state)
            entry = next(o for o in result if o.text.startswith("alpha1"))
            font = entry.model_copy(update={"style": entry.style.model_copy(update={"bold": True})})
            assert_index_indents([font if o.id == entry.id else o for o in result], state)
            for changed in [
                entry.model_copy(update={"style": entry.style.model_copy(update={"indent_em": 1})}),
                entry.model_copy(
                    update={"style": entry.style.model_copy(update={"block_indent_em": None})}
                ),
                entry.model_copy(update={"text": entry.text + "x"}),
                entry.model_copy(update={"kind": "quote"}),
            ]:
                with self.assertRaisesRegex(ValueError, "Final index"):
                    assert_index_indents(
                        [changed if o.id == entry.id else o for o in result], state
                    )
            with self.assertRaisesRegex(ValueError, "Final index"):
                assert_index_indents([o for o in result if o.id != entry.id], state)
            state.release_observations()
            self.assertEqual({}, state.source_index_entries)

    def test_all_displaced_observations_cannot_authorize_a_new_root_margin(self):
        with tempfile.TemporaryDirectory() as d:
            page, owners = context_case(Path(d))
            owners = [
                o.model_copy(update={"style": o.style.model_copy(update={"indent_em": 1})})
                for o in owners
            ]
            state = AssemblyState(source_continuation_policy=POLICY)
            record_index_context([page], owners, state)
            self.assertEqual(owners, recover_index_indents([page], owners, state))
