"""The numbered-heading exception retains whole-owner exact glyph and frame protection."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.observations import Graphic, RequiredRegion

from .numbered_heading_fixture import fixture
from .test_pdf_links import box


class NumberedHeadingSafetyTests(unittest.TestCase):
    def test_wrong_omitted_extra_or_lookalike_characters_and_competing_owners_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            original = f.owners[0]
            cases = [
                [original.model_copy(update={"text": text}), *f.owners[1:]]
                for text in (
                    original.text.replace("–", "—"),
                    original.text.replace("Rivers", "Rіvers"),
                    original.text.replace("roads", ""),
                    original.text + " extra",
                )
            ]
            cases.append([*f.owners, original.model_copy(update={"id": "peer"})])
            for owners in cases:
                with (
                    self.subTest(owners=len(owners)),
                    self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"),
                ):
                    f.resolve(owners=owners)

    def test_hidden_missing_artifact_unknown_face_or_size_and_unsafe_frame_refuse(self):
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
            ):
                page = f.page.model_copy(deep=True)
                glyph = page.lines[0].glyphs[0]
                if mode in ("hidden", "artifact", "face", "size"):
                    update = {
                        "hidden": {"visible": False},
                        "artifact": {"source_artifact": True},
                        "face": {"font": "other"},
                        "size": {"size": glyph.size + 0.01},
                    }[mode]
                    page.lines[0].glyphs[0] = glyph.model_copy(update=update)
                elif mode == "missing":
                    page.lines[0].glyphs.clear()
                elif mode == "bold":
                    page.lines[0] = page.lines[0].model_copy(
                        update={"style": page.lines[0].style.model_copy(update={"bold": False})}
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
                with self.subTest(mode=mode), self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                    f.resolve(page=page)
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                f.resolve(
                    owners=[
                        f.owners[0].model_copy(update={"box": box(22, 10, 84, 32)}),
                        *f.owners[1:],
                    ]
                )
