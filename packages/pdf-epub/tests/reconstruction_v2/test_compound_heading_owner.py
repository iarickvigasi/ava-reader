"""Original frame, visible complete source, owner identity and peer envelopes stay mandatory."""

import tempfile
import unittest
from pathlib import Path

from .compound_heading_fixture import fixture
from .test_pdf_links import box


class CompoundHeadingOwnerTests(unittest.TestCase):
    def test_bad_owner_role_identity_and_peer_ownership_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            original = f.owners[0]
            for update in (
                {"kind": "paragraph"},
                {"heading_level": 2},
                {"chapter_start": False},
                {"chapter_role": "frontmatter"},
                {"box": box(21, 10, 110, 44)},
            ):
                with (
                    self.subTest(update=update),
                    self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"),
                ):
                    f.resolve(owners=[original.model_copy(update=update), *f.owners[1:]])
            for peer in (
                original.model_copy(update={"id": "peer"}),
                f.owners[-1].model_copy(update={"box": box(20, 10, 24, 20)}),
            ):
                with (
                    self.subTest(peer=peer.id),
                    self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"),
                ):
                    f.resolve(owners=[*f.owners, peer])

    def test_native_or_excluded_furniture_owner_cannot_use_new_target_proof(self):
        from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
        from ava_pdf_epub.reconstruction_v2.numbered_heading_map import numbered_heading_map

        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            for update in (
                {"native_line_ids": ["ordinal"]},
                {"source_marginal_furniture": True},
                {"method": "native"},
                {"page": 2},
            ):
                item = f.owners[0].model_copy(update=update)
                with self.subTest(update=update):
                    self.assertIsNone(
                        numbered_heading_map(
                            f.reader, f.target, f.page, item, [item, *f.owners[1:]], POLICY
                        )
                    )
