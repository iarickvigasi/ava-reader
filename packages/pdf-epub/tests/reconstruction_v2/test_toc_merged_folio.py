"""Merged source rows keep source authority and exact accepted offsets."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.ocr_glyph_fragments import source_fragments
from ava_pdf_epub.reconstruction_v2.toc_row_layout import toc_row_layout

from .merged_toc_fixture import merged_fixture


class TocMergedFolioTests(unittest.TestCase):
    def test_single_and_wrapped_merged_folios_preserve_all_original_bytes_and_ordinals(self):
        for single in (False, True):
            with self.subTest(single=single), tempfile.TemporaryDirectory() as directory:
                f = merged_fixture(Path(directory), single=single)
                before = [o.model_dump_json() for o in f.owners], f.page.model_dump_json()
                self.assertEqual([("wrapped", 0, len(f.owners[0].text))], f.prove())
                fragments = source_fragments(f.page, f.owners[0])
                layout = toc_row_layout(f.page, fragments, "1")
                line = f.page.lines[1 if single else 2]
                self.assertIs(layout.folio.line, line)
                self.assertEqual(layout.folio.glyphs[0][0], len(line.glyphs) - 1)
                self.assertEqual(
                    before, ([o.model_dump_json() for o in f.owners], f.page.model_dump_json())
                )
                self.assertIsNone(f.prove(policy=None))

    def test_missing_extra_changed_hidden_and_partial_folio_refuse(self):
        for mode in ("missing", "extra", "changed", "hidden", "artifact", "boundary", "reordered"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                f = merged_fixture(Path(directory), single=True)
                page = f.page.model_copy(deep=True)
                line = page.lines[1]
                glyphs = line.glyphs
                if mode == "missing":
                    del glyphs[-1]
                elif mode == "extra":
                    glyphs.append(glyphs[-1])
                elif mode in ("changed", "hidden", "artifact"):
                    update = {
                        "changed": {"text": "2"},
                        "hidden": {"visible": False},
                        "artifact": {"source_artifact": True},
                    }[mode]
                    glyphs[-1] = glyphs[-1].model_copy(update=update)
                elif mode == "boundary":
                    page.lines[1] = line.model_copy(update={"text": line.text[:-2] + "1"})
                elif mode == "reordered":
                    glyphs[-1], glyphs[-2] = glyphs[-2], glyphs[-1]
                self.assertIsNone(f.prove(page=page))
