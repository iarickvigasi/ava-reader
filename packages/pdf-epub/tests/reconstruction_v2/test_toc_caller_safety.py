"""TOC authority never waives literal Unicode, complete glyphs, owners or source-frame safety."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.observations import Graphic, RequiredRegion

from .test_pdf_links import box
from .toc_caller_fixture import fixture


class TocCallerSafetyTests(unittest.TestCase):
    def test_changed_omitted_extra_reordered_or_lookalike_text_never_maps(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            original = f.owners[0]
            for text in (
                original.text.replace("–", "—"),
                original.text.replace("Alpha", "Alphа"),
                original.text.replace("continued", ""),
                original.text + " Extra",
                original.text.replace("beta", "beta!"),
                original.text.replace("1 Alpha", "Alpha 1"),
                original.text.replace("continued", "contin ued"),
            ):
                with self.subTest(text=text):
                    owners = [original.model_copy(update={"text": text}), *f.owners[1:]]
                    if "contin ued" in text:
                        # Whitespace may differ; the unchanged accepted spelling is retained.
                        self.assertEqual([("wrapped", 0, len(text))], f.prove(owners=owners))
                    else:
                        self.assertIsNone(f.prove(owners=owners))
            self.assertIsNone(
                f.prove(owners=[*f.owners, original.model_copy(update={"id": "peer"})])
            )
            for update in (
                {"page": 2},
                {"kind": "figure"},
                {"native_line_ids": ["first"]},
                {"source_marginal_furniture": True},
                {"box": box(25, 20, 108, 42)},
            ):
                with self.subTest(update=update):
                    self.assertIsNone(
                        f.prove(owners=[original.model_copy(update=update), *f.owners[1:]])
                    )

    def test_hidden_artifact_duplicate_missing_extra_and_partial_glyphs_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            for mode in ("hidden", "artifact", "missing", "duplicate", "extra", "glyph-text"):
                page = f.page.model_copy(deep=True)
                glyphs = page.lines[1].glyphs
                if mode in ("hidden", "artifact"):
                    glyphs[1] = glyphs[1].model_copy(
                        update={"visible": False} if mode == "hidden" else {"source_artifact": True}
                    )
                elif mode == "missing":
                    del glyphs[1]
                elif mode == "duplicate":
                    page.lines.append(page.lines[1].model_copy(update={"id": "duplicate"}))
                elif mode == "extra":
                    from .test_ocr_link_context import line

                    page.lines.append(line("extra", "X", 90, 20))
                elif mode == "glyph-text":
                    glyphs[1] = glyphs[1].model_copy(update={"text": "А"})
                with self.subTest(mode=mode):
                    self.assertIsNone(f.prove(page=page))
            self.assertIsNone(f.prove(caller=box(6, 20, 108, 42)))

    def test_risks_regions_graphics_rotations_and_mismatched_frame_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            for update in (
                {"risks": ["unreliable_glyph_mapping"]},
                {"rotation": 90},
                {"width_pt": 121},
                {"required_regions": [RequiredRegion(kind="appearance", box=f.caller)]},
                {"graphics": [Graphic(kind="vector", box=f.caller)]},
            ):
                with self.subTest(update=update):
                    self.assertIsNone(f.prove(page=f.page.model_copy(update=update)))
