"""Late presentation keeps page-owned glyph evidence even after canonical stream joining."""

import copy
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assemble_blocks import assemble_blocks
from ava_pdf_epub.reconstruction_v2.native_size_presentation import apply_native_sizes
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins

from .native_size_fixture import document, segment
from .native_size_metadata_fixture import state_for


class NativeSizeJoinSnapshotTests(unittest.TestCase):
    def test_cross_page_join_uses_unchanged_page_owned_size_sources(self):
        source, pages = document(
            [
                segment("body1", 1),
                segment("body2", 2),
                segment("left", 3, 10, count=1, continues_to_next=True),
                segment("right", 4, 10, count=1, continues_from_previous=True),
            ]
        )
        before_source = copy.deepcopy(source)
        state = state_for(source)
        state.evidence = {b["id"]: b["evidence"] for b in state.blocks}
        joined = stream_joins(source, state)
        self.assertEqual(3, len(joined))
        self.assertEqual(2, len(state.segments["left"].native_line_ids))
        self.assertEqual(1, len(source[2].native_line_ids))
        self.assertEqual(("left", len(source[2].text) + 1), state.aliases["right"])
        state.blocks = []
        with tempfile.TemporaryDirectory() as directory:
            assemble_blocks(joined, pages, Path(directory), state)
        before_blocks = copy.deepcopy(state.blocks)
        before_segments, before_aliases = copy.deepcopy(state.segments), dict(state.aliases)
        apply_native_sizes(source, pages, state)
        self.assertEqual(before_source, source)
        self.assertEqual(before_segments, state.segments)
        self.assertEqual(before_aliases, state.aliases)
        for old, new in zip(before_blocks, state.blocks, strict=True):
            self.assertEqual(
                {k: v for k, v in old.items() if k != "style_id"},
                {k: v for k, v in new.items() if k != "style_id"},
            )
        self.assertEqual(10 / 12, state.styles[state.blocks[-1]["style_id"]]["relative_size"])
