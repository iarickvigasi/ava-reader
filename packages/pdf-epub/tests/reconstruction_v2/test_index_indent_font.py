"""Empty or explicitly unknown source font tokens cannot supply calibration evidence."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.index_context import record_index_context
from ava_pdf_epub.reconstruction_v2.index_indents import recover_index_indents

from .index_context_fixture import context_case


class IndexIndentFontTests(unittest.TestCase):
    def test_unknown_fonts_leave_the_observation_and_measurement_receipts_unchanged(self):
        for font in ["", "   ", "unknown", "None"]:
            with self.subTest(font=font), tempfile.TemporaryDirectory() as d:
                page, owners = context_case(Path(d))
                rows = [
                    row.model_copy(
                        update={"glyphs": [g.model_copy(update={"font": font}) for g in row.glyphs]}
                    )
                    for row in page.observation.lines
                ]
                page = page.model_copy(
                    update={"observation": page.observation.model_copy(update={"lines": rows})}
                )
                state = AssemblyState(source_continuation_policy=POLICY)
                record_index_context([page], owners, state)
                self.assertEqual(12, len(state.source_index_entries))
                self.assertEqual(owners, recover_index_indents([page], owners, state))
                self.assertTrue(
                    all(r.indent_em is None for r in state.source_index_entries.values())
                )
