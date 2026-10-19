"""A unique bookmark cannot choose between two equally eligible complete source heading windows."""

import tempfile
import unittest
from pathlib import Path

from .numbered_heading_fixture import fixture


class NumberedHeadingWindowTests(unittest.TestCase):
    def test_duplicate_complete_source_window_refuses_before_skipping_to_later_text(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))

            def move(box):
                return box.model_copy(update={"y0": box.y0 + 42, "y1": box.y1 + 42})

            lines = f.page.lines[:-1]
            clones = [
                item.model_copy(
                    update={
                        "id": item.id + "-duplicate",
                        "box": move(item.box),
                        "glyphs": [g.model_copy(update={"box": move(g.box)}) for g in item.glyphs],
                    }
                )
                for item in lines
            ]
            page = f.page.model_copy(update={"lines": [*lines, *clones]})
            owners = [
                *f.owners[:-1],
                *[
                    owner.model_copy(
                        update={
                            "id": owner.id + "-duplicate",
                            "box": move(owner.box),
                        }
                    )
                    for owner in f.owners[:-1]
                ],
            ]
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                f.resolve(page=page, owners=owners)
