"""Source action, frame, complete glyph coverage and peer ownership stay mandatory."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.pdf_navigation import NavigationTarget
from ava_pdf_epub.reconstruction_v2.observations import Graphic, RequiredRegion

from .heading_caller_fixture import fixture
from .test_pdf_links import box


class HeadingCallerSafetyTests(unittest.TestCase):
    def test_different_action_frame_partial_source_and_competing_owner_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            self.addCleanup(f.heading.reader.close)
            for update in (
                {"width_pt": 121},
                {"rotation": 90},
                {"risks": ["unreliable_glyph_mapping"]},
                {"graphics": [Graphic(kind="vector", box=f.caller)]},
                {"required_regions": [RequiredRegion(kind="appearance", box=f.caller)]},
            ):
                with self.subTest(update=list(update)), self.assertRaises(ValueError):
                    f.prove(page=f.heading.page.model_copy(update=update))
            with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                f.prove(target=NavigationTarget(page=1, left=0, top=90, fit="/XYZ"))
            with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                f.prove(caller=box(6, 10, 84, 46))
            with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                f.prove(
                    owners=[
                        *f.heading.owners,
                        f.heading.owners[0].model_copy(
                            update={"id": "other", "kind": "figure", "text": ""}
                        ),
                    ]
                )
            page = f.heading.page.model_copy(deep=True)
            page.lines[0].glyphs[0] = page.lines[0].glyphs[0].model_copy(update={"visible": False})
            with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                f.prove(page=page)
