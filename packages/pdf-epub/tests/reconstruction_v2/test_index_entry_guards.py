"""Review regression: page-wide index recognition cannot waive unrelated prose checks."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.index_context import (
    independent_index_entry,
    record_index_context,
)
from ava_pdf_epub.reconstruction_v2.page_checkpoints import PreparedPageMap
from ava_pdf_epub.reconstruction_v2.source_feature_selection import source_feature_selection
from ava_pdf_epub.reconstruction_v2.source_nonquote_context import nonquote_context
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .index_context_fixture import context_case
from .index_guard_fixture import replace_left, wrapped_entry
from .test_pdf_links import box


class IndexEntryGuards(unittest.TestCase):
    def test_italic_explanatory_prose_inside_index_retains_essential_role_review(self):
        with tempfile.TemporaryDirectory() as d:
            page, owners = context_case(Path(d))
            page, owners = replace_left(page, owners, 2, "An italic notice.")
            notice = next(owner for owner in owners if owner.text == "An italic notice.")
            notice = notice.model_copy(
                update={"style": notice.style.model_copy(update={"italic": True})}
            )
            owners = [notice if owner.id == notice.id else owner for owner in owners]
            state = AssemblyState(source_continuation_policy=POLICY)
            record_index_context([page], owners, state)
            self.assertFalse(independent_index_entry(notice, state))
            pages = PreparedPageMap([page])
            self.assertFalse(nonquote_context(notice, owners, pages, state))
            with self.assertRaises(SourceContentRefusal):
                source_feature_selection([notice], pages, state)

    def test_only_indented_numeric_wraps_can_share_a_proved_entry_context(self):
        for text, expected in [
            ("18, 19", True),
            ("another entry 18", False),
            ("see also alpha", False),
        ]:
            with tempfile.TemporaryDirectory() as d:
                page, owners = context_case(Path(d))
                page, owners, combined = wrapped_entry(page, owners, text)
                state = AssemblyState(source_continuation_policy=POLICY)
                record_index_context([page], owners, state)
                self.assertEqual(expected, independent_index_entry(combined, state))

    def test_a_cropped_suffix_cannot_claim_a_complete_source_entry(self):
        with tempfile.TemporaryDirectory() as d:
            page, owners = context_case(Path(d))
            first = next(owner for owner in owners if owner.text.startswith("alpha0"))
            cropped = first.model_copy(
                update={
                    "text": first.text[1:],
                    "box": box(first.box.x0 + 4, first.box.y0, first.box.x1, first.box.y1),
                }
            )
            owners = [cropped if owner.id == first.id else owner for owner in owners]
            state = AssemblyState(source_continuation_policy=POLICY)
            record_index_context([page], owners, state)
            self.assertFalse(independent_index_entry(cropped, state))
