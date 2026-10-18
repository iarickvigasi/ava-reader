"""Every invisible witness and its full source envelope must stay outside the target."""

import tempfile
import unittest
from pathlib import Path

from .test_pdf_links import box
from .visible_target_fixture import fixture


class VisibleTargetWitnessTests(unittest.TestCase):
    def test_one_far_witness_cannot_hide_another_selected_near_or_malformed_witness(self):
        for mode in (
            "selected",
            "same-line",
            "near",
            "glyph-envelope",
            "outside",
            "whitespace",
            "artifact",
        ):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                f = fixture(Path(directory))
                self.addCleanup(f.reader.close)
                page = f.page.model_copy(deep=True)
                hidden = page.lines[-1]
                glyph = hidden.glyphs[0]
                if mode == "selected":
                    page.lines[0].glyphs[0] = (
                        page.lines[0].glyphs[0].model_copy(update={"visible": False})
                    )
                elif mode == "same-line":
                    page.lines[-1] = hidden.model_copy(update={"box": box(0, 20, 32, 80)})
                elif mode == "near":
                    page.lines[-1] = hidden.model_copy(
                        update={
                            "box": box(0, 31, 4, 41),
                            "glyphs": [glyph.model_copy(update={"box": box(0, 31, 4, 41)})],
                        }
                    )
                elif mode == "glyph-envelope":
                    page.lines[-1] = hidden.model_copy(
                        update={"glyphs": [*hidden.glyphs, page.lines[0].glyphs[0]]}
                    )
                elif mode == "outside":
                    page.lines[-1] = hidden.model_copy(
                        update={"glyphs": [glyph.model_copy(update={"box": box(99, 70, 103, 80)})]}
                    )
                else:
                    page.lines[-1] = hidden.model_copy(
                        update={
                            "glyphs": [
                                glyph.model_copy(
                                    update={"text": " "}
                                    if mode == "whitespace"
                                    else {"source_artifact": True}
                                )
                            ]
                        }
                    )
                with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                    f.prove(page=page)
