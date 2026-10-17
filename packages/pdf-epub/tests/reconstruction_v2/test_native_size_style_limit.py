"""Optional final typography cannot make an otherwise valid style set exceed its contract."""

import copy
import unittest

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.native_size_presentation import apply_native_sizes

from .native_size_fixture import document, segment
from .native_size_metadata_fixture import state_for


class NativeSizeStyleLimitTests(unittest.TestCase):
    def test_exact_distinct_style_bound_and_one_over_are_atomic_and_preserve_old_styles(self):
        limit = next(
            item.max_length
            for item in CanonicalBookV2.model_fields["styles"].metadata
            if hasattr(item, "max_length")
        )
        values, pages = document([segment("body1", 1), segment("body2", 2)])
        for count in [limit - 1, limit]:
            with self.subTest(existing_styles=count):
                state = state_for(values)
                self.assertEqual(1, len(state.styles))
                for i in range(count - 1):
                    state.style_id(Style(id=f"other-{i}", color=f"#{i:06x}"))
                before_styles = copy.deepcopy(state.styles)
                before_blocks = copy.deepcopy(state.blocks)
                before_segments = copy.deepcopy(state.segments)
                apply_native_sizes(values, pages, state)
                self.assertEqual(before_segments, state.segments)
                self.assertEqual(before_styles, {k: state.styles[k] for k in before_styles})
                self.assertEqual(limit, len(state.styles))
                if count == limit:
                    self.assertEqual(before_blocks, state.blocks)
                    self.assertEqual(
                        ["NATIVE_DOCUMENT_SIZE_STYLE_LIMIT"],
                        [f.code for f in state.structure_findings],
                    )
                else:
                    self.assertEqual(1, len({b["style_id"] for b in state.blocks}))
                    self.assertEqual(1, state.styles[state.blocks[0]["style_id"]]["relative_size"])
                    self.assertNotEqual(before_blocks[0]["style_id"], state.blocks[0]["style_id"])

    def test_existing_target_style_is_reused_at_the_full_contract_bound(self):
        limit = next(
            item.max_length
            for item in CanonicalBookV2.model_fields["styles"].metadata
            if hasattr(item, "max_length")
        )
        values, pages = document([segment("body1", 1), segment("body2", 2)])
        state = state_for(values)
        expected = state.style_id(values[0].style.model_copy(update={"relative_size": 1.0}))
        for i in range(limit - len(state.styles)):
            state.style_id(Style(id=f"other-{i}", color=f"#{i:06x}"))
        before_styles = copy.deepcopy(state.styles)
        apply_native_sizes(values, pages, state)
        self.assertEqual(before_styles, state.styles)
        self.assertEqual([expected, expected], [b["style_id"] for b in state.blocks])
