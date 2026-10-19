"""Regional visibility never waives literal text, ownership, source frames or geometry."""

import tempfile
import unittest
from pathlib import Path

from pypdf.generic import NameObject, NumberObject

from ava_pdf_epub.reconstruction_v2.observations import Graphic, RequiredRegion

from .test_pdf_links import box
from .visible_target_fixture import fixture


class VisibleTargetSafetyTests(unittest.TestCase):
    def test_other_owner_region_and_frame_guards_stay_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            self.addCleanup(f.reader.close)
            for update in (
                {"text": "wrong54,"},
                {"method": "native"},
                {"kind": "figure"},
                {"source_marginal_furniture": True},
                {"native_line_ids": ["joined"]},
                {"box": box(4, 20, 32, 30)},
            ):
                with (
                    self.subTest(update=update),
                    self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"),
                ):
                    f.prove(owners=[f.owners[0].model_copy(update=update), f.owners[1]])
            for update in (
                {"rotation": 90},
                {"width_pt": 101},
                {"graphics": [Graphic(kind="image", box=f.owners[0].box)]},
                {"required_regions": [RequiredRegion(kind="text", box=f.owners[0].box)]},
                {"lines": [*f.page.lines, f.page.lines[0]]},
            ):
                with self.subTest(update=list(update)), self.assertRaises(ValueError):
                    f.prove(page=f.page.model_copy(update=update))
            peer = f.owners[0].model_copy(update={"id": "empty", "kind": "figure", "text": ""})
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                f.prove(owners=[*f.owners, peer])
            f.reader.pages[0][NameObject("/UserUnit")] = NumberObject(2)
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                f.prove()
