"""Original frame, visible complete source, owner identity and peer envelopes stay mandatory."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.observations import Graphic, RequiredRegion

from .compound_heading_fixture import fixture
from .test_pdf_links import box


class CompoundHeadingSafetyTests(unittest.TestCase):
    def test_bad_glyph_frame_risk_region_and_duplicate_line_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            for mode in (
                "hidden",
                "missing",
                "artifact",
                "face",
                "size",
                "bold",
                "duplicate",
                "frame",
                "risk",
                "graphic",
                "region",
                "partial",
            ):
                page = f.page.model_copy(deep=True)
                glyph = page.lines[1].glyphs[0]
                changes = {
                    "hidden": {"visible": False},
                    "artifact": {"source_artifact": True},
                    "face": {"font": "other"},
                    "size": {"size": 10.01},
                }
                if mode in changes:
                    page.lines[1].glyphs[0] = glyph.model_copy(update=changes[mode])
                elif mode == "missing":
                    page.lines[1].glyphs.pop(0)
                elif mode == "bold":
                    page.lines[1] = page.lines[1].model_copy(
                        update={"style": page.lines[1].style.model_copy(update={"bold": False})}
                    )
                elif mode == "duplicate":
                    page.lines.append(page.lines[0])
                elif mode == "frame":
                    page = page.model_copy(update={"width_pt": 121})
                elif mode == "risk":
                    page.risks.append("unreliable_glyph_mapping")
                elif mode == "graphic":
                    page.graphics.append(Graphic(kind="vector", box=f.owners[0].box))
                elif mode == "region":
                    page.required_regions.append(
                        RequiredRegion(kind="appearance", box=f.owners[0].box)
                    )
                else:
                    page.lines[1].glyphs.append(
                        glyph.model_copy(update={"text": "!", "box": box(111, 10, 115, 20)})
                    )
                    page.lines[1] = page.lines[1].model_copy(
                        update={"text": page.lines[1].text + "!"}
                    )
                with self.subTest(mode=mode), self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                    f.resolve(page=page)
