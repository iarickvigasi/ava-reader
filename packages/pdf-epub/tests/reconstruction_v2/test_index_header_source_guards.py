"""Full visible source glyphs and a repeated physical font/frame remain mandatory."""

import tempfile
import unittest
from pathlib import Path

from .index_header_guard_fixture import guard_case, unchanged


class IndexHeaderSourceGuards(unittest.TestCase):
    def test_hidden_artifact_different_font_and_incomplete_line_preserve_content(self):
        with tempfile.TemporaryDirectory() as directory:
            source, pages, owners = guard_case(Path(directory))
            checkpoint = pages[1]
            page = checkpoint.observation
            header = next(line for line in page.lines if line.text == "General index")
            for fields in [
                {"visible": False},
                {"source_artifact": True},
                {"font": "different-source-font"},
            ]:
                glyphs = [header.glyphs[0].model_copy(update=fields), *header.glyphs[1:]]
                line = header.model_copy(update={"glyphs": glyphs})
                changed = checkpoint.model_copy(
                    update={
                        "observation": page.model_copy(
                            update={
                                "lines": [
                                    line if row.id == header.id else row for row in page.lines
                                ]
                            }
                        )
                    }
                )
                with self.subTest(fields=fields):
                    self.assertTrue(unchanged(source, [pages[0], changed, pages[2]], owners))
            line = header.model_copy(update={"text": header.text + " missing source text"})
            changed = checkpoint.model_copy(
                update={
                    "observation": page.model_copy(
                        update={
                            "lines": [line if row.id == header.id else row for row in page.lines]
                        }
                    )
                }
            )
            self.assertTrue(unchanged(source, [pages[0], changed, pages[2]], owners))

    def test_changed_original_page_frame_cannot_qualify(self):
        with tempfile.TemporaryDirectory() as directory:
            source, pages, owners = guard_case(Path(directory))
            checkpoint = pages[1]
            page = checkpoint.observation.model_copy(update={"width_pt": 347})
            tasks = [
                t.model_copy(update={"region_box": t.region_box.model_copy(update={"x1": 347})})
                for t in checkpoint.tasks
            ]
            changed = checkpoint.model_copy(update={"observation": page, "tasks": tasks})
            self.assertTrue(unchanged(source, [pages[0], changed, pages[2]], owners))
