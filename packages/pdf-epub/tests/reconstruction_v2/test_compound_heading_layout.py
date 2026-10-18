"""Smaller consecutive bold-italic subtitle rows need explicit bounded layout evidence."""

import tempfile
import unittest
from pathlib import Path

from .compound_heading_fixture import fixture, move_line
from .test_ocr_link_context import line


class CompoundHeadingLayoutTests(unittest.TestCase):
    def test_subtitle_can_extend_past_principal_right_edge_within_its_exclusive_owner(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            self.assertGreater(f.page.lines[3].box.x1, f.page.lines[1].box.x1)
            self.assertEqual(("chapter", 0), f.resolve())

    def test_wrong_subtitle_face_size_style_gap_indent_order_or_intervening_ink_refuses(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            for mode in (
                "face",
                "mixed_face",
                "size",
                "mixed_size",
                "bold",
                "italic",
                "indent",
                "gap",
                "above",
                "reorder",
                "intervening",
            ):
                page = f.page.model_copy(deep=True)
                sub = page.lines[3]
                if mode in ("face", "mixed_face", "size", "mixed_size"):
                    fields = {
                        "face": {"font": ""},
                        "mixed_face": {"font": "other"},
                        "size": {"size": 10},
                        "mixed_size": {"size": 7},
                    }[mode]
                    sub = sub.model_copy(
                        update={
                            "glyphs": [
                                g.model_copy(update=fields)
                                if not mode.startswith("mixed") or i == 0
                                else g
                                for i, g in enumerate(sub.glyphs)
                            ]
                        }
                    )
                elif mode in ("bold", "italic"):
                    sub = sub.model_copy(
                        update={"style": sub.style.model_copy(update={mode: False})}
                    )
                elif mode in ("indent", "gap", "above"):
                    sub = move_line(
                        sub,
                        dx=20 if mode == "indent" else 0,
                        dy=30 if mode == "gap" else -20 if mode == "above" else 0,
                    )
                page.lines[3] = sub
                if mode == "reorder":
                    page.lines[2:4] = reversed(page.lines[2:4])
                elif mode == "intervening":
                    page.lines.insert(3, line("unowned", "X", 112, 33))
                with self.subTest(mode=mode), self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                    f.resolve(page=page)
