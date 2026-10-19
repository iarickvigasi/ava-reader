"""A matching outline cannot resolve competing windows or skip earlier covered ink."""

import tempfile
import unittest
from pathlib import Path

from .compound_heading_fixture import fixture, move_line
from .test_ocr_link_context import line
from .test_pdf_links import box, segment


class CompoundHeadingWindowTests(unittest.TestCase):
    def test_duplicate_complete_windows_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            clones = [
                move_line(item, dy=46).model_copy(update={"id": item.id + "-copy"})
                for item in f.page.lines[:4]
            ]
            page = f.page.model_copy(update={"lines": [*f.page.lines[:4], *clones]})
            duplicate = f.owners[0].model_copy(update={"id": "copy", "box": box(4, 56, 110, 90)})
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                f.resolve(page=page, owners=[f.owners[0], duplicate])

    def test_earlier_covered_unprovable_ink_is_never_skipped(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            earlier = line("first-ink", "printed", 4, 0)
            peer = segment("first", "different").model_copy(update={"box": earlier.box})
            page = f.page.model_copy(update={"lines": [earlier, *f.page.lines]})
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                f.resolve(page=page, owners=[peer, *f.owners])

    def test_subtitle_in_a_different_owner_cannot_complete_this_new_route(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            main = f.owners[0].model_copy(
                update={"text": "5 fires and flights\nat dusk –", "box": box(4, 10, 84, 32)}
            )
            subtitle = segment("subtitle", "with a flea and a bandit", 2).model_copy(
                update={"box": f.page.lines[3].box}
            )
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                f.resolve(owners=[main, subtitle, *f.owners[1:]])
